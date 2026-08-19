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

def replace_text(file_id, page_number, x_pdf, y_pdf_baseline, width_pdf, new_text, font_size=12, color=(0, 0, 0)):
    doc = _open(file_id)
    try:
        page = _page(doc, page_number)
        baseline_y = page.rect.height - y_pdf_baseline
        rect = fitz.Rect(
            max(0, x_pdf - 1), max(0, baseline_y - font_size * 1.05),
            min(page.rect.width, x_pdf + width_pdf + 3),
            min(page.rect.height, baseline_y + font_size * 0.35),
        )
        if rect.is_empty or not page.rect.intersects(rect):
            raise ValueError("La zone de texte est hors de la page")

        # Une vraie rédaction supprime l'ancien contenu, contrairement à un
        # rectangle blanc qui le laissait sélectionnable et recherchable.
        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
        if new_text:
            target = fitz.Rect(rect.x0, rect.y0, max(rect.x1, rect.x0 + width_pdf + 20), rect.y1 + font_size * 0.35)
            result = page.insert_textbox(target, new_text, fontsize=font_size, color=_valid_color(color), align=fitz.TEXT_ALIGN_LEFT)
            if result < 0:
                # Les textes plus longs peuvent dépasser la zone d'origine :
                # on conserve la ligne avec une taille minimale lisible.
                page.insert_text(fitz.Point(x_pdf, baseline_y), new_text, fontsize=max(4, font_size * 0.9), color=_valid_color(color))
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

def merge_pdfs(file_ids: list[str], _output_id: str) -> dict:
    from services.r2_storage import upload_file
    result = fitz.open()
    for fid in file_ids:
        src = _open(fid)
        result.insert_pdf(src)
        src.close()
    new_id = str(uuid.uuid4())
    upload_file(new_id, result.tobytes(garbage=4, deflate=True))
    result.close()
    return {"id": new_id, "name": "merged.pdf"}


# ─── Division ─────────────────────────────────────────────────────────────────

def split_pdf(file_id: str, page_ranges: list[list[int]]) -> list[dict]:
    from services.r2_storage import upload_file
    src_doc = _open(file_id)
    results = []
    for i, (start, end) in enumerate(page_ranges):
        part = fitz.open()
        part.insert_pdf(src_doc, from_page=start, to_page=end)
        new_id = str(uuid.uuid4())
        upload_file(new_id, part.tobytes(garbage=4, deflate=True))
        part.close()
        results.append({"id": new_id, "name": f"part_{i + 1}.pdf"})
    src_doc.close()
    return results


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
    from fastapi.responses import StreamingResponse
    doc = _open(file_id)
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
