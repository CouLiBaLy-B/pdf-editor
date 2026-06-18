import os
import time
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import sentry_sdk
from apscheduler.schedulers.background import BackgroundScheduler

from database import init_db
from routers import files, edit, annotate, merge_split, sign
from routers.auth_router import router as auth_router
from routers.billing import router as billing_router
from routers.share import router as share_router

logger = logging.getLogger("pdfpro")

# Sentry (seulement si DSN configuré)
if dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(dsn=dsn, traces_sample_rate=0.2)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="PDFPro SaaS API", version="3.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(edit.router, prefix="/api/files", tags=["edit"])
app.include_router(annotate.router, prefix="/api/files", tags=["annotate"])
app.include_router(merge_split.router, prefix="/api", tags=["merge-split"])
app.include_router(sign.router, prefix="/api/files", tags=["sign"])
app.include_router(billing_router, prefix="/api/billing", tags=["billing"])
app.include_router(share_router, prefix="/api/files", tags=["share"])
app.include_router(share_router, prefix="/api", tags=["share-public"])


@app.middleware("http")
async def log_slow_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    if duration > 2:
        logger.warning(f"Slow request: {request.method} {request.url.path} took {duration:.2f}s")
    return response


@app.on_event("startup")
def startup():
    init_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(_run_cleanup, "cron", hour=3, minute=0)
    scheduler.start()


def _run_cleanup():
    from services.cleanup import run
    run()


@app.get("/")
def root():
    return {"message": "PDFPro SaaS API v3"}
