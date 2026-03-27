import json
import os
import concurrent.futures
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
    "python": "Python Programming for Beginners",
    "java": "Java Programming with projects",
    "c++": "C++ Programming complete course",
    "data structures": "Data Structures and Algorithms DSA",
    "dsa": "Data Structures and Algorithms",
    "math": "Mathematics for Computer Science",
    "statistics": "Statistics for Data Science",
    "natural-language-processing": "Natural Language Processing NLP Complete Course",
    "natural language processing": "Natural Language Processing NLP Complete Course",
    "computer-vision": "Computer Vision Course with Projects",
    "computer vision": "Computer Vision Course with Projects",
    "docker": "Docker and Containers",
    "kubernetes": "Kubernetes and Orchestration",
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
        course_recommender=None,
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

You are the core intelligence behind the **SkillBridge Learning Experience**. Generate a highly structured, production-ready career roadmap.

## CONTEXT:
* **User's Current Skills**: {skills_str}
* **Target Role**: {target_role}
* **Gaps Identified**: {", ".join(all_gap_skills) if all_gap_skills else "None"}
* **Preferred Language**: {language}

## REQUIRED OUTPUT SECTIONS:

1. **fast_track_roadmap**: 
   - Focus ONLY on the missing skills (Gaps). 
   - Content: {json.dumps(all_gap_skills)}
   - Order: Critical first, then Important/Emerging.

2. **full_roadmap**: 
   - A COMPLETE career journey from absolute beginner to industry master for the role of {target_role}.
   - MUST include foundational basics (e.g., if AI/ML: Python, SQL, Math), even if the user already knows them.
   - Phases: beginner_milestones, intermediate_milestones, advanced_milestones.
   - Each phase should have 3-5 key milestones.

## MANDATORY RULES:
1. **Industry Standards ONLY**: Use verified, widely-recognized technologies (e.g., "React.js" instead of just "Frontend").
2. **Skill Verification**: For each milestone in both roadmaps, provide a `verification_reason` (max 15 words) explaining why this specific skill is non-negotiable for {target_role}.
3. The full_roadmap MUST feel like a complete textbook or university curriculum for {target_role}.
4. Return ONLY valid JSON.

## OUTPUT FORMAT (STRICT JSON):
{{
  "readiness_summary": {{
    "current_score": {roadmap_readiness},
    "top_gap_category": "{top_cat}",
    "market_analysis": "Brief market insight"
  }},
  "skill_gap_analysis": {{
    "known_skills": {json.dumps([s['skill_name'] for s in user_skills])},
    "missing_skills": {json.dumps(all_gap_skills)},
    "strengths": {json.dumps([{"skill": s["skill"], "proficiency": s.get("user_proficiency", 0.8)} for s in strengths])}
  }},
  "fast_track_roadmap": [
    {{
      "skill": "Skill Name",
      "importance": "Outcome/Use Case",
      "difficulty": "Beginner/Intermediate/Advanced",
      "estimated_time": "e.g. 20h",
      "verification_reason": "Why this is critical for {target_role}"
    }}
  ],
  "full_roadmap": {{
    "beginner_milestones": [
        {{ "skill": "Skill Name", "importance": "Outcome", "difficulty": "Beginner", "estimated_time": "5h", "verification_reason": "Foundational necessity" }}
    ],
    "intermediate_milestones": [
        {{ "skill": "Skill Name", "importance": "Outcome", "difficulty": "Intermediate", "estimated_time": "10h", "verification_reason": "Core mastery" }}
    ],
    "advanced_milestones": [
        {{ "skill": "Skill Name", "importance": "Outcome", "difficulty": "Advanced", "estimated_time": "20h", "verification_reason": "Specialist depth" }}
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

            def _call_groq():
                return client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a professional career coach. Always return valid JSON. Do NOT include video or YouTube suggestions — only skill metadata. CRITICAL: While the fast_track_roadmap should focus on gaps, the full_roadmap MUST be a comprehensive career journey from absolute basics to mastery, including foundational skills.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    model="llama-3.3-70b-versatile",
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_call_groq)
                # Hard 25s timeout for Roadmap generation
                chat_completion = future.result(timeout=25)

            content = chat_completion.choices[0].message.content
            roadmap_data = json.loads(content)

        except concurrent.futures.TimeoutError:
            logger.error("❌ Roadmap generation timeout after 25s")
            return {"error": "LLM generation timed out. Please try again."}
        except Exception as e:
            logger.error(f"❌ LLM roadmap generation failed: {e}")
            return {"error": f"LLM generation failed: {str(e)}"}

        # ── Post-processing: Filtering & 0.0 Reset ──
        allowed_skills = {s.lower() for s in all_gap_skills}
        fast_track = roadmap_data.get("fast_track_roadmap", [])
        
        filtered = []
        for item in fast_track:
            skill_lower = item.get("skill", "").lower()
            if skill_lower in allowed_skills:
                item["attained_proficiency"] = 0.0
                item["demand"] = 0.8
                filtered.append(item)
        
        # Inject any gap skills the LLM missed
        existing = {item["skill"].lower() for item in filtered}
        for gap_skill in all_gap_skills:
            if gap_skill.lower() not in existing:
                filtered.append({
                    "skill": gap_skill,
                    "importance": f"Critical gap identified for {target_role}",
                    "difficulty": "Intermediate",
                    "estimated_time": "15-20 hours",
                    "target_proficiency": 0.8,
                    "attained_proficiency": 0.0,
                    "demand": 0.8
                })

        roadmap_data["fast_track_roadmap"] = filtered

        # 2. Full Roadmap Reset
        full_roadmap = roadmap_data.get("full_roadmap", {})
        for phase in ["beginner_milestones", "intermediate_milestones", "advanced_milestones"]:
            for item in full_roadmap.get(phase, []):
                item["attained_proficiency"] = 0.0
                item["demand"] = 0.8

        # ── Stage 2: Attach real YouTube resources ──
        if youtube_service:
            import asyncio

            # Clear cache to ensure fresh results
            if hasattr(youtube_service, '_cache'):
                youtube_service._cache.clear()
                logger.info("🗑️ Cleared YouTube cache for fresh results")

            # Collect all unique skills across both roadmaps to avoid duplicate fetches
            all_items_to_process = []
            seen_skills = {} # skill_name -> item reference list

            # Fast Track
            for item in roadmap_data.get("fast_track_roadmap", []):
                s_name = item["skill"].strip().lower()
                if s_name not in seen_skills:
                    seen_skills[s_name] = []
                    all_items_to_process.append(item)
                seen_skills[s_name].append(item)

            # Full Roadmap
            for phase in ["beginner_milestones", "intermediate_milestones", "advanced_milestones"]:
                for item in full_roadmap.get(phase, []):
                    s_name = item["skill"].strip().lower()
                    if s_name not in seen_skills:
                        seen_skills[s_name] = []
                        all_items_to_process.append(item)
                    seen_skills[s_name].append(item)
            
            logger.info(f"🎬 Fetching YouTube resources for {len(all_items_to_process)} unique skills...")

            tasks = []
            for item in all_items_to_process:
                search_name = normalize_skill_name(item["skill"])
                tasks.append(youtube_service.get_oneshot_only(search_name, language))

            try:
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for item, yt_result in zip(all_items_to_process, results):
                    s_name = item["skill"].strip().lower()
                    
                    if isinstance(yt_result, Exception):
                        logger.warning(f"⚠️ YouTube fetch failed for {item['skill']}: {yt_result}")
                        oneshot = None
                    else:
                        oneshot = yt_result.get("oneshot")
                    
                    # Apply this video to ALL instances of this skill across both roadmaps
                    for target_item in seen_skills[s_name]:
                        target_item["oneshot"] = oneshot
                        target_item["playlist"] = None # Disabled for simplicity

                logger.info(f"✅ Successfully attached YouTube resources to {len(all_items_to_process)} milestones across both roadmaps")
            except Exception as e:
                logger.error(f"❌ YouTube resource batch fetch failed: {e}")

        # ── Stage 3: Attach Expert Course Recommendations ──
        if course_recommender:
            logger.info("🎓 Fetching expert course recommendations for gap milestones...")
            # We only recommend courses for skills that are gaps (in all_gap_skills)
            gap_set = {s.lower() for s in all_gap_skills}
            
            # Fast Track (Mostly gaps)
            for item in roadmap_data.get("fast_track_roadmap", []):
                s_name = item["skill"].strip().lower()
                if s_name in gap_set:
                    # Get top 2 courses
                    courses = course_recommender.search_courses_for_skill(item["skill"], max_results=2)
                    item["recommended_courses"] = courses
            
            # Full Roadmap (Only for gap milestones)
            for phase in ["beginner_milestones", "intermediate_milestones", "advanced_milestones"]:
                for item in full_roadmap.get(phase, []):
                    s_name = item["skill"].strip().lower()
                    if s_name in gap_set:
                        courses = course_recommender.search_courses_for_skill(item["skill"], max_results=2)
                        item["recommended_courses"] = courses

            logger.info("✅ Successfully merged course recommendations into roadmap")

        # Store the language used
        roadmap_data["language"] = language

        return roadmap_data
