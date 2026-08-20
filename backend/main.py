import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text

from config import environment, validate_production_config
from database import SessionLocal, init_db
from routers import annotate, edit, files, merge_split, sign
from routers.auth_router import router as auth_router
from routers.billing import router as billing_router
from routers.pages import router as pages_router
from routers.share import router as share_router

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(message)s")
logger = logging.getLogger("pdfpro")

if dsn := os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=dsn,
        environment=environment(),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
    )


def _run_cleanup():
    from services.cleanup import run
    run()


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_production_config()
    init_db()
    from services.r2_storage import check_storage
    check_storage()
    app.state.storage_ready = True
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(_run_cleanup, "cron", hour=3, minute=0, id="document-retention", replace_existing=True)
    scheduler.start()
    app.state.scheduler = scheduler
    logger.info(json.dumps({"level": "info", "event": "api_started", "environment": environment()}))
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info(json.dumps({"level": "info", "event": "api_stopped"}))


is_production = environment() == "production"
app = FastAPI(
    title="PDFPro SaaS API",
    version="4.0.0",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
    lifespan=lifespan,
)

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri=os.getenv("REDIS_URL") or "memory://",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins = [origin.strip() for origin in os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.e2b\.app" if not is_production else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


def _safe_path(path: str) -> str:
    if path.startswith("/api/share/"):
        return "/api/share/[token]"
    return path


@app.middleware("http")
async def observability_and_security(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
        if is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000, 1)
        level = "warning" if status_code >= 400 or duration_ms > 1000 else "info"
        logger.log(
            logging.WARNING if level == "warning" else logging.INFO,
            json.dumps({
                "level": level, "event": "http_request", "request_id": request_id,
                "method": request.method, "path": _safe_path(request.url.path),
                "status": status_code, "duration_ms": duration_ms,
            }),
        )


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


@app.get("/")
def root():
    return {"service": "PDFPro API", "version": "4.0.0", "status": "running"}


@app.get("/health/live")
def liveness():
    return {"status": "ok"}


@app.get("/health/ready")
def readiness():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        if not getattr(app.state, "storage_ready", False):
            raise RuntimeError("storage unavailable")
        return {"status": "ready", "database": "ok", "storage": "ok"}
    except Exception:
        logger.exception(json.dumps({"level": "error", "event": "readiness_failed"}))
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Service non prêt")


@app.get("/health")
def health_check():
    return readiness()
