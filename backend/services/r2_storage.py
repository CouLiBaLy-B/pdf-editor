import os
import boto3
from botocore.config import Config

_R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
_R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY", "")
_R2_SECRET_KEY = os.getenv("R2_SECRET_KEY", "")
_BUCKET = os.getenv("R2_BUCKET", "pdfpro-files")

# Fallback local si R2 non configuré (dev)
_USE_LOCAL = not all([_R2_ACCOUNT_ID, _R2_ACCESS_KEY, _R2_SECRET_KEY])

if not _USE_LOCAL:
    _s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=_R2_ACCESS_KEY,
        aws_secret_access_key=_R2_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _key(file_id: str) -> str:
    return f"{file_id}/document.pdf"


def upload_file(file_id: str, content: bytes) -> None:
    if _USE_LOCAL:
        from services.storage import save_upload
        save_upload(content, "document.pdf", file_id)
        return
    _s3.put_object(Bucket=_BUCKET, Key=_key(file_id), Body=content, ContentType="application/pdf")


def download_file(file_id: str) -> bytes:
    if _USE_LOCAL:
        from services.storage import get_file_path
        p = get_file_path(file_id) / "document.pdf"
        if not p.exists():
            raise FileNotFoundError(f"PDF {file_id} introuvable")
        return p.read_bytes()
    obj = _s3.get_object(Bucket=_BUCKET, Key=_key(file_id))
    return obj["Body"].read()


def get_presigned_url(file_id: str, expires: int = 3600) -> str:
    if _USE_LOCAL:
        return f"/uploads/{file_id}/document.pdf"
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": _BUCKET, "Key": _key(file_id)},
        ExpiresIn=expires,
    )


def check_storage() -> None:
    """Vérifie l'accès au stockage au démarrage et dans les probes de disponibilité."""
    if _USE_LOCAL:
        from services.storage import UPLOAD_DIR
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        probe = UPLOAD_DIR / ".write-probe"
        probe.write_bytes(b"ok")
        probe.unlink(missing_ok=True)
        return
    probe_key = "health/startup-probe"
    _s3.put_object(Bucket=_BUCKET, Key=probe_key, Body=b"ok", ContentType="text/plain")
    _s3.delete_object(Bucket=_BUCKET, Key=probe_key)


def delete_file(file_id: str) -> None:
    if _USE_LOCAL:
        import shutil
        from services.storage import get_file_path
        shutil.rmtree(str(get_file_path(file_id)), ignore_errors=True)
        return
    _s3.delete_object(Bucket=_BUCKET, Key=_key(file_id))
