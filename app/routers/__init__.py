"""API Routers Package - Organizes all API endpoints into modular routers."""
from .users import router as users_router
from .courses import router as courses_router
from .projects import router as projects_router
from .skills import router as skills_router
from .resume import router as resume_router
from .jobs import router as jobs_router
from .analysis import router as analysis_router
from .roadmaps import router as roadmaps_router

__all__ = [
    "users_router",
    "courses_router", 
    "projects_router",
    "skills_router",
    "resume_router",
    "jobs_router",
    "analysis_router",
    "roadmaps_router"
]

