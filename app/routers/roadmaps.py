from typing import Optional
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_db
from app.services.roadmap_generator import RoadmapGenerator
from app.services.youtube_service import YoutubeService

router = APIRouter(prefix="/api/roadmaps", tags=["Roadmaps"])

# Initialize services
roadmap_gen = RoadmapGenerator()
youtube_service = YoutubeService()

class RoadmapCreateRequest(BaseModel):
    user_id: int
    target_role: str
    roadmap_type: str = "personal"  # "personal" or "full"
    language: str = "English"

class ProgressSyncRequest(BaseModel):
    user_id: int
    milestone_id: str
    youtube_playlist_id: Optional[str] = None
    current_video_id: str
    current_video_time: int
    watched_duration_seconds: int
    total_duration_seconds: int
    status: str = "in_progress"

class RoadmapChatRequest(BaseModel):
    user_id: int
    message: str
    context_milestone_id: Optional[str] = None

# Helper for aggregated skill fetching
def get_user_knowledge_base_skills(user_id: int):
    """Aggregates skills from User Skills, Projects, Courses, and Certifications."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Base skills (Resume/GitHub/Manual)
        cursor.execute("SELECT skill_name, proficiency FROM user_skills WHERE user_id = ?", (user_id,))
        skills = {row["skill_name"].lower().strip(): {"proficiency": row["proficiency"]} for row in cursor.fetchall()}
        
        # 2. Project skills
        cursor.execute("SELECT tech_stack, skills_extracted FROM projects WHERE user_id = ?", (user_id,))
        for row in cursor.fetchall():
            try:
                # Check both tech_stack and skills_extracted
                for field in ["tech_stack", "skills_extracted"]:
                    if row[field]:
                        stack = json.loads(row[field])
                        if isinstance(stack, str): stack = json.loads(stack)
                        for s in stack:
                            s_norm = s.lower().strip()
                            if s_norm and s_norm not in skills:
                                skills[s_norm] = {"proficiency": 0.6}
            except: continue
            
        # 3. Course skills
        cursor.execute("SELECT skills_extracted FROM courses WHERE user_id = ?", (user_id,))
        for row in cursor.fetchall():
            try:
                extracted = json.loads(row["skills_extracted"]) if row["skills_extracted"] else []
                if isinstance(extracted, str): extracted = json.loads(extracted)
                for s in extracted:
                    s_norm = s.lower().strip()
                    if s_norm:
                        if s_norm not in skills:
                            skills[s_norm] = {"proficiency": 0.7}
                        else:
                            skills[s_norm]["proficiency"] = max(skills[s_norm]["proficiency"], 0.7)
            except: continue

        # 4. Certification skills
        cursor.execute("SELECT skills_covered FROM certifications WHERE user_id = ?", (user_id,))
        for row in cursor.fetchall():
            try:
                covered = json.loads(row["skills_covered"]) if row["skills_covered"] else []
                if isinstance(covered, str): covered = json.loads(covered)
                for s in covered:
                    s_norm = s.lower().strip()
                    if s_norm:
                        if s_norm not in skills:
                            skills[s_norm] = {"proficiency": 0.8}
                        else:
                            skills[s_norm]["proficiency"] = max(skills[s_norm]["proficiency"], 0.8)
            except: continue
                    
    return skills

# Standard Response Helper
def standard_response(data: any = None, message: str = "Operation completed"):
    return {
        "success": True,
        "message": message,
        "data": data
    }

# ===== DYNAMIC ROADMAP ENDPOINTS =====

@router.post("/generate")
async def generate_personalized_roadmap(request: RoadmapCreateRequest):
    """Generate a custom AI-powered roadmap based on user gaps and market demand."""
    # 1. Aggregate user's entire knowledge base (Resume + Projects + Courses + Certs)
    user_skills = get_user_knowledge_base_skills(request.user_id)
    
    # Relax requirement for full roadmap
    if not user_skills and request.roadmap_type == "personal":
        raise HTTPException(
            status_code=400, 
            detail="Knowledge base is empty. Please extract skills or add projects first for a personal path."
        )

    # 2. Generate roadmap structure
    roadmap_data = await roadmap_gen.generate_roadmap(
        user_id=request.user_id,
        target_role=request.target_role,
        user_skills=user_skills or {},
        roadmap_type=request.roadmap_type,
        language=request.language
    )
    
    if not roadmap_data or "error" in roadmap_data:
        raise HTTPException(status_code=400, detail=roadmap_data.get("error", "Failed to generate roadmap"))

    with get_db() as conn:
        cursor = conn.cursor()
        # 3. Store in database
        now = datetime.now().isoformat()
        cursor.execute(
            """INSERT INTO user_roadmaps 
               (user_id, domain, roadmap_type, target_role, language_preference, started_at) 
               VALUES (?, ?, ?, ?, ?, ?)""",
            (request.user_id, request.target_role, request.roadmap_type, request.target_role, request.language, now)
        )
        roadmap_id = cursor.lastrowid
        
        # 4. Initialize milestone progress
        for ms in roadmap_data["milestones"]:
            resources_json = json.dumps(ms.get("resources", []))
            first_playlist_url = ms["resources"][0]["url"] if ms.get("resources") and len(ms["resources"]) > 0 else None
            
            cursor.execute(
                """INSERT INTO roadmap_progress 
                   (user_id, roadmap_id, domain, milestone_id, milestone_name, milestone_description, skills, status, youtube_playlist_id, resources)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (request.user_id, roadmap_id, request.target_role, ms["id"], ms["name"], ms["description"], 
                 json.dumps(ms.get("skills", [])), "not_started", 
                 first_playlist_url, resources_json)
            )
        
        conn.commit()
        return standard_response(roadmap_data, "Roadmap generated successfully")

@router.put("/sync-progress")
def sync_roadmap_progress(request: ProgressSyncRequest):
    """Sync live watch time and video progress."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user's active roadmap (most recent)
        cursor.execute(
            "SELECT id, domain FROM user_roadmaps WHERE user_id = ? ORDER BY started_at DESC LIMIT 1",
            (request.user_id,)
        )
        roadmap = cursor.fetchone()
        if not roadmap:
            raise HTTPException(status_code=404, detail="No active roadmap found")
            
        roadmap_id = roadmap["id"]
        domain = roadmap["domain"]
        
        # Update progress
        # Note: watched_duration_seconds is treated as absolute for the current video
        cursor.execute(
            """UPDATE roadmap_progress 
               SET status = ?, 
                   current_video_id = ?, 
                   current_video_time = ?, 
                   watched_duration_seconds = ?,
                   total_duration_seconds = ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND roadmap_id = ? AND milestone_id = ?""",
            (request.status, request.current_video_id, request.current_video_time, 
             request.watched_duration_seconds, request.total_duration_seconds, 
             request.user_id, roadmap_id, request.milestone_id)
        )
        conn.commit()
        
    return standard_response(None, "Progress synced")

@router.post("/chat")
async def chat_with_roadmap_ai(request: RoadmapChatRequest):
    """Roadmap-aware AI chatbot."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Get context
        cursor.execute(
            "SELECT target_role, roadmap_type FROM user_roadmaps WHERE user_id = ? ORDER BY started_at DESC LIMIT 1",
            (request.user_id,)
        )
        roadmap = cursor.fetchone()
        
    context = f"User is following a {roadmap['roadmap_type'] if roadmap else 'general'} roadmap for {roadmap['target_role'] if roadmap else 'technical roles'}."
    if request.context_milestone_id:
        context += f" Currently focused on milestone: {request.context_milestone_id}."

    # Using Groq to reply
    from app.services.groq_market_skill_provider import GroqMarketSkillProvider
    ai = GroqMarketSkillProvider()
    
    prompt = f"""
    Context: {context}
    User Question: {request.message}
    
    Provide a helpful, encouraging answer. Keep it technical and practical.
    """
    
    response = ai.client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    
    return standard_response({"reply": response.choices[0].message.content})

@router.get("/users/{user_id}/current")
def get_current_status(user_id: int):
    """Get summarized progress and detailed roadmap data for both types."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Helper to fetch a roadmap by type
        def fetch_latest_roadmap(rt_type: str):
            cursor.execute(
                """SELECT ur.id, ur.target_role, ur.roadmap_type, ur.domain, ur.language_preference, ur.started_at,
                          COUNT(rp.id) as total_milestones,
                          SUM(CASE WHEN rp.status = 'completed' THEN 1 ELSE 0 END) as completed_milestones,
                          SUM(rp.watched_duration_seconds) as total_watched_seconds
                   FROM user_roadmaps ur
                   LEFT JOIN roadmap_progress rp ON rp.roadmap_id = ur.id
                   WHERE ur.user_id = ? AND ur.roadmap_type = ?
                   GROUP BY ur.id
                   ORDER BY ur.started_at DESC LIMIT 1""",
                (user_id, rt_type)
            )
            row = cursor.fetchone()
            if not row: return None
            
            # Fetch milestones
            cursor.execute(
                """SELECT milestone_id as id, milestone_name as name, milestone_description as description, 
                          skills, status, youtube_playlist_id, resources,
                          current_video_id, current_video_time,
                          started_at, completed_at, watched_duration_seconds, total_duration_seconds
                   FROM roadmap_progress 
                   WHERE roadmap_id = ?""",
                (row["id"],)
            )
            milestones_raw = [dict(r) for r in cursor.fetchall()]
            
            milestones = []
            for m in milestones_raw:
                milestones.append({
                    "id": m["id"],
                    "name": m["name"],
                    "description": m["description"],
                    "skills": json.loads(m["skills"]) if m["skills"] else [],
                    "youtube_playlist_id": m["youtube_playlist_id"],
                    "resources": json.loads(m["resources"]) if m.get("resources") else [],
                    "current_video_id": m["current_video_id"],
                    "current_video_time": m["current_video_time"],
                    "progress": {
                        "status": m["status"],
                        "started_at": m["started_at"],
                        "completed_at": m["completed_at"],
                        "watched_duration_seconds": m["watched_duration_seconds"] or 0,
                        "total_duration_seconds": m["total_duration_seconds"] or 0
                    }
                })
                
            # Find current active milestone
            active_ms = next((m for m in milestones if m["progress"]["status"] != "completed"), milestones[0] if milestones else None)
            
            return {
                "id": str(row["id"]),
                "title": f"{row['target_role']} Mastery Path" if rt_type == "full" else f"{row['target_role']} Personal Path",
                "roadmap_type": row["roadmap_type"],
                "target_role": row["target_role"],
                "progress_percent": round((row["completed_milestones"] / row["total_milestones"]) * 100) if row["total_milestones"] else 0,
                "hours_spent": round((row["total_watched_seconds"] or 0) / 3600, 1),
                "active_milestone": {
                    "id": active_ms["id"],
                    "name": active_ms["name"]
                } if active_ms else None,
                "milestones": milestones,
                "created_at": row["started_at"]
            }

        full_path = fetch_latest_roadmap("full")
        personal_path = fetch_latest_roadmap("personal")
        
        # Fallback to general latest if specific types not found (for legacy data)
        latest = None
        if not full_path and not personal_path:
            latest = fetch_latest_roadmap(None) # fetches latest regardless of type

        return standard_response({
            "has_active_roadmap": full_path is not None or personal_path is not None or latest is not None,
            "full_path": full_path,
            "personal_path": personal_path,
            "latest": latest or personal_path or full_path # compatible with old frontend
        })
