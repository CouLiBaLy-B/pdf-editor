"""Tests de non-régression des opérations d'édition critiques."""
import fitz
import pytest

from services import pdf_service
from services import r2_storage


@pytest.fixture()
def pdf_store(monkeypatch):
    doc = fitz.open()
    for index in range(3):
        page = doc.new_page(width=300, height=400)
        page.insert_text((30, 60), f"Texte page {index + 1}", fontsize=12)
    store = {"document": doc.tobytes()}
    doc.close()

    monkeypatch.setattr(r2_storage, "download_file", lambda file_id: store[file_id])
    monkeypatch.setattr(r2_storage, "upload_file", lambda file_id, content: store.__setitem__(file_id, content))
    return store


def open_stored(store):
    return fitz.open(stream=store["document"], filetype="pdf")


def test_replace_text_redacts_original_content(pdf_store):
    # PDF.js fournit une origine basse : baseline 60 devient 340 sur une page de 400.
    pdf_service.replace_text("document", 0, 30, 340, 80, "Nouveau texte", 12)
    doc = open_stored(pdf_store)
    text = doc[0].get_text()
    assert "Texte page 1" not in text
    assert "Nouveau texte" in text
    doc.close()


def _count_dark_pixels(pix, x0, y0, x1, y1):
    dark = 0
    for y in range(max(0, int(y0)), min(pix.height, int(y1))):
        for x in range(max(0, int(x0)), min(pix.width, int(x1))):
            red, green, blue = pix.pixel(x, y)
            if red < 200 or green < 200 or blue < 200:
                dark += 1
    return dark


def test_replace_text_does_not_mask_neighbor_descenders(pdf_store):
    """Les descendantes (j, q) de la ligne du dessus ne doivent pas être recouvertes."""
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    font_size = 24
    top_y = 90
    # Interligne 1.15em : assez serré pour que l'ancien rectangle 1.05em recouvre les j/q.
    bottom_y = top_y + font_size * 1.15
    page.insert_text((40, top_y), "qqqqjjjjgyp", fontsize=font_size)
    page.insert_text((40, bottom_y), "AAAAAAAAAAA", fontsize=font_size)
    pdf_store["document"] = doc.tobytes()
    doc.close()

    pdf_service.replace_text("document", 0, 40, 400 - bottom_y, 220, "BBBBBBBBBBB", font_size)

    doc = open_stored(pdf_store)
    page = doc[0]
    text = page.get_text()
    assert "qqqqjjjjgyp" in text.replace("\n", "")
    assert "BBBBBBBBBBB" in text
    assert "AAAAAAAAAAA" not in text

    scale = 3
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    # Zone entre la ligne de base du haut et le haut des capitales du bas :
    # c'est là que vivent les descendantes, recouvertes par l'ancien fill blanc.
    descender_top = (top_y + 1) * scale
    descender_bot = (bottom_y - font_size * 0.72) * scale
    dark = _count_dark_pixels(pix, 40 * scale, descender_top, 250 * scale, descender_bot)
    assert dark > 80, f"descendantes masquées ({dark} pixels sombres)"
    doc.close()


def test_replace_text_does_not_mask_neighbor_ascenders(pdf_store):
    """Les hampes de la ligne du dessous ne doivent pas être recouvertes."""
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    font_size = 24
    top_y = 90
    bottom_y = top_y + font_size * 1.15
    page.insert_text((40, top_y), "AAAAAAAAAAA", fontsize=font_size)
    page.insert_text((40, bottom_y), "lllllllllll", fontsize=font_size)
    pdf_store["document"] = doc.tobytes()
    doc.close()

    pdf_service.replace_text("document", 0, 40, 400 - top_y, 220, "BBBBBBBBBBB", font_size)

    doc = open_stored(pdf_store)
    page = doc[0]
    text = page.get_text()
    assert "lllllllllll" in text.replace("\n", "")
    assert "BBBBBBBBBBB" in text
    assert "AAAAAAAAAAA" not in text

    scale = 3
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    cap_top = (bottom_y - font_size * 0.72) * scale
    cap_bot = (bottom_y - font_size * 0.15) * scale
    dark = _count_dark_pixels(pix, 40 * scale, cap_top, 250 * scale, cap_bot)
    assert dark > 80, f"hampes masquées ({dark} pixels sombres)"
    doc.close()


def test_rotations_are_relative_and_batched(pdf_store):
    pdf_service.rotate_pages("document", [0, 2], 90)
    pdf_service.rotate_pages("document", [0], 90)
    doc = open_stored(pdf_store)
    assert [page.rotation for page in doc] == [180, 0, 90]
    doc.close()


def test_delete_and_reorder_pages(pdf_store):
    assert pdf_service.delete_pages("document", [1]) == 2
    pdf_service.reorder_pages("document", [1, 0])
    doc = open_stored(pdf_store)
    assert "page 3" in doc[0].get_text()
    assert "page 1" in doc[1].get_text()
    doc.close()


def test_merge_and_split_return_persistable_metadata(pdf_store):
    pdf_store["second"] = pdf_store["document"]
    merged = pdf_service.merge_pdfs(["document", "second"])
    assert merged["pages"] == 6
    assert merged["size"] == len(pdf_store[merged["id"]])

    parts = pdf_service.split_pdf("document", [[0, 0], [1, 2]], "contrat")
    assert [part["pages"] for part in parts] == [1, 2]
    assert parts[0]["name"] == "contrat-partie-1.pdf"
    assert all(part["size"] == len(pdf_store[part["id"]]) for part in parts)


def test_split_rejects_out_of_bounds_range_before_upload(pdf_store):
    with pytest.raises(ValueError, match="invalide"):
        pdf_service.split_pdf("document", [[0, 3]])
    assert list(pdf_store) == ["document"]


def test_rejects_out_of_page_image(pdf_store):
    with pytest.raises(ValueError, match="entièrement"):
        pdf_service.add_image("document", 0, 290, 390, 350, 450, b"not-needed")
