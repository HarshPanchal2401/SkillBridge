"""Roadmap Generator — Generates skill-gap roadmap via LLM, then attaches real YouTube resources."""
import json
import os
from typing import Dict, List, Any, Optional
from app.logging_config import get_logger

logger = get_logger("roadmap_generator")


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
        critical = [g["skill"] for g in gaps.get("critical", [])]
        important = [g["skill"] for g in gaps.get("important", [])]
        emerging = [g["skill"] for g in gaps.get("emerging", [])]

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

## INSTRUCTIONS:
1. Generate a **fast_track_roadmap**: list of missing/critical skills the user needs to learn. Order by priority. Include metadata only — NO video suggestions.
2. Generate a **full_roadmap**: complete career journey from beginner to mastery.

## OUTPUT FORMAT (STRICT JSON):
Return ONLY valid JSON. No other text.

{{
  "readiness_summary": {{
    "current_score": {gap_analysis.get('overall_readiness', 0)},
    "top_gap_category": "{(critical and 'Critical') or (important and 'Important') or 'None'}",
    "market_analysis": "Brief market insight"
  }},
  "skill_gap_analysis": {{
    "known_skills": {json.dumps([s['skill_name'] for s in user_skills])},
    "missing_skills": {json.dumps(critical + important)},
    "advanced_skills": {json.dumps(emerging)}
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
    "beginner_milestones": [],
    "intermediate_milestones": [],
    "advanced_milestones": [],
    "portfolio_projects": [],
    "career_preparation": []
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
                        "content": "You are a professional career coach. Always return valid JSON. Do NOT include video or YouTube suggestions — only skill metadata.",
                    },
                    {"role": "user", "content": prompt},
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            content = chat_completion.choices[0].message.content
            roadmap_data = json.loads(content)

        except Exception as e:
            logger.error(f"❌ LLM roadmap generation failed: {e}")
            return {"error": f"LLM generation failed: {str(e)}"}

        # ── Stage 2: Attach real YouTube resources ──
        if youtube_service and roadmap_data.get("fast_track_roadmap"):
            import asyncio

            skills_to_fetch = roadmap_data["fast_track_roadmap"]
            logger.info(f"🎬 Fetching YouTube resources for {len(skills_to_fetch)} skills...")

            tasks = [
                youtube_service.get_resources_for_skill(item["skill"], language)
                for item in skills_to_fetch
            ]

            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for item, yt_result in zip(skills_to_fetch, results):
                    if isinstance(yt_result, Exception):
                        logger.warning(f"⚠️ YouTube fetch failed for {item['skill']}: {yt_result}")
                        item["playlist"] = None
                        item["oneshot"] = None
                    else:
                        item["playlist"] = yt_result.get("playlist")
                        item["oneshot"] = yt_result.get("oneshot")

                logger.info("✅ YouTube resources attached to roadmap")
            except Exception as e:
                logger.error(f"❌ YouTube resource batch fetch failed: {e}")

        # Store the language used
        roadmap_data["language"] = language

        return roadmap_data
