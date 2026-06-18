from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth import require_credit
from services import pdf_service

router = APIRouter()


class SignRequest(BaseModel):
    page: int = 0
    x0: float = 50
    y0: float = 700
    x1: float = 250
    y1: float = 760
    signature_b64: str


@router.post("/{file_id}/sign")
def sign(file_id: str, body: SignRequest, user=Depends(require_credit)):
    try:
        pdf_service.add_signature(file_id, body.page, body.x0, body.y0, body.x1, body.y1, body.signature_b64)
        return {"message": "Signature apposée"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
