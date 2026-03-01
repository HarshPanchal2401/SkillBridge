"""Pydantic schemas for request/response validation."""
import re
from typing import Optional, List, Any, Generic, TypeVar
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime


# ===== GENERIC RESPONSE WRAPPER =====
T = TypeVar('T')


class ResponseMeta(BaseModel):
    """Metadata for paginated responses."""
    page: int = 1
    per_page: int = 20
    total: int = 0
    total_pages: int = 0
    has_next: bool = False
    has_prev: bool = False


class APIResponse(BaseModel, Generic[T]):
    """Standard API response wrapper."""
    success: bool = True
    message: str = "Success"
    data: Optional[T] = None
    meta: Optional[ResponseMeta] = None
    error_code: Optional[str] = None
    
    @classmethod
    def success_response(cls, data: Any, message: str = "Success", meta: Optional[ResponseMeta] = None):
        return cls(success=True, message=message, data=data, meta=meta)
    
    @classmethod
    def error_response(cls, message: str, error_code: str = "ERROR"):
        return cls(success=False, message=message, error_code=error_code)


# ===== VALIDATION HELPERS =====
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
URL_REGEX = re.compile(r'^https?://[^\s/$.?#].[^\s]*$')
PHONE_REGEX = re.compile(r'^[\d\s\-\+\(\)]{7,20}$')


def validate_email(email: str) -> str:
    """Validate email format."""
    if not EMAIL_REGEX.match(email):
        raise ValueError("Invalid email format")
    return email.lower().strip()


def validate_url(url: str, field_name: str) -> str:
    """Validate URL format."""
    if url and not URL_REGEX.match(url):
        raise ValueError(f"Invalid URL format for {field_name}")
    return url


# ===== USER SCHEMAS =====
class UserCreate(BaseModel):
    """Schema for creating a new user."""
    name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    email: str = Field(..., description="User's email address")
    education: Optional[str] = Field(None, max_length=200, description="User's degree/education level")
    specialization: Optional[str] = Field(None, max_length=200, description="User's field of study")
    university: Optional[str] = Field(None, max_length=200)
    graduation_year: Optional[int] = Field(None, ge=1950, le=2100)
    location: Optional[str] = Field(None, max_length=100)
    target_role: Optional[str] = Field(None, max_length=100)
    target_sector: str = Field(default="technology", max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    github_url: Optional[str] = Field(None, max_length=500)
    
    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        return validate_email(v)
    
    @field_validator('linkedin_url')
    @classmethod
    def validate_linkedin_url(cls, v):
        if v:
            v = v.strip()
            if v and not ('linkedin.com' in v.lower()):
                raise ValueError("LinkedIn URL must contain 'linkedin.com'")
        return v
    
    @field_validator('github_url')
    @classmethod
    def validate_github_url(cls, v):
        if v:
            v = v.strip()
            if v and not ('github.com' in v.lower()):
                raise ValueError("GitHub URL must contain 'github.com'")
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v and not PHONE_REGEX.match(v):
            raise ValueError("Invalid phone number format")
        return v
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v


class UserUpdate(BaseModel):
    """Schema for updating a user (all fields optional for partial updates)."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[str] = None
    education: Optional[str] = Field(None, max_length=200)
    specialization: Optional[str] = Field(None, max_length=200)
    university: Optional[str] = Field(None, max_length=200)
    graduation_year: Optional[int] = Field(None, ge=1950, le=2100)
    location: Optional[str] = Field(None, max_length=100)
    target_role: Optional[str] = Field(None, max_length=100)
    target_sector: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    github_url: Optional[str] = Field(None, max_length=500)
    
    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        if v:
            return validate_email(v)
        return v


class ResumeUpload(BaseModel):
    """Schema for resume text upload."""
    resume_text: str = Field(..., min_length=100, max_length=100000, description="Resume content as text")
    
    @field_validator('resume_text')
    @classmethod
    def validate_resume_text(cls, v):
        v = v.strip()
        if len(v) < 100:
            raise ValueError("Resume text must be at least 100 characters")
        return v


class UserResponse(BaseModel):
    """Schema for user response."""
    id: int
    name: str
    email: str
    education: Optional[str] = None
    specialization: Optional[str] = None
    university: Optional[str] = None
    graduation_year: Optional[int] = None
    location: Optional[str] = None
    target_role: Optional[str] = None
    target_sector: str = "technology"
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    resume_path: Optional[str] = None
    resume_filename: Optional[str] = None
    has_resume: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== COURSE SCHEMAS =====
class CourseCreate(BaseModel):
    """Schema for adding a course."""
    course_name: str = Field(..., min_length=3, max_length=200)
    platform: Optional[str] = Field(None, max_length=100)
    instructor: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=20)
    completion_date: Optional[str] = Field(None, max_length=50)
    duration: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, min_length=20, max_length=5000)
    certificate_url: Optional[str] = Field(None, max_length=500)


class CourseUpdate(BaseModel):
    """Schema for updating a course (all fields optional for partial updates)."""
    course_name: Optional[str] = Field(None, min_length=3, max_length=200)
    platform: Optional[str] = Field(None, max_length=100)
    instructor: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=20)
    completion_date: Optional[str] = Field(None, max_length=50)
    duration: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    certificate_url: Optional[str] = Field(None, max_length=500)


class CourseResponse(BaseModel):
    """Schema for course response."""
    id: int
    user_id: int
    course_name: str
    platform: Optional[str] = None
    instructor: Optional[str] = None
    grade: Optional[str] = None
    completion_date: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    certificate_url: Optional[str] = None
    skills_extracted: Optional[List[str]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== PROJECT SCHEMAS =====
class ProjectCreate(BaseModel):
    """Schema for adding a project."""
    project_name: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=50, max_length=10000)
    tech_stack: Optional[List[str]] = Field(default_factory=list, max_length=50)
    role: Optional[str] = Field(None, max_length=100)
    team_size: Optional[int] = Field(None, ge=1, le=1000)
    duration: Optional[str] = Field(None, max_length=50)
    github_link: Optional[str] = Field(None, max_length=500)
    deployed_link: Optional[str] = Field(None, max_length=500)
    project_type: Optional[str] = Field(None, max_length=50)
    impact: Optional[str] = Field(None, max_length=2000)


class ProjectUpdate(BaseModel):
    """Schema for updating a project (all fields optional for partial updates)."""
    project_name: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    role: Optional[str] = Field(None, max_length=100)
    team_size: Optional[int] = Field(None, ge=1, le=1000)
    duration: Optional[str] = Field(None, max_length=50)
    github_link: Optional[str] = Field(None, max_length=500)
    deployed_link: Optional[str] = Field(None, max_length=500)
    project_type: Optional[str] = Field(None, max_length=50)
    impact: Optional[str] = Field(None, max_length=2000)


class ProjectResponse(BaseModel):
    """Schema for project response."""
    id: int
    user_id: int
    project_name: str
    description: str
    tech_stack: Optional[List[str]] = None
    role: Optional[str] = None
    team_size: Optional[int] = None
    duration: Optional[str] = None
    github_link: Optional[str] = None
    deployed_link: Optional[str] = None
    project_type: Optional[str] = None
    impact: Optional[str] = None
    skills_extracted: Optional[List[str]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ===== SKILL SCHEMAS =====
class UserSkillResponse(BaseModel):
    """Schema for user skill response."""
    id: int
    user_id: int
    skill_name: str
    proficiency: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    source_count: int = Field(ge=0)
    sources: Optional[List[str]] = None
    
    class Config:
        from_attributes = True


# ===== PROFILE SUMMARY =====
class ProfileSummary(BaseModel):
    """Complete user profile summary."""
    user: UserResponse
    total_courses: int = Field(ge=0)
    total_projects: int = Field(ge=0)
    total_certifications: int = Field(ge=0)
    total_work_experience: int = Field(ge=0)
    total_skills: int = Field(ge=0)
    profile_completion: float = Field(ge=0.0, le=100.0)


# ===== JOB SCHEMAS =====
class JobSearchRequest(BaseModel):
    """Schema for job search request."""
    title: str = Field(default="Data Analyst", max_length=200)
    location: str = Field(default="United States", max_length=100)
    limit: int = Field(default=50, ge=1, le=100)


class JobResponse(BaseModel):
    """Schema for job response."""
    id: str
    title: str
    company: str
    location: str
    description: Optional[str] = None
    posted_date: Optional[str] = None
    salary: Optional[str] = None
    url: Optional[str] = None


# ===== GAP ANALYSIS SCHEMAS =====
class SkillGap(BaseModel):
    """Schema for skill gap information."""
    skill: str
    user_proficiency: float = Field(ge=0.0, le=1.0)
    market_requirement: float = Field(ge=0.0, le=1.0)
    gap: float
    priority: str = Field(pattern="^(CRITICAL|IMPORTANT|EMERGING|STRENGTH)$")
    impact: Optional[str] = None


class GapAnalysisResponse(BaseModel):
    """Schema for gap analysis response."""
    user_id: int
    target_role: str
    overall_readiness: float = Field(ge=0.0, le=100.0)
    critical_gaps: List[SkillGap]
    important_gaps: List[SkillGap]
    strengths: List[SkillGap]


# ===== COURSE RECOMMENDATION SCHEMAS =====
class CourseRecommendation(BaseModel):
    """Schema for course recommendation."""
    course_name: str
    platform: str
    url: str
    description: Optional[str] = None
    skill_targeted: str
    rating: Optional[float] = Field(None, ge=0.0, le=5.0)
    duration: Optional[str] = None
    cost: Optional[str] = None


# ===== PAGINATION HELPERS =====
def create_pagination_meta(page: int, per_page: int, total: int) -> ResponseMeta:
    """Create pagination metadata."""
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return ResponseMeta(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )
