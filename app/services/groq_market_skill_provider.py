"""
GroqMarketSkillProvider — Single, authoritative market skill source.

Design
------
Instead of scraping web pages (Tavily) and then cleaning the noise with
a second LLM call, we ask the LLM directly to generate a curated,
role-specific skill set in one structured call.

Why Groq LLM as the sole source?
  • LLM training data captures years of job posting patterns — it intrinsically
    knows what skills are required, important, or emerging for any given role.
  • One structured JSON call replaces 2 Tavily HTTP calls + 1 validation call.
  • LLM output is already normalised and clean — no regex scraping, no noise.
  • Works for ANY role title, not just ones in a static JSON file.

Cache
-----
Results are cached to disk in app/data/skills_cache/ with a 7-day TTL.
  • First request for a role  → Groq call (~2-4 s) → saved to cache
  • Subsequent requests       → disk read, instant
  • Cache key = slugified role title (e.g. "frontend_developer.json")

Fallback
--------
If Groq is unavailable (no API key or timeout), falls back to
role_requirements.json with a role-name best-match lookup.
"""

from __future__ import annotations

import json
import os
import re
import concurrent.futures
from datetime import datetime
from typing import Dict, Optional

try:
    from groq import Groq
    _GROQ_AVAILABLE = True
except ImportError:
    _GROQ_AVAILABLE = False

# ── Constants ─────────────────────────────────────────────────────────────────
GROQ_MODEL   = "llama-3.3-70b-versatile"
GROQ_TIMEOUT = 30          # seconds — Groq is fast, 30 s is generous
CACHE_TTL_DAYS = 7         # how long cached skill sets stay valid
MAX_SKILLS   = 30          # cap on skills returned per role

_CACHE_DIR       = os.path.join("app", "data", "skills_cache")
_FALLBACK_FILE   = os.path.join("app", "data", "role_requirements.json")

# ── Prompt ────────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """\
You are a senior technical recruiter and career adviser with deep knowledge of
the global tech job market in 2025-2026.

Your task is to return the definitive list of skills required for a given job role.

Rules:
1. Include ONLY technical skills (tools, languages, frameworks, platforms).
   Do NOT include generic soft skills like "communication", "teamwork", etc.
2. Return up to 30 essential technical skills — provide a comprehensive yet focused list.
3. Classify each skill:
   - "critical"  : A fundamental must-have; most job postings require it.
   - "important" : Strongly preferred; many postings mention it.
   - "emerging"  : Gaining traction; future-relevant and trending in 2025-2026.
4. Set "frequency" (0.0–1.0) = fraction of real job postings that mention this
   skill. Typical ranges: critical ≥ 0.70, important 0.40–0.69, emerging < 0.40.
5. Set "trending": true for skills that are gaining significant traction in
   2025-2026 job postings (e.g. GenAI, Rust, Kafka, LangChain).
6. Use canonical, lowercase skill names (e.g. "python", "react", "kubernetes").
7. ONLY include significant skills with a frequency ≥ 0.10.

Return ONLY valid JSON — no prose, no markdown, no code fences.

Schema:
{
  "<skill_name>": {
    "frequency": <float 0.0-1.0>,
    "requirement_level": "critical" | "important" | "emerging",
    "trending": <bool>
  },
  ...
}
"""

_USER_TMPL = "List the required skills for a {role} in 2025-2026."


# ── Fallback role-name matcher ────────────────────────────────────────────────
_FALLBACK_MAPPINGS = {
    "ai/ml": "ai_ml_engineer", "ai ml": "ai_ml_engineer",
    "ai engineer": "ai_ml_engineer", "ml engineer": "ai_ml_engineer",
    "machine learning engineer": "ai_ml_engineer",
    "machine learning": "machine_learning_engineer",
    "frontend": "frontend_developer", "front-end": "frontend_developer",
    "front end": "frontend_developer",
    "backend": "backend_developer", "back-end": "backend_developer",
    "back end": "backend_developer",
    "full stack": "fullstack_developer", "fullstack": "fullstack_developer",
    "full-stack": "fullstack_developer",
    "data science": "data_science_analyst", "data scientist": "data_science_analyst",
    "data analyst": "data_science_analyst",
    "data engineer": "data_engineer", "data engineering": "data_engineer",
    "devops": "devops_engineer", "dev ops": "devops_engineer",
    "site reliability": "devops_engineer", "sre": "devops_engineer",
    "software engineer": "software_engineer",
    "software developer": "software_engineer",
    "mobile": "mobile_developer", "android": "mobile_developer",
    "ios": "mobile_developer",
}


class GroqMarketSkillProvider:
    """
    Single authoritative source for market skill requirements.

    Usage
    -----
    provider = GroqMarketSkillProvider(groq_api_key)
    skills = provider.get_skills("Frontend Developer")
    # → {"react": {"frequency": 0.92, "requirement_level": "critical", "trending": False}, ...}
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GROQ_API_KEY", "")
        self.client: Optional[object] = None
        self.available = False

        os.makedirs(_CACHE_DIR, exist_ok=True)

        if _GROQ_AVAILABLE and self.api_key:
            try:
                self.client = Groq(api_key=self.api_key)
                self.available = True
                print("✅ GroqMarketSkillProvider: Groq LLM ready")
            except Exception as e:
                print(f"⚠️  GroqMarketSkillProvider: Groq init failed — {e}")
        else:
            print("⚠️  GroqMarketSkillProvider: No Groq key, will use fallback data")

    # ── Public API ─────────────────────────────────────────────────────────────
    def get_skills(
        self,
        role_title: str,
        force_refresh: bool = False,
    ) -> Dict[str, Dict]:
        """
        Return market skill requirements for *role_title*.

        Returns a dict keyed by skill name:
            {
              "python": {"frequency": 0.9, "requirement_level": "critical", "trending": False},
              ...
            }

        Sources tried in order:
          1. Disk cache                (if < CACHE_TTL_DAYS days old and not force_refresh)
          2. Groq LLM                  (if available)
          3. role_requirements.json    (always available fallback)
        """
        cache_path = self._cache_path(role_title)

        # 1. Cache check
        if not force_refresh:
            cached = self._load_cache(cache_path)
            if cached is not None:
                return cached

        # 2. Groq LLM
        if self.available:
            result = self._call_groq(role_title)
            if result:
                self._save_cache(cache_path, role_title, result, source="groq_llm")
                print(f"   ✅ Groq returned {len(result)} skills for '{role_title}'")
                return result
            print("   ⚠️  Groq returned empty/invalid — falling back to static data")

        # 3. Static fallback
        result = self._load_fallback(role_title)
        print(f"   📚 Using static fallback ({len(result)} skills) for '{role_title}'")
        return result

    def is_available(self) -> bool:
        return self.available

    # ── Cache helpers ──────────────────────────────────────────────────────────
    def _cache_path(self, role_title: str) -> str:
        slug = re.sub(r"[^\w]+", "_", role_title.lower().strip()).strip("_")
        return os.path.join(_CACHE_DIR, f"{slug}.json")

    def _load_cache(self, path: str) -> Optional[Dict]:
        if not os.path.exists(path):
            return None
        age_s = datetime.now().timestamp() - os.path.getmtime(path)
        if age_s > CACHE_TTL_DAYS * 86400:
            return None
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            skills = data.get("skills", {})
            if skills:
                remaining = int(CACHE_TTL_DAYS - age_s / 86400)
                print(f"   📦 Cache hit — {len(skills)} skills for '{data.get('role')}' "
                      f"(valid {remaining}d more, source: {data.get('source', '?')})")
                return skills
        except Exception as e:
            print(f"   ⚠️  Cache read error: {e}")
        return None

    def _save_cache(self, path: str, role: str, skills: Dict, source: str) -> None:
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({
                    "role": role,
                    "skills": skills,
                    "source": source,
                    "cached_at": datetime.now().isoformat(),
                    "expires_days": CACHE_TTL_DAYS,
                }, f, indent=2)
        except Exception as e:
            print(f"   ⚠️  Cache write error: {e}")

    # ── Groq call ──────────────────────────────────────────────────────────────
    def _call_groq(self, role_title: str) -> Optional[Dict]:
        """
        Ask Groq LLM for the skill set of *role_title*.
        Returns parsed skills dict or None on error.
        
        Uses a hard threaded timeout to prevent application hangs if the API stalls.
        """
        print(f"   🤖 Asking Groq for '{role_title}' skills…")
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    self.client.chat.completions.create, # type: ignore[union-attr]
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user",   "content": _USER_TMPL.format(role=role_title)},
                    ],
                    temperature=0.1,
                    max_tokens=1800,
                    response_format={"type": "json_object"}
                )
                
                # Hard 15s timeout for Market Skill generation
                response = future.result(timeout=15)
                
        except concurrent.futures.TimeoutError:
            print(f"   ❌ Groq timeout after 15s — falling back")
            return None
        except Exception as e:
            print(f"   ❌ Groq call failed: {e}")
            return None

        content = response.choices[0].message.content
        return self._parse_response(content)

    def _parse_response(self, content: str) -> Optional[Dict]:
        """
        Parse the Groq JSON response into a validated skills dict.

        Groq occasionally wraps the skills inside a top-level key like
        {"skills": {...}} or {"required_skills": {...}}.  We handle both.
        """
        try:
            parsed = json.loads(content)
        except Exception as e:
            print(f"   ⚠️  JSON parse error: {e}")
            return None

        # If the top level IS the skill dict (each value has 'frequency')
        if self._looks_like_skill_dict(parsed):
            return self._validate_skills(parsed)

        # Handle common wrapper keys
        for wrapper_key in ("skills", "required_skills", "skill_requirements",
                            "technical_skills", "data"):
            if wrapper_key in parsed and isinstance(parsed[wrapper_key], dict):
                candidates = parsed[wrapper_key]
                if self._looks_like_skill_dict(candidates):
                    return self._validate_skills(candidates)

        # Last resort: find the first dict value that looks like a skill dict
        for v in parsed.values():
            if isinstance(v, dict) and self._looks_like_skill_dict(v):
                return self._validate_skills(v)

        print("   ⚠️  Could not find skill dict in Groq response")
        return None

    @staticmethod
    def _looks_like_skill_dict(d: dict) -> bool:
        """Heuristic: does this dict map skill_name → {frequency, ...}?"""
        if not d:
            return False
        sample = next(iter(d.values()))
        return isinstance(sample, dict) and "frequency" in sample

    @staticmethod
    def _validate_skills(raw: dict) -> Dict:
        """
        Validate + normalise skills from the LLM response.
        Drops skills with invalid schema; caps at MAX_SKILLS by frequency.
        """
        clean: Dict[str, Dict] = {}
        valid_levels = {"critical", "important", "emerging"}

        for skill, data in raw.items():
            if not isinstance(data, dict):
                continue
            freq = data.get("frequency")
            level = data.get("requirement_level", "important")
            if not isinstance(freq, (int, float)) or not (0.0 <= freq <= 1.0):
                continue
            
            # Filter out low-demand skills (< 10%)
            if freq < 0.10:
                continue

            if level not in valid_levels:
                level = "important"
            clean[skill.lower().strip()] = {
                "frequency": round(float(freq), 2),
                "requirement_level": level,
                "trending": bool(data.get("trending", False)),
                "llm_validated": True,
            }

        # Keep top MAX_SKILLS by frequency
        if len(clean) > MAX_SKILLS:
            clean = dict(
                sorted(clean.items(), key=lambda x: x[1]["frequency"], reverse=True)
                [:MAX_SKILLS]
            )

        return clean

    # ── Static fallback ────────────────────────────────────────────────────────
    def _load_fallback(self, role_title: str) -> Dict:
        try:
            with open(_FALLBACK_FILE, encoding="utf-8") as f:
                roles_data = json.load(f)
        except Exception as e:
            print(f"   ⚠️  Could not load fallback JSON: {e}")
            return {}

        role_lower = role_title.lower()
        matched_id = None

        # Try exact key match first
        for rid in roles_data:
            if rid == role_lower or roles_data[rid].get("title", "").lower() == role_lower:
                matched_id = rid
                break

        # Try keyword mapping
        if not matched_id:
            for keyword, rid in _FALLBACK_MAPPINGS.items():
                if keyword in role_lower and rid in roles_data:
                    matched_id = rid
                    break

        # Last resort: first available role
        if not matched_id and roles_data:
            matched_id = next(iter(roles_data))

        if matched_id:
            return roles_data[matched_id].get("skills", {})
        return {}

    # ── Cache management (called from API endpoints) ───────────────────────────
    def clear_cache(self, role_title: Optional[str] = None) -> None:
        """Clear cached skill data for one role or all roles."""
        if role_title:
            path = self._cache_path(role_title)
            if os.path.exists(path):
                os.remove(path)
                print(f"🗑️  Cleared cache for: {role_title}")
        else:
            import glob
            for p in glob.glob(os.path.join(_CACHE_DIR, "*.json")):
                os.remove(p)
            print("🗑️  Cleared all skills cache")
