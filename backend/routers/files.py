from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from services import storage

router = APIRouter()


@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")
    content = await file.read()
    result = storage.save_upload(content, file.filename)
    return result


@router.get("/")
def list_files():
    return storage.list_pdf_files()


@router.get("/{file_id}/download")
def download_file(file_id: str):
    folder = storage.get_file_path(file_id)
    pdf_path = folder / "document.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    name = (folder / "meta.txt").read_text().strip() if (folder / "meta.txt").exists() else f"{file_id}.pdf"
    return FileResponse(str(pdf_path), media_type="application/pdf", filename=name)


@router.delete("/{file_id}")
def delete_file(file_id: str):
    import shutil
    folder = storage.get_file_path(file_id)
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    shutil.rmtree(str(folder))
    return {"message": "Fichier supprimé"}
