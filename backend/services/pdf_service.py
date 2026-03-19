"""
Service PDF — toutes les opérations PyMuPDF
"""
from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image as PILImage


def _open(file_id: str) -> tuple[fitz.Document, Path]:
    from services.storage import get_file_path

    folder = get_file_path(file_id)
    pdf_path = folder / "document.pdf"
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF {file_id} introuvable")
    doc = fitz.open(str(pdf_path))
    return doc, pdf_path


def _save(doc: fitz.Document, path: Path, clean: bool = False) -> None:
    if clean:
        # Impossible d'écrire dans le même fichier en mode non-incrémental :
        # on sérialise en mémoire puis on écrase le fichier.
        buf = doc.tobytes(garbage=4, deflate=True)
        doc.close()
        path.write_bytes(buf)
    else:
        doc.save(str(path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
        doc.close()


# ─── Ajout de texte ───────────────────────────────────────────────────────────

def add_text(
    file_id: str,
    page_number: int,
    x: float,
    y: float,
    text: str,
    font_size: float = 12,
    color: tuple[float, float, float] = (0, 0, 0),
) -> None:
    doc, path = _open(file_id)
    page = doc[page_number]
    page.insert_text(
        (x, y),
        text,
        fontsize=font_size,
        color=color,
    )
    _save(doc, path)


# ─── Remplacement de texte existant ─────────────────────────────────────────

def replace_text(
    file_id: str,
    page_number: int,
    x_pdf: float,
    y_pdf_baseline: float,
    width_pdf: float,
    new_text: str,
    font_size: float = 12,
    color: tuple = (0, 0, 0),
) -> None:
    """
    Efface le texte original (rectangle blanc) puis insère le nouveau texte.
    y_pdf_baseline : y de la baseline en coordonnées PDF.js (origine bas-gauche).
    """
    doc, path = _open(file_id)
    page = doc[page_number]
    page_height = page.rect.height  # hauteur en coords PyMuPDF (origine haut-gauche)

    # Conversion : PDF.js y-up → PyMuPDF y-down
    baseline_y = page_height - y_pdf_baseline

    # Rectangle couvrant le texte original
    rect = fitz.Rect(
        x_pdf - 1,
        baseline_y - font_size * 0.95,
        x_pdf + width_pdf + 4,
        baseline_y + font_size * 0.3,
    )

    # Masquer l'ancien texte avec un rectangle blanc
    page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1))

    # Insérer le nouveau texte
    page.insert_text(
        fitz.Point(x_pdf, baseline_y),
        new_text,
        fontsize=font_size,
        color=color,
    )

    _save(doc, path, clean=True)


# ─── Annotation / Surlignage ──────────────────────────────────────────────────

def add_highlight(
    file_id: str,
    page_number: int,
    quads: list[list[float]],  # liste de [x0,y0,x1,y1]
    color: tuple[float, float, float] = (1, 1, 0),
) -> None:
    doc, path = _open(file_id)
    page = doc[page_number]
    for rect_coords in quads:
        rect = fitz.Rect(*rect_coords)
        annot = page.add_highlight_annot(rect)
        annot.set_colors(stroke=color)
        annot.update()
    _save(doc, path)


# ─── Insertion d'image ────────────────────────────────────────────────────────

def add_image(
    file_id: str,
    page_number: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    image_bytes: bytes,
) -> None:
    doc, path = _open(file_id)
    page = doc[page_number]
    rect = fitz.Rect(x0, y0, x1, y1)
    page.insert_image(rect, stream=image_bytes)
    _save(doc, path)


# ─── Fusion ───────────────────────────────────────────────────────────────────

def merge_pdfs(file_ids: list[str], output_id: str) -> dict:
    from services.storage import get_file_path, UPLOAD_DIR
    import uuid

    result = fitz.open()
    for fid in file_ids:
        p = get_file_path(fid) / "document.pdf"
        src = fitz.open(str(p))
        result.insert_pdf(src)
        src.close()

    new_id = str(uuid.uuid4())
    out_folder = UPLOAD_DIR / new_id
    out_folder.mkdir(parents=True, exist_ok=True)
    out_path = out_folder / "document.pdf"
    result.save(str(out_path))
    result.close()
    (out_folder / "meta.txt").write_text("merged.pdf")

    return {
        "id": new_id,
        "name": "merged.pdf",
        "url": f"/uploads/{new_id}/document.pdf",
    }


# ─── Division ─────────────────────────────────────────────────────────────────

def split_pdf(file_id: str, page_ranges: list[list[int]]) -> list[dict]:
    """
    page_ranges : liste de [start, end] (index 0-based inclusifs)
    Retourne la liste des nouveaux fichiers créés.
    """
    from services.storage import get_file_path, UPLOAD_DIR
    import uuid

    src_doc, _ = _open(file_id)
    results = []

    for i, (start, end) in enumerate(page_ranges):
        new_id = str(uuid.uuid4())
        out_folder = UPLOAD_DIR / new_id
        out_folder.mkdir(parents=True, exist_ok=True)
        out_path = out_folder / "document.pdf"

        part = fitz.open()
        part.insert_pdf(src_doc, from_page=start, to_page=end)
        part.save(str(out_path))
        part.close()

        name = f"part_{i + 1}.pdf"
        (out_folder / "meta.txt").write_text(name)
        results.append({
            "id": new_id,
            "name": name,
            "url": f"/uploads/{new_id}/document.pdf",
        })

    src_doc.close()
    return results


# ─── Signature ────────────────────────────────────────────────────────────────

def add_signature(
    file_id: str,
    page_number: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    signature_b64: str,
) -> None:
    """
    signature_b64 : image PNG encodée en base64 (pureté sans préfixe data:)
    """
    image_bytes = base64.b64decode(signature_b64)
    add_image(file_id, page_number, x0, y0, x1, y1, image_bytes)
