"""Helpers partagés par les routes qui modifient un PDF."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import PDFFile, User


def owned_file(db: Session, user: User, file_id: str) -> PDFFile:
    file = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id,
    ).first()
    if not file:
        # Un 404 évite de révéler l'existence d'un fichier d'un autre compte.
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return file


def pdf_error(exc: Exception) -> HTTPException:
    if isinstance(exc, FileNotFoundError):
        return HTTPException(status_code=404, detail="PDF introuvable")
    if isinstance(exc, (ValueError, IndexError)):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail="L'opération PDF a échoué")
