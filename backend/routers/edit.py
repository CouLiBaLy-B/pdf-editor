from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import PDFFile, get_db
from auth import require_credit, get_current_user
from services import pdf_service

router = APIRouter()


class AddTextRequest(BaseModel):
    page: int = 0
    x: float
    y: float
    text: str
    font_size: float = 12
    color: list[float] = [0, 0, 0]


class AddImageRequest(BaseModel):
    page: int = 0
    x0: float
    y0: float
    x1: float
    y1: float
    image_b64: str


class ReplaceTextRequest(BaseModel):
    page: int = 0
    x_pdf: float
    y_pdf_baseline: float
    width_pdf: float
    new_text: str
    font_size: float = 12
    color: list[float] = [0, 0, 0]


class MetadataRequest(BaseModel):
    title: str = ""
    author: str = ""
    subject: str = ""
    keywords: str = ""
    creation_date: str = ""
    mod_date: str = ""


@router.post("/{file_id}/add-text")
def add_text(file_id: str, body: AddTextRequest, user=Depends(require_credit)):
    try:
        pdf_service.add_text(file_id, body.page, body.x, body.y, body.text, body.font_size, tuple(body.color))
        return {"message": "Texte ajouté"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/add-image")
def add_image(file_id: str, body: AddImageRequest, user=Depends(require_credit)):
    import base64
    try:
        pdf_service.add_image(file_id, body.page, body.x0, body.y0, body.x1, body.y1, base64.b64decode(body.image_b64))
        return {"message": "Image insérée"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/replace-text")
def replace_text(file_id: str, body: ReplaceTextRequest, user=Depends(require_credit)):
    try:
        pdf_service.replace_text(file_id, body.page, body.x_pdf, body.y_pdf_baseline, body.width_pdf, body.new_text, body.font_size, tuple(body.color))
        return {"message": "Texte remplacé"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{file_id}/metadata")
def get_metadata(file_id: str, user=Depends(get_current_user)):
    try:
        return pdf_service.get_metadata(file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/metadata")
def update_metadata(file_id: str, body: MetadataRequest, user=Depends(require_credit)):
    try:
        pdf_service.set_metadata(file_id, body.model_dump())
        return {"message": "Métadonnées mises à jour"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/compress")
def compress(file_id: str, db: Session = Depends(get_db), user=Depends(require_credit)):
    try:
        result = pdf_service.compress_pdf(file_id)
        f = db.query(PDFFile).filter(PDFFile.id == file_id).first()
        if f:
            f.size_bytes = result["compressed_size"]
            db.commit()
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/export-images")
def export_images(file_id: str, user=Depends(require_credit)):
    try:
        return pdf_service.export_images(file_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/ocr")
def ocr(file_id: str, user=Depends(require_credit)):
    try:
        pdf_service.apply_ocr(file_id)
        return {"message": "OCR appliqué"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
