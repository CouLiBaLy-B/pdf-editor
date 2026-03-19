import os
import uuid
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import files, edit, annotate, merge_split, sign

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="PDF Editor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(edit.router, prefix="/api/files", tags=["edit"])
app.include_router(annotate.router, prefix="/api/files", tags=["annotate"])
app.include_router(merge_split.router, prefix="/api", tags=["merge-split"])
app.include_router(sign.router, prefix="/api/files", tags=["sign"])


@app.get("/")
def root():
    return {"message": "PDF Editor API is running"}
