import pytest

from config import validate_production_config


PRODUCTION_ENV = {
    "ENVIRONMENT": "production",
    "SECRET_KEY": "a" * 64,
    "DATABASE_URL": "postgresql://user:pass@db:5432/pdfpro",
    "FRONTEND_URL": "https://pdfpro.example",
    "ALLOWED_ORIGINS": "https://pdfpro.example",
    "STRIPE_SECRET_KEY": "sk_live_example",
    "STRIPE_WEBHOOK_SECRET": "whsec_example",
    "R2_ACCOUNT_ID": "account",
    "R2_ACCESS_KEY": "access",
    "R2_SECRET_KEY": "secret",
    "R2_BUCKET": "pdfpro",
    "RESEND_API_KEY": "re_example",
    "FROM_EMAIL": "PDFPro <noreply@pdfpro.example>",
    "REDIS_URL": "redis://redis:6379/0",
}


def apply(monkeypatch, values):
    for key in PRODUCTION_ENV:
        monkeypatch.delenv(key, raising=False)
    for key, value in values.items():
        monkeypatch.setenv(key, value)


def test_valid_production_configuration(monkeypatch):
    apply(monkeypatch, PRODUCTION_ENV)
    validate_production_config()


def test_production_refuses_missing_and_local_values(monkeypatch):
    invalid = {**PRODUCTION_ENV, "SECRET_KEY": "change-me", "FRONTEND_URL": "http://localhost:5173", "ALLOWED_ORIGINS": "*"}
    invalid.pop("STRIPE_WEBHOOK_SECRET")
    apply(monkeypatch, invalid)
    with pytest.raises(RuntimeError) as error:
        validate_production_config()
    message = str(error.value)
    assert "STRIPE_WEBHOOK_SECRET" in message
    assert "SECRET_KEY" in message
    assert "HTTPS" in message
    assert "wildcard" in message


def test_development_allows_optional_integrations(monkeypatch):
    apply(monkeypatch, {"ENVIRONMENT": "development"})
    validate_production_config()
