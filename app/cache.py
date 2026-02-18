"""Simple in-memory caching utilities for the Healthcare Skill Intelligence API."""
import time
from typing import Any, Optional, Dict, Callable
from functools import wraps
from threading import Lock
import hashlib
import json


class CacheEntry:
    """Represents a cached value with TTL."""
    
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.expires_at = time.time() + ttl_seconds
        self.created_at = time.time()
    
    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        return time.time() > self.expires_at
    
    @property
    def age_seconds(self) -> float:
        """Get age of the cache entry in seconds."""
        return time.time() - self.created_at


class SimpleCache:
    """
    Thread-safe in-memory cache with TTL support.
    
    Usage:
        cache = SimpleCache(default_ttl=300)  # 5 minutes default
        cache.set("key", {"data": "value"})
        value = cache.get("key")
    """
    
    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        """
        Initialize the cache.
        
        Args:
            default_ttl: Default time-to-live in seconds (default: 5 minutes)
            max_size: Maximum number of entries (default: 1000)
        """
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = Lock()
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from the cache.
        
        Args:
            key: Cache key
        
        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            entry = self._cache.get(key)
            
            if entry is None:
                self._misses += 1
                return None
            
            if entry.is_expired():
                del self._cache[key]
                self._misses += 1
                return None
            
            self._hits += 1
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set a value in the cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if not specified)
        """
        with self._lock:
            # Evict expired entries if at max size
            if len(self._cache) >= self._max_size:
                self._evict_expired()
            
            # If still at max size, evict oldest entries
            if len(self._cache) >= self._max_size:
                self._evict_oldest(self._max_size // 4)  # Evict 25%
            
            self._cache[key] = CacheEntry(value, ttl or self._default_ttl)
    
    def delete(self, key: str) -> bool:
        """
        Delete a value from the cache.
        
        Args:
            key: Cache key
        
        Returns:
            True if key existed and was deleted
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            self._cache.clear()
    
    def _evict_expired(self) -> int:
        """Remove all expired entries. Returns count of evicted entries."""
        expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
        for key in expired_keys:
            del self._cache[key]
        return len(expired_keys)
    
    def _evict_oldest(self, count: int) -> None:
        """Evict the oldest entries."""
        sorted_entries = sorted(
            self._cache.items(),
            key=lambda x: x[1].created_at
        )
        for key, _ in sorted_entries[:count]:
            del self._cache[key]
    
    @property
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate_percent": round(hit_rate, 2),
                "default_ttl_seconds": self._default_ttl
            }


# Global cache instance
_cache = SimpleCache(default_ttl=300, max_size=500)


def get_cache() -> SimpleCache:
    """Get the global cache instance."""
    return _cache


def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache function results.
    
    Args:
        ttl: Time-to-live in seconds
        key_prefix: Prefix for cache keys
    
    Usage:
        @cached(ttl=600, key_prefix="courses")
        def get_courses_for_skill(skill: str):
            # expensive operation
            return courses
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            
            key_string = ":".join(key_parts)
            cache_key = hashlib.md5(key_string.encode()).hexdigest()
            
            # Try to get from cache
            cache = get_cache()
            cached_value = cache.get(cache_key)
            
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        
        # Add method to clear cache for this function
        def clear_cache():
            cache = get_cache()
            # Clear all entries (simple approach)
            cache.clear()
        
        wrapper.clear_cache = clear_cache
        return wrapper
    
    return decorator


# Specific cache functions for common operations
def cache_market_requirements(job_title: str, location: str, data: Dict) -> None:
    """Cache market requirements data."""
    key = f"market_req:{job_title}:{location}"
    get_cache().set(key, data, ttl=3600)  # 1 hour


def get_cached_market_requirements(job_title: str, location: str) -> Optional[Dict]:
    """Get cached market requirements data."""
    key = f"market_req:{job_title}:{location}"
    return get_cache().get(key)


def cache_course_recommendations(skill: str, courses: list) -> None:
    """Cache course recommendations for a skill."""
    key = f"courses:{skill.lower()}"
    get_cache().set(key, courses, ttl=1800)  # 30 minutes


def get_cached_course_recommendations(skill: str) -> Optional[list]:
    """Get cached course recommendations for a skill."""
    key = f"courses:{skill.lower()}"
    return get_cache().get(key)
