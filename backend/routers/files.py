import re
import uuid
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
import fitz

from database import PDFFile, get_db
from auth import get_current_user
from services import r2_storage

router = APIRouter()

# Constants
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
PDF_MAGIC_BYTES = b'%PDF'
PDF_EOF_MARKER = b'%%EOF'
MAX_PAGES = 300


def sanitize_filename(filename: str) -> str:
    """
    Sanitize user-provided filename for safe storage.
    
    - Removes path components (prevents path traversal)
    - Removes control characters
    - Replaces dangerous characters
    - Limits length to 255 chars
    - Always ensures .pdf extension
    """
    if not filename:
        return f"document_{uuid.uuid4().hex[:8]}.pdf"
    
    # Extract just the filename (remove any path components)
    name = Path(filename).name
    
    # Remove null bytes and control characters
    name = re.sub(r'[\x00-\x1f\x7f]', '', name)
    
    # Replace potentially dangerous characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    
    # Remove leading/trailing dots, spaces, and underscores
    name = name.strip('. ')
    
    # Limit length
    name = name[:255]
    
    # Ensure non-empty
    if not name or name == '.pdf':
        name = f"document_{uuid.uuid4().hex[:8]}.pdf"
    
    # Toujours normaliser l'extension et conserver une longueur maximale de 255.
    if name.lower().endswith('.pdf'):
        name = name[:-4]
    else:
        name = re.sub(r'\.[^.]+$', '', name)
    name = name[:251].rstrip('. ') or f"document_{uuid.uuid4().hex[:8]}"
    return name + '.pdf'


def validate_pdf_content(content: bytes) -> None:
    """
    Validate that the content is a valid PDF.
    Checks magic bytes and basic structure.
    """
    # Check magic bytes
    if not content[:4] == PDF_MAGIC_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Le fichier n'est pas un PDF valide (signature manquante)"
        )
    
    # Check for EOF marker (basic integrity check)
    # Only check in the last 1KB to avoid scanning large files
    search_start = max(0, len(content) - 1024)
    if PDF_EOF_MARKER not in content[search_start:]:
        raise HTTPException(
            status_code=400,
            detail="Le fichier PDF semble incomplet ou corrompu"
        )

    try:
        document = fitz.open(stream=content, filetype="pdf")
        if document.needs_pass:
            raise HTTPException(status_code=400, detail="Les PDF protégés par mot de passe ne sont pas pris en charge")
        if len(document) == 0:
            raise HTTPException(status_code=400, detail="Le PDF ne contient aucune page")
        if len(document) > MAX_PAGES:
            raise HTTPException(status_code=400, detail=f"Le PDF dépasse la limite de {MAX_PAGES} pages")
        document.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Le fichier PDF est corrompu ou non pris en charge") from exc


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # Validate extension first (before reading content)
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Seuls les fichiers PDF sont acceptés"
        )
    
    # Lire par blocs afin de couper la requête avant qu'un fichier malveillant
    # ne monopolise la mémoire du processus.
    chunks = []
    total_size = 0
    while chunk := await file.read(1024 * 1024):
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Fichier trop volumineux. Maximum: {MAX_FILE_SIZE // (1024 * 1024)} MB"
            )
        chunks.append(chunk)
    content = b"".join(chunks)
    
    # Validate PDF magic bytes and structure
    try:
        validate_pdf_content(content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Impossible de valider le fichier PDF"
        )
    
    # Generate file ID and sanitize filename
    file_id = str(uuid.uuid4())
    safe_name = sanitize_filename(file.filename)
    
    # Stockage et enregistrement compensés : aucun objet orphelin si la base échoue.
    r2_storage.upload_file(file_id, content)
    try:
        db_file = PDFFile(
            id=file_id,
            name=safe_name,
            size_bytes=len(content),
            user_id=user.id,
        )
        db.add(db_file)
        db.commit()
    except Exception:
        db.rollback()
        r2_storage.delete_file(file_id)
        raise
    
    return {
        "id": file_id,
        "name": safe_name,
        "size": len(content),
        "url": f"/api/files/{file_id}/download"
    }


@router.get("/")
def list_files(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return [
        {
            "id": f.id,
            "name": f.name,
            "url": f"/api/files/{f.id}/download",
            "size": f.size_bytes
        }
        for f in user.files
    ]


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    f = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id
    ).first()
    
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    
    # Update last accessed time
    f.last_accessed_at = datetime.now(timezone.utc)
    db.commit()
    
    # Le backend relaie le contenu pour garder l'autorisation, le CSP et CORS
    # identiques avec le stockage local et R2.
    try:
        content = r2_storage.download_file(file_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="PDF introuvable") from exc
    safe_name = quote(f.name)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    f = db.query(PDFFile).filter(
        PDFFile.id == file_id,
        PDFFile.user_id == user.id
    ).first()
    
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    
    # Delete from storage
    r2_storage.delete_file(file_id)
    
    # Delete from database
    db.delete(f)
    db.commit()
    
    return {"message": "Fichier supprimé"}
