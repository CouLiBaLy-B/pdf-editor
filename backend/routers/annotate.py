from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import pdf_service

router = APIRouter()


class HighlightRequest(BaseModel):
    page: int = 0
    quads: list[list[float]]  # liste de [x0, y0, x1, y1]
    color: list[float] = [1, 1, 0]  # jaune par défaut


@router.post("/{file_id}/highlight")
def highlight(file_id: str, body: HighlightRequest):
    try:
        pdf_service.add_highlight(
            file_id,
            body.page,
            body.quads,
            tuple(body.color),
        )
        return {"message": "Surlignage ajouté"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
