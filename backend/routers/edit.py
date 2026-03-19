from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import pdf_service

router = APIRouter()


class AddTextRequest(BaseModel):
    page: int = 0
    x: float
    y: float
    text: str
    font_size: float = 12
    color: list[float] = [0, 0, 0]  # RGB 0-1


class AddImageRequest(BaseModel):
    page: int = 0
    x0: float
    y0: float
    x1: float
    y1: float
    image_b64: str  # base64 de l'image


@router.post("/{file_id}/add-text")
def add_text(file_id: str, body: AddTextRequest):
    try:
        pdf_service.add_text(
            file_id,
            body.page,
            body.x,
            body.y,
            body.text,
            body.font_size,
            tuple(body.color),
        )
        return {"message": "Texte ajouté"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/add-image")
def add_image(file_id: str, body: AddImageRequest):
    import base64
    try:
        image_bytes = base64.b64decode(body.image_b64)
        pdf_service.add_image(
            file_id,
            body.page,
            body.x0,
            body.y0,
            body.x1,
            body.y1,
            image_bytes,
        )
        return {"message": "Image insérée"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ReplaceTextRequest(BaseModel):
    page: int = 0
    x_pdf: float
    y_pdf_baseline: float
    width_pdf: float
    new_text: str
    font_size: float = 12
    color: list[float] = [0, 0, 0]


@router.post("/{file_id}/replace-text")
def replace_text(file_id: str, body: ReplaceTextRequest):
    try:
        pdf_service.replace_text(
            file_id,
            body.page,
            body.x_pdf,
            body.y_pdf_baseline,
            body.width_pdf,
            body.new_text,
            body.font_size,
            tuple(body.color),
        )
        return {"message": "Texte remplacé"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
