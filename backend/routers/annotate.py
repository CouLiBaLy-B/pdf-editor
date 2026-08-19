from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import consume_credit, require_available_credit
from database import get_db
from routers.editing_utils import lock_owned_file, pdf_error
from services import pdf_service

router = APIRouter()


class HighlightRequest(BaseModel):
    page: int = Field(default=0, ge=0)
    quads: list[list[float]] = Field(min_length=1, max_length=100)
    color: list[float] = [1, 0.88, 0.1]


@router.post("/{file_id}/highlight")
def highlight(file_id: str, body: HighlightRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    lock_owned_file(db, user, file_id)
    if any(len(rect) != 4 for rect in body.quads):
        raise HTTPException(status_code=400, detail="Coordonnées de surlignage invalides")
    try:
        pdf_service.add_highlight(file_id, body.page, body.quads, tuple(body.color))
    except Exception as exc:
        raise pdf_error(exc) from exc
    consume_credit(db, user, file_id)
    return {"message": "Surlignage ajouté", "credits": user.credits}
