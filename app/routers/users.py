"""User endpoints router with enhanced validation and response format."""
from typing import List, Optional

from fastapi import APIRouter, Query

from app.database import get_db
from app import schemas
from app.schemas import create_pagination_meta
from app.exceptions import (
    UserNotFoundException,
    DuplicateResourceError,
    ValidationError
)
from app.logging_config import get_logger

router = APIRouter(prefix="/api/users", tags=["Users"])
logger = get_logger("users")


@router.post("/register", response_model=schemas.UserResponse, status_code=201)
def register_user(user: schemas.UserCreate):
    """
    Register a new user.
    
    - **name**: User's full name (2-100 characters)
    - **email**: User's email (must be unique, valid format)
    - **education**: Degree and major
    - **target_role**: Target healthcare role
    
    Returns the created user with generated ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
        if cursor.fetchone():
            logger.warning(f"Registration attempt with existing email: {user.email}")
            raise DuplicateResourceError("User", "email", user.email)
        
        # Insert new user
        cursor.execute('''
            INSERT INTO users (name, email, education, specialization, university, graduation_year, location, 
                             target_role, target_sector, phone, linkedin_url, github_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user.name, user.email, user.education, user.specialization, user.university, user.graduation_year,
              user.location, user.target_role, user.target_sector, user.phone, 
              user.linkedin_url, user.github_url))
        
        user_id = cursor.lastrowid
        logger.info(f"Created new user: {user_id} ({user.email})")
        
        # Get created user
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        
        result = dict(row)
        result['has_resume'] = bool(result.get('resume_path'))
        return result


@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int):
    """
    Get user by ID.
    
    Returns user details including profile information and resume status.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        
        if not row:
            raise UserNotFoundException(user_id)
        
        user = dict(row)
        user['has_resume'] = bool(user.get('resume_path'))
        return user


@router.get("/{user_id}/profile", response_model=schemas.ProfileSummary)
def get_user_profile(user_id: int):
    """
    Get complete user profile with statistics.
    
    Returns user details along with counts of courses, projects, skills, etc.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            raise UserNotFoundException(user_id)
        
        # Count related items
        cursor.execute("SELECT COUNT(*) as count FROM courses WHERE user_id = ?", (user_id,))
        total_courses = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM projects WHERE user_id = ?", (user_id,))
        total_projects = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM certifications WHERE user_id = ?", (user_id,))
        total_certifications = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM work_experience WHERE user_id = ?", (user_id,))
        total_work_experience = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM user_skills WHERE user_id = ?", (user_id,))
        total_skills = cursor.fetchone()['count']
        
        user = dict(user_row)
        user['has_resume'] = bool(user.get('resume_path'))
        
        # Calculate profile completion
        fields_filled = sum([
            bool(user.get('name')),
            bool(user.get('email')),
            bool(user.get('education')),
            bool(user.get('location')),
            bool(user.get('target_role')),
            bool(user.get('resume_path')),
            total_courses > 0,
            total_projects > 0,
        ])
        profile_completion = round((fields_filled / 8) * 100, 1)
        
        return {
            "user": user,
            "total_courses": total_courses,
            "total_projects": total_projects,
            "total_certifications": total_certifications,
            "total_work_experience": total_work_experience,
            "total_skills": total_skills,
            "profile_completion": profile_completion
        }


@router.get("", response_model=List[schemas.UserResponse])
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or email")
):
    """
    List all users with pagination.
    
    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    - **search**: Optional search term for name or email
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        offset = (page - 1) * per_page
        
        if search:
            search_pattern = f"%{search}%"
            cursor.execute(
                "SELECT * FROM users WHERE name LIKE ? OR email LIKE ? LIMIT ? OFFSET ?",
                (search_pattern, search_pattern, per_page, offset)
            )
        else:
            cursor.execute("SELECT * FROM users LIMIT ? OFFSET ?", (per_page, offset))
        
        rows = cursor.fetchall()
        
        users = []
        for row in rows:
            user = dict(row)
            user['has_resume'] = bool(user.get('resume_path'))
            users.append(user)
        
        return users


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user: schemas.UserUpdate):
    """
    Update user by ID.
    
    Only provided fields will be updated. Omit fields to keep current values.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists and get current data
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        existing = cursor.fetchone()
        if not existing:
            raise UserNotFoundException(user_id)
        
        # Get only the fields that were actually provided (not None)
        update_data = user.model_dump(exclude_unset=True)
        
        if not update_data:
            raise ValidationError("No fields to update")
        
        # Check for email conflict if email is being updated
        if 'email' in update_data and update_data['email']:
            cursor.execute(
                "SELECT id FROM users WHERE email = ? AND id != ?",
                (update_data['email'], user_id)
            )
            if cursor.fetchone():
                raise DuplicateResourceError("User", "email", update_data['email'])
        
        # Build dynamic UPDATE query
        set_clauses = []
        values = []
        for field, value in update_data.items():
            set_clauses.append(f"{field} = ?")
            values.append(value)
        
        # Add updated_at timestamp
        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        
        values.append(user_id)
        query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"
        cursor.execute(query, values)
        
        logger.info(f"Updated user {user_id}: {list(update_data.keys())}")
        
        # Get updated user
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        
        result = dict(row)
        result['has_resume'] = bool(result.get('resume_path'))
        return result


@router.delete("/{user_id}")
def delete_user(user_id: int):
    """
    Delete user by ID.
    
    This will also delete all associated data (courses, projects, skills, etc.)
    due to cascading foreign key constraints.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT id, email FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise UserNotFoundException(user_id)
        
        # Delete user (cascading will handle related data)
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        logger.info(f"Deleted user {user_id} ({user['email']})")
        
        return {
            "success": True,
            "message": "User deleted successfully",
            "data": {"user_id": user_id}
        }
