import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import consume_credit, require_available_credit
from database import get_db
from routers.editing_utils import lock_owned_file, pdf_error
from services import pdf_service

router = APIRouter()


class SignRequest(BaseModel):
    page: int = Field(default=0, ge=0)
    x0: float = Field(ge=0)
    y0: float = Field(ge=0)
    x1: float = Field(gt=0)
    y1: float = Field(gt=0)
    signature_b64: str = Field(min_length=1, max_length=3_000_000)


@router.post("/{file_id}/sign")
def sign(file_id: str, body: SignRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    lock_owned_file(db, user, file_id)
    if body.x1 <= body.x0 or body.y1 <= body.y0:
        raise HTTPException(status_code=400, detail="Zone de signature invalide")
    try:
        signature = base64.b64decode(body.signature_b64, validate=True)
        pdf_service.add_image(file_id, body.page, body.x0, body.y0, body.x1, body.y1, signature)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Signature invalide") from exc
    except Exception as exc:
        raise pdf_error(exc) from exc
    consume_credit(db, user, file_id)
    return {"message": "Signature apposée", "credits": user.credits}
