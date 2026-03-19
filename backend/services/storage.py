import uuid
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"


def generate_file_id() -> str:
    return str(uuid.uuid4())


def get_file_path(file_id: str) -> Path:
    return UPLOAD_DIR / file_id


def list_pdf_files() -> list[dict]:
    files = []
    for p in UPLOAD_DIR.iterdir():
        if p.is_dir():
            pdf_path = p / "document.pdf"
            if pdf_path.exists():
                files.append({
                    "id": p.name,
                    "name": (p / "meta.txt").read_text().strip()
                    if (p / "meta.txt").exists()
                    else p.name,
                    "url": f"/uploads/{p.name}/document.pdf",
                })
    return files


def save_upload(content: bytes, original_name: str) -> dict:
    file_id = generate_file_id()
    folder = UPLOAD_DIR / file_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "document.pdf").write_bytes(content)
    (folder / "meta.txt").write_text(original_name)
    return {
        "id": file_id,
        "name": original_name,
        "url": f"/uploads/{file_id}/document.pdf",
    }
