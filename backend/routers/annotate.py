from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth import require_credit
from services import pdf_service

router = APIRouter()


class HighlightRequest(BaseModel):
    page: int = 0
    quads: list[list[float]]
    color: list[float] = [1, 1, 0]


@router.post("/{file_id}/highlight")
def highlight(file_id: str, body: HighlightRequest, user=Depends(require_credit)):
    try:
        pdf_service.add_highlight(file_id, body.page, body.quads, tuple(body.color))
        return {"message": "Surlignage ajouté"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
