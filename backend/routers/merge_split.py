from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth import require_credit, get_current_user
from services import pdf_service

router = APIRouter()


class MergeRequest(BaseModel):
    file_ids: list[str]


class SplitRequest(BaseModel):
    page_ranges: list[list[int]]


@router.post("/merge")
def merge(body: MergeRequest, user=Depends(require_credit)):
    if len(body.file_ids) < 2:
        raise HTTPException(status_code=400, detail="Au moins 2 fichiers requis")
    try:
        return pdf_service.merge_pdfs(body.file_ids, "")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files/{file_id}/split")
def split(file_id: str, body: SplitRequest, user=Depends(require_credit)):
    if not body.page_ranges:
        raise HTTPException(status_code=400, detail="Au moins une plage de pages requise")
    try:
        return pdf_service.split_pdf(file_id, body.page_ranges)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
