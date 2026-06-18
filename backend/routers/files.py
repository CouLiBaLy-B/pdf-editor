import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from database import PDFFile, get_db
from auth import get_current_user
from services import r2_storage

router = APIRouter()


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")
    content = await file.read()
    file_id = str(uuid.uuid4())
    r2_storage.upload_file(file_id, content)
    db_file = PDFFile(id=file_id, name=file.filename, size_bytes=len(content), user_id=user.id)
    db.add(db_file)
    db.commit()
    return {"id": file_id, "name": file.filename, "size": len(content), "url": r2_storage.get_presigned_url(file_id)}


@router.get("/")
def list_files(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return [
        {"id": f.id, "name": f.name, "url": r2_storage.get_presigned_url(f.id), "size": f.size_bytes}
        for f in user.files
    ]


@router.get("/{file_id}/download")
def download_file(file_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    f = db.query(PDFFile).filter(PDFFile.id == file_id, PDFFile.user_id == user.id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    f.last_accessed_at = datetime.now(timezone.utc)
    db.commit()
    url = r2_storage.get_presigned_url(file_id)
    # En local, retourner le contenu directement
    if url.startswith("/uploads/"):
        content = r2_storage.download_file(file_id)
        return Response(content=content, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{f.name}"'})
    return RedirectResponse(url=url)


@router.delete("/{file_id}")
def delete_file(file_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    f = db.query(PDFFile).filter(PDFFile.id == file_id, PDFFile.user_id == user.id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    r2_storage.delete_file(file_id)
    db.delete(f)
    db.commit()
    return {"message": "Fichier supprimé"}
