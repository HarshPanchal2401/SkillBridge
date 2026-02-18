"""Project endpoints router with enhanced validation and response format."""
import json
from typing import List, Optional

from fastapi import APIRouter, Query

from app.database import get_db
from app import schemas
from app.exceptions import (
    UserNotFoundException,
    ProjectNotFoundException,
    ValidationError
)
from app.logging_config import get_logger

router = APIRouter(prefix="/api/users/{user_id}/projects", tags=["Projects"])
logger = get_logger("projects")


def _verify_user_exists(cursor, user_id: int) -> None:
    """Helper to verify user exists."""
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        raise UserNotFoundException(user_id)


def _parse_json_field(json_str: str) -> List[str]:
    """Parse JSON field safely."""
    if json_str:
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return []
    return []


def _format_project(row) -> dict:
    """Format a project row for response."""
    project = dict(row)
    project['tech_stack'] = _parse_json_field(project.get('tech_stack'))
    project['skills_extracted'] = _parse_json_field(project.get('skills_extracted'))
    return project


@router.post("", response_model=schemas.ProjectResponse, status_code=201)
def add_project(user_id: int, project: schemas.ProjectCreate):
    """
    Add a project for a user.
    
    - **project_name**: Name of the project (required, min 3 chars)
    - **description**: Project description (required, min 50 chars)
    - **tech_stack**: List of technologies used
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Insert project
        tech_stack_json = json.dumps(project.tech_stack) if project.tech_stack else None
        
        cursor.execute('''
            INSERT INTO projects (user_id, project_name, description, tech_stack, role, 
                                team_size, duration, github_link, deployed_link, 
                                project_type, impact)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, project.project_name, project.description, tech_stack_json,
              project.role, project.team_size, project.duration, project.github_link,
              project.deployed_link, project.project_type, project.impact))
        
        project_id = cursor.lastrowid
        logger.info(f"Added project {project_id} for user {user_id}: {project.project_name}")
        
        # Get created project
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        
        return _format_project(row)


@router.get("", response_model=List[schemas.ProjectResponse])
def get_user_projects(
    user_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    project_type: Optional[str] = Query(None, description="Filter by project type")
):
    """
    Get all projects for a user with pagination.
    
    - **page**: Page number (default: 1)
    - **per_page**: Items per page (default: 20, max: 100)
    - **project_type**: Optional filter by project type
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        offset = (page - 1) * per_page
        
        if project_type:
            cursor.execute(
                """SELECT * FROM projects 
                   WHERE user_id = ? AND project_type LIKE ? 
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?""",
                (user_id, f"%{project_type}%", per_page, offset)
            )
        else:
            cursor.execute(
                """SELECT * FROM projects 
                   WHERE user_id = ?
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?""",
                (user_id, per_page, offset)
            )
        
        rows = cursor.fetchall()
        return [_format_project(row) for row in rows]


@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def get_project(user_id: int, project_id: int):
    """Get a specific project by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        cursor.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id)
        )
        row = cursor.fetchone()
        
        if not row:
            raise ProjectNotFoundException(project_id)
        
        return _format_project(row)


@router.put("/{project_id}", response_model=schemas.ProjectResponse)
def update_project(user_id: int, project_id: int, project: schemas.ProjectUpdate):
    """
    Update a project.
    
    Only provided fields will be updated. Omit fields to keep current values.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Verify project exists and belongs to user
        cursor.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id)
        )
        existing = cursor.fetchone()
        if not existing:
            raise ProjectNotFoundException(project_id)
        
        # Get only the fields that were actually provided (not None)
        update_data = project.model_dump(exclude_unset=True)
        
        if not update_data:
            raise ValidationError("No fields to update")
        
        # Handle tech_stack serialization if provided
        if 'tech_stack' in update_data and update_data['tech_stack'] is not None:
            update_data['tech_stack'] = json.dumps(update_data['tech_stack'])
        
        # Build dynamic UPDATE query
        set_clauses = []
        values = []
        for field, value in update_data.items():
            set_clauses.append(f"{field} = ?")
            values.append(value)
        
        values.append(project_id)
        query = f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = ?"
        cursor.execute(query, values)
        
        logger.info(f"Updated project {project_id}: {list(update_data.keys())}")
        
        # Get updated project
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        
        return _format_project(row)


@router.delete("/{project_id}")
def delete_project(user_id: int, project_id: int):
    """Delete a project."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Verify project exists and belongs to user
        cursor.execute(
            "SELECT id, project_name FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id)
        )
        project = cursor.fetchone()
        if not project:
            raise ProjectNotFoundException(project_id)
        
        # Delete project
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        
        logger.info(f"Deleted project {project_id} for user {user_id}")
        
        return {
            "success": True,
            "message": "Project deleted successfully",
            "data": {"project_id": project_id}
        }
