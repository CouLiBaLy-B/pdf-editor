import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import User, Transaction, get_db


def _get_secret_key() -> str:
    """Get and validate SECRET_KEY from environment."""
    key = os.getenv("SECRET_KEY")
    if not key:
        # Generate ephemeral key for development only
        if os.getenv("ENVIRONMENT") != "production":
            return secrets.token_hex(32)
        # In production, refuse to start without a proper key
        raise RuntimeError(
            "FATAL: SECRET_KEY environment variable is required in production. "
            "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    # Validate minimum strength
    if len(key) < 32:
        if os.getenv("ENVIRONMENT") == "production":
            raise ValueError("SECRET_KEY must be at least 32 characters in production")
        import warnings
        warnings.warn("SECRET_KEY is shorter than 32 characters. This is insecure for production.")
    return key


SECRET_KEY = _get_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

logger = logging.getLogger("pdfpro")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, token_version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "ver": token_version, "iat": now, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user or payload.get("ver", -1) != user.token_version:
        raise credentials_exc
    return user


def require_available_credit(user: User = Depends(get_current_user)) -> User:
    """Vérifie le solde sans facturer une opération qui pourrait échouer."""
    if not user.is_admin and user.credits <= 0:
        raise HTTPException(status_code=402, detail="Crédits insuffisants. Rechargez votre compte.")
    return user


def consume_credit(db: Session, user: User, file_id: str | None = None) -> None:
    """Facture une opération terminée avec succès.

    La mise à jour conditionnelle protège également le solde contre deux requêtes
    concurrentes. Les administrateurs ne sont jamais débités.
    """
    if user.is_admin:
        return
    updated = (
        db.query(User)
        .filter(User.id == user.id, User.credits > 0)
        .update({User.credits: User.credits - 1}, synchronize_session=False)
    )
    if updated != 1:
        db.rollback()
        raise HTTPException(status_code=402, detail="Crédits insuffisants. Rechargez votre compte.")
    db.add(Transaction(
        id=str(uuid.uuid4()), user_id=user.id, file_id=file_id,
        type="operation", credits_delta=-1,
    ))
    db.commit()
    db.refresh(user)
    if user.credits == 2:
        try:
            from services.email import send_low_credits_email
            send_low_credits_email(user.email, user.credits)
        except Exception:
            logger.exception("Low-credit email failed for user %s", user.id)


def require_credit(user: User = Depends(require_available_credit), db: Session = Depends(get_db)) -> User:
    """Compatibilité pour les anciennes routes : débit immédiat.

    Les routes d'édition utilisent `require_available_credit` puis
    `consume_credit` uniquement après succès.
    """
    consume_credit(db, user)
    return user
