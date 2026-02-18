import re
import json
import os
import pdfplumber
import nltk
from rapidfuzz import fuzz
from typing import List, Dict, Set, Any

# Download punkt if not already present
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

class PrioritySkillExtractor:
    """
    Extracts skills from resumes using a priority-based approach with section weighting
    and fuzzy matching.
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
        self.skills_data = self._load_skills()
        self.skills_lookup = self._build_variants()

    def _load_skills(self) -> Dict[str, Any]:
        """Load skills from JSON file."""
        if not os.path.exists(self.skills_json_path):
            raise FileNotFoundError(f"Skills file not found at {self.skills_json_path}")
        
        with open(self.skills_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Handle different JSON structures. The user's script expects a dict of skills.
            # Our existing skills.json might have a different structure (e.g. valid skills list).
            # We need to adapt based on the actual content of skills.json.
            # Looking at previous file views, skills.json has keys like 'skills', 'synonyms', etc.
            # Use 'skills' list as base and 'synonyms' for variants.
            
            normalized_skills = {}
            if 'skills' in data and isinstance(data['skills'], list):
                # Format: {"skills": ["Python", ...], "synonyms": {"ml": "machine-learning", ...}}
                skills_list = data['skills']
                synonyms = data.get('synonyms', {})
                
                # Initialize all skills
                for skill in skills_list:
                    normalized_skills[skill] = {
                        "abbr": [],
                        "aliases": []
                    }
                
                # Populate aliases from reverse mapping
                for variant, canonical in synonyms.items():
                    # Handle case where canonical might be in list but maybe case difference or missing
                    # Check exact match first
                    if canonical in normalized_skills:
                        normalized_skills[canonical]["aliases"].append(variant)
                    else:
                        # Check lower case match
                        found = False
                        for s in normalized_skills:
                            if s.lower() == canonical.lower():
                                normalized_skills[s]["aliases"].append(variant)
                                found = True
                                break
                        if not found:
                            # Use canonical as key if valid skill not found in list?
                            # Or just ignore? Best to ignore if not in main list to avoid noise
                            pass
            else:
                # Assume it matches the user's expected format directly
                normalized_skills = data
                
            return normalized_skills

    def _build_variants(self) -> Dict[str, Set[str]]:
        """Build a lookup table for skill variants."""
        lookup = {}
        for skill, data in self.skills_data.items():
            variants = set([skill.lower()])
            if isinstance(data, dict):
                variants |= set(map(str.lower, data.get("abbr", [])))
                variants |= set(map(str.lower, data.get("aliases", [])))
            lookup[skill.lower()] = variants
        return lookup

    def extract_resume_text(self, pdf_path: str) -> str:
        """Extract text from a PDF file."""
        text = ""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"Error extracting text with pdfplumber: {e}")
            return ""
        return text.lower()

    def normalize(self, text: str) -> str:
        """Normalize text by removing special characters and extra spaces."""
        text = re.sub(r"[-_/]", " ", text)
        text = re.sub(r"\([^)]*\)", "", text)
        text = re.sub(r"[^a-z\s\.]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def split_sections(self, text: str) -> Dict[str, str]:
        """Split resume text into sections."""
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
        """Check for exact word match."""
        return re.search(rf"\b{re.escape(skill)}\b", text) is not None

    def skill_matches(self, skill: str, variants: Set[str], text: str) -> bool:
        """Check if a skill matches the text using exact or fuzzy matching."""
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
        """
        Extract skills from resume text.
        
        Returns:
            List of dicts containing skill details (skill, priority, evidence, confidence).
        """
        sections = self.split_sections(resume_text)
        results = {}

        for section_name, section_text in sections.items():
            clean_section = self.normalize(section_text)
            lines = [l.strip() for l in clean_section.split("\n") if l.strip()]

            for line in lines:
                for skill, variants in self.skills_lookup.items():
                    # Skip if already found with highest priority
                    if skill in results and results[skill]["priority"] == 1.0:
                        continue

                    if self.skill_matches(skill, variants, line):
                        weight = self.SECTION_WEIGHTS.get(section_name, 0.4)

                        if skill in results:
                            results[skill]["priority"] = max(
                                results[skill]["priority"], weight
                            )
                        else:
                            # Capitalize skill name for display
                            display_name = skill.title()
                            # Correction for specific capitalizations could be added here
                            
                            results[skill] = {
                                "skill": display_name,
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
