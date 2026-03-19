from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import pdf_service

router = APIRouter()


class MergeRequest(BaseModel):
    file_ids: list[str]  # liste des IDs à fusionner dans l'ordre


class SplitRequest(BaseModel):
    page_ranges: list[list[int]]  # ex: [[0, 2], [3, 5]]


@router.post("/merge")
def merge(body: MergeRequest):
    if len(body.file_ids) < 2:
        raise HTTPException(status_code=400, detail="Au moins 2 fichiers requis")
    try:
        result = pdf_service.merge_pdfs(body.file_ids, "")
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files/{file_id}/split")
def split(file_id: str, body: SplitRequest):
    if not body.page_ranges:
        raise HTTPException(status_code=400, detail="Au moins une plage de pages requise")
    try:
        results = pdf_service.split_pdf(file_id, body.page_ranges)
        return results
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
