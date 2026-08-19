import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import consume_credit, require_available_credit
from database import PDFFile, get_db
from routers.editing_utils import lock_owned_file, pdf_error
from services import pdf_service, r2_storage

router = APIRouter()
logger = logging.getLogger("pdfpro")


def _cleanup_results(results: list[dict]) -> None:
    for result in results:
        try:
            r2_storage.delete_file(result["id"])
        except Exception:
            logger.exception("Failed to clean generated PDF %s", result["id"])


class MergeRequest(BaseModel):
    file_ids: list[str] = Field(min_length=2, max_length=20)


class SplitRequest(BaseModel):
    page_ranges: list[list[int]] = Field(min_length=1, max_length=50)


def _register_results(db: Session, user, results: list[dict]) -> None:
    for result in results:
        db.add(PDFFile(
            id=result["id"],
            name=result["name"],
            size_bytes=result["size"],
            user_id=user.id,
        ))


@router.post("/merge")
def merge(body: MergeRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    # Conserver l'ordre demandé tout en refusant les doublons accidentels.
    if len(set(body.file_ids)) != len(body.file_ids):
        raise HTTPException(status_code=400, detail="Un même fichier ne peut pas être combiné deux fois")
    locked = {file_id: lock_owned_file(db, user, file_id) for file_id in sorted(body.file_ids)}
    result = None
    try:
        result = pdf_service.merge_pdfs(body.file_ids)
        first_file = locked[body.file_ids[0]]
        result["name"] = f"fusion-{first_file.name.rsplit('.', 1)[0]}.pdf"[:255]
        _register_results(db, user, [result])
        consume_credit(db, user, result["id"])
        return {**result, "credits": user.credits}
    except HTTPException:
        if result:
            _cleanup_results([result])
        raise
    except Exception as exc:
        db.rollback()
        if result:
            _cleanup_results([result])
        raise pdf_error(exc) from exc


@router.post("/files/{file_id}/split")
def split(file_id: str, body: SplitRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    source = lock_owned_file(db, user, file_id)
    for page_range in body.page_ranges:
        if len(page_range) != 2 or page_range[0] < 0 or page_range[1] < page_range[0]:
            raise HTTPException(status_code=400, detail="Chaque plage doit contenir un début et une fin valides")
    results = []
    try:
        prefix = source.name.rsplit('.', 1)[0]
        results = pdf_service.split_pdf(file_id, body.page_ranges, prefix)
        _register_results(db, user, results)
        consume_credit(db, user, file_id)
        return {"files": results, "credits": user.credits}
    except HTTPException:
        _cleanup_results(results)
        raise
    except Exception as exc:
        db.rollback()
        _cleanup_results(results)
        raise pdf_error(exc) from exc
