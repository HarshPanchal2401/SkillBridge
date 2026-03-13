import json
import os
from typing import List, Dict, Any, Optional
from app.services.groq_market_skill_provider import GroqMarketSkillProvider
from app.services.gap_analyzer import SmartGapAnalyzer
from app.services.youtube_service import YoutubeService
from app.logging_config import get_logger

logger = get_logger("roadmap_generator")

class RoadmapGenerator:
    """Generates personalized or full career roadmaps with AI enrichment."""
    
    def __init__(self):
        self.market_provider = GroqMarketSkillProvider()
        self.gap_analyzer = SmartGapAnalyzer()
        self.youtube_service = YoutubeService()

    async def generate_roadmap(
        self, 
        user_id: int, 
        target_role: str, 
        user_skills: Dict[str, Any], 
        roadmap_type: str = "personal",
        language: str = "English"
    ) -> Dict[str, Any]:
        """
        Generates a structured roadmap.
        """
        # 1. Fetch market skills
        market_skills = self.market_provider.get_skills(target_role)
        
        if roadmap_type == "personal":
            # 2. Analyze gaps
            analysis = self.gap_analyzer.analyze_gaps(user_skills, market_skills)
            # Handle potential different keys from SmartGapAnalyzer
            critical = analysis.get("critical_gaps", [])
            important = analysis.get("important_gaps", [])
            
            target_skills = critical + important
            # Map back to market skill format
            skills_to_learn = {}
            for s in target_skills:
                sname = s.get("skill", "").lower()
                if sname in market_skills:
                    skills_to_learn[sname] = market_skills[sname]
        else:
            # Full roadmap includes all market skills
            skills_to_learn = market_skills

        if not skills_to_learn:
            return {"error": "No significant skills found for this role."}

        # 3. Partition into Milestones using LLM
        milestones = await self._partition_skills_with_ai(target_role, skills_to_learn, roadmap_type)
        
        # 4. Attach YouTube resources for each milestone
        for milestone in milestones:
            # Search for the primary skill in the milestone
            search_skill = milestone["skills"][0] if milestone.get("skills") else target_role
            milestone["resources"] = self.youtube_service.search_playlists(search_skill, language)
            
        return {
            "target_role": target_role,
            "type": roadmap_type,
            "language": language,
            "milestones": milestones,
            "total_skills": len(skills_to_learn)
        }

    async def _partition_skills_with_ai(self, role: str, skills: Dict[str, Dict], roadmap_type: str = "personal") -> List[Dict]:
        """Uses Groq to group skills into a logical learning path."""
        skill_names = list(skills.keys())
        
        count_target = "3-5" if roadmap_type == "personal" else "6-8"
        detail_target = "focusing only on the gaps" if roadmap_type == "personal" else "covering everything from basics to advanced"
        
        prompt = f"""
        Role: {role}
        Roadmap Type: {roadmap_type} ({detail_target})
        Skills to learn: {', '.join(skill_names)}
        
        Group these skills into {count_target} logical learning milestones.
        Return ONLY a JSON array. 
        
        REQUIRED JSON Schema:
        [
          {{
            "id": "phase_1",
            "name": "Phase Name",
            "description": "Short summary",
            "skills": ["skill1", "skill2"],
            "difficulty": "beginner"
          }}
        ]
        """
        try:
            # Check if using a model that supports json_object
            model_name = "llama-3.3-70b-versatile"
            
            response = self.market_provider.client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a career coach. Return only valid JSON arrays."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"} if "llama-3" in model_name else None
            )
            content = response.choices[0].message.content or ""
            
            if not content.strip():
                logger.warning("⚠️ Groq returned empty content for partitioning")
                raise ValueError("Empty AI response")

            # Handle common LLM markdown wrapping
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            data = json.loads(content)
            
            # Ensure it's a list (some models might return a dict with a "milestones" key)
            if isinstance(data, dict):
                for key in ["milestones", "phases", "roadmap", "groups"]:
                    if key in data and isinstance(data[key], list):
                        return data[key]
                # If it's a single object that looks like a milestone, wrap it
                if "skills" in data and "name" in data:
                    return [data]
                return []
            
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"❌ AI partitioning failed: {e}")
            # Fallback partitioning: Split skills into 1-2 generic phases
            mid = len(skill_names) // 2
            if mid == 0:
                p1, p2 = skill_names, []
            else:
                p1, p2 = skill_names[:mid], skill_names[mid:]
            
            milestones = [{
                "id": "phase_1",
                "name": f"{role} Fundamentals",
                "description": "Start with these core skills",
                "skills": p1,
                "difficulty": "beginner"
            }]
            if p2:
                milestones.append({
                    "id": "phase_2",
                    "name": f"Advanced {role} Techniques",
                    "description": "Deeper dive into specialization",
                    "skills": p2,
                    "difficulty": "intermediate"
                })
            return milestones
