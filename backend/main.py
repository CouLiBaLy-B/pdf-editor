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
from routers.pages import router as pages_router

logger = logging.getLogger("pdfpro")

# Sentry monitoring (only if DSN is configured)
if dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(dsn=dsn, traces_sample_rate=0.2)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Rate limiter configuration
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri=os.getenv("REDIS_URL", "memory://") if os.getenv("REDIS_URL") else "memory://"
)

app = FastAPI(title="PDFPro SaaS API", version="3.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Content Security Policy (basic)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-src 'none';"
    )
    
    return response

# Mount static files for local uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(edit.router, prefix="/api/files", tags=["edit"])
app.include_router(annotate.router, prefix="/api/files", tags=["annotate"])
app.include_router(merge_split.router, prefix="/api", tags=["merge-split"])
app.include_router(sign.router, prefix="/api/files", tags=["sign"])
app.include_router(billing_router, prefix="/api/billing", tags=["billing"])
app.include_router(share_router, prefix="/api/files", tags=["share"])
app.include_router(share_router, prefix="/api", tags=["share-public"])
app.include_router(pages_router, prefix="/api/files", tags=["pages"])


@app.middleware("http")
async def log_slow_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    
    # Log slow requests (> 500ms threshold, reduced from 2s)
    if duration > 0.5:
        logger.warning(
            f"Slow request: {request.method} {request.url.path} took {duration:.2f}s"
        )
    
    return response


@app.on_event("startup")
def startup():
    init_db()
    scheduler = BackgroundScheduler()
    scheduler.add_job(_run_cleanup, "cron", hour=3, minute=0)
    scheduler.start()
    logger.info("PDFPro API started successfully")


def _run_cleanup():
    from services.cleanup import run
    run()


@app.get("/")
def root():
    return {"message": "PDFPro SaaS API v3.1.0", "status": "running"}


@app.get("/health")
def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}
