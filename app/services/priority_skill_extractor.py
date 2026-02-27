import re
import json
import os
import pdfplumber
import nltk
from rapidfuzz import fuzz
from typing import List, Dict, Set, Any, Optional

# Download nltk data
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt")

class PrioritySkillExtractor:
    """
    Priority-based skill extractor following the user's specified logic.
    Uses section weighting and fuzzy matching via rapidfuzz.
    """

    GENERIC_PHRASE_SKILLS = {
        "solid principles",
        "clean code",
        "system design",
        "software architecture"
    }

    OS_SKILLS = {
        "linux", "windows", "macos"
    }

    SHORT_SKILLS = {
        "r", "c", "go", "sre"
    }

    SECTION_WEIGHTS = {
        "skills": 1.0,
        "experience": 0.8,
        "projects": 0.6,
        "certifications": 0.6,
        "other": 0.4
    }

    def __init__(self, skills_json_path: str):
        self.skills_json_path = skills_json_path
        self.skills_lookup = self._prepare_lookup()

    def _prepare_lookup(self) -> Dict[str, Set[str]]:
        """Load skills and build variant variants lookup."""
        if not os.path.exists(self.skills_json_path):
            return {}
        
        with open(self.skills_json_path, 'r', encoding='utf-8') as f:
            skills_data = json.load(f)
            
        lookup = {}
        # New format has "skills" list and "synonyms" dict
        if "skills" in skills_data and "synonyms" in skills_data:
            # First add all canonical skills
            for skill in skills_data["skills"]:
                lookup[skill.lower()] = {skill.lower()}
            
            # Then add synonyms for each canonical skill
            for variant, canonical in skills_data["synonyms"].items():
                v_lower = variant.lower()
                c_lower = canonical.lower()
                if c_lower in lookup:
                    lookup[c_lower].add(v_lower)
                else:
                    lookup[c_lower] = {c_lower, v_lower}
        else:
            # Fallback for old format
            for skill, data in skills_data.items():
                variants = {skill.lower()}
                if isinstance(data, dict):
                    variants |= set(map(str.lower, data.get("abbr", [])))
                    variants |= set(map(str.lower, data.get("aliases", [])))
                lookup[skill.lower()] = variants
        return lookup

    def extract_resume_text(self, pdf_path: str) -> str:
        """Extract text from PDF using pdfplumber."""
        text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
            return ""
        return text.lower()

    def normalize(self, text: str) -> str:
        """Text normalization following user's script."""
        text = re.sub(r"[-_/]", " ", text)
        text = re.sub(r"\([^)]*\)", "", text)
        text = re.sub(r"[^a-z\s\.]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def split_sections(self, text: str) -> Dict[str, str]:
        """Section splitting following user's script."""
        sections = {
            "skills": "",
            "experience": "",
            "projects": "",
            "certifications": "",
            "other": ""
        }

        text_lower = text.lower()

        skills_split = re.split(r"\bskills\b|\btechnical skills\b", text_lower)
        if len(skills_split) > 1:
            sections["skills"] = skills_split[1]

        exp_split = re.split(r"\bexperience\b|\bwork experience\b", text_lower)
        if len(exp_split) > 1:
            sections["experience"] = exp_split[1]

        proj_split = re.split(r"\bprojects\b", text_lower)
        if len(proj_split) > 1:
            sections["projects"] = proj_split[1]

        cert_split = re.split(r"\bcertifications\b|\bcertificate\b", text_lower)
        if len(cert_split) > 1:
            sections["certifications"] = cert_split[1]

        sections["other"] = text_lower

        return sections

    def exact_word(self, skill: str, text: str) -> bool:
        """Check for exact word match in text."""
        return re.search(rf"\b{re.escape(skill)}\b", text) is not None

    def skill_matches(self, skill: str, variants: Set[str], text: str) -> bool:
        """Fuzzy and exact matching logic from user's script."""
        text = text.lower()

        if skill in self.SHORT_SKILLS:
            return self.exact_word(skill, text)

        if skill in self.GENERIC_PHRASE_SKILLS:
            return self.exact_word(skill, text)

        if skill in self.OS_SKILLS:
            return self.exact_word(skill, text)

        for v in variants:
            if self.exact_word(v, text):
                return True

            if len(v.replace(" ", "")) >= 5:
                if fuzz.partial_ratio(v, text) > 90:
                    return True

        return False

    def extract_skills(self, resume_text: str) -> List[Dict[str, Any]]:
        """Main extraction logic with prioritization."""
        sections = self.split_sections(resume_text)
        results = {}

        for section_name, section_text in sections.items():
            clean_section = self.normalize(section_text)
            lines = [l.strip() for l in clean_section.split("\n") if l.strip()]

            for line in lines:
                for skill, variants in self.skills_lookup.items():
                    if skill in results and results[skill]["priority"] == 1.0:
                        continue

                    if self.skill_matches(skill, variants, line):
                        weight = self.SECTION_WEIGHTS.get(section_name, 0.4)

                        if skill in results:
                            results[skill]["priority"] = max(
                                results[skill]["priority"], weight
                            )
                        else:
                            results[skill] = {
                                "skill": skill,
                                "confidence": 0.95,
                                "priority": weight,
                                "evidence": line
                            }

        sorted_results = sorted(
            results.values(),
            key=lambda x: x["priority"],
            reverse=True
        )

        return sorted_results
