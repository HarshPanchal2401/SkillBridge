import json
import os
import asyncio
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
        
        # 2. Analyze gaps & Identify Trending Skills
        analysis = self.gap_analyzer.analyze_gaps(user_skills, market_skills)
        
        # Get trending skills for prioritization
        trending_skills = [s for s, data in market_skills.items() if data.get("trending")]
        strengths = [s.get("skill") for s in analysis.get("strengths", [])]

        if roadmap_type == "personal":
            critical = analysis.get("critical_gaps", [])
            important = analysis.get("important_gaps", [])
            emerging = analysis.get("emerging_gaps", [])
            
            # Combine all gaps with their metadata
            all_gaps = critical + important + emerging
            
            # STRENGTHS MUST BE EXCLUDED from the learning list
            strength_set = {s.get("skill").lower() for s in analysis.get("strengths", [])}
            
            # Map back to market skill format but include gap metadata
            skills_to_learn = {}
            gap_metadata = {}
            for s in all_gaps:
                sname = s.get("skill", "").lower()
                user_prof = s.get("user_proficiency", 0.0)
                effective_gap = s.get("effective_gap", 0.0)
                
                # HYPER-STRICT: If user already has > 75% proficiency, skip it even if there's a small gap
                if user_prof > 0.75:
                    continue
                    
                # Double check: if it is a strength or has a very small gap, do not learn it
                if sname in market_skills and sname not in strength_set and effective_gap > 0.20:
                    skills_to_learn[sname] = market_skills[sname]
                    gap_metadata[sname] = {
                        "effective_gap": effective_gap,
                        "user_proficiency": user_prof,
                        "reasoning": s.get("reasoning", "")
                    }
        else:
            # Full roadmap includes all market skills for a 0-to-100 path
            # We DONT exclude strengths here because it's a full curriculum, 
            # but we highlight them in the prompt context.
            skills_to_learn = market_skills
            gap_metadata = {}

        if not skills_to_learn:
            return {"error": "No significant gaps found. You are already a master!" if roadmap_type == "personal" else "No skills found for this role."}

        # 3. Partition into Milestones using LLM
        milestones = await self._partition_skills_with_ai(
            target_role, 
            skills_to_learn, 
            roadmap_type, 
            strengths,
            trending_skills,
            gap_metadata
        )
        
        # 4. Attach YouTube resources for each milestone in parallel (Multi-Resource Support)
        # We parallelize the searches to significantly reduce latency for full roadmaps
        search_tasks = []
        milestone_mapping = [] # to map results back to milestones

        for milestone in milestones:
            m_skills = milestone.get("skills", [])
            if not m_skills:
                m_skills = [target_role]
            
            # Limit searches to top 5 skills per milestone for full roadmap to prevent extreme latency
            skills_to_search = m_skills[:5] if roadmap_type == "full" else m_skills[:3]
            
            for sname in skills_to_search:
                search_query = f"{sname} tutorial for {target_role}"
                search_tasks.append(self.youtube_service.search_playlists(search_query, language, limit=2))
                milestone_mapping.append(milestone)

        # Execute all searches in parallel
        all_results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Distribute results and ensure uniqueness per milestone
        for idx, results in enumerate(all_results):
            if isinstance(results, Exception):
                logger.error(f"Search task failed: {results}")
                continue
            
            ms = milestone_mapping[idx]
            if "resources" not in ms:
                ms["resources"] = []
                ms["_seen_urls"] = set()
            
            for r in results:
                if r["url"] not in ms["_seen_urls"]:
                    ms["resources"].append(r)
                    ms["_seen_urls"].add(r["url"])

        # Final cleanup and fallback
        for milestone in milestones:
            # Remove the temporary set
            if "_seen_urls" in milestone:
                del milestone["_seen_urls"]
            else:
                milestone["resources"] = []

            # If still low on resources, search for the milestone name itself
            if len(milestone["resources"]) < 2:
                ms_query = f"{milestone['name']} {target_role} course"
                # This one is sequential but mostly hits for small or failed milestone results
                extra = await self.youtube_service.search_playlists(ms_query, language, limit=2)
                existing_urls = {r["url"] for r in milestone["resources"]}
                for r in extra:
                    if r["url"] not in existing_urls:
                        milestone["resources"].append(r)
            
            # Attach top 3 resources per milestone
            milestone["resources"] = milestone["resources"][:3]
            
        return {
            "target_role": target_role,
            "type": roadmap_type,
            "language": language,
            "milestones": milestones,
            "total_skills": len(skills_to_learn),
            "trending_highlights": trending_skills[:5],
            "overall_readiness": analysis.get("overall_readiness", 0)
        }

    async def _partition_skills_with_ai(
        self, 
        role: str, 
        skills: Dict[str, Dict], 
        roadmap_type: str = "personal", 
        strengths: List[str] = [],
        trending_skills: List[str] = [],
        gap_metadata: Dict[str, Dict] = {}
    ) -> List[Dict]:
        """Uses Groq to group skills into a logical learning path."""
        skill_names = list(skills.keys())
        
        count_target = "3-5" if roadmap_type == "personal" else "7-10"
        
        if roadmap_type == "personal":
            # For personal path, provide detailed gap info
            gap_details = []
            for sname in skill_names:
                meta = gap_metadata.get(sname, {})
                gap_details.append(f"{sname} (Gap: {int(meta.get('effective_gap', 0)*100)}%, Proficiency: {int(meta.get('user_proficiency', 0)*100)}%)")
            
            context_str = f"The user is ALREADY AN EXPERT in: {', '.join(strengths) if strengths else 'none'}. DO NOT include these in milestones. "
            detail_target = f"STRICTLY focusing ONLY on bridging these specific gaps: {', '.join(gap_details)}. SKIP all strengths mentioned above."
            priority_str = "STRICT CONSTRAINT: You MUST include ALL skills listed in the 'Skills to map' below. DO NOT add any filler skills, strengths, or other technologies not in the list. This is a GAP-FILLER path."
        else:
            context_str = f"The user's existing strengths are: {', '.join(strengths) if strengths else 'not yet assessed'}. "
            detail_target = f"covering the COMPLETE 0-to-Mastery curriculum for a professional {role}."
            trending_str = f"ALSO: Ensure high attention is given to these TRENDING skills: {', '.join(trending_skills)}."
            priority_str = f"SEQUENCING RULE: Follow a standard computer science / professional path (Foundations -> Intermediate -> Advanced -> Specialty). {trending_str}"

        prompt = f"""
        Role: {role}
        Roadmap Type: {roadmap_type}
        Context: {context_str}
        Goal: Create a {roadmap_type} roadmap {detail_target}
        Skills to map: {', '.join(skill_names)}
        
        {priority_str}
        
        Group these skills into {count_target} logical learning milestones. 
        Each milestone MUST have:
        1. A logical 'name'
        2. A 'description' explaining WHY these skills are grouped together.
        3. A 'difficulty' (beginner, intermediate, advanced).
        
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
            
            # Post-generation Validation & Cleaning (Stricter Enforcement)
            if not isinstance(data, list):
                # ... same dict conversion logic ...
                if isinstance(data, dict):
                    for key in ["milestones", "phases", "roadmap", "groups"]:
                        if key in data and isinstance(data[key], list):
                            data = data[key]
                            break
                    else:
                        if "skills" in data and "name" in data:
                            data = [data]
                        else:
                            data = []
            
            # Clean milestones
            final_milestones = []
            placed_skills = set()
            allowed_skills_lower = {s.lower() for s in skill_names}
            
            for m in data:
                if not isinstance(m, dict) or "skills" not in m:
                    continue
                
                # Filter out hallucinations (filler skills)
                m_skills = [s for s in m["skills"] if s.lower() in allowed_skills_lower]
                
                if m_skills:
                    m["skills"] = m_skills
                    final_milestones.append(m)
                    for s in m_skills:
                        placed_skills.add(s.lower())
            
            # Ensure MISSING skills (that were skipped by AI) are added to a last milestone
            missing = [s for s in skill_names if s.lower() not in placed_skills]
            if missing:
                if final_milestones:
                    final_milestones[-1]["skills"].extend(missing)
                else:
                    final_milestones.append({
                        "id": "remainder",
                        "name": "Additional Specialization",
                        "description": "Remaining core gaps to be bridged.",
                        "skills": missing,
                        "difficulty": "advanced"
                    })
            
            return final_milestones
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
