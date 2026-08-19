import json
import logging
import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from database import PDFFile, SessionLocal
from services.r2_storage import delete_file as r2_delete

logger = logging.getLogger("pdfpro")


def run() -> dict:
    retention_days = max(1, int(os.getenv("FILE_RETENTION_DAYS", "30")))
    deleted = 0
    failed = 0
    db = SessionLocal()
    lock_acquired = False
    try:
        if db.bind and db.bind.dialect.name == "postgresql":
            lock_acquired = bool(db.execute(text("SELECT pg_try_advisory_lock(730021)")).scalar())
            if not lock_acquired:
                return {"deleted": 0, "failed": 0, "retention_days": retention_days, "skipped": True}
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        old_files = db.query(PDFFile).filter(PDFFile.last_accessed_at < cutoff).all()
        for file in old_files:
            try:
                r2_delete(file.id)
                db.delete(file)
                db.commit()
                deleted += 1
            except Exception:
                db.rollback()
                failed += 1
                logger.exception(json.dumps({
                    "level": "error", "event": "retention_delete_failed", "file_id": file.id,
                }))
        result = {"deleted": deleted, "failed": failed, "retention_days": retention_days}
        logger.info(json.dumps({"level": "info", "event": "retention_completed", **result}))
        return result
    finally:
        if lock_acquired:
            try:
                db.execute(text("SELECT pg_advisory_unlock(730021)"))
            except Exception:
                logger.exception(json.dumps({"level": "error", "event": "retention_unlock_failed"}))
        db.close()
