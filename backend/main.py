"""
Procura Backend - Main FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import structlog
import uvicorn

from .config import settings
from .routers import opportunities, submissions, connectors, audit, admin, feeds
# from .tasks.celery_app import celery_app  # Uncomment when Celery is configured

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events - startup and shutdown
    """
    # Startup
    logger.info("Starting Procura API", environment=settings.ENVIRONMENT)
    
    # Initialize Celery beat schedule (uncomment when ready)
    # celery_app.conf.beat_schedule = {
    #     'discovery-govcon-every-15min': {
    #         'task': 'tasks.discovery.run_connector',
    #         'schedule': 900.0,  # 15 minutes
    #         'args': ('govcon',)
    #     },
    # }
    
    yield
    
    # Shutdown
    logger.info("Shutting down Procura API")


# Create FastAPI application
app = FastAPI(
    title="Procura Ops API",
    description="Government Contract Opportunity Automation Platform",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)

# ===========================================
# MIDDLEWARE
# ===========================================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing"""
    import time
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(process_time, 2)
    )
    
    response.headers["X-Process-Time"] = str(round(process_time, 2))
    return response


# ===========================================
# EXCEPTION HANDLERS
# ===========================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with clear messages"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error",
            "errors": errors
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all exception handler"""
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "Internal server error" if settings.is_production else str(exc)
        }
    )


# ===========================================
# ROUTERS
# ===========================================

app.include_router(
    opportunities.router,
    prefix="/api/opportunities",
    tags=["Opportunities"]
)

app.include_router(
    submissions.router,
    prefix="/api/submissions",
    tags=["Submissions"]
)

app.include_router(
    connectors.router,
    prefix="/api/connectors",
    tags=["Connectors"]
)

app.include_router(
    audit.router,
    prefix="/api/audit-logs",
    tags=["Audit"]
)

app.include_router(
    admin.router,
    prefix="/api/admin",
    tags=["Admin"]
)

app.include_router(
    feeds.router,
    prefix="/api/feeds",
    tags=["Feeds"]
)


# ===========================================
# ROOT ENDPOINTS
# ===========================================

@app.get("/", tags=["Health"])
async def root():
    """API root - health check"""
    return {
        "name": "Procura Ops API",
        "version": "1.0.0",
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check with actual connection verification"""
    from .database import get_supabase_client

    health_status = {
        "status": "healthy",
        "checks": {},
        "environment": settings.ENVIRONMENT
    }

    # Check Supabase connection
    try:
        db = get_supabase_client()
        db.table("profiles").select("id").limit(1).execute()
        health_status["checks"]["database"] = "connected"
    except Exception as e:
        health_status["checks"]["database"] = f"error: {str(e)[:100]}"
        health_status["status"] = "degraded"

    # Check Redis (only if configured for Celery)
    if settings.REDIS_URL and not settings.REDIS_URL.startswith("redis://localhost"):
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=2)
            r.ping()
            health_status["checks"]["redis"] = "connected"
        except Exception as e:
            health_status["checks"]["redis"] = "not configured"
    else:
        health_status["checks"]["redis"] = "not configured (optional)"

    return health_status


# ===========================================
# MAIN
# ===========================================

if __name__ == "__main__":
    import os
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        reload=settings.DEBUG
    )
