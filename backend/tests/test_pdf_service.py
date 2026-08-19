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
