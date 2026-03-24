"""Roadmap Generator — Generates skill-gap roadmap via LLM, then attaches real YouTube resources."""
import json
import os
from typing import Dict, List, Any, Optional
from app.logging_config import get_logger

logger = get_logger("roadmap_generator")

# Skill name normalization map — ensures YouTube search gets good results
SKILL_NAME_MAP = {
    "genai": "Generative AI",
    "gen ai": "Generative AI",
    "ml": "Machine Learning",
    "dl": "Deep Learning",
    "nlp": "Natural Language Processing",
    "cv": "Computer Vision",
    "ds": "Data Science",
    "ai": "Artificial Intelligence",
    "devops": "DevOps",
    "k8s": "Kubernetes",
    "aws": "Amazon Web Services AWS",
    "gcp": "Google Cloud Platform",
    "js": "JavaScript",
    "ts": "TypeScript",
    "react.js": "React JS",
    "node.js": "Node JS",
    "next.js": "Next JS",
    "vue.js": "Vue JS",
    "ci/cd": "CI CD Pipeline",
    "sql": "SQL Database",
    "nosql": "NoSQL Database",
    "llm": "Large Language Models LLM",
    "rag": "Retrieval Augmented Generation RAG",
}


def normalize_skill_name(skill: str) -> str:
    """Normalize short/technical skill names to full searchable names."""
    key = skill.strip().lower()
    return SKILL_NAME_MAP.get(key, skill)


class RoadmapGenerator:
    """
    Generates a learning roadmap in two stages:
    1. LLM generates the skill-gap analysis & learning plan (no video suggestions)
    2. YoutubeService fetches real playlist + oneshot video for each skill
    """

    def __init__(self, groq_api_key: Optional[str] = None):
        self.api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ RoadmapGenerator: GROQ_API_KEY not found.")

    async def generate_roadmap(
        self,
        user_skills: List[Dict[str, Any]],
        target_role: str,
        gap_analysis: Dict[str, Any],
        language: str = "English",
        youtube_service=None,
    ) -> Dict[str, Any]:
        """
        Generate a dual roadmap (Fast-Track & Full) using Groq LLM,
        then attach real YouTube resources via YoutubeService.
        """
        if not self.api_key:
            return {"error": "GROQ_API_KEY not configured"}

        # ── Stage 1: LLM generates skill plan ──
        skills_str = ", ".join(
            [f"{s['skill_name']} ({s.get('proficiency', 0):.1f})" for s in user_skills]
        )

        gaps = gap_analysis.get("skill_gaps", {})
        
        # ── Filter and Recalculate Metrics ──
        GAP_THRESHOLD = 0.30
        
        # 1. Filter the gaps
        filtered_critical = [g for g in gaps.get("critical", []) if g.get("effective_gap", 0) >= GAP_THRESHOLD]
        filtered_important = [g for g in gaps.get("important", []) if g.get("effective_gap", 0) >= GAP_THRESHOLD]
        filtered_emerging = [g for g in gaps.get("emerging", []) if g.get("effective_gap", 0) >= GAP_THRESHOLD]
        
        # 2. Collect only the relevant roadmap skills
        critical = [g["skill"] for g in filtered_critical]
        important = [g["skill"] for g in filtered_important]
        emerging = [g["skill"] for g in filtered_emerging]
        all_gap_skills = critical + important + emerging

        # 3. Calculate metrics based ONLY on roadmap skills + strengths
        relevant_gaps = filtered_critical + filtered_important + filtered_emerging
        strengths = gap_analysis.get("strengths", [])
        
        # Calculate a simplified "Overall Score" based on unweighted count
        # This is more intuitive for users (e.g. if they know 33/37 skills, they are 89% ready)
        total_items = len(relevant_gaps) + len(strengths)
        
        if total_items > 0:
            # Gaps start at their attained proficiency (0.0 to demand)
            # For a simple count, we normalize (demand - gap) / demand
            attained_count = sum(max(0, g.get("demand", 0.5) - g.get("effective_gap", 0)) / g.get("demand", 0.5) for g in relevant_gaps)
            attained_count += len(strengths)
            roadmap_readiness = round((attained_count / total_items) * 100, 1)
        else:
            roadmap_readiness = gap_analysis.get("overall_readiness", 0)

        top_cat = "None"
        if filtered_critical: top_cat = "Critical"
        elif filtered_important: top_cat = "Important"
        elif filtered_emerging: top_cat = "Emerging"

        logger.info(f"📊 Filtered Metrics: Score={roadmap_readiness}%, TopGap={top_cat}, Skills={all_gap_skills}")

        prompt = f"""
# Role: SkillBridge AI Career Architect

You are the core intelligence behind the **SkillBridge Learning Experience**. Generate a highly structured, production-ready learning roadmap.

## CONTEXT:
* **User's Current Skills**: {skills_str}
* **Target Role**: {target_role}
* **Critical Gaps**: {", ".join(critical) if critical else "None"}
* **Important Gaps**: {", ".join(important) if important else "None"}
* **Emerging Gaps**: {", ".join(emerging) if emerging else "None"}
* **Preferred Language**: {language}

## MANDATORY RULES:
1. Generate a **fast_track_roadmap** that includes ONLY the skills from this exact list: {json.dumps(all_gap_skills)}
2. DO NOT add ANY skill that is NOT in the list above. No AWS, GCP, Azure, Docker, or any other skill unless it appears in the list.
3. DO NOT invent or suggest additional skills. ONLY use skills from the provided list.
4. Each skill from the list MUST have its own entry in fast_track_roadmap.
5. Order by priority (Critical first, then Important, then Emerging).
6. Include metadata only — NO video suggestions.
7. Generate a **full_roadmap**: complete career journey from beginner to mastery.

## OUTPUT FORMAT (STRICT JSON):
Return ONLY valid JSON. No other text.

{{
  "readiness_summary": {{
    "current_score": {roadmap_readiness},
    "top_gap_category": "{top_cat}",
    "market_analysis": "Brief market insight"
  }},
  "skill_gap_analysis": {{
    "known_skills": {json.dumps([s['skill_name'] for s in user_skills])},
    "missing_skills": {json.dumps(all_gap_skills)},
    "advanced_skills": {json.dumps(emerging)},
    "strengths": {json.dumps([{"skill": s["skill"], "proficiency": s.get("user_proficiency", 0.8), "demand": s.get("demand", 0.5)} for s in strengths])}
  }},
  "fast_track_roadmap": [
    {{
      "skill": "Skill Name",
      "importance": "Why this is critical",
      "difficulty": "Beginner/Intermediate/Advanced",
      "estimated_time": "e.g. 20 hours",
      "target_proficiency": 0.8
    }}
  ],
  "full_roadmap": {{
    "beginner_milestones": [
        {{ "skill": "Skill Name", "importance": "Outcome", "difficulty": "Beginner", "estimated_time": "5h" }}
    ],
    "intermediate_milestones": [
        {{ "skill": "Skill Name", "importance": "Outcome", "difficulty": "Intermediate", "estimated_time": "10h" }}
    ],
    "advanced_milestones": [
        {{ "skill": "Skill Name", "importance": "Outcome", "difficulty": "Advanced", "estimated_time": "20h" }}
    ],
    "portfolio_projects": [
        {{ "title": "Project Name", "description": "Details" }}
    ],
    "career_preparation": [
        {{ "step": "Step Name", "details": "Action items" }}
    ]
  }},
  "language": "{language}"
}}
"""

        try:
            from groq import Groq

            client = Groq(api_key=self.api_key)

            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional career coach. Always return valid JSON. Do NOT include video or YouTube suggestions — only skill metadata. CRITICAL: You must ONLY include skills from the provided missing_skills list. Do NOT add any extra skills.",
                    },
                    {"role": "user", "content": prompt},
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.1,
            )

            content = chat_completion.choices[0].message.content
            roadmap_data = json.loads(content)

        except Exception as e:
            logger.error(f"❌ LLM roadmap generation failed: {e}")
            return {"error": f"LLM generation failed: {str(e)}"}

        # ── Post-processing: HARD FILTER — remove any skill NOT in gap analysis ──
        # Create a lookup map for effective gaps
        gap_info = {}
        for category in ["critical", "important", "emerging"]:
            for g in gaps.get(category, []):
                gap_info[g["skill"].lower()] = {
                    "gap": g.get("effective_gap", 0),
                    "demand": g.get("demand", 0.5)
                }

        allowed_skills = {s.lower() for s in all_gap_skills}
        fast_track = roadmap_data.get("fast_track_roadmap", [])
        
        filtered = []
        removed = []
        for item in fast_track:
            skill_lower = item.get("skill", "").lower()
            if skill_lower in allowed_skills:
                # Add current_proficiency based on gap analysis
                info = gap_info.get(skill_lower, {})
                gap_val = info.get("gap", 0)
                demand_val = info.get("demand", 0.5)
                item["attained_proficiency"] = round(max(0, demand_val - gap_val), 2)
                item["demand"] = demand_val
                filtered.append(item)
            else:
                removed.append(item.get("skill", "unknown"))
        
        if removed:
            logger.info(f"🚫 Removed LLM-invented skills from roadmap: {removed}")
        
        # Inject any gap skills the LLM missed
        existing = {item["skill"].lower() for item in filtered}
        for gap_skill in all_gap_skills:
            if gap_skill.lower() not in existing:
                logger.info(f"🔧 Injecting missing gap skill: {gap_skill}")
                info = gap_info.get(gap_skill.lower(), {})
                gap_val = info.get("gap", 0)
                demand_val = info.get("demand", 0.5)
                filtered.append({
                    "skill": gap_skill,
                    "importance": f"Identified as a significant gap for {target_role}",
                    "difficulty": "Intermediate",
                    "estimated_time": "15-25 hours",
                    "target_proficiency": 0.7,
                    "attained_proficiency": round(max(0, demand_val - gap_val), 2),
                    "demand": demand_val
                })

        roadmap_data["fast_track_roadmap"] = filtered
        logger.info(f"✅ Final roadmap skills ({len(filtered)}): {[f['skill'] for f in filtered]}")

        # Add attained_proficiency to full roadmap as well
        full_roadmap = roadmap_data.get("full_roadmap", {})
        for phase in ["beginner_milestones", "intermediate_milestones", "advanced_milestones"]:
            for item in full_roadmap.get(phase, []):
                s_lower = item.get("skill", "").lower()
                info = gap_info.get(s_lower, {})
                gap_val = info.get("gap", 0)
                demand_val = info.get("demand", 0.5)
                # If it's a gap, use (demand - gap), otherwise it's a strength (assume demand met)
                if s_lower in allowed_skills:
                    item["attained_proficiency"] = round(max(0, demand_val - gap_val), 2)
                    item["demand"] = demand_val
                else:
                    item["attained_proficiency"] = demand_val # It's a strength
                    item["demand"] = demand_val

        # ── Stage 2: Attach real YouTube resources ──
        if youtube_service and roadmap_data.get("fast_track_roadmap"):
            import asyncio

            # Clear cache to ensure fresh results
            if hasattr(youtube_service, '_cache'):
                youtube_service._cache.clear()
                logger.info("🗑️ Cleared YouTube cache for fresh results")

            # 1. Fast Track Skills
            skills_to_fetch = roadmap_data["fast_track_roadmap"]
            
            # 2. Full Roadmap Milestones (Beginner, Intermediate, Advanced)
            full_roadmap = roadmap_data.get("full_roadmap", {})
            full_milestones = []
            for phase in ["beginner_milestones", "intermediate_milestones", "advanced_milestones"]:
                full_milestones.extend(full_roadmap.get(phase, []))
            
            # Combine all for fetching
            all_milestones_to_process = skills_to_fetch + full_milestones
            
            logger.info(f"🎬 Fetching YouTube resources for {len(all_milestones_to_process)} milestones...")

            tasks = []
            for item in all_milestones_to_process:
                search_name = normalize_skill_name(item["skill"])
                logger.info(f"  → Searching YouTube for: '{search_name}' (original: '{item['skill']}')")
                tasks.append(youtube_service.get_oneshot_only(search_name, language))

            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for item, yt_result in zip(skills_to_fetch, results):
                    if isinstance(yt_result, Exception):
                        logger.warning(f"⚠️ YouTube fetch failed for {item['skill']}: {yt_result}")
                        item["playlist"] = None
                        item["oneshot"] = None
                    else:
                        oneshot = yt_result.get("oneshot")
                        logger.info(f"  ✅ {item['skill']}: oneshot={'yes' if oneshot and oneshot.get('video_id') else 'no'}")
                        
                        item["playlist"] = None  # Playlist disabled for now
                        item["oneshot"] = oneshot

                logger.info("✅ YouTube resources attached to roadmap")
            except Exception as e:
                logger.error(f"❌ YouTube resource batch fetch failed: {e}")

        # Store the language used
        roadmap_data["language"] = language

        return roadmap_data
