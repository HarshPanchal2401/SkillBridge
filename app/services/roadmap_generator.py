import json
import os
from typing import Dict, List, Any, Optional
from app.logging_config import get_logger

logger = get_logger("roadmap_generator")

class RoadmapGenerator:
    """
    Service to generate industry-realistic learning roadmaps using LLM.
    Implements the Master Prompt for SkillBridge.
    """
    
    def __init__(self, groq_api_key: Optional[str] = None):
        self.api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ RoadmapGenerator: GROQ_API_KEY not found. Generation will fail.")
            
    async def generate_roadmap(
        self, 
        user_skills: List[Dict[str, Any]], 
        target_role: str, 
        gap_analysis: Dict[str, Any],
        language: str = "English"
    ) -> Dict[str, Any]:
        """
        Generate a dual roadmap (Fast-Track & Full) using Groq LLM.
        """
        if not self.api_key:
            return {"error": "GROQ_API_KEY not configured"}

        # Format skills for prompt
        skills_str = ", ".join([f"{s['skill_name']} ({s.get('proficiency', 0):.1f})" for s in user_skills])
        
        # Format gaps for prompt
        gaps = gap_analysis.get('skill_gaps', {})
        critical = [g['skill'] for g in gaps.get('critical', [])]
        important = [g['skill'] for g in gaps.get('important', [])]
        emerging = [g['skill'] for g in gaps.get('emerging', [])]
        
        prompt = f"""
# Role: SkillBridge AI Career Architect & RAG Tutor Specialist

You are the core intelligence behind the **SkillBridge Learning Experience**. Your mission is to generate a highly structured, production-ready learning roadmap AND prepare the context for an interactive **"Ask Tutor" RAG Chatbot**.

---

## 🛠️ CONTEXT & DATA INPUT:

* **User's Current Skills**: {skills_str}
* **Target Role**: {target_role}
* **Gap Analysis Results**: 
    - Critical Gaps: {", ".join(critical) if critical else "None"}
    - Important Gaps: {", ".join(important) if important else "None"}
    - Emerging Gaps: {", ".join(emerging) if emerging else "None"}
* **Preferred Language**: {language}

---

## 🎯 STEP 1: SKILL GAP MAPPING & PRIORITIZATION
1.  Analyze Parity: Match user's existing skills against target role requirements.
2.  Quantify Gaps: Identify the delta between current proficiency and market-standard requirements.
3.  Categorize: Known Skills, Missing Skills (Gaps), Advanced Skills.

---

## 🧭 STEP 2: GENERATE DUAL ROADMAPS

### Path A: THE QUICK-START GAP ROADMAP (Hiring Focused)
* Goal: Fastest route to a 75%+ readiness score.
* Inclusion: Only missing/critical gaps in logical learning order.
* Per-Skill Requirements: Importance, Difficulty, Target Proficiency [0.0-1.0], 3 YouTube suggestions.

### Path B: THE 0 → 100 FULL ROADMAP (Career Mastery)
* Goal: Complete mastery from fundamentals to industry leadership.
* Phases: Beginner, Intermediate, Advanced, Project Phase, Interview Prep.

---

## 📺 STEP 3: VIDEO & RAG "ASK TUTOR" PIPELINE
(Include metadata for tutoring and Hindi-to-English translation mapping if applicable.)

---

## 🤖 STEP 4: CHATBOT TUTOR BEHAVIOR
(Personality: Expert Technical Mentor, Mission: Explain seamless & right without fail.)

---

## ⚙️ STEP 5: OUTPUT FORMAT (STRICT JSON)
Return ONLY a valid JSON object. No other text.

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
      "importance": "Rationale",
      "difficulty": "Beginner/Intermediate/Advanced",
      "estimated_time": "e.g. 20 hours",
      "target_proficiency": 0.8,
      "videos": [
        {{
          "title": "Title",
          "channel": "Channel",
          "duration": "Duration",
          "level": "Level",
          "reason": "Why recommended",
          "tutor_ready": true,
          "translation_engine": "Hindi-to-English Mapping Enabled"
        }}
      ]
    }}
  ],
  "full_roadmap": {{
    "beginner_milestones": [],
    "intermediate_milestones": [],
    "advanced_milestones": [],
    "portfolio_projects": [],
    "career_preparation": []
  }},
  "ask_tutor_config": {{
    "rag_enabled": true,
    "pedagogical_style": "Seamless Expert",
    "translation_support": "Enabled for non-English sources"
  }}
}}
"""

        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)
            
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional career coach and technical architect. Always return valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            
            content = chat_completion.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"❌ Roadmap generation failed: {e}")
            return {"error": f"LLM generation failed: {str(e)}"}
