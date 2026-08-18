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
    from services.r2_storage import upload_file
    if clean:
        buf = doc.tobytes(garbage=4, deflate=True)
    else:
        buf = doc.tobytes(incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()
    upload_file(file_id, buf)


# ─── Ajout de texte ───────────────────────────────────────────────────────────

def add_text(file_id, page_number, x, y, text, font_size=12, color=(0, 0, 0)):
    doc = _open(file_id)
    doc[page_number].insert_text((x, y), text, fontsize=font_size, color=color)
    _save(doc, file_id)


# ─── Remplacement de texte ────────────────────────────────────────────────────

def replace_text(file_id, page_number, x_pdf, y_pdf_baseline, width_pdf, new_text, font_size=12, color=(0, 0, 0)):
    doc = _open(file_id)
    page = doc[page_number]
    baseline_y = page.rect.height - y_pdf_baseline
    rect = fitz.Rect(x_pdf - 1, baseline_y - font_size * 0.95, x_pdf + width_pdf + 4, baseline_y + font_size * 0.3)
    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))
    page.insert_text(fitz.Point(x_pdf, baseline_y), new_text, fontsize=font_size, color=color)
    _save(doc, file_id, clean=True)


# ─── Surlignage ───────────────────────────────────────────────────────────────

def add_highlight(file_id, page_number, quads, color=(1, 1, 0)):
    doc = _open(file_id)
    page = doc[page_number]
    for rect_coords in quads:
        annot = page.add_highlight_annot(fitz.Rect(*rect_coords))
        annot.set_colors(stroke=color)
        annot.update()
    _save(doc, file_id)


# ─── Image ────────────────────────────────────────────────────────────────────

def add_image(file_id, page_number, x0, y0, x1, y1, image_bytes):
    doc = _open(file_id)
    doc[page_number].insert_image(fitz.Rect(x0, y0, x1, y1), stream=image_bytes)
    _save(doc, file_id)


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
    """
    Rotate a single page by the specified degrees.
    
    Args:
        file_id: The PDF file ID
        page_number: 0-based page index
        degrees: Rotation angle (90, 180, or 270)
    """
    doc = _open(file_id)
    
    if page_number < 0 or page_number >= len(doc):
        doc.close()
        raise ValueError(f"Page {page_number + 1} invalide (document a {len(doc)} pages)")
    
    page = doc[page_number]
    page.set_rotation(degrees)
    _save(doc, file_id, clean=True)


def rotate_all_pages(file_id: str, degrees: int) -> None:
    """
    Rotate all pages in the PDF by the same angle.
    
    Args:
        file_id: The PDF file ID
        degrees: Rotation angle (90, 180, or 270)
    """
    doc = _open(file_id)
    
    for page in doc:
        page.set_rotation(degrees)
    
    _save(doc, file_id, clean=True)


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
