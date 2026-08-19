import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import consume_credit, get_current_user, require_available_credit
from database import PDFFile, get_db
from routers.editing_utils import owned_file, pdf_error
from services import pdf_service

router = APIRouter()

Color = list[float]


class AddTextRequest(BaseModel):
    page: int = Field(default=0, ge=0)
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    text: str = Field(min_length=1, max_length=5000)
    font_size: float = Field(default=12, ge=4, le=144)
    color: Color = [0, 0, 0]


class AddImageRequest(BaseModel):
    page: int = Field(default=0, ge=0)
    x0: float = Field(ge=0)
    y0: float = Field(ge=0)
    x1: float = Field(gt=0)
    y1: float = Field(gt=0)
    image_b64: str = Field(min_length=1, max_length=14_000_000)


class ReplaceTextRequest(BaseModel):
    page: int = Field(default=0, ge=0)
    x_pdf: float = Field(ge=0)
    y_pdf_baseline: float = Field(ge=0)
    width_pdf: float = Field(gt=0)
    new_text: str = Field(max_length=5000)
    font_size: float = Field(default=12, ge=4, le=144)
    color: Color = [0, 0, 0]


class MetadataRequest(BaseModel):
    title: str = Field(default="", max_length=512)
    author: str = Field(default="", max_length=512)
    subject: str = Field(default="", max_length=1024)
    keywords: str = Field(default="", max_length=1024)
    creation_date: str = Field(default="", max_length=64)
    mod_date: str = Field(default="", max_length=64)


def _run_paid(file_id: str, user, db: Session, operation, message: str):
    owned_file(db, user, file_id)
    try:
        operation()
    except Exception as exc:
        raise pdf_error(exc) from exc
    consume_credit(db, user, file_id)
    return {"message": message, "credits": user.credits}


@router.post("/{file_id}/add-text")
def add_text(file_id: str, body: AddTextRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    return _run_paid(file_id, user, db, lambda: pdf_service.add_text(
        file_id, body.page, body.x, body.y, body.text, body.font_size, tuple(body.color)
    ), "Texte ajouté")


@router.post("/{file_id}/add-image")
def add_image(file_id: str, body: AddImageRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    if body.x1 <= body.x0 or body.y1 <= body.y0:
        raise HTTPException(status_code=400, detail="La zone de l'image est invalide")
    try:
        image = base64.b64decode(body.image_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Image encodée invalide") from exc
    if len(image) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image trop volumineuse (10 Mo maximum)")
    return _run_paid(file_id, user, db, lambda: pdf_service.add_image(
        file_id, body.page, body.x0, body.y0, body.x1, body.y1, image
    ), "Image insérée")


@router.post("/{file_id}/replace-text")
def replace_text(file_id: str, body: ReplaceTextRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    return _run_paid(file_id, user, db, lambda: pdf_service.replace_text(
        file_id, body.page, body.x_pdf, body.y_pdf_baseline, body.width_pdf,
        body.new_text, body.font_size, tuple(body.color)
    ), "Texte remplacé")


@router.get("/{file_id}/metadata")
def get_metadata(file_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    owned_file(db, user, file_id)
    try:
        return pdf_service.get_metadata(file_id)
    except Exception as exc:
        raise pdf_error(exc) from exc


@router.post("/{file_id}/metadata")
def update_metadata(file_id: str, body: MetadataRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    return _run_paid(file_id, user, db, lambda: pdf_service.set_metadata(file_id, body.model_dump()), "Métadonnées mises à jour")


@router.post("/{file_id}/compress")
def compress(file_id: str, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    owned_file(db, user, file_id)
    try:
        result = pdf_service.compress_pdf(file_id)
    except Exception as exc:
        raise pdf_error(exc) from exc
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    file.size_bytes = result["compressed_size"]
    consume_credit(db, user, file_id)
    return {**result, "credits": user.credits}


@router.post("/{file_id}/export-images")
def export_images(file_id: str, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    owned_file(db, user, file_id)
    try:
        result = pdf_service.export_images(file_id)
    except Exception as exc:
        raise pdf_error(exc) from exc
    consume_credit(db, user, file_id)
    return result


@router.post("/{file_id}/ocr")
def ocr(file_id: str, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    return _run_paid(file_id, user, db, lambda: pdf_service.apply_ocr(file_id), "OCR appliqué")
