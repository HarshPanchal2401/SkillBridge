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
    video_id: str
    current_time: int
    watched_seconds: int
    total_duration: int
    is_completed: bool = False

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
            cursor.execute(
                """INSERT INTO roadmap_progress 
                   (user_id, roadmap_id, domain, milestone_id, milestone_name, milestone_description, skills, status, youtube_playlist_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (request.user_id, roadmap_id, request.target_role, ms["id"], ms["name"], ms["description"], 
                 json.dumps(ms.get("skills", [])), "not_started", 
                 ms["resources"][0]["url"] if ms.get("resources") and len(ms["resources"]) > 0 else None)
            )
        
        conn.commit()
        return standard_response(roadmap_data, "Roadmap generated successfully")

@router.put("/sync-progress")
def sync_roadmap_progress(request: ProgressSyncRequest):
    """Sync live watch time and video progress."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user's active roadmap
        cursor.execute(
            "SELECT domain FROM user_roadmaps WHERE user_id = ? ORDER BY started_at DESC LIMIT 1",
            (request.user_id,)
        )
        roadmap = cursor.fetchone()
        if not roadmap:
            raise HTTPException(status_code=404, detail="No active roadmap found")
            
        domain = roadmap["domain"]
        status = "completed" if request.is_completed else "in_progress"
        
        cursor.execute(
            """UPDATE roadmap_progress 
               SET status = ?, 
                   current_video_id = ?, 
                   current_video_time = ?, 
                   watched_duration_seconds = watched_duration_seconds + ?,
                   total_duration_seconds = ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND domain = ? AND milestone_id = ?""",
            (status, request.video_id, request.current_time, request.watched_seconds, 
             request.total_duration, request.user_id, domain, request.milestone_id)
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
    """Get summarized progress and detailed roadmap data."""
    with get_db() as conn:
        cursor = conn.cursor()
        # Join on roadmap_id if available, otherwise domain as fallback for old data
        cursor.execute(
            """SELECT ur.id, ur.target_role, ur.roadmap_type, ur.domain, ur.language_preference, ur.started_at,
                      COUNT(rp.id) as total_milestones,
                      SUM(CASE WHEN rp.status = 'completed' THEN 1 ELSE 0 END) as completed_milestones,
                      SUM(rp.watched_duration_seconds) as total_watched_seconds
               FROM user_roadmaps ur
               LEFT JOIN roadmap_progress rp ON 
                  (rp.roadmap_id = ur.id) OR 
                  (rp.roadmap_id IS NULL AND ur.user_id = rp.user_id AND ur.domain = rp.domain)
               WHERE ur.user_id = ?
               GROUP BY ur.id
               ORDER BY ur.started_at DESC LIMIT 1""",
            (user_id,)
        )
        row = cursor.fetchone()
        if not row:
            return standard_response({"has_active_roadmap": False})
        
        # Fetch detailed milestones for the current roadmap specifically
        cursor.execute(
            """SELECT milestone_id as id, milestone_name as name, milestone_description as description, 
                      skills, status, youtube_playlist_id, 
                      current_video_id, current_video_time,
                      started_at, completed_at, watched_duration_seconds, total_duration_seconds
               FROM roadmap_progress 
               WHERE (roadmap_id = ?) OR 
                     (roadmap_id IS NULL AND user_id = ? AND domain = ?)""",
            (row["id"], user_id, row["domain"])
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
        
        data = {
            "has_active_roadmap": True,
            "role": row["target_role"],
            "type": row["roadmap_type"],
            "progress_percent": round((row["completed_milestones"] / row["total_milestones"]) * 100) if row["total_milestones"] else 0,
            "hours_spent": round((row["total_watched_seconds"] or 0) / 3600, 1),
            "roadmap": {
                "id": str(row["id"]),
                "title": f"{row['target_role']} Mastery Path",
                "description": f"AI-powered {row['roadmap_type']} roadmap for {row['target_role']}",
                "roadmap_type": row["roadmap_type"],
                "target_role": row["target_role"],
                "language": row["language_preference"],
                "milestones": milestones,
                "created_at": row["started_at"],
                "last_accessed": row["started_at"]
            }
        }
        return standard_response(data)
