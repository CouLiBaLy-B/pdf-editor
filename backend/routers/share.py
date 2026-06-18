import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

from database import PDFFile, ShareLink, get_db
from auth import get_current_user, SECRET_KEY, ALGORITHM
from services.storage import get_file_path

router = APIRouter()

SHARE_EXPIRE_DAYS = 7


@router.post("/{file_id}/share")
def create_share_link(file_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    f = db.query(PDFFile).filter(PDFFile.id == file_id, PDFFile.user_id == user.id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    expire = datetime.now(timezone.utc) + timedelta(days=SHARE_EXPIRE_DAYS)
    token = jwt.encode({"file_id": file_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    link = ShareLink(id=str(uuid.uuid4()), file_id=file_id, user_id=user.id, token=token)
    db.add(link)
    db.commit()
    return {"share_url": f"/shared/{token}", "token": token}


@router.get("/share/{token}")
def get_shared_file(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        file_id = payload.get("file_id")
    except JWTError:
        raise HTTPException(status_code=410, detail="Lien expiré ou invalide")
    f = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    pdf_path = get_file_path(file_id) / "document.pdf"
    return FileResponse(str(pdf_path), media_type="application/pdf", filename=f.name)
