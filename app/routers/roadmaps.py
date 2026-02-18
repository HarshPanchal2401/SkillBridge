"""Roadmap endpoints router - Career roadmaps with progress tracking."""
import json
import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db

router = APIRouter(prefix="/api", tags=["Roadmaps"])

# Load roadmaps data
ROADMAPS_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'roadmaps.json')


def load_roadmaps():
    """Load roadmaps from JSON file."""
    try:
        with open(ROADMAPS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading roadmaps: {e}")
        return {"domains": []}


class MilestoneProgressUpdate(BaseModel):
    milestone_id: str
    status: str  # 'not_started', 'in_progress', 'completed'


class RoadmapSelection(BaseModel):
    domain: str


# ===== ROADMAP LISTING ENDPOINTS =====

@router.get("/roadmaps")
def get_all_roadmaps():
    """Get all available career roadmaps."""
    data = load_roadmaps()
    
    # Return simplified list for overview
    roadmaps = []
    for domain in data.get('domains', []):
        roadmaps.append({
            'id': domain['id'],
            'name': domain['name'],
            'description': domain['description'],
            'icon': domain['icon'],
            'color': domain['color'],
            'estimatedDuration': domain['estimatedDuration'],
            'totalMilestones': len(domain.get('milestones', []))
        })
    
    return {
        "message": "Available roadmaps",
        "total": len(roadmaps),
        "roadmaps": roadmaps
    }


@router.get("/roadmaps/{domain}")
def get_roadmap(domain: str):
    """Get a specific roadmap by domain ID."""
    data = load_roadmaps()
    
    for d in data.get('domains', []):
        if d['id'] == domain:
            return {
                "message": f"Roadmap for {d['name']}",
                "roadmap": d
            }
    
    raise HTTPException(status_code=404, detail=f"Roadmap '{domain}' not found")


# ===== USER ROADMAP PROGRESS ENDPOINTS =====

@router.get("/users/{user_id}/roadmap")
def get_user_roadmap(user_id: int):
    """Get user's selected roadmap and progress."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's selected roadmap
        cursor.execute(
            "SELECT * FROM user_roadmaps WHERE user_id = ? ORDER BY started_at DESC LIMIT 1",
            (user_id,)
        )
        user_roadmap = cursor.fetchone()
        
        if not user_roadmap:
            return {
                "message": "No roadmap selected",
                "has_roadmap": False,
                "roadmap": None,
                "progress": []
            }
        
        user_roadmap_dict = dict(user_roadmap)
        domain = user_roadmap_dict['domain']
        
        # Get the roadmap data
        data = load_roadmaps()
        roadmap_data = None
        for d in data.get('domains', []):
            if d['id'] == domain:
                roadmap_data = d
                break
        
        if not roadmap_data:
            return {
                "message": "Roadmap data not found",
                "has_roadmap": False,
                "roadmap": None,
                "progress": []
            }
        
        # Get progress for all milestones
        cursor.execute(
            "SELECT * FROM roadmap_progress WHERE user_id = ? AND domain = ?",
            (user_id, domain)
        )
        progress_rows = cursor.fetchall()
        
        # Build progress map
        progress_map = {}
        for row in progress_rows:
            row_dict = dict(row)
            progress_map[row_dict['milestone_id']] = {
                'status': row_dict['status'],
                'started_at': row_dict['started_at'],
                'completed_at': row_dict['completed_at']
            }
        
        # Get user skills
        cursor.execute("SELECT skill_name, proficiency FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills = {row['skill_name'].lower(): row['proficiency'] for row in cursor.fetchall()}
        
        # Enrich milestones with progress and skill matching
        milestones_with_progress = []
        completed_count = 0
        for milestone in roadmap_data['milestones']:
            ms_id = milestone['id']
            progress = progress_map.get(ms_id, {'status': 'not_started', 'started_at': None, 'completed_at': None})
            
            # Calculate skill completion for this milestone
            required_skills = milestone.get('skills', [])
            matched_skills = 0
            skill_details = []
            
            for skill in required_skills:
                skill_lower = skill.lower()
                user_prof = user_skills.get(skill_lower, 0)
                has_skill = user_prof >= 0.3  # Consider skill acquired if proficiency >= 30%
                if has_skill:
                    matched_skills += 1
                skill_details.append({
                    'name': skill,
                    'hasSkill': has_skill,
                    'proficiency': round(user_prof * 100)
                })
            
            skill_completion = (matched_skills / len(required_skills) * 100) if required_skills else 0
            
            if progress['status'] == 'completed':
                completed_count += 1
            
            milestones_with_progress.append({
                **milestone,
                'progress': progress,
                'skillCompletion': round(skill_completion),
                'skillDetails': skill_details
            })
        
        # Calculate overall progress
        total_milestones = len(roadmap_data['milestones'])
        overall_progress = (completed_count / total_milestones * 100) if total_milestones > 0 else 0
        
        return {
            "message": "User roadmap with progress",
            "has_roadmap": True,
            "domain": domain,
            "started_at": user_roadmap_dict['started_at'],
            "overall_progress": round(overall_progress),
            "completed_milestones": completed_count,
            "total_milestones": total_milestones,
            "roadmap": {
                **roadmap_data,
                'milestones': milestones_with_progress
            }
        }


@router.post("/users/{user_id}/roadmap/select")
def select_roadmap(user_id: int, selection: RoadmapSelection):
    """Select a roadmap for the user to follow."""
    # Verify roadmap exists
    data = load_roadmaps()
    roadmap_exists = any(d['id'] == selection.domain for d in data.get('domains', []))
    
    if not roadmap_exists:
        raise HTTPException(status_code=404, detail=f"Roadmap '{selection.domain}' not found")
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user already has this roadmap
        cursor.execute(
            "SELECT id FROM user_roadmaps WHERE user_id = ? AND domain = ?",
            (user_id, selection.domain)
        )
        existing = cursor.fetchone()
        
        if existing:
            return {
                "message": "Roadmap already selected",
                "domain": selection.domain,
                "already_exists": True
            }
        
        # Insert new roadmap selection
        now = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO user_roadmaps (user_id, domain, started_at) VALUES (?, ?, ?)",
            (user_id, selection.domain, now)
        )
        conn.commit()
        
        return {
            "message": f"Roadmap '{selection.domain}' selected",
            "domain": selection.domain,
            "started_at": now,
            "already_exists": False
        }


@router.put("/users/{user_id}/roadmap/progress")
def update_milestone_progress(user_id: int, update: MilestoneProgressUpdate):
    """Update progress on a specific milestone."""
    valid_statuses = ['not_started', 'in_progress', 'completed']
    if update.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's current roadmap
        cursor.execute(
            "SELECT domain FROM user_roadmaps WHERE user_id = ? ORDER BY started_at DESC LIMIT 1",
            (user_id,)
        )
        roadmap = cursor.fetchone()
        
        if not roadmap:
            raise HTTPException(status_code=400, detail="No roadmap selected. Select a roadmap first.")
        
        domain = roadmap['domain']
        
        # Verify milestone exists in roadmap
        data = load_roadmaps()
        milestone_exists = False
        for d in data.get('domains', []):
            if d['id'] == domain:
                milestone_exists = any(m['id'] == update.milestone_id for m in d.get('milestones', []))
                break
        
        if not milestone_exists:
            raise HTTPException(status_code=404, detail=f"Milestone '{update.milestone_id}' not found in roadmap")
        
        now = datetime.now().isoformat()
        
        # Check existing progress
        cursor.execute(
            "SELECT id, status FROM roadmap_progress WHERE user_id = ? AND domain = ? AND milestone_id = ?",
            (user_id, domain, update.milestone_id)
        )
        existing = cursor.fetchone()
        
        if existing:
            # Update existing progress
            completed_at = now if update.status == 'completed' else None
            started_at = now if update.status == 'in_progress' and existing['status'] == 'not_started' else None
            
            if started_at:
                cursor.execute(
                    "UPDATE roadmap_progress SET status = ?, started_at = ? WHERE id = ?",
                    (update.status, started_at, existing['id'])
                )
            elif completed_at:
                cursor.execute(
                    "UPDATE roadmap_progress SET status = ?, completed_at = ? WHERE id = ?",
                    (update.status, completed_at, existing['id'])
                )
            else:
                cursor.execute(
                    "UPDATE roadmap_progress SET status = ? WHERE id = ?",
                    (update.status, existing['id'])
                )
        else:
            # Insert new progress
            started_at = now if update.status in ['in_progress', 'completed'] else None
            completed_at = now if update.status == 'completed' else None
            
            cursor.execute(
                """INSERT INTO roadmap_progress (user_id, domain, milestone_id, status, started_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, domain, update.milestone_id, update.status, started_at, completed_at)
            )
        
        conn.commit()
        
        return {
            "message": f"Milestone '{update.milestone_id}' updated to '{update.status}'",
            "milestone_id": update.milestone_id,
            "status": update.status,
            "updated_at": now
        }


@router.delete("/users/{user_id}/roadmap")
def remove_user_roadmap(user_id: int):
    """Remove user's roadmap selection and progress."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete progress
        cursor.execute("DELETE FROM roadmap_progress WHERE user_id = ?", (user_id,))
        
        # Delete roadmap selection
        cursor.execute("DELETE FROM user_roadmaps WHERE user_id = ?", (user_id,))
        
        conn.commit()
        
        return {
            "message": "Roadmap and progress removed",
            "user_id": user_id
        }
