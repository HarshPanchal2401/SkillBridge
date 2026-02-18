"""Course endpoints router with enhanced validation and response format."""
import json
from typing import List, Optional

from fastapi import APIRouter, Query

from app.database import get_db
from app import schemas
from app.exceptions import (
    UserNotFoundException,
    CourseNotFoundException,
    ValidationError
)
from app.logging_config import get_logger

router = APIRouter(prefix="/api/users/{user_id}/courses", tags=["Courses"])
logger = get_logger("courses")


def _verify_user_exists(cursor, user_id: int) -> None:
    """Helper to verify user exists."""
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        raise UserNotFoundException(user_id)


def _parse_skills(skills_json: str) -> List[str]:
    """Parse skills JSON safely."""
    if skills_json:
        try:
            return json.loads(skills_json)
        except json.JSONDecodeError:
            return []
    return []


def _format_course(row) -> dict:
    """Format a course row for response."""
    course = dict(row)
    course['skills_extracted'] = _parse_skills(course.get('skills_extracted'))
    return course


@router.post("", response_model=schemas.CourseResponse, status_code=201)
def add_course(user_id: int, course: schemas.CourseCreate):
    """
    Add a course for a user.
    
    - **course_name**: Name of the course (required, min 3 chars)
    - **platform**: Platform name (e.g., Coursera, Udemy)
    - **description**: Course description (min 20 chars if provided)
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Insert course
        cursor.execute('''
            INSERT INTO courses (user_id, course_name, platform, instructor, grade, 
                               completion_date, duration, description, certificate_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, course.course_name, course.platform, course.instructor, 
              course.grade, course.completion_date, course.duration, 
              course.description, course.certificate_url))
        
        course_id = cursor.lastrowid
        logger.info(f"Added course {course_id} for user {user_id}: {course.course_name}")
        
        # Get created course
        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        row = cursor.fetchone()
        
        return _format_course(row)


@router.get("", response_model=List[schemas.CourseResponse])
def get_user_courses(
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    platform: Optional[str] = Query(None, description="Filter by platform")
):
    """
    Get all courses for a user with pagination.
    
    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    - **platform**: Optional filter by platform name
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        offset = (page - 1) * per_page
        
        if platform:
            cursor.execute(
                """SELECT * FROM courses 
                   WHERE user_id = ? AND platform LIKE ? 
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?""",
                (user_id, f"%{platform}%", per_page, offset)
            )
        else:
            cursor.execute(
                """SELECT * FROM courses 
                   WHERE user_id = ? 
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?""",
                (user_id, per_page, offset)
            )
        
        rows = cursor.fetchall()
        return [_format_course(row) for row in rows]


@router.get("/{course_id}", response_model=schemas.CourseResponse)
def get_course(user_id: int, course_id: int):
    """Get a specific course by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        cursor.execute(
            "SELECT * FROM courses WHERE id = ? AND user_id = ?",
            (course_id, user_id)
        )
        row = cursor.fetchone()
        
        if not row:
            raise CourseNotFoundException(course_id)
        
        return _format_course(row)


@router.put("/{course_id}", response_model=schemas.CourseResponse)
def update_course(user_id: int, course_id: int, course: schemas.CourseUpdate):
    """
    Update a course.
    
    Only provided fields will be updated. Omit fields to keep current values.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Verify course exists and belongs to user
        cursor.execute(
            "SELECT * FROM courses WHERE id = ? AND user_id = ?",
            (course_id, user_id)
        )
        existing = cursor.fetchone()
        if not existing:
            raise CourseNotFoundException(course_id)
        
        # Get only the fields that were actually provided (not None)
        update_data = course.model_dump(exclude_unset=True)
        
        if not update_data:
            raise ValidationError("No fields to update")
        
        # Build dynamic UPDATE query
        set_clauses = []
        values = []
        for field, value in update_data.items():
            set_clauses.append(f"{field} = ?")
            values.append(value)
        
        values.append(course_id)
        query = f"UPDATE courses SET {', '.join(set_clauses)} WHERE id = ?"
        cursor.execute(query, values)
        
        logger.info(f"Updated course {course_id}: {list(update_data.keys())}")
        
        # Get updated course
        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        row = cursor.fetchone()
        
        return _format_course(row)


@router.delete("/{course_id}")
def delete_course(user_id: int, course_id: int):
    """Delete a course."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Verify course exists and belongs to user
        cursor.execute(
            "SELECT id, course_name FROM courses WHERE id = ? AND user_id = ?",
            (course_id, user_id)
        )
        course = cursor.fetchone()
        if not course:
            raise CourseNotFoundException(course_id)
        
        # Delete course
        cursor.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        
        logger.info(f"Deleted course {course_id} for user {user_id}")
        
        return {
            "success": True,
            "message": "Course deleted successfully",
            "data": {"course_id": course_id}
        }
