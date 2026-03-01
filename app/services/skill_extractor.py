"""NLP-based skill extraction service with ATS-style extraction."""
import re
import json
import os
from typing import List, Dict, Set, Tuple, Optional
from difflib import SequenceMatcher
from collections import defaultdict
from .resume_parser import ResumeParser
from .ats_skill_extractor import ATSSkillExtractor
from .huggingface_skill_extractor import HuggingFaceSkillExtractor
from .priority_skill_extractor import PrioritySkillExtractor

try:
    from .groq_skill_refiner import GroqSkillRefiner
except ImportError:
    GroqSkillRefiner = None  # type: ignore


# Import PDF/DOCX readers
try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

try:
    from docx import Document
except ImportError:
    Document = None


class SkillExtractor:
    """Extract skills from text using NLP techniques."""
    
    def __init__(self, skills_file_path: str, hf_extractor: Optional[HuggingFaceSkillExtractor] = None, groq_refiner=None):
        """Initialize with skills taxonomy."""
        with open(skills_file_path, 'r', encoding='utf-8') as f:
            skills_data = json.load(f)
        
        # Handle flat format: {skill: {abbr, aliases}} -> convert to structured format
        if 'skills' not in skills_data and 'synonyms' not in skills_data:
            skills_list = []
            synonyms = {}
            for skill, data in skills_data.items():
                skills_list.append(skill.lower())
                if isinstance(data, dict):
                    for abbr in data.get('abbr', []):
                        synonyms[abbr.lower()] = skill.lower()
                    for alias in data.get('aliases', []):
                        synonyms[alias.lower()] = skill.lower()
            skills_data = {'skills': skills_list, 'synonyms': synonyms, 'categories': {}, 'weights': {}}
        
        self.skills_list = set(skills_data.get('skills', []))
        self.synonyms = skills_data.get('synonyms', {})
        self.categories = skills_data.get('categories', {})
        self.weights = skills_data.get('weights', {})
        self.resume_parser = ResumeParser()
        
        # Initialize ATS extractor for advanced extraction
        self._skills_file_path = skills_file_path
        self.ats_extractor = ATSSkillExtractor(skills_file_path)
        self.hf_extractor = hf_extractor
        
        # Groq LLM refiner (optional — falls back gracefully if not available)
        self.groq_refiner = groq_refiner
        
        # Initialize Priority Extractor
        try:
            self.priority_extractor = PrioritySkillExtractor(skills_file_path)
        except Exception as e:
            print(f"⚠️ Failed to initialize PrioritySkillExtractor: {e}")
            self.priority_extractor = None
        
        # Build synonym map: canonical -> [variants]
        self.synonym_map = defaultdict(set)
        for variant, canonical in self.synonyms.items():
            self.synonym_map[canonical].add(variant.lower())
            # Also add versions with spaces/hyphens swapped
            self.synonym_map[canonical].add(variant.lower().replace('-', ' '))
            self.synonym_map[canonical].add(variant.lower().replace(' ', '-'))
        
        # Soft skills set - these are excluded from GitHub/LinkedIn extraction
        self.soft_skills = {
            'communication', 'leadership', 'project-management', 'problem-solving',
            'critical-thinking', 'teamwork', 'collaboration', 'presentation',
            'public-speaking', 'negotiation', 'conflict-resolution', 'time-management',
            'adaptability', 'creativity', 'analytical-thinking', 'attention-to-detail',
            'stakeholder-management', 'mentoring', 'coaching', 'interpersonal-skills',
            'emotional-intelligence', 'decision-making', 'strategic-thinking',
            'customer-service', 'work-ethic', 'self-motivation', 'flexibility'
        }
    
    def is_technical_skill(self, skill: str) -> bool:
        """
        Check if a skill is technical (not a soft skill).
        
        Args:
            skill: The skill name to check
            
        Returns:
            True if technical skill, False if soft skill
        """
        return skill.lower().replace(' ', '-') not in self.soft_skills
    
    def filter_technical_skills(self, skills: List[str]) -> List[str]:
        """
        Filter a list of skills to only return technical skills.
        
        Args:
            skills: List of skill names
            
        Returns:
            List containing only technical skills (soft skills removed)
        """
        return [s for s in skills if self.is_technical_skill(s)]
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text while preserving tech-critical characters."""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Strip anything in brackets/parentheses (Professional [ATS] -> Professional)
        text = re.sub(r'[\(\[].*?[\)\]]', ' ', text)
        
        # Preserve common tech symbols: +, #, . (e.g., C++, C#, Node.js)
        # We replace other special characters with spaces
        text = re.sub(r'[^a-z0-9\s\-\+\#\.]', ' ', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def extract_ngrams(self, text: str, max_n: int = 3) -> Set[str]:
        """Extract n-grams (unigrams, bigrams, trigrams) from text."""
        words = text.split()
        ngrams = set()
        
        for n in range(1, min(max_n + 1, len(words) + 1)):
            for i in range(len(words) - n + 1):
                ngram = ' '.join(words[i:i+n])
                ngrams.add(ngram)
        
        return ngrams
    
    def fuzzy_match(self, text: str, skill: str, threshold: float = 0.88) -> bool:
        """Check if text contains skill with fuzzy matching."""
        text_lower = text.lower()
        skill_lower = skill.lower()
        
        # Exact match
        if skill_lower in text_lower:
            return True
        
        # Word boundary match for single words
        if '-' not in skill_lower and ' ' not in skill_lower:
            pattern = r'\b' + re.escape(skill_lower) + r'\b'
            if re.search(pattern, text_lower):
                return True
        
        # Fuzzy match using SequenceMatcher
        words = text_lower.split()
        skill_words = skill_lower.split('-')  # Handle hyphenated skills
        skill_words = [w for part in skill_words for w in part.split()]  # Further split
        
        # For single word skills
        if len(skill_words) == 1:
            for word in words:
                # Remove special characters for comparison
                clean_word = re.sub(r'[^\w]', '', word)
                clean_skill = re.sub(r'[^\w]', '', skill_words[0])
                ratio = SequenceMatcher(None, clean_word, clean_skill).ratio()
                if ratio >= threshold:
                    return True
        
        # For multi-word skills, check if appears as phrase
        for i in range(len(words) - len(skill_words) + 1):
            phrase = ' '.join(words[i:i+len(skill_words)])
            ratio = SequenceMatcher(None, phrase, ' '.join(skill_words)).ratio()
            if ratio >= threshold:
                return True
        
        return False
    
    def extract_skills_from_resume(self, resume_text: str, use_ats: bool = True, file_path: Optional[str] = None) -> List:
        """
        Extract skills from resume using ONLY PrioritySkillExtractor.
        
        Args:
            resume_text: The resume text to extract skills from
            use_ats: Ignored (kept for API compatibility)
            file_path: Optional path to the resume file (for better PDF extraction)
        
        Returns:
            List of skill dicts with {skill, proficiency, confidence, found_in, context_boost, evidence}
        """
        if not resume_text and not file_path:
            return []
        
        # If file_path is a PDF, use pdfplumber for better text extraction
        current_text = resume_text
        if file_path and file_path.lower().endswith('.pdf') and self.priority_extractor:
            try:
                print(f"📄 Extracting text from PDF file using pdfplumber: {file_path}")
                pdf_text = self.priority_extractor.extract_resume_text(file_path)
                if pdf_text and len(pdf_text) > (len(resume_text) if resume_text else 0):
                    current_text = pdf_text
            except Exception as e:
                print(f"⚠️ PDF extraction with pdfplumber failed: {e}")

        # Use ONLY PrioritySkillExtractor
        if not self.priority_extractor:
            print("❌ PrioritySkillExtractor not initialized!")
            return []

        print("🔍 Running Priority skill extraction...")
        priority_skills = self.priority_extractor.extract_skills(current_text)
        print(f"✅ Priority Extractor found {len(priority_skills)} skills")

        # --- Groq LLM Refinement ---
        if self.groq_refiner and self.groq_refiner.is_available() and priority_skills:
            print("🧠 Running Groq LLM refinement...")
            priority_skills = self.groq_refiner.refine_skills(current_text, priority_skills)
        else:
            # Mark all as not LLM-refined if refiner isn't available
            priority_skills = [
                {**s, "llm_refined": False, "llm_reasoning": ""}
                for s in priority_skills
            ]

        return priority_skills

    def extract_skills_with_proficiency(self, resume_text: str) -> Dict[str, Dict]:
        """
        Extract skills with proficiency scores using ATS-style extraction.
        
        Uses context analysis, experience detection, and expert indicators
        to estimate proficiency and confidence levels.
        
        Args:
            resume_text: The resume text to analyze
            
        Returns:
            Dict of {skill_name: {proficiency, confidence, sources, ...}}
        """
        if not resume_text or len(resume_text.strip()) < 50:
            return {}
        
        print("🔍 Running ATS-style skill extraction with proficiency...")
        result = self.ats_extractor.extract_skills(resume_text)
        print(f"✅ Extracted {len(result.skills)} skills with proficiency data")
        return result.skills

    def _get_canonical_skill(self, skill_name: str) -> str:
        """Helper to get canonical skill name."""
        if not skill_name:
            return ""
            
        # Strip brackets first: "Python (Advanced)" -> "Python"
        s = skill_name
        s = re.sub(r'\s*[\(\[\{].*?[\)\]\}]', '', s)
        s = re.sub(r'\s*[\(\[\{].*', '', s)
        s = re.sub(r'[\)\]\}]', '', s)
        s = s.strip().lower()
        
        if not s or len(s) < 1: return ""
        
        # Check synonym map
        if s in self.synonym_map:
            return self.synonym_map[s]
            
        # Check if it's in skills list directly
        if s in self.skills_list:
            return s
            
        # Try cleaning hyphens
        s_hyphen = s.replace(' ', '-')
        if s_hyphen in self.skills_list:
            return s_hyphen
            
        return s # Return as is if not in taxonomy but extracted

    def _get_skill_category(self, skill: str) -> str:
        """Find category for a given skill."""
        for category, skill_list in self.categories.items():
            if skill in skill_list:
                return category
        return "other"
    
    def extract_skills_from_text(self, text: str) -> List[str]:
        """Extract skills from text using multiple techniques."""
        if not text:
            return []
        
        cleaned_text = self.clean_text(text)
        found_skills = set()
        
        # Extract n-grams
        ngrams = self.extract_ngrams(cleaned_text, max_n=4)
        
        # Match against skills taxonomy
        for skill in self.skills_list:
            skill_clean = skill.lower()
            skill_space = skill_clean.replace('-', ' ')
            
            # 1. Exact match for canonical name or simple variations (using n-grams for word boundary safety)
            if (skill_clean in ngrams or skill_space in ngrams):
                found_skills.add(skill)
                continue
            
            # For longer skills, we can be slightly more flexible if they aren't in n-grams (e.g., concatenated)
            if len(skill_clean) > 3:
                if (skill_clean in cleaned_text or skill_space in cleaned_text):
                    found_skills.add(skill)
                    continue
            
            # 2. Check synonym matches (using the fixed mapping)
            # Variants recorded for this canonical skill
            variants = self.synonym_map.get(skill, set())
            found_variant = False
            for variant in variants:
                if variant in cleaned_text or variant in ngrams:
                    found_skills.add(skill)
                    found_variant = True
                    break
            
            if found_variant:
                continue

            # 3. Fuzzy match for skills with hyphens or variations (avoiding single letters)
            if len(skill_clean) > 2 and self.fuzzy_match(cleaned_text, skill_clean, threshold=0.90):
                found_skills.add(skill)
        
        return list(found_skills)
    
    def calculate_proficiency_from_course(
        self,
        skill: str,
        course_data: Dict
    ) -> Tuple[float, float]:
        """
        Calculate skill proficiency from course data.
        Returns: (proficiency, confidence)
        """
        base_proficiency = 0.5  # Base for course completion
        confidence = 0.7
        
        # Grade boost
        grade = (course_data.get('grade') or '').upper()
        if grade in ['A+', 'A']:
            base_proficiency += 0.15
            confidence += 0.1
        elif grade in ['A-', 'B+']:
            base_proficiency += 0.10
        elif grade in ['B', 'B-']:
            base_proficiency += 0.05
        
        # Platform reputation boost
        platform = (course_data.get('platform') or '').lower()
        if platform in ['coursera', 'edx', 'mit', 'stanford']:
            base_proficiency += 0.05
            confidence += 0.05
        
        # Course level boost (check in name/description)
        text = f"{course_data.get('course_name') or ''} {course_data.get('description') or ''}".lower()
        if 'advanced' in text:
            base_proficiency += 0.10
        elif 'intermediate' in text:
            base_proficiency += 0.05
        
        # Cap at 0.70 (courses have theoretical limit)
        proficiency = min(base_proficiency, 0.70)
        confidence = min(confidence, 0.85)
        
        return (proficiency, confidence)
    
    def calculate_proficiency_from_project(
        self,
        skill: str,
        project_data: Dict
    ) -> Tuple[float, float]:
        """
        Calculate skill proficiency from project data.
        Returns: (proficiency, confidence)
        """
        base_proficiency = 0.60  # Base for hands-on project
        confidence = 0.75
        
        description = (project_data.get('description') or '').lower()
        
        # Complexity indicators
        complexity_terms = {
            'deployed': 0.15,
            'production': 0.15,
            'scalable': 0.10,
            'large-scale': 0.10,
            'complex': 0.10,
            'advanced': 0.10,
            'optimized': 0.08,
            'improved': 0.08,
            'integrated': 0.05,
            'api': 0.05
        }
        
        for term, boost in complexity_terms.items():
            if term in description:
                base_proficiency += boost
                confidence += 0.02
        
        # Team role boost
        role = (project_data.get('role') or '').lower()
        if 'lead' in role or 'architect' in role:
            base_proficiency += 0.10
            confidence += 0.05
        elif 'solo' in role:
            base_proficiency += 0.05
        
        # Duration boost
        duration = (project_data.get('duration') or '').lower()
        if any(term in duration for term in ['6 months', '7 months', '8 months', '9 months', '1 year', '2 year']):
            base_proficiency += 0.10
        elif any(term in duration for term in ['3 months', '4 months', '5 months']):
            base_proficiency += 0.05
        
        # Links boost (shows completion/quality)
        if project_data.get('github_link'):
            base_proficiency += 0.05
            confidence += 0.03
        if project_data.get('deployed_link'):
            base_proficiency += 0.10
            confidence += 0.05
        
        # Cap at 0.90 (projects can reach high proficiency)
        proficiency = min(base_proficiency, 0.90)
        confidence = min(confidence, 0.92)
        
        return (proficiency, confidence)
    
    def calculate_proficiency_from_resume(
        self,
        skill: str,
        resume_text: str
    ) -> Tuple[float, float]:
        """
        Calculate skill proficiency from resume mentions.
        Returns: (proficiency, confidence)
        """
        resume_lower = resume_text.lower()
        skill_lower = skill.lower()
        
        # Count mentions
        mention_count = 0
        skill_clean = skill.lower()
        skill_space = skill_clean.replace('-', ' ')
        
        # Check both hyphen and space versions
        mention_count += resume_lower.count(skill_clean)
        if skill_clean != skill_space:
            mention_count += resume_lower.count(skill_space)
            
        # Check synonyms
        if skill in self.synonyms:
            for synonym in self.synonyms[skill]:
                synonym_clean = synonym.lower()
                mention_count += resume_lower.count(synonym_clean)
                synonym_space = synonym_clean.replace('-', ' ')
                if synonym_clean != synonym_space:
                    mention_count += resume_lower.count(synonym_space)
        
        # Base proficiency from mentions
        base_proficiency = 0.50
        if mention_count >= 5:
            base_proficiency = 0.75
        elif mention_count >= 3:
            base_proficiency = 0.65
        elif mention_count >= 2:
            base_proficiency = 0.55
        
        # Context boost (check for expertise indicators)
        expertise_terms = ['expert', 'proficient', 'advanced', 'extensive experience', 'strong', 'skilled']
        for term in expertise_terms:
            # Check if term appears near the skill (within 50 chars)
            pattern = f".{{0,50}}{re.escape(term)}.{{0,50}}{re.escape(skill_lower)}"
            if re.search(pattern, resume_lower):
                base_proficiency += 0.10
                break
        
        confidence = min(0.60 + (mention_count * 0.05), 0.80)
        proficiency = min(base_proficiency, 0.85)
        
        return (proficiency, confidence)
    
    def calculate_proficiency_from_text(
        self,
        skill: str,
        text: str
    ) -> Tuple[float, float]:
        """
        Calculate skill proficiency from text (alias for calculate_proficiency_from_resume).
        Returns: (proficiency, confidence)
        """
        return self.calculate_proficiency_from_resume(skill, text)
    
    def calculate_proficiency_from_experience(
        self,
        skill: str,
        experience_data: Dict
    ) -> Tuple[float, float]:
        """
        Calculate skill proficiency from work experience data.
        Returns: (proficiency, confidence)
        """
        base_proficiency = 0.70  # Base for work experience
        confidence = 0.80
        
        description = (experience_data.get('responsibilities') or '').lower()
        skill_lower = skill.lower()
        
        # Count mentions
        mention_count = description.count(skill_lower)
        
        # Check for leadership indicators
        leadership_terms = ['lead', 'led', 'managed', 'architected', 'designed', 'mentor']
        if any(term in description for term in leadership_terms):
            base_proficiency += 0.10
            confidence += 0.05
        
        # Check for expertise indicators
        expertise_terms = ['expert', 'extensive', 'advanced', 'specialized', 'proficient']
        if any(term in description for term in expertise_terms):
            base_proficiency += 0.08
        
        # Mention frequency boost
        if mention_count >= 4:
            base_proficiency += 0.10
        elif mention_count >= 2:
            base_proficiency += 0.05
        
        # Cap at 0.95
        proficiency = min(base_proficiency, 0.95)
        confidence = min(confidence, 0.90)
        
        return (proficiency, confidence)
    
    def aggregate_skills(
        self,
        skill_sources: List[Dict]
    ) -> Dict[str, Dict]:
        """
        Aggregate skills from multiple sources.
        
        Args:
            skill_sources: List of dicts with format:
                {
                    'source': 'course'|'project'|'resume',
                    'source_id': int,
                    'skills': {skill_name: (proficiency, confidence)}
                }
        
        Returns:
            Dict of {skill_name: {proficiency, confidence, source_count, sources}}
        """
        skill_data = defaultdict(lambda: {
            'proficiencies': [],
            'confidences': [],
            'sources': [],
            'source_types': []
        })
        
        # Collect all data
        for source_data in skill_sources:
            source_type = source_data['source']
            source_id = source_data.get('source_id', 0)
            
            for skill, (proficiency, confidence) in source_data['skills'].items():
                skill_data[skill]['proficiencies'].append(proficiency)
                skill_data[skill]['confidences'].append(confidence)
                skill_data[skill]['sources'].append(f"{source_type}:{source_id}")
                skill_data[skill]['source_types'].append(source_type)
        
        # Aggregate
        aggregated = {}
        for skill, data in skill_data.items():
            proficiencies = data['proficiencies']
            confidences = data['confidences']
            source_types = data['source_types']
            
            # Weighted average (give more weight to practical sources)
            source_weights = {
                'experience': 2.0,
                'project': 1.5,
                'certification': 1.2,
                'course': 1.0,
                'resume': 1.3
            }
            
            total_weight = sum(source_weights.get(st, 1.0) for st in source_types)
            weighted_prof = sum(
                p * source_weights.get(st, 1.0)
                for p, st in zip(proficiencies, source_types)
            ) / total_weight
            
            # Frequency boost
            source_count = len(proficiencies)
            frequency_boost = min(source_count * 0.05, 0.15)
            
            # Final proficiency
            final_proficiency = min(weighted_prof + frequency_boost, 1.0)
            
            # Confidence based on agreement
            avg_confidence = sum(confidences) / len(confidences)
            count_boost = min(source_count * 0.1, 0.2)
            final_confidence = min(avg_confidence + count_boost, 0.95)
            
            aggregated[skill] = {
                'proficiency': round(final_proficiency, 2),
                'confidence': round(final_confidence, 2),
                'source_count': source_count,
                'sources': data['sources']
            }
        
        return aggregated
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        if not PdfReader:
            raise ImportError("PyPDF2 not installed. Install with: pip install PyPDF2")
        
        try:
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return ""
    
    def extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX file."""
        if not Document:
            raise ImportError("python-docx not installed. Install with: pip install python-docx")
        
        try:
            doc = Document(file_path)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text
        except Exception as e:
            print(f"Error reading DOCX: {e}")
            return ""
    
    def extract_text_from_file(self, file_path: str) -> str:
        """Extract text from file (PDF, DOCX, or TXT)."""
        if not os.path.exists(file_path):
            return ""
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.pdf':
            return self.extract_text_from_pdf(file_path)
        elif ext in ['.docx', '.doc']:
            return self.extract_text_from_docx(file_path)
        elif ext == '.txt':
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        else:
            return ""
