import json
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
from app.database import get_db
from app.routers.dependencies import get_services
from app.logging_config import get_logger

router = APIRouter(prefix="/api/roadmaps", tags=["Roadmaps"])
logger = get_logger("roadmaps_router")

@router.post("/generate/{user_id}")
async def generate_user_roadmap(user_id: int, language: str = "English"):
    """
    Generate and save a personalized roadmap for the user.
    """
    services = get_services()
    roadmap_gen = services.roadmap_generator
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user_row)
        target_role = user_dict.get('target_role') or "Software Engineer"
        
        # 2. Get user skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        user_skills = [dict(row) for row in user_skills_rows]
        
        # 3. Get gap analysis
        market_requirements = services.market_skill_provider.get_skills(target_role)
        
        # Format user skills for analyzer
        user_skills_map = {s['skill_name']: {'proficiency': s['proficiency']} for s in user_skills}
        gap_result = services.llm_gap_analyzer.analyze_gaps(user_skills_map, market_requirements, target_role=target_role)
        
        # 4. Generate roadmap using LLM + YouTube
        youtube_service = services.youtube_service
        roadmap_data = await roadmap_gen.generate_roadmap(
            user_skills, target_role, gap_result, language,
            youtube_service=youtube_service
        )
        
        if "error" in roadmap_data:
            raise HTTPException(status_code=500, detail=roadmap_data["error"])
        
        # 5. Save to database
        cursor.execute("""
            INSERT INTO user_roadmaps (user_id, target_role, roadmap_data)
            VALUES (?, ?, ?)
        """, (user_id, target_role, json.dumps(roadmap_data)))
        
        roadmap_id = cursor.lastrowid
        
        return {
            "message": "Roadmap generated successfully",
            "roadmap_id": roadmap_id,
            "roadmap": roadmap_data
        }

@router.get("/user/{user_id}")
async def get_latest_roadmap(user_id: int):
    """
    Fetch the latest generated roadmap for a user.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM user_roadmaps 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        row = cursor.fetchone()
        
        if not row:
            return {"message": "No roadmap found for user", "roadmap": None}
            
        roadmap_dict = dict(row)
        roadmap_dict['roadmap_data'] = json.loads(roadmap_dict['roadmap_data'])
        
        # Also fetch progress
        cursor.execute("SELECT * FROM roadmap_progress WHERE roadmap_id = ?", (roadmap_dict['id'],))
        progress_rows = cursor.fetchall()
        roadmap_dict['progress'] = [dict(r) for r in progress_rows]
        
        return roadmap_dict

@router.post("/progress/{user_id}")
async def update_roadmap_progress(user_id: int, skill_name: str, status: str, percentage: int = 0):
    """
    Update progress for a specific skill in the roadmap.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get latest roadmap ID
        cursor.execute("SELECT id FROM user_roadmaps WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user_id,))
        roadmap_row = cursor.fetchone()
        if not roadmap_row:
            raise HTTPException(status_code=404, detail="No roadmap found to update progress")
        
        roadmap_id = roadmap_row['id']
        
        # Update or Insert progress
        cursor.execute("""
            INSERT INTO roadmap_progress (user_id, roadmap_id, skill_name, status, completion_percentage)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, roadmap_id, skill_name) DO UPDATE SET
            status = excluded.status,
            completion_percentage = excluded.completion_percentage,
            last_updated = CURRENT_TIMESTAMP
        """, (user_id, roadmap_id, skill_name, status, percentage))
        
        return {"message": "Progress updated successfully"}
