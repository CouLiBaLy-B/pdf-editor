import uuid
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"


def get_file_path(file_id: str) -> Path:
    return UPLOAD_DIR / file_id


def save_upload(content: bytes, original_name: str, file_id: str = None) -> dict:
    if file_id is None:
        file_id = str(uuid.uuid4())
    folder = UPLOAD_DIR / file_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "document.pdf").write_bytes(content)
    return {"id": file_id, "name": original_name, "url": f"/uploads/{file_id}/document.pdf"}
