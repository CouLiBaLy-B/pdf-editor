import uuid
import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import PDFFile, ShareLink, Transaction, User, get_db
from auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    SECRET_KEY, ALGORITHM, attach_auth_cookie, clear_auth_cookie,
)
from services.email import send_reset_email, send_welcome_email

logger = logging.getLogger("pdfpro")

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Rate limiter for auth endpoints
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    accepted_terms: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class PromoteRequest(BaseModel):
    email: EmailStr
    secret: str


@router.post("/register", status_code=201)
@limiter.limit("30/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    if not body.accepted_terms:
        raise HTTPException(status_code=422, detail="Vous devez accepter les CGU et la politique de confidentialité")

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email déjà utilisé")
    
    # Validate password strength
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Mot de passe trop court (min 8 caractères)")
    
    if len(body.password) > 128:
        raise HTTPException(status_code=422, detail="Mot de passe trop long (max 128 caractères)")
    
    # Create user with 10 free credits
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=hash_password(body.password),
        credits=10,  # 10 free credits on signup
        terms_accepted_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    
    # Send welcome email (non-blocking, won't fail the request)
    try:
        send_welcome_email(user.email)
    except Exception as e:
        logger.warning("Welcome email failed for user %s", user.id)

    logger.info("User registered: %s", user.id)
    token = create_access_token(user.id, user.token_version)
    response = JSONResponse(
        {"access_token": token, "token_type": "bearer", "credits": user.credits},
        status_code=201,
    )
    attach_auth_cookie(response, request, token)
    return response


@router.post("/login")
@limiter.limit("60/minute")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = db.query(User).filter(User.email == form.username).first()
    
    if not user or not verify_password(form.password, user.hashed_password):
        # Small delay to mitigate timing attacks
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    logger.info("User logged in: %s", user.id)
    token = create_access_token(user.id, user.token_version)
    response = JSONResponse({"access_token": token, "token_type": "bearer", "credits": user.credits})
    attach_auth_cookie(response, request, token)
    return response


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "id": user.id,
        "email": user.email,
        "credits": user.credits,
        "is_admin": bool(user.is_admin),
        "file_count": len(user.files),
    }


@router.post("/promote-admin", status_code=200)
def promote_admin(body: PromoteRequest, db: Session = Depends(get_db)):
    """Promote a user to admin. Requires ADMIN_SECRET."""
    if not ADMIN_SECRET or not secrets.compare_digest(ADMIN_SECRET, body.secret):
        raise HTTPException(status_code=403, detail="Secret invalide")
    
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    
    user.is_admin = 1
    db.commit()
    
    logger.info("User promoted to admin: %s", user.id)
    
    return {"message": f"{user.email} est maintenant admin"}


@router.get("/export")
def export_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Export portable des données de compte, sans secrets ni contenu documentaire."""
    files = db.query(PDFFile).filter(PDFFile.user_id == user.id).all()
    transactions = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    shares = db.query(ShareLink).filter(ShareLink.user_id == user.id).all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {
            "id": user.id, "email": user.email, "credits": user.credits,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "terms_accepted_at": user.terms_accepted_at.isoformat() if user.terms_accepted_at else None,
        },
        "files": [{
            "id": file.id, "name": file.name, "size_bytes": file.size_bytes,
            "created_at": file.created_at.isoformat() if file.created_at else None,
            "last_accessed_at": file.last_accessed_at.isoformat() if file.last_accessed_at else None,
        } for file in files],
        "transactions": [{
            "id": tx.id, "type": tx.type, "credits_delta": tx.credits_delta,
            "file_id": tx.file_id, "created_at": tx.created_at.isoformat() if tx.created_at else None,
        } for tx in transactions],
        "share_links": [{
            "id": share.id, "file_id": share.file_id,
            "created_at": share.created_at.isoformat() if share.created_at else None,
        } for share in shares],
    }


@router.delete("/me")
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete user account and all associated files."""
    from services.r2_storage import delete_file as r2_delete
    
    # Ne supprimer les métadonnées qu'après confirmation du stockage : cela
    # garantit le droit à l'effacement sans créer d'objets orphelins.
    failed_files = []
    for file in user.files:
        try:
            r2_delete(file.id)
        except Exception:
            failed_files.append(file.id)
            logger.exception("Failed to delete file %s during account deletion", file.id)
    if failed_files:
        raise HTTPException(status_code=503, detail="Suppression temporairement impossible, veuillez réessayer")

    user_id = user.id
    db.delete(user)
    db.commit()

    logger.info("Account deleted: %s", user_id)
    
    return {"message": "Compte supprimé"}


@router.post("/forgot-password")
@limiter.limit("5/minute")  # 5 password reset requests per minute
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send password reset email to user if email exists."""
    user = db.query(User).filter(User.email == body.email).first()
    
    if user:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        token = jwt.encode(
            {"sub": user.id, "type": "reset", "ver": user.token_version, "exp": expire},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        try:
            send_reset_email(user.email, token)
        except Exception as e:
            logger.warning("Password reset email failed for user %s", user.id)
    
    # Always return success to prevent email enumeration
    return {"message": "Si cet email existe, un lien a été envoyé"}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset user password using a valid reset token."""
    try:
        payload = jwt.decode(body.token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Token invalide")
        user_id = payload.get("sub")
        token_version = payload.get("ver")
    except JWTError:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or token_version != user.token_version:
        raise HTTPException(status_code=400, detail="Token invalide ou déjà utilisé")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Mot de passe trop court")
    
    if len(body.new_password) > 128:
        raise HTTPException(status_code=422, detail="Mot de passe trop long")
    
    user.hashed_password = hash_password(body.new_password)
    user.token_version += 1
    db.commit()
    
    logger.info("Password reset for user: %s", user.id)
    
    return {"message": "Mot de passe mis à jour"}
