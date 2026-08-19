"""Configuration et garde-fous de démarrage."""
import os
from urllib.parse import urlparse


def environment() -> str:
    return os.getenv("ENVIRONMENT", "development").lower()


def validate_production_config() -> None:
    """Refuse un déploiement production incomplet ou manifestement dangereux."""
    if environment() != "production":
        return

    errors: list[str] = []
    required = [
        "SECRET_KEY", "DATABASE_URL", "FRONTEND_URL", "ALLOWED_ORIGINS",
        "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
        "R2_ACCOUNT_ID", "R2_ACCESS_KEY", "R2_SECRET_KEY", "R2_BUCKET",
        "RESEND_API_KEY", "FROM_EMAIL", "REDIS_URL",
    ]
    for name in required:
        if not os.getenv(name, "").strip():
            errors.append(f"{name} est obligatoire")

    secret = os.getenv("SECRET_KEY", "")
    if secret and (len(secret) < 48 or secret.startswith("change-me")):
        errors.append("SECRET_KEY doit être aléatoire et contenir au moins 48 caractères")

    database_url = os.getenv("DATABASE_URL", "")
    if database_url and not database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
        errors.append("DATABASE_URL doit utiliser PostgreSQL en production")

    frontend_url = os.getenv("FRONTEND_URL", "")
    if frontend_url and urlparse(frontend_url).scheme != "https":
        errors.append("FRONTEND_URL doit utiliser HTTPS")

    origins = os.getenv("ALLOWED_ORIGINS", "")
    if "*" in origins or "localhost" in origins or "127.0.0.1" in origins:
        errors.append("ALLOWED_ORIGINS ne doit contenir ni wildcard ni adresse locale")

    if errors:
        formatted = "\n - ".join(errors)
        raise RuntimeError(f"Configuration production invalide :\n - {formatted}")
