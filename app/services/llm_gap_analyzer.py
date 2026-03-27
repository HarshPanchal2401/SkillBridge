"""
Groq LLM-based skill gap ENRICHMENT service.

The core gap detection is done by SmartGapAnalyzer (deterministic, ontology-first).
This module only ENRICHES the gaps with human-readable reasoning via Groq LLM.
If Groq is unavailable the SmartGapAnalyzer result is returned as-is.
"""
import os
import json
import re
import concurrent.futures
from typing import List, Dict, Any, Optional

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

from app.services.gap_analyzer import SmartGapAnalyzer

GROQ_MODEL   = "llama-3.3-70b-versatile"
GROQ_TIMEOUT = 15    # reduced from 45 s — fail fast, base result is always valid
GROQ_MAX_GAPS = 10   # only enrich top N gaps to keep prompt small

# ── Prompt for Contextual Gap Evaluation ──────────────────────────────────────
EVAL_SYSTEM = """You are a senior technical career strategist.
You receive a list of the user's existing skills and a list of "Missing Skills" (gaps) detected by a strict keyword matcher.
Sometimes the strict matcher makes mistakes by flagging a broad category as a gap when the user already knows a specific subset of it (e.g. flagging "AI" as a gap when the user knows "Machine Learning" and "Deep Learning" or flagging "Frontend" when they know "React").

Your job:
1. Review each gap in the context of the user's existing skills.
2. If the user's existing skills conceptually cover the gap (or a large portion of it), mark action as "remove" (meaning it's a false positive gap and they actually have the skill).
3. If it is a true gap, mark action as "keep" and provide a 1-sentence "reasoning" on why it matters.

Return ONLY valid JSON.
Schema:
[
  {
    "skill": "<gap-skill-name>",
    "action": "keep" | "remove",
    "reasoning": "<1 sentence why it matters OR why it is covered by existing skills>"
  }
]
"""

EVAL_USER_TMPL = """Target Role: {target_role}

User's Existing Skills:
{user_skills_list}

Detected Gaps to evaluate:
{gaps_json}

Return the evaluated JSON array:"""


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
        synonym_map: Optional[Dict] = None,   # kept for backward-compat and to avoid TypeError
    ) -> Dict:
        """
        Run SmartGapAnalyzer then optionally enrich gaps with Groq reasoning.
        Always returns the standard SmartGapAnalyzer dict format.
        """
        # 1. Authoritative gap detection (pure Python, always works)
        result = self._smart.analyze_gaps(user_skills, market_requirements)

        # 2. Optional: contextual evaluation with Groq
        if self.available:
            try:
                result = self._contextualize_gaps(result, user_skills, target_role)
            except Exception:
                # Silently fallback to base result
                pass

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

    # ── Groq Contextual Gap Evaluation ─────────────────────────────────────────
    def _contextualize_gaps(self, result: Dict, user_skills: Dict, target_role: str) -> Dict:
        all_gaps = (
            result["critical_gaps"] +
            result["important_gaps"] +
            result["emerging_gaps"]
        )
        if not all_gaps:
            return result

        # Limit to top GROQ_MAX_GAPS by demand to keep the prompt small & fast
        top_gaps = sorted(all_gaps, key=lambda g: g["demand"], reverse=True)[:GROQ_MAX_GAPS]

        # Send only the minimal gap info to Groq
        slim_gaps = [
            {
                "skill":             g["skill"],
                "demand":            g["demand"],
            }
            for g in top_gaps
        ]
        
        user_skills_list = list(user_skills.keys())

        # Define the API call as a separate function for the thread executor
        def _fetch_from_groq():
            return self.client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": EVAL_SYSTEM},
                    {"role": "user",   "content": EVAL_USER_TMPL.format(
                        target_role=target_role,
                        user_skills_list=", ".join(user_skills_list),
                        gaps_json=json.dumps(slim_gaps, indent=2)
                    )},
                ],
                temperature=0.0,
                max_tokens=600,
                response_format={"type": "json_object"},
                timeout=GROQ_TIMEOUT,
            )

        # Wrap in a thread pool with a hard timeout to prevent hangs
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            future = executor.submit(_fetch_from_groq)
            # Hard 10s wait for LLM enrichment (non-blocking if it fails)
            response = future.result(timeout=10)
        except Exception:
            # If it hangs or fails, we fail gracefully and return base results
            executor.shutdown(wait=False, cancel_futures=True)
            return result
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        content = response.choices[0].message.content
        evaluated_list = self._parse_enriched(content)
        if not evaluated_list:
            return result

        # Actions map: skill -> {"action": "keep"|"remove", "reasoning": "..."}
        eval_map: Dict[str, Dict] = {
            item["skill"]: {
                "action": item.get("action", "keep").lower(),
                "reasoning": item.get("reasoning", "")
            }
            for item in evaluated_list
            if isinstance(item, dict) and "skill" in item
        }

        # Filter gaps and promote false positives to strengths
        def process_gap_list(gaps_list: List[Dict]) -> List[Dict]:
            kept = []
            for g in gaps_list:
                evaluation = eval_map.get(g["skill"])
                if evaluation:
                    if evaluation["action"] == "remove":
                        # False positive gap -> promote to strength!
                        g["match_type"] = "contextual_llm"
                        g["matched_via"] = ["LLM semantic deduction"]
                        g["user_proficiency"] = g.get("demand", 0.5) # assume they meet it if LLM removed it
                        g["reasoning"] = evaluation["reasoning"]
                        # Remove effective_gap from strengths to keep schema clean
                        g.pop("effective_gap", None)
                        result["strengths"].append(g)
                    else:
                        g["reasoning"] = evaluation["reasoning"]
                        kept.append(g)
                else:
                    kept.append(g)
            return kept

        result["critical_gaps"]  = process_gap_list(result["critical_gaps"])
        result["important_gaps"] = process_gap_list(result["important_gaps"])
        result["emerging_gaps"]  = process_gap_list(result["emerging_gaps"])
        
        # Sort strengths since we appended to it
        result["strengths"].sort(key=lambda x: x.get("demand", 0), reverse=True)
        
        # Update summary counts manually since we moved items around
        result["summary"]["critical_gap_count"] = len(result["critical_gaps"])
        result["summary"]["important_gap_count"] = len(result["important_gaps"])
        result["summary"]["emerging_gap_count"] = len(result["emerging_gaps"])
        result["summary"]["strength_count"] = len(result["strengths"])
        result["summary"]["total_gaps"] = (
            len(result["critical_gaps"]) + 
            len(result["important_gaps"]) + 
            len(result["emerging_gaps"])
        )
        
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
