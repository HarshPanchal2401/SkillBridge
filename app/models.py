"""Database models."""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    """User model - stores basic user information."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    education = Column(String, nullable=True)
    university = Column(String, nullable=True)
    graduation_year = Column(Integer, nullable=True)
    location = Column(String, nullable=True)
    target_role = Column(String, nullable=True)
    target_sector = Column(String, default="healthcare")
    phone = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    certifications = relationship("Certification", back_populates="user", cascade="all, delete-orphan")
    work_experiences = relationship("WorkExperience", back_populates="user", cascade="all, delete-orphan")
    skills = relationship("UserSkill", back_populates="user", cascade="all, delete-orphan")


class Course(Base):
    """Course model - stores courses taken by user."""
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_name = Column(String, nullable=False)
    platform = Column(String, nullable=True)
    instructor = Column(String, nullable=True)
    grade = Column(String, nullable=True)
    completion_date = Column(String, nullable=True)
    duration = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    certificate_url = Column(String, nullable=True)
    skills_extracted = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="courses")


class Project(Base):
    """Project model - stores projects completed by user."""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    tech_stack = Column(JSON, nullable=True)
    role = Column(String, nullable=True)
    team_size = Column(Integer, nullable=True)
    duration = Column(String, nullable=True)
    github_link = Column(String, nullable=True)
    deployed_link = Column(String, nullable=True)
    project_type = Column(String, nullable=True)
    impact = Column(Text, nullable=True)
    skills_extracted = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="projects")


class Certification(Base):
    """Certification model - stores professional certifications."""
    __tablename__ = "certifications"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    certification_name = Column(String, nullable=False)
    issuing_organization = Column(String, nullable=True)
    issue_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    credential_id = Column(String, nullable=True)
    credential_url = Column(String, nullable=True)
    skills_covered = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="certifications")


class WorkExperience(Base):
    """Work experience model - stores internships and work experience."""
    __tablename__ = "work_experience"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_name = Column(String, nullable=False)
    job_title = Column(String, nullable=False)
    employment_type = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    location = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    technologies_used = Column(JSON, nullable=True)
    skills_extracted = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="work_experiences")


class UserSkill(Base):
    """User skill model - stores extracted and aggregated skills."""
    __tablename__ = "user_skills"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_name = Column(String, nullable=False, index=True)
    proficiency = Column(Float, default=0.0)  # 0.0 to 1.0
    confidence = Column(Float, default=0.0)  # 0.0 to 1.0
    source_count = Column(Integer, default=0)
    sources = Column(JSON, nullable=True)  # ["course:5", "project:3"]
    skill_metadata = Column(JSON, nullable=True)  # Extra info - renamed to avoid SQLAlchemy conflict
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="skills")
