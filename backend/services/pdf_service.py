"""
Service PDF — toutes les opérations PyMuPDF
"""
from __future__ import annotations

import base64
import io
import uuid
import zipfile
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image as PILImage


def _open(file_id: str) -> fitz.Document:
    from services.r2_storage import download_file
    content = download_file(file_id)
    return fitz.open(stream=content, filetype="pdf")


def _save(doc: fitz.Document, file_id: str, clean: bool = False) -> None:
    """Sérialise entièrement le document avant de remplacer l'original.

    Les documents sont ouverts depuis un flux mémoire : une sauvegarde incrémentale
    y est fragile et peut produire un PDF illisible selon sa structure d'origine.
    """
    from services.r2_storage import upload_file
    try:
        buf = doc.tobytes(garbage=4 if clean else 3, deflate=True)
    finally:
        doc.close()
    upload_file(file_id, buf)


def _page(doc: fitz.Document, page_number: int) -> fitz.Page:
    if page_number < 0 or page_number >= len(doc):
        raise ValueError(f"Page {page_number + 1} invalide (document de {len(doc)} pages)")
    return doc[page_number]


def _valid_color(color) -> tuple[float, float, float]:
    if len(color) != 3 or any(not 0 <= float(value) <= 1 for value in color):
        raise ValueError("La couleur doit contenir trois valeurs entre 0 et 1")
    return tuple(float(value) for value in color)


# ─── Ajout de texte ───────────────────────────────────────────────────────────

def add_text(file_id, page_number, x, y, text, font_size=12, color=(0, 0, 0)):
    doc = _open(file_id)
    try:
        page = _page(doc, page_number)
        if not page.rect.contains(fitz.Point(x, y)):
            raise ValueError("La position du texte est hors de la page")
        page.insert_text((x, y), text, fontsize=font_size, color=_valid_color(color))
        _save(doc, file_id)
    except Exception:
        if not doc.is_closed:
            doc.close()
        raise


# ─── Remplacement de texte ────────────────────────────────────────────────────
# Bande verticale autour du corps des glyphes (hauteur d'œil / capitales).
# Un rectangle trop haut (ex. 1.05em au-dessus de la ligne de base) recouvre
# les descendantes (j, q, g, p, y) de la ligne supérieure ; trop bas, les
# hampes de la ligne inférieure. La rédaction n'a besoin que d'intersecter
# les glyphes cibles pour les supprimer entièrement.
_LINE_BODY_ASCENDER = 0.78
_LINE_BODY_DESCENDER = 0.10


def _pdfjs_to_pymupdf_y(page: fitz.Page, y_pdf_baseline: float) -> float:
    """PDF.js fournit une origine basse ; PyMuPDF une origine haute."""
    return page.rect.height - y_pdf_baseline


def _page_text_lines(page: fitz.Page) -> list[dict]:
    lines = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type", 0) != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans") or []
            if not spans:
                continue
            origin = spans[0].get("origin")
            if not origin:
                continue
            lines.append({
                "bbox": fitz.Rect(line["bbox"]),
                "baseline": float(origin[1]),
                "spans": spans,
            })
    return lines


def _same_line(baseline_a: float, baseline_b: float, font_size: float) -> bool:
    return abs(baseline_a - baseline_b) <= max(2.0, font_size * 0.4)


def _clip_band_against_neighbors(band: fitz.Rect, baseline_y: float, font_size: float, lines: list[dict]) -> fitz.Rect:
    """Rétrécit la bande pour ne pas recouvrir les glyphes des lignes voisines."""
    y0, y1 = band.y0, band.y1
    for line in lines:
        if _same_line(line["baseline"], baseline_y, font_size):
            continue
        other = line["bbox"]
        if other.x1 < band.x0 or other.x0 > band.x1:
            continue
        if line["baseline"] < baseline_y:
            y0 = max(y0, other.y1)
        else:
            y1 = min(y1, other.y0)
    if y1 - y0 < font_size * 0.12:
        # Interligne trop serré : fine tranche dans le corps, sans fond blanc.
        mid = baseline_y - font_size * 0.35
        half = max(0.6, font_size * 0.08)
        return fitz.Rect(band.x0, mid - half, band.x1, mid + half)
    return fitz.Rect(band.x0, y0, band.x1, y1)


def _body_band(x0: float, x1: float, baseline_y: float, font_size: float) -> fitz.Rect:
    return fitz.Rect(
        x0,
        baseline_y - font_size * _LINE_BODY_ASCENDER,
        x1,
        baseline_y + font_size * _LINE_BODY_DESCENDER,
    )


def _redaction_rects(page: fitz.Page, x_pdf: float, baseline_y: float, width_pdf: float, font_size: float) -> list[tuple[fitz.Rect, bool]]:
    """Rectangles de rédaction (rect, with_fill) limités au corps de la ligne éditée."""
    lines = _page_text_lines(page)
    pad_x0, pad_x1 = x_pdf - 0.6, x_pdf + width_pdf + 1.2
    hits: list[tuple[dict, dict, fitz.Rect]] = []
    for line in lines:
        if not _same_line(line["baseline"], baseline_y, font_size):
            continue
        for span in line["spans"]:
            box = fitz.Rect(span["bbox"])
            if box.x1 >= pad_x0 and box.x0 <= pad_x1:
                hits.append((line, span, box))

    rects: list[tuple[fitz.Rect, bool]] = []
    if hits:
        for _line, span, box in hits:
            size = float(span.get("size") or font_size)
            origin_y = float((span.get("origin") or (0, baseline_y))[1])
            band = _body_band(box.x0 - 0.3, box.x1 + 0.3, origin_y, size)
            clipped = _clip_band_against_neighbors(band, origin_y, size, lines)
            use_fill = clipped.height >= size * 0.12
            rects.append((clipped & page.rect, use_fill))
    else:
        band = _body_band(
            max(page.rect.x0, x_pdf - 1),
            min(page.rect.x1, x_pdf + width_pdf + 3),
            baseline_y,
            font_size,
        )
        clipped = _clip_band_against_neighbors(band, baseline_y, font_size, lines)
        use_fill = clipped.height >= font_size * 0.12
        rects.append((clipped & page.rect, use_fill))
    return [(rect, fill) for rect, fill in rects if not rect.is_empty]


def replace_text(file_id, page_number, x_pdf, y_pdf_baseline, width_pdf, new_text, font_size=12, color=(0, 0, 0)):
    doc = _open(file_id)
    try:
        page = _page(doc, page_number)
        baseline_y = _pdfjs_to_pymupdf_y(page, y_pdf_baseline)
        redact_rects = _redaction_rects(page, x_pdf, baseline_y, width_pdf, font_size)
        if not redact_rects:
            raise ValueError("La zone de texte est hors de la page")

        # Rédaction réelle (le texte n'est plus sélectionnable) mais sur une
        # bande trop basse/haute le fond blanc masquait les descendantes
        # (j, q, g, p, y) ou les hampes des lignes voisines.
        for rect, use_fill in redact_rects:
            page.add_redact_annot(rect, fill=(1, 1, 1) if use_fill else None)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=0)
        if new_text:
            # insert_text à la ligne de base évite qu'un textbox trop haut
            # déborde visuellement sur la ligne suivante.
            page.insert_text(
                fitz.Point(x_pdf, baseline_y),
                new_text,
                fontsize=font_size,
                color=_valid_color(color),
            )
        _save(doc, file_id, clean=True)
    except Exception:
        if not doc.is_closed:
            doc.close()
        raise


# ─── Surlignage ───────────────────────────────────────────────────────────────

def add_highlight(file_id, page_number, quads, color=(1, 1, 0)):
    doc = _open(file_id)
    try:
        page = _page(doc, page_number)
        for rect_coords in quads:
            rect = fitz.Rect(*rect_coords).normalize()
            rect = rect & page.rect
            if rect.is_empty or rect.width < 1 or rect.height < 1:
                raise ValueError("Zone de surlignage invalide")
            annot = page.add_highlight_annot(rect)
            annot.set_colors(stroke=_valid_color(color))
            annot.set_opacity(0.35)
            annot.update()
        _save(doc, file_id)
    except Exception:
        if not doc.is_closed:
            doc.close()
        raise


# ─── Image ────────────────────────────────────────────────────────────────────

def add_image(file_id, page_number, x0, y0, x1, y1, image_bytes):
    doc = _open(file_id)
    try:
        page = _page(doc, page_number)
        rect = fitz.Rect(x0, y0, x1, y1).normalize()
        if rect.is_empty or not page.rect.contains(rect):
            raise ValueError("L'image doit être entièrement placée dans la page")
        # PyMuPDF valide également le véritable format de l'image.
        page.insert_image(rect, stream=image_bytes, keep_proportion=True)
        _save(doc, file_id)
    except Exception:
        if not doc.is_closed:
            doc.close()
        raise


# ─── Signature ────────────────────────────────────────────────────────────────

def add_signature(file_id, page_number, x0, y0, x1, y1, signature_b64):
    add_image(file_id, page_number, x0, y0, x1, y1, base64.b64decode(signature_b64))


# ─── Fusion ───────────────────────────────────────────────────────────────────

def merge_pdfs(file_ids: list[str]) -> dict:
    from services.r2_storage import upload_file
    result = fitz.open()
    try:
        for file_id in file_ids:
            source = _open(file_id)
            try:
                result.insert_pdf(source)
                if len(result) > 500:
                    raise ValueError("La fusion est limitée à 500 pages")
            finally:
                source.close()
        if len(result) == 0:
            raise ValueError("Les documents à combiner sont vides")
        content = result.tobytes(garbage=4, deflate=True)
        new_id = str(uuid.uuid4())
        upload_file(new_id, content)
        return {"id": new_id, "name": "fusion.pdf", "size": len(content), "pages": len(result)}
    finally:
        result.close()


# ─── Division ─────────────────────────────────────────────────────────────────

def split_pdf(file_id: str, page_ranges: list[list[int]], name_prefix: str = "document") -> list[dict]:
    from services.r2_storage import upload_file
    source = _open(file_id)
    results = []
    try:
        for start, end in page_ranges:
            if start < 0 or end < start or end >= len(source):
                raise ValueError(f"Plage {start + 1}–{end + 1} invalide pour un document de {len(source)} pages")
        for index, (start, end) in enumerate(page_ranges):
            part = fitz.open()
            try:
                part.insert_pdf(source, from_page=start, to_page=end)
                content = part.tobytes(garbage=4, deflate=True)
                new_id = str(uuid.uuid4())
                upload_file(new_id, content)
                results.append({
                    "id": new_id,
                    "name": f"{name_prefix}-partie-{index + 1}.pdf"[:255],
                    "size": len(content),
                    "pages": len(part),
                })
            finally:
                part.close()
        return results
    finally:
        source.close()


# ─── Compression ─────────────────────────────────────────────────────────────

def compress_pdf(file_id: str) -> dict:
    from services.r2_storage import download_file, upload_file
    original = download_file(file_id)
    doc = fitz.open(stream=original, filetype="pdf")
    compressed = doc.tobytes(garbage=4, deflate=True, clean=True)
    doc.close()
    upload_file(file_id, compressed)
    ratio = round((1 - len(compressed) / len(original)) * 100, 1)
    return {"original_size": len(original), "compressed_size": len(compressed), "ratio": ratio}


# ─── Export images ────────────────────────────────────────────────────────────

def export_images(file_id: str) -> dict:
    doc = _open(file_id)
    if len(doc) > 100:
        doc.close()
        raise ValueError("L'export d'images est limité à 100 pages")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=150)
            zf.writestr(f"page_{i + 1}.png", pix.tobytes("png"))
    page_count = len(doc)
    doc.close()
    buf.seek(0)
    # Retourner le ZIP encodé en base64 pour le frontend
    return {"zip_b64": base64.b64encode(buf.read()).decode(), "pages": page_count}


# ─── OCR ─────────────────────────────────────────────────────────────────────

def apply_ocr(file_id: str) -> None:
    import pytesseract
    from services.r2_storage import upload_file
    doc = _open(file_id)
    if len(doc) > 30:
        doc.close()
        raise ValueError("L'OCR est limité à 30 pages dans la version MVP")
    out = fitz.open()
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        img = PILImage.frombytes("RGB", [pix.width, pix.height], pix.samples)
        ocr_pdf_bytes = pytesseract.image_to_pdf_or_hocr(img, extension="pdf")
        ocr_page = fitz.open(stream=ocr_pdf_bytes, filetype="pdf")
        out.insert_pdf(ocr_page)
        ocr_page.close()
    doc.close()
    upload_file(file_id, out.tobytes(garbage=4, deflate=True))
    out.close()


# ─── Métadonnées ──────────────────────────────────────────────────────────────

def _from_pdf_date(pdf_str: str) -> str:
    if not pdf_str:
        return ""
    s = pdf_str.strip()
    if s.startswith("D:"):
        s = s[2:]
    digits = "".join(c for c in s if c.isdigit())
    if len(digits) < 8:
        return ""
    return f"{digits[0:4]}-{digits[4:6]}-{digits[6:8]}T{digits[8:10] if len(digits)>=10 else '00'}:{digits[10:12] if len(digits)>=12 else '00'}"


def _to_pdf_date(iso_str: str) -> str:
    if not iso_str:
        return ""
    digits = "".join(c for c in iso_str if c.isdigit())
    if len(digits) < 8:
        return ""
    y, mo, d = digits[0:4], digits[4:6], digits[6:8]
    h, mi, s = digits[8:10] if len(digits)>=10 else "00", digits[10:12] if len(digits)>=12 else "00", digits[12:14] if len(digits)>=14 else "00"
    return f"D:{y}{mo}{d}{h}{mi}{s}+00'00'"


def get_metadata(file_id: str) -> dict:
    doc = _open(file_id)
    raw = doc.metadata
    doc.close()
    return {
        "title": raw.get("title", ""), "author": raw.get("author", ""),
        "subject": raw.get("subject", ""), "keywords": raw.get("keywords", ""),
        "creation_date": _from_pdf_date(raw.get("creationDate", "")),
        "mod_date": _from_pdf_date(raw.get("modDate", "")),
    }


def set_metadata(file_id: str, metadata: dict) -> None:
    doc = _open(file_id)
    existing = doc.metadata
    doc.set_metadata({
        "title": metadata.get("title", existing.get("title", "")),
        "author": metadata.get("author", existing.get("author", "")),
        "subject": metadata.get("subject", existing.get("subject", "")),
        "keywords": metadata.get("keywords", existing.get("keywords", "")),
        "creationDate": _to_pdf_date(metadata.get("creation_date", "")) or existing.get("creationDate", ""),
        "modDate": _to_pdf_date(metadata.get("mod_date", "")) or existing.get("modDate", ""),
        "creator": existing.get("creator", ""), "producer": existing.get("producer", ""),
    })
    _save(doc, file_id, clean=True)


# ─── Rotation de pages ────────────────────────────────────────────────────────

def rotate_page(file_id: str, page_number: int, degrees: int) -> None:
    rotate_pages(file_id, [page_number], degrees)


def rotate_pages(file_id: str, page_numbers: list[int], degrees: int) -> None:
    """Pivote plusieurs pages relativement à leur orientation actuelle."""
    doc = _open(file_id)
    try:
        if not page_numbers:
            raise ValueError("Aucune page sélectionnée")
        for page_number in set(page_numbers):
            page = _page(doc, page_number)
            page.set_rotation((page.rotation + degrees) % 360)
        _save(doc, file_id, clean=True)
    except Exception:
        if not doc.is_closed:
            doc.close()
        raise


def rotate_all_pages(file_id: str, degrees: int) -> None:
    doc = _open(file_id)
    try:
        for page in doc:
            page.set_rotation((page.rotation + degrees) % 360)
        _save(doc, file_id, clean=True)
    except Exception:
        if not doc.is_closed:
            doc.close()
        raise


# ─── Suppression de pages ─────────────────────────────────────────────────────

def delete_pages(file_id: str, page_indices: list[int]) -> int:
    """
    Delete specified pages from the PDF.
    
    Args:
        file_id: The PDF file ID
        page_indices: List of 0-based page indices to delete
    
    Returns:
        Number of remaining pages
    """
    doc = _open(file_id)
    total_pages = len(doc)
    
    # Validate indices
    for idx in page_indices:
        if idx < 0 or idx >= total_pages:
            doc.close()
            raise ValueError(f"Page {idx + 1} invalide (document a {total_pages} pages)")
    
    # Remove duplicates and sort in reverse order
    unique_indices = sorted(set(page_indices), reverse=True)
    
    # Check if we're trying to delete all pages
    if len(unique_indices) >= total_pages:
        doc.close()
        raise ValueError("Impossible de supprimer toutes les pages du document")
    
    # Delete pages in reverse order to maintain correct indices
    for idx in unique_indices:
        doc.delete_page(idx)
    
    remaining = len(doc)
    _save(doc, file_id, clean=True)
    
    return remaining


# ─── Réorganisation de pages ──────────────────────────────────────────────────

def reorder_pages(file_id: str, new_order: list[int]) -> None:
    """
    Reorder pages in the PDF according to new_order.
    
    Args:
        file_id: The PDF file ID
        new_order: List of 0-based page indices in the desired order
    
    Raises:
        ValueError: If the order is invalid or incomplete
    """
    doc = _open(file_id)
    total_pages = len(doc)
    
    # Validate new_order
    if len(new_order) != total_pages:
        doc.close()
        raise ValueError(
            f"Ordre incomplet: {len(new_order)} pages fournies, {total_pages} attendues"
        )
    
    # Check for valid indices and no duplicates
    try:
        sorted_indices = sorted(new_order)
        if sorted_indices != list(range(total_pages)):
            raise ValueError("Indices invalides ou dupliqués dans new_order")
    except (TypeError, ValueError) as e:
        doc.close()
        raise ValueError(f"Ordre invalide: {e}")
    
    # Create a new PDF with pages in the specified order
    from services.r2_storage import upload_file
    
    new_doc = fitz.open()
    for idx in new_order:
        new_doc.insert_pdf(doc, from_page=idx, to_page=idx)
    
    # Save the reordered document
    upload_file(file_id, new_doc.tobytes(garbage=4, deflate=True))
    doc.close()
    new_doc.close()
