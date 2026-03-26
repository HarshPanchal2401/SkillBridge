"""Database configuration using pure SQLite3 with enhanced utilities."""
import os
import sqlite3
import json
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List, Dict, Any, Generator
from threading import local

from app.logging_config import get_logger, log_database_query

# Get the base directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(BASE_DIR, "skillbridge.db")

# Thread-local storage for connections
_thread_local = local()

# Logger
logger = get_logger("database")


class DatabaseConfig:
    """Database configuration settings."""
    
    def __init__(
        self,
        database_path: str = DATABASE_PATH,
        timeout: float = 60.0,
        check_same_thread: bool = False,
        isolation_level: Optional[str] = None
    ):
        self.database_path = database_path
        self.timeout = timeout
        self.check_same_thread = check_same_thread
        self.isolation_level = isolation_level


# Default configuration
_config = DatabaseConfig()


def configure_database(
    database_path: Optional[str] = None,
    timeout: Optional[float] = None
) -> None:
    """Configure database settings."""
    global _config
    if database_path:
        _config.database_path = database_path
    if timeout:
        _config.timeout = timeout


def get_db_connection() -> sqlite3.Connection:
    """
    Get a database connection with proper configuration.
    
    Returns a connection configured with:
    - Row factory for dict-like access
    - Foreign keys enabled
    - WAL mode for better concurrency
    """
    conn = sqlite3.connect(
        _config.database_path,
        timeout=_config.timeout,
        check_same_thread=_config.check_same_thread,
        isolation_level=_config.isolation_level
    )
    conn.row_factory = sqlite3.Row
    
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    
    # Use WAL mode for better concurrent access
    conn.execute("PRAGMA journal_mode = WAL")
    
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager for database connections.
    
    Usage:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users")
    """
    conn = get_db_connection()
    start_time = time.time()
    
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {type(e).__name__}: {str(e)}")
        raise
    finally:
        duration_ms = (time.time() - start_time) * 1000
        if duration_ms > 100:  # Log slow transactions
            logger.warning(f"Slow transaction: {duration_ms:.2f}ms")
        conn.close()


class DatabaseSession:
    """
    Database session class for more control over transactions.
    
    Usage:
        session = DatabaseSession()
        try:
            session.execute("INSERT INTO users ...")
            session.commit()
        except Exception:
            session.rollback()
        finally:
            session.close()
    """
    
    def __init__(self):
        self.conn = get_db_connection()
        self.cursor = self.conn.cursor()
        self._closed = False
    
    def execute(self, query: str, params: tuple = ()) -> sqlite3.Cursor:
        """Execute a query with timing."""
        start = time.time()
        result = self.cursor.execute(query, params)
        duration_ms = (time.time() - start) * 1000
        log_database_query(query, duration_ms)
        return result
    
    def executemany(self, query: str, params_list: List[tuple]) -> sqlite3.Cursor:
        """Execute a query with multiple parameter sets."""
        return self.cursor.executemany(query, params_list)
    
    def fetchone(self) -> Optional[sqlite3.Row]:
        """Fetch one result."""
        return self.cursor.fetchone()
    
    def fetchall(self) -> List[sqlite3.Row]:
        """Fetch all results."""
        return self.cursor.fetchall()
    
    def fetchmany(self, size: int = 100) -> List[sqlite3.Row]:
        """Fetch many results."""
        return self.cursor.fetchmany(size)
    
    @property
    def lastrowid(self) -> int:
        """Get the last inserted row ID."""
        return self.cursor.lastrowid
    
    def commit(self) -> None:
        """Commit the transaction."""
        self.conn.commit()
    
    def rollback(self) -> None:
        """Rollback the transaction."""
        self.conn.rollback()
    
    def close(self) -> None:
        """Close the connection."""
        if not self._closed:
            self.conn.close()
            self._closed = True
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()
        return False


# ===== QUERY HELPERS =====

def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert a sqlite3.Row to a dictionary."""
    return dict(row) if row else {}


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    """Convert a list of sqlite3.Row to a list of dictionaries."""
    return [dict(row) for row in rows]


def paginate_query(
    base_query: str,
    page: int = 1,
    per_page: int = 20
) -> tuple:
    """
    Add pagination to a query.
    
    Returns:
        (paginated_query, offset, limit)
    """
    offset = (page - 1) * per_page
    paginated = f"{base_query} LIMIT ? OFFSET ?"
    return paginated, per_page, offset


def get_total_count(table: str, where_clause: str = "", params: tuple = ()) -> int:
    """Get total count for pagination."""
    query = f"SELECT COUNT(*) as count FROM {table}"
    if where_clause:
        query += f" WHERE {where_clause}"
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        result = cursor.fetchone()
        return result['count'] if result else 0


# ===== DATABASE INITIALIZATION =====

def init_db() -> None:
    """Initialize database tables."""
    conn = sqlite3.connect(_config.database_path)
    cursor = conn.cursor()
    
    # Check for outdated roadmap tables and drop if they exist (migration to new schema)
    # The old user_roadmaps table had a 'domain' column which is no longer used
    try:
        cursor.execute("PRAGMA table_info(user_roadmaps)")
        columns = [row[1] for row in cursor.fetchall()]
        if columns and "domain" in columns:
            logger.warning("⚠️ Outdated roadmap schema detected. Dropping roadmap tables for recreation.")
            cursor.execute("DROP TABLE IF EXISTS roadmap_progress")
            cursor.execute("DROP TABLE IF EXISTS user_roadmaps")
    except sqlite3.OperationalError:
        pass
        
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            education TEXT,
            specialization TEXT,
            university TEXT,
            graduation_year INTEGER,
            location TEXT,
            target_role TEXT,
            target_sector TEXT DEFAULT 'technology',
            phone TEXT,
            linkedin_url TEXT,
            github_url TEXT,
            resume_path TEXT,
            resume_text TEXT,
            resume_filename TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create courses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            course_name TEXT NOT NULL,
            platform TEXT,
            instructor TEXT,
            grade TEXT,
            completion_date TEXT,
            duration TEXT,
            description TEXT,
            certificate_url TEXT,
            skills_extracted TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            description TEXT NOT NULL,
            tech_stack TEXT,
            role TEXT,
            team_size INTEGER,
            duration TEXT,
            github_link TEXT,
            deployed_link TEXT,
            project_type TEXT,
            impact TEXT,
            skills_extracted TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create certifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS certifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            certification_name TEXT NOT NULL,
            issuing_organization TEXT,
            issue_date TEXT,
            expiry_date TEXT,
            credential_id TEXT,
            credential_url TEXT,
            skills_covered TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create work_experience table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS work_experience (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            company_name TEXT NOT NULL,
            job_title TEXT NOT NULL,
            employment_type TEXT,
            start_date TEXT,
            end_date TEXT,
            location TEXT,
            description TEXT,
            technologies_used TEXT,
            skills_extracted TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create user_skills table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            skill_name TEXT NOT NULL,
            proficiency REAL DEFAULT 0.0,
            confidence REAL DEFAULT 0.0,
            source_count INTEGER DEFAULT 0,
            sources TEXT,
            skill_metadata TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create user_roadmaps table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_roadmaps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            target_role TEXT NOT NULL,
            roadmap_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    
    # Create roadmap_progress table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS roadmap_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            roadmap_id INTEGER NOT NULL,
            skill_name TEXT NOT NULL,
            status TEXT DEFAULT 'not_started',
            completion_percentage INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (roadmap_id) REFERENCES user_roadmaps (id) ON DELETE CASCADE
        )
    ''')
    
    # Create video_progress table for watch analytics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS video_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            video_id TEXT NOT NULL,
            skill_name TEXT,
            watch_time_seconds REAL DEFAULT 0,
            total_duration_seconds REAL DEFAULT 0,
            completion_percentage REAL DEFAULT 0,
            last_position_seconds REAL DEFAULT 0,
            play_count INTEGER DEFAULT 1,
            is_completed BOOLEAN DEFAULT 0,
            last_watched TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Create indexes for better performance
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_skills_user ON user_skills(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_skills_name ON user_skills(skill_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON user_roadmaps(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_progress_user ON roadmap_progress(user_id)')
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_unique ON roadmap_progress(user_id, roadmap_id, skill_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_video_progress_user ON video_progress(user_id)')
    cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_video_progress_unique ON video_progress(user_id, video_id)')
    
    # Migration: add missing columns if missing (for existing databases)
    columns_to_add = [
        ("users", "resume_filename", "TEXT"),
        ("users", "specialization", "TEXT")
    ]
    
    for table, col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
            logger.info(f"✅ Added column {col_name} to {table} table")
        except sqlite3.OperationalError:
            pass  # Column already exists
    
    conn.commit()
    conn.close()
    
    logger.info(f"✅ Database initialized at: {_config.database_path}")


def reset_db() -> None:
    """Reset database by dropping all tables and reinitializing."""
    logger.warning("⚠️ Resetting database - all data will be lost!")
    
    conn = sqlite3.connect(_config.database_path)
    cursor = conn.cursor()
    
    # Drop all tables
    tables = [
        'user_skills',
        'work_experience', 'certifications', 'projects', 'courses', 'users'
    ]
    
    for table in tables:
        cursor.execute(f'DROP TABLE IF EXISTS {table}')
    
    conn.commit()
    conn.close()
    
    # Reinitialize
    init_db()
    logger.info("✅ Database reset complete")


def get_db_stats() -> Dict[str, Any]:
    """Get database statistics."""
    stats = {}
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        tables = ['users', 'courses', 'projects', 'certifications', 
                  'work_experience', 'user_skills']
        
        for table in tables:
            cursor.execute(f'SELECT COUNT(*) as count FROM {table}')
            stats[table] = cursor.fetchone()['count']
        
        # Get database size
        cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
        result = cursor.fetchone()
        stats['database_size_bytes'] = result['size'] if result else 0
    
    return stats
