"""
Groq LLM-based skill refinement service.

Takes resume text + heuristic skills/proficiency from PrioritySkillExtractor
and uses Groq's LLM to contextually validate and refine each skill's proficiency.

Fallback: if Groq call fails or key is missing, returns original heuristic list unchanged.
"""
import os
import json
import re
from typing import List, Dict, Any, Optional

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

# Best available Groq model — fast, high-quality, 128k context window
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_TIMEOUT = 45  # seconds

# System prompt for skill refinement
SYSTEM_PROMPT = """You are an expert technical recruiter and skills assessor with 15+ years of experience evaluating software engineering, data science, and technology resumes.

Your job is to analyze a candidate's resume and refine the skill proficiency scores that were initially estimated by a heuristic algorithm.

For each skill, you must:
1. Confirm the skill is *genuinely* present and relevant in the resume (not just mentioned in passing)
2. Assess true proficiency based on: years of experience, depth of usage, projects built, certifications, leadership/architecture roles, and context
3. Assign a proficiency score from 0.0 to 1.0 using this scale:
   - 0.10–0.25: Basic awareness or exposure only (e.g., "familiar with X", mentions once)
   - 0.30–0.45: Beginner/learning (used in a course or single small project)
   - 0.50–0.65: Intermediate (used in real projects, some experience)
   - 0.70–0.80: Proficient (regular use, multiple projects, solid experience)
   - 0.85–0.95: Advanced/Expert (led teams, architected systems, deep specialization, 3+ years)
   - 1.00: World-class / certified expert (rarely appropriate)

Rules:
- ONLY refine skills from the provided list — do NOT add new skills
- ONLY remove a skill if it is completely absent from the resume text (not just underemphasized)
- Be realistic: most candidates have 2–3 advanced skills, not 10
- Consider the FULL resume context, not just the skills section
- Return ONLY a valid JSON array — no markdown, no explanation outside JSON"""

USER_PROMPT_TEMPLATE = """Here is the candidate's full resume text:

<resume>
{resume_text}
</resume>

The heuristic algorithm detected these skills with initial proficiency scores (scale 0.0–1.0):

<heuristic_skills>
{heuristic_skills_json}
</heuristic_skills>

Please refine these skills based on the full resume context.

Respond with ONLY a JSON array in exactly this format:
[
  {{
    "skill": "skill-name",
    "proficiency": 0.75,
    "reasoning": "3 years hands-on in 2 major projects, led backend architecture"
  }},
  ...
]

Important:
- "skill" must exactly match one from the heuristic list
- "proficiency" is a float between 0.0 and 1.0
- "reasoning" is a single short sentence (max 12 words) explaining the score
- Return ONLY the JSON array — no other text"""


class GroqSkillRefiner:
    """
    Uses Groq LLM to refine skill proficiency scores after heuristic extraction.

    The heuristic extractor (PrioritySkillExtractor) gives raw scores based on
    section weights, occurrences, and action verbs. This refiner uses LLM
    understanding of the full resume context to correct and calibrate those scores.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.client: Optional[Any] = None
        self.available = False

        if not GROQ_AVAILABLE:
            print("⚠️  groq package not installed. Run: pip install groq")
            return

        if not self.api_key:
            print("⚠️  GROQ_API_KEY not set. Skill refinement will use heuristic scores only.")
            return

        try:
            self.client = Groq(api_key=self.api_key)
            self.available = True
            print(f"✅ GroqSkillRefiner initialized (model: {GROQ_MODEL})")
        except Exception as e:
            print(f"⚠️  Failed to initialize Groq client: {e}")

    def is_available(self) -> bool:
        """Check if the refiner is ready to use."""
        return self.available and self.client is not None

    def refine_skills(
        self,
        resume_text: str,
        heuristic_skills: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Refine heuristic skill scores using Groq LLM.

        Args:
            resume_text: Full resume text (plain text, already extracted)
            heuristic_skills: List of dicts from PrioritySkillExtractor:
                [{"skill": "python", "proficiency": 0.75, "confidence": 0.9, ...}, ...]

        Returns:
            Refined list of skill dicts with updated proficiency + llm_refined=True.
            Falls back to original heuristic list on any error.
        """
        if not self.is_available():
            print("ℹ️  Groq not available — using heuristic scores unchanged.")
            return heuristic_skills

        if not heuristic_skills:
            return heuristic_skills

        # Truncate resume to prevent token overflow (keep ~6000 chars — ~1500 tokens)
        truncated_resume = resume_text[:6000] if len(resume_text) > 6000 else resume_text

        # Build simplified skill list for the prompt (name + heuristic score only)
        simplified = [
            {"skill": s.get("skill", ""), "heuristic_proficiency": round(s.get("proficiency", 0.5), 2)}
            for s in heuristic_skills
            if s.get("skill")
        ]

        user_prompt = USER_PROMPT_TEMPLATE.format(
            resume_text=truncated_resume,
            heuristic_skills_json=json.dumps(simplified, indent=2),
        )

        try:
            print(f"🤖 Calling Groq ({GROQ_MODEL}) to refine {len(heuristic_skills)} skills...")

            response = self.client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,      # Low temperature for consistent, factual scoring
                max_tokens=2048,
                timeout=GROQ_TIMEOUT,
            )

            raw_content = response.choices[0].message.content.strip()
            print(f"✅ Groq responded ({len(raw_content)} chars)")

            # Parse the JSON response
            refined_list = self._parse_llm_response(raw_content)

            if not refined_list:
                print("⚠️  Groq returned empty/invalid JSON — falling back to heuristic scores.")
                return self._mark_heuristic(heuristic_skills)

            # Merge LLM results back with original heuristic data
            return self._merge_results(heuristic_skills, refined_list)

        except Exception as e:
            print(f"⚠️  Groq refinement failed: {e} — falling back to heuristic scores.")
            return self._mark_heuristic(heuristic_skills)

    def _parse_llm_response(self, content: str) -> List[Dict[str, Any]]:
        """
        Extract the JSON array from the LLM response.
        Handles cases where the model wraps it in markdown code blocks.
        """
        # Strip markdown code fences if present
        content = re.sub(r"```(?:json)?", "", content).strip()
        content = content.strip("`").strip()

        # Find the JSON array bounds
        start = content.find("[")
        end = content.rfind("]") + 1

        if start == -1 or end == 0:
            print(f"⚠️  No JSON array found in LLM response: {content[:200]}")
            return []

        json_str = content[start:end]

        try:
            parsed = json.loads(json_str)
            if isinstance(parsed, list):
                return parsed
            return []
        except json.JSONDecodeError as e:
            print(f"⚠️  JSON parse error: {e}")
            # Try to fix common issues: trailing commas
            try:
                fixed = re.sub(r",\s*([}\]])", r"\1", json_str)
                return json.loads(fixed)
            except Exception:
                return []

    def _merge_results(
        self,
        original: List[Dict[str, Any]],
        refined: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Merge LLM refined scores back into the original heuristic skill dicts.

        - Skills present in LLM output: use LLM proficiency, mark llm_refined=True
        - Skills missing from LLM output: keep heuristic score, mark llm_refined=False
        - Skills added by LLM that weren't in original: ignored (LLM shouldn't do this)
        """
        # Build lookup: skill_name → refined data
        refined_map: Dict[str, Dict] = {}
        for item in refined:
            skill_name = item.get("skill", "").strip().lower()
            if skill_name:
                refined_map[skill_name] = item

        result = []
        llm_count = 0

        for orig_skill in original:
            skill_name = orig_skill.get("skill", "").strip().lower()
            merged = dict(orig_skill)  # copy all original fields

            if skill_name in refined_map:
                llm_data = refined_map[skill_name]
                raw_prof = llm_data.get("proficiency", orig_skill.get("proficiency", 0.5))

                # Clamp to [0.0, 1.0]
                refined_prof = max(0.0, min(float(raw_prof), 1.0))
                merged["proficiency"] = round(refined_prof, 2)
                merged["llm_refined"] = True
                merged["llm_reasoning"] = llm_data.get("reasoning", "")
                llm_count += 1
            else:
                merged["llm_refined"] = False
                merged["llm_reasoning"] = ""

            result.append(merged)

        # Sort by proficiency descending (same as original extractor)
        result.sort(key=lambda x: x["proficiency"], reverse=True)

        print(f"✅ LLM refined {llm_count}/{len(original)} skills")
        return result

    def _mark_heuristic(self, skills: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Mark all skills as NOT LLM refined (fallback case)."""
        return [
            {**s, "llm_refined": False, "llm_reasoning": ""}
            for s in skills
        ]
