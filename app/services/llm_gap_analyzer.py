"""
Groq LLM-based skill gap analysis service.
Uses contextual understanding to compare user skills vs market demand.
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

GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_TIMEOUT = 45

SYSTEM_PROMPT = """You are a senior technical career strategist and AI talent matcher. 
Your task is to perform a CONTEXTUAL skill gap analysis.

You will be given:
1. User Skills (with proficiency 0.0-1.0)
2. Market Requirements (with demand/frequency 0.0-1.0)

Your goal is to identify gaps not just by name, but by SEMANTIC understanding.
Logic Rules:
- Contextual Matching: If user lacks "FastAPI" but has 0.9 proficiency in "Python" and "Flask", the gap for FastAPI is HIGHLY TRANSFERABLE (lower effective gap).
- Prerequisite Logic: If a user lacks "PyTorch" and also lacks "Python", "Python" is a Critical PREREQUISITE.
- Calculation: Effective Gap = Market Demand - (User Proficiency * Similarity_Factor).

Categorization:
- Critical Gaps: Effective Gap > 0.6 (Must learn immediately)
- Important Gaps: Effective Gap 0.3 - 0.6 (Strategic learning)
- Emerging Gaps: Effective Gap < 0.3 (Nice to have / Monitor)

Output JSON structure:
{
  "overall_readiness": float (0-100),
  "interpretation": "Direct, actionable career advice",
  "skill_gaps": {
    "critical": [{"skill": str, "demand": float (0.0-1.0), "demand_percentage": str, "requirement_level": "critical", "reasoning": str, "transferability": float}],
    "important": [{"skill": str, "demand": float (0.0-1.0), "demand_percentage": str, "requirement_level": "important", "reasoning": str, "transferability": float}],
    "emerging": [{"skill": str, "demand": float (0.0-1.0), "demand_percentage": str, "requirement_level": "emerging", "reasoning": str, "transferability": float}]
  },
  "strengths": [{"skill": str, "proficiency": float, "demand": float}]
}

Important: Return ONLY valid JSON."""

USER_PROMPT_TEMPLATE = """Target Role: {target_role}

User Skills:
{user_skills_json}

Market Requirements:
{market_requirements_json}

Perform the gap analysis and return the JSON response."""

class GroqGapAnalyzer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.client: Optional[Any] = None
        self.available = False

        if GROQ_AVAILABLE and self.api_key:
            try:
                self.client = Groq(api_key=self.api_key)
                self.available = True
            except:
                self.available = False

    def analyze_gaps(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        target_role: str = "Target Position"
    ) -> Dict:
        if not self.available:
            # Fallback to simple logic if Groq is unavailable
            return self._fallback_analysis(user_skills, market_requirements)

        user_skills_simple = {k: v.get('proficiency', 0) for k, v in user_skills.items()}
        market_req_simple = {k: v.get('frequency', 0) for k, v in market_requirements.items()}

        user_prompt = USER_PROMPT_TEMPLATE.format(
            target_role=target_role,
            user_skills_json=json.dumps(user_skills_simple, indent=2),
            market_requirements_json=json.dumps(market_req_simple, indent=2)
        )

        try:
            response = self.client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            print(f"Error in GroqGapAnalyzer: {e}")
            return self._fallback_analysis(user_skills, market_requirements)

    def _fallback_analysis(self, user_skills: Dict[str, Dict], market_requirements: Dict[str, Dict]) -> Dict:
        # Simple heuristic fallback
        critical = []
        important = []
        emerging = []
        strengths = []
        
        matched_count = 0
        total_market = len(market_requirements)
        
        for skill, market_data in market_requirements.items():
            market_demand = market_data.get('frequency', 0)
            user_data = user_skills.get(skill.lower()) or user_skills.get(skill)
            user_prof = user_data.get('proficiency', 0) if user_data else 0
            
            if user_data:
                matched_count += 1
                
            gap = max(0, (market_demand - user_prof) * 100)
            
            skill_info = {
                "skill": skill,
                "demand": market_demand,
                "demand_percentage": f"{int(market_demand * 100)}%",
                "requirement_level": "",
                "reasoning": "Heuristic comparison",
                "transferability": 0.0 if gap > 50 else 0.5
            }
            
            if gap > 70:
                skill_info["requirement_level"] = "critical"
                critical.append(skill_info)
            elif gap >= 30:
                skill_info["requirement_level"] = "important"
                important.append(skill_info)
            elif gap > 0:
                skill_info["requirement_level"] = "emerging"
                emerging.append(skill_info)
            else:
                strengths.append(skill_info)
                
        readiness = (matched_count / total_market * 100) if total_market > 0 else 0
        
        return {
            "overall_readiness": round(readiness, 1),
            "interpretation": "Analysis performed using heuristic fallback.",
            "skill_gaps": {
                "critical": critical,
                "important": important,
                "emerging": emerging
            },
            "strengths": strengths
        }
