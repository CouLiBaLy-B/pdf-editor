from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import PDFFile, get_db
from auth import require_credit, get_current_user
from services import pdf_service

router = APIRouter()


class RotatePageRequest(BaseModel):
    page: int  # 0-based page index
    degrees: int = 90  # 90, 180, or 270


class RotateAllPagesRequest(BaseModel):
    degrees: int = 90  # 90, 180, or 270


class DeletePagesRequest(BaseModel):
    pages: list[int]  # List of 0-based page indices


class ReorderPagesRequest(BaseModel):
    new_order: list[int]  # New order of page indices (0-based)


@router.post("/{file_id}/rotate-page")
def rotate_page(
    file_id: str,
    body: RotatePageRequest,
    db: Session = Depends(get_db),
    user=Depends(require_credit)
):
    """Rotate a single page by 90, 180, or 270 degrees."""
    if body.degrees not in [90, 180, 270]:
        raise HTTPException(
            status_code=400,
            detail="L'angle doit être 90, 180 ou 270 degrés"
        )
    
    # Verify file ownership
    f = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    
    try:
        pdf_service.rotate_page(file_id, body.page, body.degrees)
        return {"message": f"Page {body.page + 1} pivotée de {body.degrees}°"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/rotate-all")
def rotate_all_pages(
    file_id: str,
    body: RotateAllPagesRequest,
    db: Session = Depends(get_db),
    user=Depends(require_credit)
):
    """Rotate all pages by the same angle."""
    if body.degrees not in [90, 180, 270]:
        raise HTTPException(
            status_code=400,
            detail="L'angle doit être 90, 180 ou 270 degrés"
        )
    
    # Verify file ownership
    f = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    
    try:
        pdf_service.rotate_all_pages(file_id, body.degrees)
        return {"message": f"Toutes les pages pivotées de {body.degrees}°"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/delete-pages")
def delete_pages(
    file_id: str,
    body: DeletePagesRequest,
    db: Session = Depends(get_db),
    user=Depends(require_credit)
):
    """Delete specified pages from the PDF."""
    if not body.pages:
        raise HTTPException(status_code=400, detail="Aucune page spécifiée")
    
    if len(body.pages) < 1:
        raise HTTPException(status_code=400, detail="Au moins une page requise")
    
    # Verify file ownership
    f = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    
    try:
        remaining = pdf_service.delete_pages(file_id, body.pages)
        return {
            "message": f"{len(body.pages)} page(s) supprimée(s)",
            "remaining_pages": remaining
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{file_id}/reorder-pages")
def reorder_pages(
    file_id: str,
    body: ReorderPagesRequest,
    db: Session = Depends(get_db),
    user=Depends(require_credit)
):
    """Reorder pages in the PDF according to new_order list."""
    if not body.new_order:
        raise HTTPException(status_code=400, detail="Aucun ordre spécifié")
    
    # Verify file ownership
    f = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    
    try:
        pdf_service.reorder_pages(file_id, body.new_order)
        return {"message": "Pages réordonnées avec succès"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
