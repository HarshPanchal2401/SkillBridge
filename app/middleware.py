"""Custom middleware for the Healthcare Skill Intelligence API."""
import time
import uuid
from typing import Callable, Dict
from collections import defaultdict
from threading import Lock

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.logging_config import get_logger, log_request


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging all HTTP requests."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]
        
        # Add request ID to state for use in handlers
        request.state.request_id = request_id
        
        # Record start time
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Log the request
        log_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms
        )
        
        # Add request ID and timing headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Cache control for API responses
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware.
    
    Limits requests per IP address within a time window.
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        exclude_paths: list = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/redoc", "/openapi.json"]
        
        # Track requests: {ip: [(timestamp, ...], ...}
        self._minute_requests: Dict[str, list] = defaultdict(list)
        self._hour_requests: Dict[str, list] = defaultdict(list)
        self._lock = Lock()
        
        self.logger = get_logger("ratelimit")
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request."""
        # Check for forwarded headers (for reverse proxy setups)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _clean_old_requests(self, ip: str, current_time: float) -> None:
        """Remove expired request timestamps."""
        minute_ago = current_time - 60
        hour_ago = current_time - 3600
        
        self._minute_requests[ip] = [
            t for t in self._minute_requests[ip] if t > minute_ago
        ]
        self._hour_requests[ip] = [
            t for t in self._hour_requests[ip] if t > hour_ago
        ]
    
    def _is_rate_limited(self, ip: str) -> tuple:
        """
        Check if IP is rate limited.
        
        Returns:
            (is_limited: bool, retry_after: int or None)
        """
        current_time = time.time()
        
        with self._lock:
            self._clean_old_requests(ip, current_time)
            
            # Check minute limit
            if len(self._minute_requests[ip]) >= self.requests_per_minute:
                oldest = min(self._minute_requests[ip]) if self._minute_requests[ip] else current_time
                retry_after = int(60 - (current_time - oldest)) + 1
                return True, retry_after
            
            # Check hour limit
            if len(self._hour_requests[ip]) >= self.requests_per_hour:
                oldest = min(self._hour_requests[ip]) if self._hour_requests[ip] else current_time
                retry_after = int(3600 - (current_time - oldest)) + 1
                return True, retry_after
            
            # Record this request
            self._minute_requests[ip].append(current_time)
            self._hour_requests[ip].append(current_time)
            
            return False, None
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        is_limited, retry_after = self._is_rate_limited(client_ip)
        
        if is_limited:
            self.logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return Response(
                content='{"detail": "Rate limit exceeded. Please slow down your requests.", "error_code": "RATE_LIMIT_EXCEEDED"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(retry_after)} if retry_after else {}
            )
        
        # Add rate limit headers
        response = await call_next(request)
        
        with self._lock:
            remaining_minute = self.requests_per_minute - len(self._minute_requests[client_ip])
            remaining_hour = self.requests_per_hour - len(self._hour_requests[client_ip])
        
        response.headers["X-RateLimit-Limit-Minute"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining-Minute"] = str(max(0, remaining_minute))
        response.headers["X-RateLimit-Limit-Hour"] = str(self.requests_per_hour)
        response.headers["X-RateLimit-Remaining-Hour"] = str(max(0, remaining_hour))
        
        return response


def get_rate_limit_stats(middleware: RateLimitMiddleware) -> Dict:
    """Get rate limiting statistics."""
    with middleware._lock:
        return {
            "tracked_ips": len(middleware._minute_requests),
            "limits": {
                "per_minute": middleware.requests_per_minute,
                "per_hour": middleware.requests_per_hour
            }
        }
