from datetime import datetime, timedelta, timezone
from database import SessionLocal, PDFFile
from services.r2_storage import delete_file as r2_delete


def run():
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        old_files = db.query(PDFFile).filter(PDFFile.last_accessed_at < cutoff).all()
        for f in old_files:
            try:
                r2_delete(f.id)
            except Exception:
                pass
            db.delete(f)
        db.commit()
    finally:
        db.close()
