"""Video Progress Router — Track and analyze video watch progress."""
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.logging_config import get_logger

router = APIRouter(prefix="/api/video-progress", tags=["Video Progress"])
logger = get_logger("video_progress_router")


class SaveProgressRequest(BaseModel):
    """Request body to save/update video watch progress."""
    user_id: int
    video_id: str
    skill_name: Optional[str] = None
    watch_time_seconds: float = 0
    total_duration_seconds: float = 0
    completion_percentage: float = 0
    last_position_seconds: float = 0
    delta_seconds: float = 0  # Actual time spent watching since last sync


@router.post("/save")
async def save_video_progress(req: SaveProgressRequest):
    """Save or update video watch progress (upsert)."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Check if record exists
        cursor.execute(
            "SELECT id, play_count, watch_time_seconds FROM video_progress WHERE user_id = ? AND video_id = ?",
            (req.user_id, req.video_id),
        )
        existing = cursor.fetchone()

        is_completed = 1 if req.completion_percentage >= 90 else 0

        if existing:
            row = dict(existing)
            # Accumulate watch time correctly (anti-cheat)
            # We add the delta provided by the frontend (real time * speed)
            new_watch_time = min(req.total_duration_seconds, row["watch_time_seconds"] + req.delta_seconds)
            
            # Recalculate completion percentage based on accumulated watch time
            new_percent = 0
            if req.total_duration_seconds > 0:
                new_percent = min(100, (new_watch_time / req.total_duration_seconds) * 100)
            
            is_completed = 1 if new_percent >= 90 else row.get("is_completed", 0)

            cursor.execute("""
                UPDATE video_progress SET
                    watch_time_seconds = ?,
                    total_duration_seconds = ?,
                    completion_percentage = ?,
                    last_position_seconds = ?,
                    is_completed = ?,
                    skill_name = COALESCE(?, skill_name),
                    last_watched = CURRENT_TIMESTAMP
                WHERE user_id = ? AND video_id = ?
            """, (
                new_watch_time,
                req.total_duration_seconds,
                new_percent,
                req.last_position_seconds,
                is_completed,
                req.skill_name,
                req.user_id,
                req.video_id,
            ))

            return {"message": "Progress updated", "is_completed": bool(is_completed), "accumulated_percent": new_percent}
        else:
            # First time saving this video
            new_percent = 0
            if req.total_duration_seconds > 0:
                new_percent = min(100, (req.delta_seconds / req.total_duration_seconds) * 100)
            
            is_completed = 1 if new_percent >= 90 else 0

            cursor.execute("""
                INSERT INTO video_progress
                    (user_id, video_id, skill_name, watch_time_seconds, total_duration_seconds,
                     completion_percentage, last_position_seconds, play_count, is_completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            """, (
                req.user_id,
                req.video_id,
                req.skill_name,
                req.delta_seconds,
                req.total_duration_seconds,
                new_percent,
                req.last_position_seconds,
                is_completed,
            ))

            return {"message": "Progress saved", "is_completed": bool(is_completed), "accumulated_percent": new_percent}


@router.post("/increment-play/{user_id}/{video_id}")
async def increment_play_count(user_id: int, video_id: str):
    """Increment play count when a video starts playing."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM video_progress WHERE user_id = ? AND video_id = ?",
            (user_id, video_id),
        )
        if cursor.fetchone():
            cursor.execute(
                "UPDATE video_progress SET play_count = play_count + 1, last_watched = CURRENT_TIMESTAMP WHERE user_id = ? AND video_id = ?",
                (user_id, video_id),
            )
        else:
            cursor.execute("""
                INSERT INTO video_progress (user_id, video_id, play_count)
                VALUES (?, ?, 1)
            """, (user_id, video_id))

    return {"message": "Play count incremented"}


@router.get("/user/{user_id}")
async def get_user_progress(user_id: int):
    """Get all video progress for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM video_progress WHERE user_id = ? ORDER BY last_watched DESC",
            (user_id,),
        )
        rows = cursor.fetchall()
        return {"progress": [dict(r) for r in rows]}


@router.get("/user/{user_id}/skill/{skill_name}")
async def get_skill_progress(user_id: int, skill_name: str):
    """Get video progress for a specific skill."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM video_progress WHERE user_id = ? AND skill_name = ? ORDER BY last_watched DESC",
            (user_id, skill_name),
        )
        rows = cursor.fetchall()
        return {"progress": [dict(r) for r in rows]}


@router.get("/user/{user_id}/video/{video_id}")
async def get_single_video_progress(user_id: int, video_id: str):
    """Get progress for a single video."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM video_progress WHERE user_id = ? AND video_id = ?",
            (user_id, video_id),
        )
        row = cursor.fetchone()
        if not row:
            return {"progress": None}
        return {"progress": dict(row)}


@router.get("/user/{user_id}/analytics")
async def get_user_analytics(user_id: int):
    """Get aggregated watch analytics for a user."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Total stats
        cursor.execute("""
            SELECT
                COUNT(*) as total_videos_started,
                SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as total_completed,
                COALESCE(SUM(watch_time_seconds), 0) as total_watch_time_seconds,
                COALESCE(SUM(play_count), 0) as total_play_count,
                COALESCE(AVG(completion_percentage), 0) as avg_completion
            FROM video_progress
            WHERE user_id = ?
        """, (user_id,))
        totals = dict(cursor.fetchone())

        # Per-skill breakdown
        cursor.execute("""
            SELECT
                skill_name,
                COUNT(*) as videos_started,
                SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as videos_completed,
                COALESCE(SUM(watch_time_seconds), 0) as watch_time_seconds,
                COALESCE(AVG(completion_percentage), 0) as avg_completion
            FROM video_progress
            WHERE user_id = ? AND skill_name IS NOT NULL
            GROUP BY skill_name
            ORDER BY watch_time_seconds DESC
        """, (user_id,))
        skill_rows = cursor.fetchall()

        # Format total watch time
        total_seconds = totals["total_watch_time_seconds"]
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        totals["total_watch_time_text"] = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

        return {
            "analytics": {
                **totals,
                "per_skill": [dict(r) for r in skill_rows],
            }
        }


@router.delete("/user/{user_id}/reset")
async def reset_all_progress(user_id: int):
    """Delete all video progress for a user (Global Reset)."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM video_progress WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM roadmap_progress WHERE user_id = ?", (user_id,))
    
    logger.info(f"🧹 Progress reset for user {user_id}")
    return {"message": "All progress has been reset"}
