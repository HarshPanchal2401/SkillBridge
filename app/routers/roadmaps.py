import json
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
from app.database import get_db
from app.routers.dependencies import get_services
from app.logging_config import get_logger

router = APIRouter(prefix="/api/roadmaps", tags=["Roadmaps"])
logger = get_logger("roadmaps_router")

@router.post("/generate/{user_id}")
async def generate_user_roadmap(
    user_id: int, 
    stext: Optional[str] = None,
    language: str = "English"
):
    """
    Generate and save a personalized roadmap for the user.
    """
    services = get_services()
    roadmap_gen = services.roadmap_generator
    
    # 1. Quick DB Fetch
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user_row)
        
        # Use stext if provided, otherwise use user's target_role or default
        if stext:
            target_role = stext
            logger.info(f"⚡ Generating custom roadmap for '{target_role}' for user {user_id}")
        else:
            target_role = user_dict.get('target_role') or "Software Engineer"
        
        # Get user skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        user_skills = [dict(row) for row in user_skills_rows]
    
    # 2. Slow external calls (Outside DB context)
    market_requirements = services.market_skill_provider.get_skills(target_role)
    
    # Format user skills for analyzer
    user_skills_map = {s['skill_name']: {'proficiency': s['proficiency']} for s in user_skills}
    gap_result = services.llm_gap_analyzer.analyze_gaps(user_skills_map, market_requirements, target_role=target_role)
    
    # Generate roadmap using LLM + YouTube + Courses
    youtube_service = services.youtube_service
    course_recommender = services.course_recommender
    roadmap_data = await roadmap_gen.generate_roadmap(
        user_skills, target_role, gap_result, language,
        youtube_service=youtube_service,
        course_recommender=course_recommender
    )
    
    if "error" in roadmap_data:
        raise HTTPException(status_code=500, detail=roadmap_data["error"])
    
    # 3. Quick DB Save
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_roadmaps (user_id, target_role, roadmap_data)
            VALUES (?, ?, ?)
        """, (user_id, target_role, json.dumps(roadmap_data)))
        roadmap_id = cursor.lastrowid
    
    return {
        "message": f"Roadmap for '{target_role}' generated successfully",
        "roadmap_id": roadmap_id,
        "target_role": target_role,
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
        progress = [dict(r) for r in progress_rows]
        roadmap_dict['progress'] = progress
        
        # Calculate completion accurately
        # Count target skills from roadmap_data (assuming structured format)
        total_skills = 0
        r_data = roadmap_dict['roadmap_data']
        if isinstance(r_data, dict):
            # Check for fast_track first as it's the primary target for quick completion
            if "fast_track_roadmap" in r_data and r_data["fast_track_roadmap"]:
                total_skills = len(r_data["fast_track_roadmap"])
            # Fallback to full_roadmap milestones if fast_track is missing
            elif "full_roadmap" in r_data:
                fr = r_data["full_roadmap"]
                milestones = (fr.get("beginner_milestones", []) + 
                             fr.get("intermediate_milestones", []) + 
                             fr.get("advanced_milestones", []))
                total_skills = len(milestones)
            # Legacy support
            elif "roadmap" in r_data:
                total_skills = len(r_data["roadmap"])
            elif "full_career_path" in r_data:
                total_skills = len(r_data["full_career_path"])
        
        completed_skills = sum(1 for p in progress if p['completion_percentage'] >= 100)
        
        # Calculate granular percentage based on partial progress of ALL skills
        total_progress_points = sum(p['completion_percentage'] for p in progress)
        raw_percentage = (total_progress_points / total_skills) if total_skills > 0 else 0
        overall_percentage = round(raw_percentage)
        
        # Safeguard: If there is actual progress but it rounds to 0, show 1% instead
        if overall_percentage == 0 and total_progress_points > 0:
            overall_percentage = 1
        
        # Determine if roadmap is complete based on progress
        is_complete = (total_skills > 0 and completed_skills >= total_skills)
        roadmap_dict['is_complete'] = is_complete
        roadmap_dict['completion_stats'] = {
            "total": total_skills,
            "completed": completed_skills,
            "percentage": overall_percentage
        }
        
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

@router.get("/certificate/{user_id}")
async def get_certificate_data(user_id: int):
    """
    Fetch certificate data for a completed roadmap.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Sync video progress to roadmap progress on-the-fly to ensure consistency
        try:
            cursor.execute("""
                SELECT vp.skill_name, vp.completion_percentage 
                FROM video_progress vp
                WHERE vp.user_id = ? AND vp.is_completed = 1 AND vp.skill_name IS NOT NULL
            """, (user_id,))
            completed_videos = cursor.fetchall()
            
            if completed_videos:
                # Get latest roadmap ID
                cursor.execute("SELECT id FROM user_roadmaps WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", (user_id,))
                roadmap_row = cursor.fetchone()
                if roadmap_row:
                    roadmap_id = roadmap_row['id']
                    for v in completed_videos:
                        cursor.execute("""
                            INSERT INTO roadmap_progress (user_id, roadmap_id, skill_name, status, completion_percentage)
                            VALUES (?, ?, ?, 'completed', ?)
                            ON CONFLICT(user_id, roadmap_id, skill_name) DO UPDATE SET
                            status = 'completed',
                            completion_percentage = CASE WHEN ? > completion_percentage THEN ? ELSE completion_percentage END,
                            last_updated = CURRENT_TIMESTAMP
                        """, (user_id, roadmap_id, v['skill_name'], int(v['completion_percentage']), int(v['completion_percentage']), int(v['completion_percentage'])))
        except Exception as e:
            logger.error(f"⚠️ Failed to sync progress during certificate check: {e}")

        # 1. Get user info
        cursor.execute("SELECT name, email, target_role FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 2. Get latest roadmap and verify completion
        cursor.execute("""
            SELECT id, target_role, created_at, roadmap_data FROM user_roadmaps 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 1
        """, (user_id,))
        roadmap = cursor.fetchone()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="No roadmap found")
        
        # Verify 100% completion
        cursor.execute("SELECT COUNT(*) as count FROM roadmap_progress WHERE roadmap_id = ? AND completion_percentage >= 100", (roadmap['id'],))
        completed_count = cursor.fetchone()['count']
        
        # Get total skills count from roadmap data
        roadmap_data = json.loads(roadmap['roadmap_data'])
        total_skills = 0
        if "fast_track_roadmap" in roadmap_data and roadmap_data["fast_track_roadmap"]:
            total_skills = len(roadmap_data["fast_track_roadmap"])
        elif "full_roadmap" in roadmap_data:
            fr = roadmap_data["full_roadmap"]
            milestones = (fr.get("beginner_milestones", []) + 
                         fr.get("intermediate_milestones", []) + 
                         fr.get("advanced_milestones", []))
            total_skills = len(milestones)
        elif "roadmap" in roadmap_data:
            total_skills = len(roadmap_data["roadmap"])
        
        if total_skills == 0 or completed_count < total_skills:
            return {
                "eligible": False,
                "reason": "Roadmap is not 100% complete",
                "stats": {"completed": completed_count, "total": total_skills}
            }
        
        # 3. Generate unique certificate ID
        import hashlib
        cert_id = f"SB-{roadmap['id']}-{user_id}-" + hashlib.md5(f"{user_id}-{roadmap['id']}".encode()).hexdigest()[:8].upper()
        
        return {
            "eligible": True,
            "certificate_id": cert_id,
            "user_name": user['name'],
            "target_role": roadmap['target_role'],
            "completion_date": roadmap['created_at'], # Use roadmap creation or last update as completion date
            "issuer": "SkillBridge Career Intelligence",
            "verification_url": f"https://skillbridge.ai/verify/{cert_id}"
        }

@router.get("/video")
async def get_skill_video(skill: str, language: str = "English"):
    """
    Fetch the best one-shot video for a specific skill.
    Used for on-the-fly resource filling in the frontend.
    """
    services = get_services()
    yt_service = services.youtube_service
    
    # Normalize skill name if possible
    from app.services.roadmap_generator import normalize_skill_name
    search_name = normalize_skill_name(skill)
    
    try:
        result = await yt_service.get_oneshot_only(search_name, language)
        return result
    except Exception as e:
        logger.error(f"❌ Failed to fetch video for {skill}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
