"""FastAPI Healthcare Skill Intelligence System - Enhanced Main Application"""
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.database import init_db
from app.logging_config import init_logging, get_logger
from app.middleware import (
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
    RateLimitMiddleware
)
from app.exceptions import APIException
from app.cache import get_cache
from app.routers import (
    users_router,
    courses_router,
    projects_router,
    skills_router,
    resume_router,
    jobs_router,
    analysis_router,
    roadmaps_router
)


# Initialize logging
init_logging()
logger = get_logger("main")


# ===== LIFESPAN CONTEXT MANAGER =====
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    # Startup
    logger.info("🚀 Starting Healthcare Skill Intelligence API...")
    
    # Initialize database
    init_db()
    logger.info("✅ Database initialized")
    
    # Initialize services
    from app.routers.dependencies import get_services
    services = get_services()
    logger.info("✅ Services initialized")
    
    # Log API key status
    logger.info(f"📡 LinkedIn API: {'Available' if services.has_linkedin_api() else 'Not configured'}")
    logger.info(f"📡 Tavily API: {'Available' if services.has_tavily_api() else 'Not configured'}")
    logger.info(f"📡 LLM API: {'Available' if services.has_llm_api() else 'Not configured'}")
    
    logger.info("✅ FastAPI server started successfully!")
    
    yield  # Application is running
    
    # Shutdown
    logger.info("🛑 Shutting down Healthcare Skill Intelligence API...")
    
    # Clear cache
    cache = get_cache()
    cache.clear()
    logger.info("✅ Cache cleared")
    
    logger.info("👋 Goodbye!")


# ===== CORS CONFIGURATION =====
def get_cors_origins() -> list:
    """Get CORS origins from environment."""
    origins_env = os.getenv("CORS_ORIGINS", "")
    if origins_env:
        return [origin.strip() for origin in origins_env.split(",")]
    
    # Default origins for development
    return [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]


# ===== INITIALIZE FASTAPI APP =====
app = FastAPI(
    title="Healthcare Skill Intelligence API",
    description="""
    AI-powered skill gap analysis for healthcare professionals.
    
    ## Features
    - **User Management**: Register and manage user profiles
    - **Resume Processing**: Upload and parse resumes to extract skills
    - **Course Management**: Track completed courses
    - **Project Management**: Document projects and tech stack
    - **Skill Extraction**: NLP-based skill extraction from all sources
    - **Job Search**: Search LinkedIn for healthcare jobs
    - **Gap Analysis**: Compare skills against market requirements
    - **Course Recommendations**: AI-powered course suggestions
    - **GitHub Analysis**: Extract skills from repositories
    - **Roadmaps**: Learning paths for career development
    
    ## API Response Format
    All endpoints return responses in a standardized format:
    ```json
    {
        "success": true,
        "message": "Operation completed",
        "data": {...},
        "meta": {"page": 1, "per_page": 20, "total": 100}
    }
    ```
    
    ## Rate Limiting
    - 60 requests per minute per IP
    - 1000 requests per hour per IP
    
    ## Authentication
    Currently public API. Authentication coming soon.
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    responses={
        400: {"description": "Bad Request - Invalid input"},
        404: {"description": "Not Found - Resource doesn't exist"},
        429: {"description": "Too Many Requests - Rate limit exceeded"},
        500: {"description": "Internal Server Error"},
    }
)


# ===== ADD MIDDLEWARE =====
# Order matters! Last added = first executed

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time", "X-RateLimit-Remaining-Minute"]
)

# Rate limiting middleware
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "60")),
    requests_per_hour=int(os.getenv("RATE_LIMIT_PER_HOUR", "1000")),
    exclude_paths=["/health", "/docs", "/redoc", "/openapi.json", "/"]
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Request logging middleware
app.add_middleware(RequestLoggingMiddleware)


# ===== EXCEPTION HANDLERS =====
@app.exception_handler(APIException)
async def api_exception_handler(request: Request, exc: APIException):
    """Handle custom API exceptions."""
    logger.warning(f"API Exception: {exc.error_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "error_code": exc.error_code,
            "data": None
        },
        headers=exc.headers
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors."""
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append(f"{field}: {error['msg']}")
    
    logger.warning(f"Validation Error: {errors}")
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": "Validation error",
            "error_code": "VALIDATION_ERROR",
            "data": {"errors": errors}
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unexpected error: {type(exc).__name__}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "An unexpected error occurred",
            "error_code": "INTERNAL_ERROR",
            "data": None
        }
    )


# ===== HEALTH & UTILITY ENDPOINTS =====
@app.get("/", tags=["Health"], summary="API Information")
def read_root():
    """Root endpoint - API health check and info."""
    return {
        "success": True,
        "message": "Healthcare Skill Intelligence API",
        "data": {
            "status": "online",
            "version": "2.0.0",
            "documentation": {
                "swagger": "/docs",
                "redoc": "/redoc"
            },
            "endpoints": {
                "users": "/api/users",
                "skills": "/api/skills",
                "jobs": "/api/jobs",
                "analysis": "/api/users/{user_id}/gap-analysis",
                "courses": "/api/courses/search/{skill}",
                "roadmaps": "/api/roadmaps"
            }
        }
    }


@app.get("/health", tags=["Health"], summary="Health Check")
def health_check():
    """Detailed health check endpoint for monitoring."""
    from app.routers.dependencies import get_services
    
    services = get_services()
    cache = get_cache()
    
    # Check service availability
    services_status = {
        "skill_extractor": "healthy",
        "resume_parser": "healthy",
        "linkedin_api": "available" if services.has_linkedin_api() else "not_configured",
        "tavily_api": "available" if services.has_tavily_api() else "not_configured",
        "llm_api": "available" if services.has_llm_api() else "not_configured",
    }
    
    return {
        "success": True,
        "message": "System healthy",
        "data": {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "services": services_status,
            "cache": cache.stats
        }
    }


@app.get("/api/metrics", tags=["Monitoring"], summary="API Metrics")
def get_metrics():
    """Get API performance metrics."""
    cache = get_cache()
    
    return {
        "success": True,
        "message": "Metrics retrieved",
        "data": {
            "cache": cache.stats,
            "timestamp": datetime.utcnow().isoformat()
        }
    }


# ===== REGISTER ROUTERS =====
# All routers are prefixed with /api
app.include_router(users_router)
app.include_router(courses_router)
app.include_router(projects_router)
app.include_router(skills_router)
app.include_router(resume_router)
app.include_router(jobs_router)
app.include_router(analysis_router)
app.include_router(roadmaps_router)


# ===== MAIN ENTRY POINT =====
if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    
    print("=" * 60)
    print("🏥 Healthcare Skill Intelligence API")
    print("=" * 60)
    print(f"🌐 Server: http://{host}:{port}")
    print(f"📚 Documentation: http://{host}:{port}/docs")
    print(f"📖 ReDoc: http://{host}:{port}/redoc")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )
