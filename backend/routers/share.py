import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from auth import ALGORITHM, SECRET_KEY, get_current_user
from database import PDFFile, ShareLink, get_db
from services import r2_storage

router = APIRouter()
SHARE_EXPIRE_DAYS = 7


@router.post("/{file_id}/share")
def create_share_link(file_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    file = db.query(PDFFile).filter(PDFFile.id == file_id, PDFFile.user_id == user.id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    expire = datetime.now(timezone.utc) + timedelta(days=SHARE_EXPIRE_DAYS)
    link_id = str(uuid.uuid4())
    token = jwt.encode(
        {"file_id": file_id, "link_id": link_id, "type": "share", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    db.add(ShareLink(id=link_id, file_id=file_id, user_id=user.id, token=token))
    db.commit()
    return {"share_url": f"/shared/{token}", "expires_at": expire.isoformat()}


@router.delete("/{file_id}/share")
def revoke_share_links(file_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    file = db.query(PDFFile).filter(PDFFile.id == file_id, PDFFile.user_id == user.id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    count = db.query(ShareLink).filter(ShareLink.file_id == file_id, ShareLink.user_id == user.id).delete()
    db.commit()
    return {"message": "Liens révoqués", "revoked": count}


@router.get("/share/{token}")
def get_shared_file(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "share":
            raise JWTError("wrong token type")
        file_id = payload.get("file_id")
        link_id = payload.get("link_id")
    except JWTError as exc:
        raise HTTPException(status_code=410, detail="Lien expiré ou invalide") from exc

    link = db.query(ShareLink).filter(
        ShareLink.id == link_id,
        ShareLink.file_id == file_id,
        ShareLink.token == token,
    ).first()
    file = db.query(PDFFile).filter(PDFFile.id == file_id).first()
    if not link or not file:
        raise HTTPException(status_code=410, detail="Lien expiré, révoqué ou invalide")
    try:
        content = r2_storage.download_file(file_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Fichier introuvable") from exc
    filename = quote(file.name)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{filename}",
            "Cache-Control": "private, max-age=300",
        },
    )
