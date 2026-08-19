"""Helpers partagés par les routes qui modifient un PDF."""
from fastapi import HTTPException
from sqlalchemy import text
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


def lock_owned_file(db: Session, user: User, file_id: str) -> PDFFile:
    """Verrouille un document jusqu'au commit pour sérialiser ses modifications.

    Le verrou consultatif PostgreSQL fonctionne entre workers et entre réplicas.
    SQLite reste sérialisé par son verrou d'écriture en développement.
    """
    file = owned_file(db, user, file_id)
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:file_id))"), {"file_id": file_id})
    return file


def pdf_error(exc: Exception) -> HTTPException:
    if isinstance(exc, FileNotFoundError):
        return HTTPException(status_code=404, detail="PDF introuvable")
    if isinstance(exc, (ValueError, IndexError)):
        return HTTPException(status_code=400, detail=str(exc))
    return HTTPException(status_code=500, detail="L'opération PDF a échoué")
