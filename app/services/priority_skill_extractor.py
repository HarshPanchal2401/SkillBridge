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

    # Skills that are common English words — require exact word boundary match only
    # These NEVER go through fuzzy matching to avoid false positives
    EXACT_MATCH_ONLY = {
        "scala", "teams", "lead", "data", "spark", "flask",
        "spring", "dart", "swift", "rust", "ruby", "perl",
        "latex", "sass", "less", "make", "helm", "chef",
        "puppet", "salt", "consul", "vault", "mesh",
    }

    # Layer 1: Section-based weights (additive across sections)
    # Skills > Experience = Projects > Certifications > About
    SECTION_WEIGHTS = {
        "about": 0.10,
        "skills": 0.45,
        "experience": 0.30,
        "projects": 0.30,
        "certifications": 0.15,
    }

    # Layer 2: Contextual meaning boosters
    # Each entry: (regex_pattern_template, boost_value)
    # {skill} placeholder will be replaced with the actual skill name
    CONTEXT_BOOSTERS = [
        # Expertise indicators (+0.10)
        (r"expert\s+in\s+{skill}", 0.10),
        (r"expertise\s+in\s+{skill}", 0.10),
        (r"led\s+{skill}", 0.10),
        (r"architected\s+.*{skill}", 0.10),
        # Proficiency indicators (+0.08)
        (r"proficient\s+in\s+{skill}", 0.08),
        (r"advanced\s+{skill}", 0.08),
        (r"certified\s+{skill}", 0.08),
        (r"{skill}\s+certified", 0.08),
        # Competence indicators (+0.05)
        (r"strong\s+{skill}", 0.05),
        (r"skilled\s+in\s+{skill}", 0.05),
        (r"experienced\s+(in|with)\s+{skill}", 0.05),
    ]

    # Layer 4: Action verbs that indicate hands-on experience
    ACTION_VERBS = [
        'developed', 'built', 'created', 'designed', 'implemented', 'architected',
        'optimized', 'improved', 'enhanced', 'maintained', 'deployed', 'automated',
        'integrated', 'migrated', 'scaled', 'refactored', 'configured', 'engineered',
        'managed', 'leveraged', 'utilized', 'established', 'contributed',
    ]

    # Layer 5: Years of experience patterns
    YEARS_PATTERNS = [
        r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience\s+(?:with|in|using))?\s*{skill}',
        r'{skill}\s*[\(\-–]\s*(\d+)\+?\s*(?:years?|yrs?)',
        r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?{skill}',
        r'(\d+)\s*[-–]\s*\d+\s*(?:years?|yrs?)(?:\s+of)?\s*{skill}',
    ]

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
        """Extract text from PDF using pdfplumber, with whitespace normalization."""
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
        # Normalize: collapse excessive whitespace but keep newlines as single spaces
        # This fixes PDF artifacts like "deep\n              learning" -> "deep learning"
        text = re.sub(r'[ \t]+', ' ', text)          # collapse tabs/spaces
        text = re.sub(r'\n\s*', '\n', text)           # remove leading spaces after newlines
        text = re.sub(r'\n+', '\n', text)             # collapse multiple newlines
        return text.lower().strip()

    def normalize(self, text: str) -> str:
        """Text normalization following user's script."""
        text = re.sub(r"[-_/]", " ", text)
        text = re.sub(r"\([^)]*\)", "", text)
        text = re.sub(r"[^a-z\s\.]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def split_sections(self, text: str) -> Dict[str, str]:
        """
        Split resume text into bounded sections.
        Each section gets ONLY the text between its header and the next section header.
        """
        text_lower = text.lower()

        # Ordered section headers (regex pattern, section name)
        # Headers must be at the START of a line to avoid matching mid-sentence words
        section_headers = [
            (r'(?:^|\n)\s*(?:about\s*me|summary|objective|profile)\s*\n', 'about'),
            (r'(?:^|\n)\s*(?:technical\s+skills|skills)\s*\n', 'skills'),
            (r'(?:^|\n)\s*(?:work\s+experience|experience/?internship|experience|internship)\s*\n', 'experience'),
            (r'(?:^|\n)\s*(?:projects|academic\s+projects|personal\s+projects)\s*\n', 'projects'),
            (r'(?:^|\n)\s*(?:education)\s*\n', 'education'),
            (r'(?:^|\n)\s*(?:certifications?|certificates?)\s*\n', 'certifications'),
        ]

        # Find all section header positions
        found_sections = []
        for pattern, section_name in section_headers:
            for match in re.finditer(pattern, text_lower):
                found_sections.append((match.start(), match.end(), section_name))

        # Sort by position in the text
        found_sections.sort(key=lambda x: x[0])

        # Remove duplicate section names (keep first occurrence)
        seen = set()
        unique_sections = []
        for start, end, name in found_sections:
            if name not in seen:
                seen.add(name)
                unique_sections.append((start, end, name))

        # Extract text between each section header and the next
        sections = {
            "about": "",
            "skills": "",
            "experience": "",
            "projects": "",
            "certifications": "",
        }

        for i, (start, end, name) in enumerate(unique_sections):
            if name not in sections:
                continue
            # Content starts after the header
            content_start = end
            # Content ends at the start of the next section (or end of text)
            if i + 1 < len(unique_sections):
                content_end = unique_sections[i + 1][0]
            else:
                content_end = len(text_lower)
            sections[name] = text_lower[content_start:content_end].strip()

        return sections

    def exact_word(self, skill: str, text: str) -> bool:
        """Check for exact word match in text."""
        return re.search(rf"\b{re.escape(skill)}\b", text) is not None

    def skill_matches(self, skill: str, variants: Set[str], text: str) -> bool:
        """Fuzzy and exact matching logic with false-positive protection."""
        text = text.lower()

        # Exact-match-only skills: short, OS, generic phrases, or common-word skills
        if skill in self.SHORT_SKILLS or skill in self.OS_SKILLS or skill in self.GENERIC_PHRASE_SKILLS or skill in self.EXACT_MATCH_ONLY:
            for v in (variants | {skill}):
                if self.exact_word(v, text):
                    return True
            return False

        for v in variants:
            if self.exact_word(v, text):
                return True

            # Fuzzy matching with word-boundary validation
            if len(v.replace(" ", "")) >= 5:
                score = fuzz.partial_ratio(v, text)
                if score > 90:
                    # Validate: find where the fuzzy match lands and check word boundaries
                    if self._validate_fuzzy_match(v, text):
                        return True

        return False

    def _validate_fuzzy_match(self, skill: str, text: str) -> bool:
        """Ensure fuzzy match lands on a word boundary, not inside a longer word."""
        # Find the best match position in text
        skill_len = len(skill)
        best_pos = -1
        best_score = 0
        for i in range(len(text) - skill_len + 1):
            window = text[i:i + skill_len]
            score = fuzz.ratio(skill, window)
            if score > best_score:
                best_score = score
                best_pos = i

        if best_pos < 0 or best_score < 85:
            return False

        # Check word boundaries at match position
        start = best_pos
        end = best_pos + skill_len
        left_ok = (start == 0 or not text[start - 1].isalnum())
        right_ok = (end >= len(text) or not text[end].isalnum())
        return left_ok and right_ok

    def _check_context_boost(self, skill: str, text: str) -> float:
        """
        Layer 2: Check for contextual meaning patterns near the skill.
        Returns the highest applicable boost value.
        """
        text_lower = text.lower()
        best_boost = 0.0

        for pattern_template, boost in self.CONTEXT_BOOSTERS:
            # Build regex with the skill name inserted
            try:
                pattern = pattern_template.format(skill=re.escape(skill))
                if re.search(pattern, text_lower):
                    best_boost = max(best_boost, boost)
            except Exception:
                continue

        return best_boost

    def _count_occurrences(self, skill: str, variants: Set[str], full_text: str) -> int:
        """Layer 3: Count total occurrences of skill (and variants) in full text."""
        count = 0
        text_lower = full_text.lower()
        for v in variants | {skill}:
            count += len(re.findall(rf"\b{re.escape(v)}\b", text_lower))
        return count

    def _count_action_verbs(self, skill: str, full_text: str) -> int:
        """Layer 4: Count unique action verbs near skill mentions."""
        text_lower = full_text.lower()
        found_verbs = set()
        # Find all positions of the skill
        for match in re.finditer(rf"\b{re.escape(skill)}\b", text_lower):
            # Look at 120-char window around each mention
            start = max(0, match.start() - 120)
            end = min(len(text_lower), match.end() + 120)
            window = text_lower[start:end]
            for verb in self.ACTION_VERBS:
                if verb in window:
                    found_verbs.add(verb)
        return len(found_verbs)

    def _extract_years(self, skill: str, full_text: str) -> float:
        """Layer 5: Extract years of experience for a skill."""
        text_lower = full_text.lower()
        max_years = 0.0
        for pattern_template in self.YEARS_PATTERNS:
            try:
                pattern = pattern_template.format(skill=re.escape(skill))
                match = re.search(pattern, text_lower)
                if match:
                    years = float(match.group(1))
                    max_years = max(max_years, min(years, 20))
            except Exception:
                continue
        return max_years

    def extract_skills(self, resume_text: str) -> List[Dict[str, Any]]:
        """
        Main extraction logic with multi-layer weight accumulation.
        
        Layer 1: Section weights accumulate across sections.
        Layer 2: Contextual meaning boosters add extra weight.
        Layer 3: Occurrence count boost (mentions across full text).
        Layer 4: Action verb context boost (hands-on experience signals).
        Layer 5: Years of experience extraction.
        Layer 6: Multi-section diversity bonus.
        
        Returns list of dicts with:
            - skill: canonical skill name
            - proficiency: accumulated weight (0.0-1.0)
            - confidence: extraction confidence
            - found_in: list of sections where skill was found
            - context_boost: extra boost from contextual phrases
            - evidence: first matching line
        """
        sections = self.split_sections(resume_text)
        results = {}
        full_text = resume_text.lower()

        for section_name, section_text in sections.items():
            if not section_text.strip():
                continue

            clean_section = self.normalize(section_text)
            lines = [l.strip() for l in clean_section.split("\n") if l.strip()]

            # For Skills section: also split comma/pipe/semicolon separated items
            # e.g. "python, sql, numpy, pandas" -> individual tokens for matching
            if section_name == "skills":
                expanded_lines = []
                for line in lines:
                    expanded_lines.append(line)  # keep the full line
                    # Also add individual comma-separated tokens
                    tokens = re.split(r'[,;|]+', line)
                    for token in tokens:
                        t = token.strip()
                        if t and len(t) > 1:
                            expanded_lines.append(t)
                lines = expanded_lines

            for line in lines:
                for skill, variants in self.skills_lookup.items():
                    # Skip if already found in this section
                    if skill in results and section_name in results[skill]["found_in"]:
                        continue

                    if self.skill_matches(skill, variants, line):
                        weight = self.SECTION_WEIGHTS.get(section_name, 0.0)

                        if skill in results:
                            # Accumulate weight from new section
                            results[skill]["proficiency"] = min(
                                results[skill]["proficiency"] + weight, 1.0
                            )
                            results[skill]["found_in"].append(section_name)
                        else:
                            # First time seeing this skill
                            results[skill] = {
                                "skill": skill,
                                "proficiency": weight,
                                "confidence": 0.85 + (0.05 if section_name == "skills" else 0.0),
                                "found_in": [section_name],
                                "context_boost": 0.0,
                                "evidence": line
                            }

                        # Layer 2: Check contextual meaning boost from this line
                        line_boost = self._check_context_boost(skill, line)
                        if line_boost > results[skill]["context_boost"]:
                            results[skill]["context_boost"] = line_boost

        # Apply all scoring layers to final proficiency
        for skill, skill_data in results.items():
            variants = self.skills_lookup.get(skill, set())
            base = skill_data["proficiency"]

            # Layer 2: Context boost
            context_boost = skill_data["context_boost"]

            # Layer 3: Occurrence count boost — more mentions = higher weight
            occurrence_count = self._count_occurrences(skill, variants, full_text)
            occurrence_boost = min(occurrence_count * 0.03, 0.15)

            # Layer 4: Action verb boost — hands-on experience signals
            verb_count = self._count_action_verbs(skill, full_text)
            action_boost = min(verb_count * 0.02, 0.10)

            # Layer 5: Years of experience boost
            years = self._extract_years(skill, full_text)
            years_boost = min(years * 0.04, 0.20) if years > 0 else 0.0

            # Layer 6: Multi-section diversity bonus
            section_count = len(set(skill_data["found_in"]))
            diversity_bonus = 0.10 if section_count >= 3 else (0.05 if section_count >= 2 else 0.0)

            # Combine all layers
            final = base + context_boost + occurrence_boost + action_boost + years_boost + diversity_bonus
            skill_data["proficiency"] = round(min(final, 1.0), 2)

            # Boost confidence based on evidence strength
            if section_count >= 2:
                skill_data["confidence"] = min(skill_data["confidence"] + 0.05, 0.98)
            if occurrence_count >= 3:
                skill_data["confidence"] = min(skill_data["confidence"] + 0.03, 0.98)

        # Sort by proficiency (highest first)
        sorted_results = sorted(
            results.values(),
            key=lambda x: x["proficiency"],
            reverse=True
        )

        return sorted_results


    