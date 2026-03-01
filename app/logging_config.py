"""Logging configuration for the SkillBridge Career Intelligence API."""
import logging
import sys
from datetime import datetime
from typing import Optional
import os


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for console output."""
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # Add color to log level
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
        return super().format(record)


def setup_logging(
    level: str = "INFO",
    log_file: Optional[str] = None,
    json_format: bool = False
) -> logging.Logger:
    """
    Configure application logging.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path for logging
        json_format: Whether to use JSON format for logs
    
    Returns:
        Configured logger instance
    """
    # Get log level from environment or use default
    log_level = os.getenv("LOG_LEVEL", level).upper()
    
    # Create logger
    logger = logging.getLogger("skillbridge_api")
    logger.setLevel(getattr(logging, log_level, logging.INFO))
    logger.handlers = []  # Clear existing handlers
    
    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    
    if json_format:
        console_format = '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "%(module)s", "message": "%(message)s"}'
        console_handler.setFormatter(logging.Formatter(console_format))
    else:
        console_format = "%(asctime)s | %(levelname)-8s | %(module)s:%(lineno)d | %(message)s"
        console_handler.setFormatter(ColoredFormatter(console_format, datefmt="%Y-%m-%d %H:%M:%S"))
    
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_format = "%(asctime)s | %(levelname)-8s | %(module)s:%(lineno)d | %(message)s"
        file_handler.setFormatter(logging.Formatter(file_format, datefmt="%Y-%m-%d %H:%M:%S"))
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get a logger instance.
    
    Args:
        name: Optional name for the logger (creates child logger)
    
    Returns:
        Logger instance
    """
    base_logger = logging.getLogger("skillbridge_api")
    if name:
        return base_logger.getChild(name)
    return base_logger


# Request logging utilities
def log_request(method: str, path: str, status_code: int, duration_ms: float):
    """Log HTTP request details."""
    logger = get_logger("request")
    
    # Color code based on status
    if status_code < 400:
        level = logging.INFO
    elif status_code < 500:
        level = logging.WARNING
    else:
        level = logging.ERROR
    
    logger.log(level, f"{method} {path} -> {status_code} ({duration_ms:.2f}ms)")


def log_database_query(query: str, duration_ms: float):
    """Log database query details."""
    logger = get_logger("database")
    # Truncate long queries
    truncated = query[:100] + "..." if len(query) > 100 else query
    logger.debug(f"Query: {truncated} ({duration_ms:.2f}ms)")


def log_service_call(service: str, operation: str, success: bool, duration_ms: Optional[float] = None):
    """Log external service calls."""
    logger = get_logger("service")
    status = "✓" if success else "✗"
    duration_str = f" ({duration_ms:.2f}ms)" if duration_ms else ""
    level = logging.INFO if success else logging.WARNING
    logger.log(level, f"{service}.{operation} {status}{duration_str}")


# Initialize default logger
_default_logger = None

def init_logging():
    """Initialize default logging configuration."""
    global _default_logger
    if _default_logger is None:
        _default_logger = setup_logging()
    return _default_logger
