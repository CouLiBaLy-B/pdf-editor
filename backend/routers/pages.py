from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import consume_credit, require_available_credit
from database import get_db
from routers.editing_utils import lock_owned_file, pdf_error
from services import pdf_service

router = APIRouter()


class RotatePageRequest(BaseModel):
    page: int = Field(ge=0)
    degrees: int = 90


class RotatePagesRequest(BaseModel):
    pages: list[int] = Field(min_length=1)
    degrees: int = 90


class RotateAllPagesRequest(BaseModel):
    degrees: int = 90


class DeletePagesRequest(BaseModel):
    pages: list[int] = Field(min_length=1)


class ReorderPagesRequest(BaseModel):
    new_order: list[int] = Field(min_length=1)


def _validate_degrees(degrees: int):
    if degrees not in (90, 180, 270):
        raise HTTPException(status_code=400, detail="L'angle doit être 90, 180 ou 270 degrés")


def _paid(file_id, user, db, operation, response):
    lock_owned_file(db, user, file_id)
    try:
        result = operation()
    except Exception as exc:
        raise pdf_error(exc) from exc
    consume_credit(db, user, file_id)
    return {**response, "credits": user.credits, "result": result}


@router.post("/{file_id}/rotate-page")
def rotate_page(file_id: str, body: RotatePageRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    _validate_degrees(body.degrees)
    return _paid(file_id, user, db, lambda: pdf_service.rotate_pages(file_id, [body.page], body.degrees),
                 {"message": f"Page {body.page + 1} pivotée de {body.degrees}°"})


@router.post("/{file_id}/rotate-pages")
def rotate_pages(file_id: str, body: RotatePagesRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    _validate_degrees(body.degrees)
    pages = sorted(set(body.pages))
    return _paid(file_id, user, db, lambda: pdf_service.rotate_pages(file_id, pages, body.degrees),
                 {"message": f"{len(pages)} page(s) pivotée(s) de {body.degrees}°"})


@router.post("/{file_id}/rotate-all")
def rotate_all_pages(file_id: str, body: RotateAllPagesRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    _validate_degrees(body.degrees)
    return _paid(file_id, user, db, lambda: pdf_service.rotate_all_pages(file_id, body.degrees),
                 {"message": f"Toutes les pages pivotées de {body.degrees}°"})


@router.post("/{file_id}/delete-pages")
def delete_pages(file_id: str, body: DeletePagesRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    pages = sorted(set(body.pages))
    result = _paid(file_id, user, db, lambda: pdf_service.delete_pages(file_id, pages),
                   {"message": f"{len(pages)} page(s) supprimée(s)"})
    result["remaining_pages"] = result.pop("result")
    return result


@router.post("/{file_id}/reorder-pages")
def reorder_pages(file_id: str, body: ReorderPagesRequest, db: Session = Depends(get_db), user=Depends(require_available_credit)):
    result = _paid(file_id, user, db, lambda: pdf_service.reorder_pages(file_id, body.new_order),
                   {"message": "Pages réordonnées avec succès"})
    result.pop("result", None)
    return result
