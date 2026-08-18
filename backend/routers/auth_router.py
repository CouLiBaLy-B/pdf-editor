import uuid
import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import User, get_db
from auth import hash_password, verify_password, create_access_token, get_current_user, SECRET_KEY, ALGORITHM
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class PromoteRequest(BaseModel):
    email: EmailStr
    secret: str


@router.post("/register", status_code=201)
@limiter.limit("5/minute")  # 5 registrations per minute max
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
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
        credits=10  # 10 free credits on signup
    )
    db.add(user)
    db.commit()
    
    # Send welcome email (non-blocking, won't fail the request)
    try:
        send_welcome_email(user.email)
    except Exception as e:
        logger.warning(f"Failed to send welcome email to {user.email}: {e}")
    
    logger.info(f"New user registered: {user.email}")
    
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "credits": user.credits
    }


@router.post("/login")
@limiter.limit("10/minute")  # 10 login attempts per minute max
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = db.query(User).filter(User.email == form.username).first()
    
    if not user or not verify_password(form.password, user.hashed_password):
        # Small delay to mitigate timing attacks
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    logger.info(f"User logged in: {user.email}")
    
    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "credits": user.credits
    }


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
    
    logger.info(f"User promoted to admin: {user.email}")
    
    return {"message": f"{user.email} est maintenant admin"}


@router.delete("/me")
def delete_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete user account and all associated files."""
    from services.r2_storage import delete_file as r2_delete
    
    # Delete all user files
    for f in user.files:
        try:
            r2_delete(f.id)
        except Exception as e:
            logger.warning(f"Failed to delete file {f.id}: {e}")
    
    # Delete user from database
    user_email = user.email
    db.delete(user)
    db.commit()
    
    logger.info(f"Account deleted: {user_email}")
    
    return {"message": "Compte supprimé"}


@router.post("/forgot-password")
@limiter.limit("5/minute")  # 5 password reset requests per minute
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send password reset email to user if email exists."""
    user = db.query(User).filter(User.email == body.email).first()
    
    if user:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        token = jwt.encode(
            {"sub": user.id, "type": "reset", "exp": expire},
            SECRET_KEY,
            algorithm=ALGORITHM
        )
        try:
            send_reset_email(user.email, token)
        except Exception as e:
            logger.warning(f"Failed to send reset email to {user.email}: {e}")
    
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
    except JWTError:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Mot de passe trop court")
    
    if len(body.new_password) > 128:
        raise HTTPException(status_code=422, detail="Mot de passe trop long")
    
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    
    logger.info(f"Password reset for user: {user.email}")
    
    return {"message": "Mot de passe mis à jour"}
