"""
Groq LLM-based skill gap ENRICHMENT service.

The core gap detection is done by SmartGapAnalyzer (deterministic, ontology-first).
This module only ENRICHES the gaps with human-readable reasoning via Groq LLM.
If Groq is unavailable the SmartGapAnalyzer result is returned as-is.
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

from app.services.gap_analyzer import SmartGapAnalyzer

GROQ_MODEL   = "llama-3.3-70b-versatile"
GROQ_TIMEOUT = 45

# ── Prompt for ENRICHMENT only (not gap detection) ───────────────────────────
ENRICH_SYSTEM = """You are a senior technical career strategist.
You will receive a pre-computed skill gap analysis result.
Your ONLY job is to add a short "reasoning" field (1 sentence) to each gap item
explaining WHY this skill matters for the role and HOW urgently the user should learn it.
Do NOT change any skill names, demands, or requirement_level values.
Return ONLY valid JSON with the same structure you received, with "reasoning" added to each gap.
"""

ENRICH_USER_TMPL = """Target Role: {target_role}

Gaps to enrich (add reasoning field to each):
{gaps_json}

Return enriched JSON array only."""


class GroqGapAnalyzer:
    """
    Wraps SmartGapAnalyzer with optional Groq LLM enrichment.

    analyze_gaps() always returns a valid result:
      - SmartGapAnalyzer provides the authoritative gap list
      - Groq adds "reasoning" text to each gap (best-effort, skipped on error)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key  = api_key or os.getenv("GROQ_API_KEY", "")
        self.client: Optional[Any] = None
        self.available = False
        self._smart = SmartGapAnalyzer()

        if GROQ_AVAILABLE and self.api_key:
            try:
                self.client    = Groq(api_key=self.api_key)
                self.available = True
            except Exception:
                self.available = False

    def is_available(self) -> bool:
        return self.available

    def analyze_gaps(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        target_role: str = "Target Position",
    ) -> Dict:
        """
        Run SmartGapAnalyzer then optionally enrich gaps with Groq reasoning.
        Always returns the standard SmartGapAnalyzer dict format.
        """
        # 1. Authoritative gap detection (pure Python, always works)
        result = self._smart.analyze_gaps(user_skills, market_requirements)

        # 2. Optional: enrich with Groq reasoning
        if self.available:
            try:
                result = self._enrich_with_reasoning(result, target_role)
            except Exception as e:
                print(f"⚠️  Groq enrichment failed (using base result): {e}")

        # Reformat to match the LLM-style `skill_gaps` key expected by analysis.py
        return {
            "overall_readiness": result["overall_readiness"],
            "interpretation":    result["summary"]["interpretation"],
            "skill_gaps": {
                "critical":  result["critical_gaps"],
                "important": result["important_gaps"],
                "emerging":  result["emerging_gaps"],
            },
            "strengths":         result["strengths"],
            # pass through summary keys for backward compat
            "summary":           result["summary"],
            "critical_gaps":     result["critical_gaps"],
            "important_gaps":    result["important_gaps"],
            "emerging_gaps":     result["emerging_gaps"],
        }

    # ── Groq enrichment (reasoning only) ─────────────────────────────────────
    def _enrich_with_reasoning(self, result: Dict, target_role: str) -> Dict:
        all_gaps = (
            result["critical_gaps"] +
            result["important_gaps"] +
            result["emerging_gaps"]
        )
        if not all_gaps:
            return result

        # Send only the minimal gap info to Groq (skill + demand + level)
        slim = [
            {
                "skill":             g["skill"],
                "demand":            g["demand"],
                "requirement_level": g["requirement_level"],
            }
            for g in all_gaps
        ]

        response = self.client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": ENRICH_SYSTEM},
                {"role": "user",   "content": ENRICH_USER_TMPL.format(
                    target_role=target_role,
                    gaps_json=json.dumps(slim, indent=2)
                )},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            timeout=GROQ_TIMEOUT,
        )

        content = response.choices[0].message.content
        enriched_list = self._parse_enriched(content)
        if not enriched_list:
            return result

        # Map skill name → reasoning
        reasoning_map: Dict[str, str] = {
            item["skill"]: item.get("reasoning", "")
            for item in enriched_list
            if isinstance(item, dict) and "skill" in item
        }

        def add_reasoning(gaps: List[Dict]) -> List[Dict]:
            for g in gaps:
                if g["skill"] in reasoning_map:
                    g["reasoning"] = reasoning_map[g["skill"]]
            return gaps

        result["critical_gaps"]  = add_reasoning(result["critical_gaps"])
        result["important_gaps"] = add_reasoning(result["important_gaps"])
        result["emerging_gaps"]  = add_reasoning(result["emerging_gaps"])
        return result

    @staticmethod
    def _parse_enriched(content: str) -> List[Dict]:
        """Extract list from Groq JSON response (handles wrapper objects)."""
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
            # Groq sometimes wraps: {"gaps": [...]} or {"skills": [...]}
            for key in ("gaps", "skills", "skill_gaps", "items", "data"):
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
            # Try first list value
            for v in parsed.values():
                if isinstance(v, list):
                    return v
        except Exception:
            pass
        return []


# ── backward-compat alias ────────────────────────────────────────────────────
LLMGapAnalyzer = GroqGapAnalyzer
