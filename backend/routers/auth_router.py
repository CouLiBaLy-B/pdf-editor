import uuid
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from database import User, get_db
from auth import hash_password, verify_password, create_access_token, get_current_user, SECRET_KEY, ALGORITHM
from services.email import send_reset_email, send_welcome_email

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email déjà utilisé")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Mot de passe trop court (min 8 caractères)")
    user = User(id=str(uuid.uuid4()), email=body.email, hashed_password=hash_password(body.password), credits=10)
    db.add(user)
    db.commit()
    send_welcome_email(user.email)
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "credits": user.credits}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "credits": user.credits}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "credits": user.credits,
        "is_admin": bool(user.is_admin),
        "file_count": len(user.files),
    }


class PromoteRequest(BaseModel):
    email: EmailStr
    secret: str


@router.post("/promote-admin", status_code=200)
def promote_admin(body: PromoteRequest, db: Session = Depends(get_db)):
    """Promeut un utilisateur en admin. Nécessite ADMIN_SECRET."""
    if not ADMIN_SECRET or body.secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Secret invalide")
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_admin = 1
    db.commit()
    return {"message": f"{user.email} est maintenant admin"}


@router.delete("/me")
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import shutil
    from services.r2_storage import delete_file as r2_delete
    for f in user.files:
        try:
            r2_delete(f.id)
        except Exception:
            pass
    db.delete(user)
    db.commit()
    return {"message": "Compte supprimé"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        token = jwt.encode({"sub": user.id, "type": "reset", "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
        send_reset_email(user.email, token)
    return {"message": "Si cet email existe, un lien a été envoyé"}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(body.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Token invalide")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Mot de passe trop court")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Mot de passe mis à jour"}
