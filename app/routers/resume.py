"""Resume upload endpoints router with enhanced validation and response format."""
import os
from typing import Optional

from fastapi import APIRouter, File, UploadFile

from app.database import get_db
from app import schemas
from app.routers.dependencies import get_services
from app.exceptions import (
    UserNotFoundException,
    ResumeNotFoundException,
    ValidationError,
    FileProcessingError
)
from app.logging_config import get_logger

router = APIRouter(prefix="/api/users/{user_id}/resume", tags=["Resume"])
logger = get_logger("resume")

# Allowed file extensions
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.doc'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _verify_user_exists(cursor, user_id: int) -> dict:
    """Helper to verify user exists and return user data."""
    cursor.execute("SELECT id, name FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise UserNotFoundException(user_id)
    return dict(user)


def _validate_file(file: UploadFile) -> str:
    """Validate uploaded file and return extension."""
    if not file.filename:
        raise ValidationError("Filename is required")
    
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"Invalid file type '{file_extension}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            field="file"
        )
    
    return file_extension


@router.post("/upload", status_code=201)
async def upload_resume(user_id: int, file: UploadFile = File(...)):
    """
    Upload resume file for a user.
    
    Supports: PDF, TXT, DOCX, DOC
    Max file size: 10 MB
    """
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        user = _verify_user_exists(cursor, user_id)
        
        # Validate file
        file_extension = _validate_file(file)
        
        # Read file content
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_FILE_SIZE:
            raise ValidationError(
                f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB",
                field="file"
            )
        
        # Save file
        safe_filename = f"user_{user_id}_resume{file_extension}"
        file_path = os.path.join(services.upload_dir, safe_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                buffer.write(content)
        except IOError as e:
            logger.error(f"Failed to save resume file: {e}")
            raise FileProcessingError(f"Failed to save file: {str(e)}")
        
        # Extract text if possible
        resume_text = None
        if file_extension == '.txt':
            try:
                resume_text = content.decode('utf-8')
            except UnicodeDecodeError:
                resume_text = content.decode('latin-1', errors='ignore')
        
        # Update database - always clear resume_text so skills are re-extracted from new file
        original_filename = file.filename
        if resume_text:
            cursor.execute(
                "UPDATE users SET resume_path = ?, resume_text = ?, resume_filename = ? WHERE id = ?",
                (file_path, resume_text, original_filename, user_id)
            )
        else:
            cursor.execute(
                "UPDATE users SET resume_path = ?, resume_text = NULL, resume_filename = ? WHERE id = ?",
                (file_path, original_filename, user_id)
            )
        
        logger.info(f"Uploaded resume for user {user_id}: {safe_filename}")
        
        return {
            "success": True,
            "message": "Resume uploaded successfully",
            "data": {
                "user_id": user_id,
                "filename": safe_filename,
                "file_path": file_path,
                "file_size": len(content),
                "file_type": file_extension
            }
        }


@router.post("/upload-text", status_code=201)
def upload_resume_text(user_id: int, resume_data: schemas.ResumeUpload):
    """
    Upload resume as text (for copy-paste functionality).
    
    Useful when users don't have resume file or want to paste content directly.
    Minimum 100 characters required.
    """
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        _verify_user_exists(cursor, user_id)
        
        # Save resume text to file
        safe_filename = f"user_{user_id}_resume.txt"
        file_path = os.path.join(services.upload_dir, safe_filename)
        
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(resume_data.resume_text)
        except IOError as e:
            logger.error(f"Failed to save resume text: {e}")
            raise FileProcessingError(f"Failed to save resume text: {str(e)}")
        
        # Update database with both path and text
        cursor.execute(
            "UPDATE users SET resume_path = ?, resume_text = ? WHERE id = ?",
            (file_path, resume_data.resume_text, user_id)
        )
        
        logger.info(f"Uploaded resume text for user {user_id}")
        
        return {
            "success": True,
            "message": "Resume text uploaded successfully",
            "data": {
                "user_id": user_id,
                "filename": safe_filename,
                "text_length": len(resume_data.resume_text)
            }
        }


@router.get("/text")
def get_resume_text(user_id: int):
    """
    Get resume text for a user.
    
    Returns the resume content either from database or from file.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT resume_text, resume_path FROM users WHERE id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            raise UserNotFoundException(user_id)
        
        resume_text = row['resume_text']
        resume_path = row['resume_path']
        
        if not resume_text and not resume_path:
            raise ResumeNotFoundException(user_id)
        
        # If we have text, return it
        if resume_text:
            return {
                "success": True,
                "message": "Resume text retrieved",
                "data": {
                    "user_id": user_id,
                    "resume_text": resume_text,
                    "source": "database",
                    "text_length": len(resume_text)
                }
            }
        
        # If we only have file path, try to read it
        if resume_path and os.path.exists(resume_path):
            try:
                with open(resume_path, "r", encoding="utf-8") as f:
                    content = f.read()
                return {
                    "success": True,
                    "message": "Resume text retrieved",
                    "data": {
                        "user_id": user_id,
                        "resume_text": content,
                        "source": "file",
                        "file_path": resume_path,
                        "text_length": len(content)
                    }
                }
            except UnicodeDecodeError:
                # Try with latin-1 encoding
                with open(resume_path, "r", encoding="latin-1") as f:
                    content = f.read()
                return {
                    "success": True,
                    "message": "Resume text retrieved",
                    "data": {
                        "user_id": user_id,
                        "resume_text": content,
                        "source": "file",
                        "file_path": resume_path,
                        "text_length": len(content)
                    }
                }
            except Exception as e:
                logger.error(f"Error reading resume file: {e}")
                raise FileProcessingError(f"Error reading resume: {str(e)}")
        
        raise ResumeNotFoundException(user_id)


@router.get("/info")
def get_resume_info(user_id: int):
    """
    Get resume metadata for a user (without full text).
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT resume_text, resume_path FROM users WHERE id = ?",
            (user_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            raise UserNotFoundException(user_id)
        
        resume_text = row['resume_text']
        resume_path = row['resume_path']
        
        has_resume = bool(resume_text or resume_path)
        
        info = {
            "user_id": user_id,
            "has_resume": has_resume,
            "text_length": len(resume_text) if resume_text else 0,
            "file_path": resume_path
        }
        
        # Get file size if file exists
        if resume_path and os.path.exists(resume_path):
            info["file_size"] = os.path.getsize(resume_path)
            info["file_type"] = os.path.splitext(resume_path)[1]
        
        return {
            "success": True,
            "message": "Resume info retrieved",
            "data": info
        }


@router.delete("")
def delete_resume(user_id: int):
    """
    Delete resume for a user.
    
    Removes both the file and database entries.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user
        cursor.execute("SELECT resume_path FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        
        if not row:
            raise UserNotFoundException(user_id)
        
        resume_path = row['resume_path']
        
        # Delete file if exists
        if resume_path and os.path.exists(resume_path):
            try:
                os.remove(resume_path)
                logger.info(f"Deleted resume file: {resume_path}")
            except OSError as e:
                logger.warning(f"Could not delete resume file: {e}")
        
        # Update database
        cursor.execute(
            "UPDATE users SET resume_path = NULL, resume_text = NULL WHERE id = ?",
            (user_id,)
        )
        
        logger.info(f"Deleted resume for user {user_id}")
        
        return {
            "success": True,
            "message": "Resume deleted successfully",
            "data": {"user_id": user_id}
        }
