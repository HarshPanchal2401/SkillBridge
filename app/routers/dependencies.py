"""Dependencies for routers - shared services and configurations with proper dependency injection."""
import os
from functools import lru_cache
from typing import Optional, Generator
from dotenv import load_dotenv

from fastapi import Depends

from app.database import get_db, DatabaseSession
from app.logging_config import get_logger
from app.cache import get_cache, SimpleCache
from app.services.skill_extractor import SkillExtractor
from app.services.resume_parser import ResumeParser
from app.services.resume_parser import ResumeParser
from app.services.job_fetcher import JobFetcher
from app.services.job_skill_analyzer import JobSkillAnalyzer
from app.services.gap_analyzer import GapAnalyzer
from app.services.course_recommender import CourseRecommender
from app.services.github_analyzer import GitHubAnalyzer
from app.services.huggingface_skill_extractor import HuggingFaceSkillExtractor
from app.services.market_skill_searcher import MarketSkillSearcher
from app.services.groq_skill_refiner import GroqSkillRefiner
from app.services.llm_gap_analyzer import GroqGapAnalyzer

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

# Logger
logger = get_logger("dependencies")

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads/resumes")
SKILLS_FILE = os.path.join("app", "data", "skills.json")


class ServiceContainer:
    """
    Container for all services - enables dependency injection and lazy loading.
    
    This is a singleton that initializes all services once and provides
    easy access to them throughout the application.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        logger.info("Initializing service container...")
        
        # Ensure upload directory exists
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        # Load API keys from environment
        self._rapidapi_key = os.getenv("RAPIDAPI_KEY", "")
        self._tavily_api_key = os.getenv("TAVILY_API_KEY", "")
        self._gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self._huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN", "")
        self._groq_api_key = os.getenv("GROQ_API_KEY", "")
        
        # Log API key status
        logger.info(f"🔑 RAPIDAPI_KEY: {'✓ Loaded' if self._rapidapi_key else '✗ Not set'}")
        logger.info(f"🔑 TAVILY_API_KEY: {'✓ Loaded' if self._tavily_api_key else '✗ Not set'}")
        logger.info(f"🔑 GEMINI_API_KEY: {'✓ Loaded' if self._gemini_api_key else '✗ Not set'}")
        logger.info(f"🔑 HUGGINGFACE_API_KEY: {'✓ Loaded' if self._huggingface_api_key else '✗ Not set'}")
        logger.info(f"🔑 GROQ_API_KEY: {'✓ Loaded' if self._groq_api_key else '✗ Not set'}")
        
        # Initialize core services
        self._huggingface_extractor = HuggingFaceSkillExtractor(self._huggingface_api_key) if self._huggingface_api_key else None
        self._groq_refiner = GroqSkillRefiner(self._groq_api_key)
        self._skill_extractor = SkillExtractor(SKILLS_FILE, hf_extractor=self._huggingface_extractor, groq_refiner=self._groq_refiner)
        self._resume_parser = ResumeParser()
        
        # Initialize dependent services
        self._linkedin_fetcher = JobFetcher(self._rapidapi_key) if self._rapidapi_key else None
        self._job_analyzer = JobSkillAnalyzer(self._skill_extractor)
        self._gap_analyzer = GapAnalyzer()
        self._course_recommender = CourseRecommender(self._tavily_api_key)
        self._github_analyzer = GitHubAnalyzer(self._skill_extractor)
        self._market_skill_searcher = MarketSkillSearcher(self._tavily_api_key)
        self._llm_gap_analyzer = GroqGapAnalyzer(self._groq_api_key)
        
        self._initialized = True
        logger.info("✅ Service container initialized")
    
    @property
    def skill_extractor(self) -> SkillExtractor:
        """Get the skill extractor service."""
        return self._skill_extractor
    
    @property
    def resume_parser(self) -> ResumeParser:
        """Get the resume parser service."""
        return self._resume_parser
    
    @property
    def linkedin_fetcher(self) -> Optional[JobFetcher]:
        """Get the job fetcher service (may be None if not configured)."""
        return self._linkedin_fetcher
    
    @property
    def job_analyzer(self) -> JobSkillAnalyzer:
        """Get the job skill analyzer service."""
        return self._job_analyzer
    
    @property
    def gap_analyzer(self) -> GapAnalyzer:
        """Get the gap analyzer service."""
        return self._gap_analyzer
    
    @property
    def course_recommender(self) -> CourseRecommender:
        """Get the course recommender service."""
        return self._course_recommender
    
    @property
    def github_analyzer(self) -> GitHubAnalyzer:
        """Get the GitHub analyzer service."""
        return self._github_analyzer
    
    @property
    def huggingface_extractor(self) -> Optional[HuggingFaceSkillExtractor]:
        """Get the HuggingFace skill extractor service (may be None if not configured)."""
        return self._huggingface_extractor
    
    @property
    def market_skill_searcher(self) -> MarketSkillSearcher:
        """Get the market skill searcher service for real-time skill lookup."""
        return self._market_skill_searcher
    
    @property
    def groq_refiner(self) -> GroqSkillRefiner:
        """Get the Groq skill refiner service."""
        return self._groq_refiner
    
    @property
    def llm_gap_analyzer(self) -> GroqGapAnalyzer:
        """Get the LLM-based gap analyzer service."""
        return self._llm_gap_analyzer
    
    @property
    def upload_dir(self) -> str:
        """Get the upload directory path."""
        return UPLOAD_DIR
    
    def has_linkedin_api(self) -> bool:
        """Check if LinkedIn API is configured."""
        return self._linkedin_fetcher is not None
    
    def has_llm_api(self) -> bool:
        """Check if HuggingFace API is configured and available."""
        return self._huggingface_extractor is not None and self._huggingface_extractor.is_available()
    
    def has_groq_api(self) -> bool:
        """Check if Groq API is configured and available."""
        return self._groq_refiner.is_available()
    
    def has_tavily_api(self) -> bool:
        """Check if Tavily API is configured."""
        return bool(self._tavily_api_key)
    
    def get_service_status(self) -> dict:
        """Get status of all services."""
        return {
            "skill_extractor": "healthy",
            "resume_parser": "healthy",
            "linkedin_api": "available" if self.has_linkedin_api() else "not_configured",
            "tavily_api": "available" if self.has_tavily_api() else "not_configured",
            "llm_api": "available" if self.has_llm_api() else "not_configured",
            "groq_refiner": "available" if self.has_groq_api() else "not_configured",
            "gap_analyzer": "healthy",
            "llm_gap_analyzer": "available" if self._llm_gap_analyzer.available else "not_configured",
            "course_recommender": "healthy",
            "github_analyzer": "healthy",
            "market_skill_searcher": "healthy"
        }


@lru_cache()
def get_services() -> ServiceContainer:
    """
    Get the service container singleton.
    
    This is cached to ensure only one instance exists.
    """
    return ServiceContainer()


# ===== FASTAPI DEPENDENCY FUNCTIONS =====
# Use these with Depends() in route functions

def get_db_session() -> Generator[DatabaseSession, None, None]:
    """
    FastAPI dependency for database session.
    
    Usage:
        @router.get("/users")
        def get_users(db: DatabaseSession = Depends(get_db_session)):
            db.execute("SELECT * FROM users")
            return db.fetchall()
    """
    session = DatabaseSession()
    try:
        yield session
    finally:
        session.close()


def get_skill_extractor() -> SkillExtractor:
    """FastAPI dependency for skill extractor."""
    return get_services().skill_extractor


def get_resume_parser() -> ResumeParser:
    """FastAPI dependency for resume parser."""
    return get_services().resume_parser


def get_gap_analyzer() -> GapAnalyzer:
    """FastAPI dependency for gap analyzer."""
    return get_services().gap_analyzer


def get_course_recommender() -> CourseRecommender:
    """FastAPI dependency for course recommender."""
    return get_services().course_recommender


def get_github_analyzer() -> GitHubAnalyzer:
    """FastAPI dependency for GitHub analyzer."""
    return get_services().github_analyzer


def get_job_analyzer() -> JobSkillAnalyzer:
    """FastAPI dependency for job skill analyzer."""
    return get_services().job_analyzer




def get_app_cache() -> SimpleCache:
    """FastAPI dependency for cache."""
    return get_cache()


# ===== SAMPLE DATA =====

def get_sample_market_requirements() -> dict:
    """
    Return sample market requirements when API is unavailable.
    
    This is used as a fallback when LinkedIn API is not configured.
    In production, this should be replaced with cached real market data.
    """
    return {
        "python": {
            "frequency": 0.85,
            "requirement_level": "critical",
            "avg_proficiency_needed": 0.75
        },
        "sql": {
            "frequency": 0.80,
            "requirement_level": "critical",
            "avg_proficiency_needed": 0.70
        },
        "machine-learning": {
            "frequency": 0.65,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.65
        },
        "data-analysis": {
            "frequency": 0.75,
            "requirement_level": "critical",
            "avg_proficiency_needed": 0.70
        },
        "tensorflow": {
            "frequency": 0.45,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.60
        },
        "data-visualization": {
            "frequency": 0.55,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.65
        },
        "nlp": {
            "frequency": 0.40,
            "requirement_level": "emerging",
            "avg_proficiency_needed": 0.55
        },
        "pandas": {
            "frequency": 0.70,
            "requirement_level": "critical",
            "avg_proficiency_needed": 0.70
        },
        "tableau": {
            "frequency": 0.50,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.60
        },
        "statistics": {
            "frequency": 0.60,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.65
        },
        "deep-learning": {
            "frequency": 0.35,
            "requirement_level": "emerging",
            "avg_proficiency_needed": 0.55
        },
        "kubernetes": {
            "frequency": 0.30,
            "requirement_level": "emerging",
            "avg_proficiency_needed": 0.50
        },
        "docker": {
            "frequency": 0.45,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.55
        },
        "aws": {
            "frequency": 0.50,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.60
        },
        "power-bi": {
            "frequency": 0.40,
            "requirement_level": "important",
            "avg_proficiency_needed": 0.55
        }
    }


def get_upload_dir() -> str:
    """Get the upload directory path."""
    return UPLOAD_DIR
