"""Custom exception classes for the SkillBridge Career Intelligence API."""
from fastapi import HTTPException, status
from typing import Optional, Dict, Any


class APIException(HTTPException):
    """Base exception class for API errors."""
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code or f"ERR_{status_code}"


class NotFoundException(APIException):
    """Resource not found exception."""
    
    def __init__(self, resource: str, resource_id: Optional[Any] = None):
        detail = f"{resource} not found"
        if resource_id is not None:
            detail = f"{resource} with ID {resource_id} not found"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND"
        )


class UserNotFoundException(NotFoundException):
    """User not found exception."""
    
    def __init__(self, user_id: int):
        super().__init__("User", user_id)


class CourseNotFoundException(NotFoundException):
    """Course not found exception."""
    
    def __init__(self, course_id: int):
        super().__init__("Course", course_id)


class ProjectNotFoundException(NotFoundException):
    """Project not found exception."""
    
    def __init__(self, project_id: int):
        super().__init__("Project", project_id)


class ResumeNotFoundException(NotFoundException):
    """Resume not found exception."""
    
    def __init__(self, user_id: int):
        super().__init__(f"Resume for user {user_id}", None)


class ValidationError(APIException):
    """Input validation error."""
    
    def __init__(self, detail: str, field: Optional[str] = None):
        message = detail
        if field:
            message = f"Validation error on field '{field}': {detail}"
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
            error_code="VALIDATION_ERROR"
        )


class DuplicateResourceError(APIException):
    """Resource already exists error."""
    
    def __init__(self, resource: str, field: str, value: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{resource} with {field} '{value}' already exists",
            error_code="DUPLICATE_RESOURCE"
        )


class ServiceUnavailableError(APIException):
    """External service unavailable error."""
    
    def __init__(self, service: str, detail: Optional[str] = None):
        message = f"{service} is currently unavailable"
        if detail:
            message = f"{message}: {detail}"
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=message,
            error_code="SERVICE_UNAVAILABLE"
        )


class RateLimitExceededError(APIException):
    """Rate limit exceeded error."""
    
    def __init__(self, retry_after: Optional[int] = None):
        headers = {}
        if retry_after:
            headers["Retry-After"] = str(retry_after)
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down your requests.",
            error_code="RATE_LIMIT_EXCEEDED",
            headers=headers if headers else None
        )


class AuthenticationError(APIException):
    """Authentication required or failed."""
    
    def __init__(self, detail: str = "Authentication required"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code="AUTHENTICATION_ERROR",
            headers={"WWW-Authenticate": "Bearer"}
        )


class AuthorizationError(APIException):
    """Authorization/permission denied."""
    
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="AUTHORIZATION_ERROR"
        )


class FileProcessingError(APIException):
    """Error processing uploaded file."""
    
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File processing error: {detail}",
            error_code="FILE_PROCESSING_ERROR"
        )


class DatabaseError(APIException):
    """Database operation error."""
    
    def __init__(self, detail: str = "Database operation failed"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DATABASE_ERROR"
        )
