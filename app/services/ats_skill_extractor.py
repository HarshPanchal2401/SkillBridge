"""
Advanced ATS-Style Skill Extractor

This module implements production-grade skill extraction that mirrors how professional
Applicant Tracking Systems (ATS) work - using pattern matching, context analysis,
skill inference, and intelligent proficiency estimation.

Key features:
- Multi-pass skill matching (exact, pattern, fuzzy, contextual)
- Section-aware weighting (Skills section > Experience > Body)
- Experience level detection (years of experience)
- Expert indicator analysis
- Proficiency scoring with confidence levels
"""

import re
import json
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum


class SkillSource(Enum):
    """Source of skill detection."""
    SKILLS_SECTION = "skills_section"
    EXPERIENCE = "experience"
    PROJECTS = "projects"
    EDUCATION = "education"
    CERTIFICATIONS = "certifications"
    BODY_TEXT = "body_text"


@dataclass
class SkillMatch:
    """Represents a detected skill with metadata."""
    name: str
    canonical_name: str
    source: SkillSource
    confidence: float
    proficiency: float
    context: str = ""
    years_experience: Optional[float] = None
    has_expert_indicator: bool = False
    mention_count: int = 1


@dataclass
class ExtractionResult:
    """Result of skill extraction."""
    skills: Dict[str, Dict]
    raw_matches: List[SkillMatch] = field(default_factory=list)
    extraction_stats: Dict = field(default_factory=dict)


class ATSSkillExtractor:
    """
    Advanced ATS-style skill extractor.
    
    Uses multiple techniques to extract skills:
    1. Exact matching from skills taxonomy
    2. Pattern matching for skill variations
    3. Context analysis for proficiency estimation
    4. Experience year detection
    5. Expert indicator analysis
    """
    
    # Section header patterns
    SECTION_PATTERNS = {
        SkillSource.SKILLS_SECTION: [
            r'(?i)^[\s]*(?:technical\s+)?skills?[\s]*[:\-]?',
            r'(?i)^[\s]*core\s+competencies?[\s]*[:\-]?',
            r'(?i)^[\s]*expertise[\s]*[:\-]?',
            r'(?i)^[\s]*technologies?[\s]*[:\-]?',
            r'(?i)^[\s]*tools?\s*(?:\&|and)?\s*technologies?[\s]*[:\-]?',
            r'(?i)^[\s]*programming[\s]*[:\-]?',
            r'(?i)^[\s]*languages?\s*(?:\&|and)?\s*frameworks?[\s]*[:\-]?',
        ],
        SkillSource.EXPERIENCE: [
            r'(?i)^[\s]*(?:work\s+)?experience[\s]*[:\-]?',
            r'(?i)^[\s]*professional\s+experience[\s]*[:\-]?',
            r'(?i)^[\s]*employment\s+history[\s]*[:\-]?',
            r'(?i)^[\s]*career\s+history[\s]*[:\-]?',
            r'(?i)^[\s]*internships?[\s]*[:\-]?',
            r'(?i)^[\s]*internship\s+experience[\s]*[:\-]?',
            r'(?i)^[\s]*experience\s*/\s*internship[\s]*[:\-]?',
        ],
        SkillSource.PROJECTS: [
            r'(?i)^[\s]*projects?[\s]*[:\-]?',
            r'(?i)^[\s]*personal\s+projects?[\s]*[:\-]?',
            r'(?i)^[\s]*academic\s+projects?[\s]*[:\-]?',
            r'(?i)^[\s]*portfolio[\s]*[:\-]?',
        ],
        SkillSource.EDUCATION: [
            r'(?i)^[\s]*education[\s]*[:\-]?',
            r'(?i)^[\s]*academic\s+background[\s]*[:\-]?',
            r'(?i)^[\s]*qualifications?[\s]*[:\-]?',
        ],
        SkillSource.CERTIFICATIONS: [
            r'(?i)^[\s]*certifications?[\s]*[:\-]?',
            r'(?i)^[\s]*certificates?[\s]*[:\-]?',
            r'(?i)^[\s]*licenses?[\s]*[:\-]?',
            r'(?i)^[\s]*credentials?[\s]*[:\-]?',
        ],
    }
    
    # Experience year patterns
    EXPERIENCE_PATTERNS = [
        # "5+ years of Python" / "5 years Python experience"
        r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience\s+(?:with|in|using))?\s*{skill}',
        # "Python (5 years)" / "Python - 5 years"
        r'{skill}\s*[\(\-–]\s*(\d+)\+?\s*(?:years?|yrs?)',
        # "experience: 5 years" near skill
        r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?{skill}',
        # "3-5 years of Python"
        r'(\d+)\s*[-–]\s*\d+\s*(?:years?|yrs?)(?:\s+of)?\s*{skill}',
    ]
    
    # Expert level indicators
    EXPERT_INDICATORS = {
        'high': [
            'expert', 'mastery', 'master', 'fluent', 'native', 'exceptional',
            'extensive experience', 'deep expertise', 'thought leader',
        ],
        'medium_high': [
            'advanced', 'proficient', 'strong', 'solid', 'comprehensive',
            'in-depth', 'hands-on', 'practical',
        ],
        'medium': [
            'intermediate', 'working knowledge', 'comfortable', 'familiar',
            'good understanding', 'experience with',
        ],
        'low': [
            'basic', 'beginner', 'fundamental', 'entry-level', 'learning',
            'exposure to', 'some experience',
        ],
    }
    
    # Action verbs that indicate hands-on experience
    ACTION_VERBS = [
        'developed', 'built', 'created', 'designed', 'implemented', 'architected',
        'optimized', 'improved', 'enhanced', 'maintained', 'deployed', 'automated',
        'integrated', 'migrated', 'scaled', 'refactored', 'led', 'managed',
        'configured', 'established', 'leveraged', 'utilized', 'engineered',
    ]
    
    # Source weight multipliers
    SOURCE_WEIGHTS = {
        SkillSource.SKILLS_SECTION: 1.5,
        SkillSource.EXPERIENCE: 1.3,
        SkillSource.PROJECTS: 1.2,
        SkillSource.CERTIFICATIONS: 1.1,
        SkillSource.EDUCATION: 1.0,
        SkillSource.BODY_TEXT: 0.8,
    }
    
    def __init__(self, skills_file_path: str):
        """Initialize with skills taxonomy."""
        self.skills_taxonomy = self._load_skills_taxonomy(skills_file_path)
        self.skills_set = set(self.skills_taxonomy.get('skills', []))
        self.synonyms = self.skills_taxonomy.get('synonyms', {})
        self.categories = self.skills_taxonomy.get('categories', {})
        self.weights = self.skills_taxonomy.get('weights', {})
        
        # Build enhanced lookup structures
        self._build_lookup_structures()
    
    def _load_skills_taxonomy(self, path: str) -> Dict:
        """Load skills taxonomy from JSON file."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle flat format: {skill: {abbr, aliases}}
            if 'skills' not in data and 'synonyms' not in data:
                skills_list = []
                synonyms = {}
                for skill, sdata in data.items():
                    skills_list.append(skill.lower())
                    if isinstance(sdata, dict):
                        for abbr in sdata.get('abbr', []):
                            synonyms[abbr.lower()] = skill.lower()
                        for alias in sdata.get('aliases', []):
                            synonyms[alias.lower()] = skill.lower()
                return {'skills': skills_list, 'synonyms': synonyms, 'categories': {}, 'weights': {}}
            
            return data
        except Exception as e:
            print(f"Error loading skills taxonomy: {e}")
            return {'skills': [], 'synonyms': {}, 'categories': {}, 'weights': {}}
    
    def _build_lookup_structures(self):
        """Build optimized lookup structures for skill matching."""
        # Canonical name lookup (synonym -> canonical)
        self.canonical_lookup = {}
        
        # Add direct skills
        for skill in self.skills_set:
            skill_lower = skill.lower()
            self.canonical_lookup[skill_lower] = skill
            # Add space version
            self.canonical_lookup[skill_lower.replace('-', ' ')] = skill
            # Add no-space version
            self.canonical_lookup[skill_lower.replace('-', '')] = skill
        
        # Add synonyms
        for variant, canonical in self.synonyms.items():
            variant_lower = variant.lower()
            self.canonical_lookup[variant_lower] = canonical
            self.canonical_lookup[variant_lower.replace('-', ' ')] = canonical
            self.canonical_lookup[variant_lower.replace('-', '')] = canonical
            self.canonical_lookup[variant_lower.replace(' ', '-')] = canonical
        
        # Build skill patterns for regex matching
        self.skill_patterns = self._build_skill_patterns()
        
        # Category reverse lookup
        self.skill_to_category = {}
        for category, skills in self.categories.items():
            for skill in skills:
                self.skill_to_category[skill] = category
    
    def _build_skill_patterns(self) -> Dict[str, re.Pattern]:
        """Build regex patterns for skill matching."""
        patterns = {}
        
        for skill in self.skills_set:
            # Create pattern that matches word boundaries
            skill_lower = skill.lower()
            
            # Handle different skill formats
            if '-' in skill_lower:
                # For hyphenated skills, match with hyphen, space, or no separator
                parts = skill_lower.split('-')
                pattern_str = r'[\-\s]?'.join(re.escape(p) for p in parts)
            else:
                pattern_str = re.escape(skill_lower)
            
            # Word boundary pattern
            patterns[skill] = re.compile(
                r'(?<![a-zA-Z0-9\-])' + pattern_str + r'(?![a-zA-Z0-9\-])',
                re.IGNORECASE
            )
        
        return patterns
    
    def extract_skills(self, text: str) -> ExtractionResult:
        """
        Main extraction method - extracts skills using ATS-style multi-pass approach.
        
        Args:
            text: Resume text to analyze
            
        Returns:
            ExtractionResult with skills, matches, and statistics
        """
        if not text or len(text.strip()) < 50:
            return ExtractionResult(skills={})
        
        # Step 1: Split into sections
        sections = self._split_into_sections(text)
        
        # Step 2: Multi-pass extraction
        all_matches: List[SkillMatch] = []
        
        # Pass 1: Extract from skills section (highest priority)
        if SkillSource.SKILLS_SECTION in sections:
            matches = self._extract_from_skills_section(
                sections[SkillSource.SKILLS_SECTION]
            )
            all_matches.extend(matches)
        
        # Pass 2: Extract from experience section
        if SkillSource.EXPERIENCE in sections:
            matches = self._extract_from_context(
                sections[SkillSource.EXPERIENCE],
                SkillSource.EXPERIENCE
            )
            all_matches.extend(matches)
        
        # Pass 3: Extract from projects section
        if SkillSource.PROJECTS in sections:
            matches = self._extract_from_context(
                sections[SkillSource.PROJECTS],
                SkillSource.PROJECTS
            )
            all_matches.extend(matches)
        
        # Pass 4: Extract from entire body text (lower weight)
        body_matches = self._extract_from_body(text)
        all_matches.extend(body_matches)
        
        # Step 3: Aggregate and score
        aggregated = self._aggregate_matches(all_matches)
        
        # Step 4: Apply category limits and ranking
        final_skills = self._apply_ranking_and_limits(aggregated, text)
        
        # Build stats
        stats = {
            'total_matches': len(all_matches),
            'unique_skills': len(final_skills),
            'sections_found': [s.value for s in sections.keys()],
        }
        
        return ExtractionResult(
            skills=final_skills,
            raw_matches=all_matches,
            extraction_stats=stats
        )
    
    def _split_into_sections(self, text: str) -> Dict[SkillSource, str]:
        """Split resume into sections based on headers."""
        sections = {}
        lines = text.split('\n')
        
        current_section = SkillSource.BODY_TEXT
        current_content = []
        
        for line in lines:
            section_found = None
            
            # Check if line is a section header
            for source, patterns in self.SECTION_PATTERNS.items():
                for pattern in patterns:
                    if re.match(pattern, line.strip()):
                        section_found = source
                        break
                if section_found:
                    break
            
            if section_found:
                # Save previous section
                if current_content:
                    content = '\n'.join(current_content)
                    if current_section in sections:
                        sections[current_section] += '\n' + content
                    else:
                        sections[current_section] = content
                
                current_section = section_found
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_content:
            content = '\n'.join(current_content)
            if current_section in sections:
                sections[current_section] += '\n' + content
            else:
                sections[current_section] = content
        
        return sections
    
    def _extract_from_skills_section(self, text: str) -> List[SkillMatch]:
        """Extract skills from dedicated skills section."""
        matches = []
        
        # Clean and parse the skills section
        lines = text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Handle category headers (e.g., "Languages: Python, Java, SQL")
            if ':' in line:
                parts = line.split(':', 1)
                skills_text = parts[1] if len(parts) > 1 else line
            else:
                skills_text = line
            
            # Split by common delimiters
            delimiters = r'[,;|•·\t]+'
            skill_items = re.split(delimiters, skills_text)
            
            for item in skill_items:
                item = item.strip().strip('-•·').strip()
                if not item or len(item) < 1:
                    continue
                
                # Clean parenthetical content
                item = re.sub(r'\([^)]*\)', '', item).strip()
                
                # Try to find canonical skill
                canonical = self._get_canonical_skill(item)
                if canonical:
                    matches.append(SkillMatch(
                        name=item,
                        canonical_name=canonical,
                        source=SkillSource.SKILLS_SECTION,
                        confidence=0.95,  # High confidence from skills section
                        proficiency=0.70,  # Base proficiency
                    ))
                elif len(item) > 2 and self._is_likely_skill(item):
                    # Unknown skill but likely valid
                    matches.append(SkillMatch(
                        name=item,
                        canonical_name=item.lower().replace(' ', '-'),
                        source=SkillSource.SKILLS_SECTION,
                        confidence=0.75,
                        proficiency=0.60,
                    ))
        
        return matches
    
    def _extract_from_context(
        self, 
        text: str, 
        source: SkillSource
    ) -> List[SkillMatch]:
        """Extract skills with context analysis."""
        matches = []
        text_lower = text.lower()
        
        for skill, pattern in self.skill_patterns.items():
            for match in pattern.finditer(text):
                # Get context window (100 chars before and after)
                start = max(0, match.start() - 100)
                end = min(len(text), match.end() + 100)
                context = text[start:end]
                context_lower = context.lower()
                
                # Calculate proficiency based on context
                proficiency, has_expert = self._analyze_context(
                    skill, context_lower
                )
                
                # Extract years of experience
                years = self._extract_years_experience(skill, context_lower)
                if years:
                    proficiency = min(proficiency + (years * 0.05), 0.95)
                
                matches.append(SkillMatch(
                    name=match.group(),
                    canonical_name=skill,
                    source=source,
                    confidence=0.85,
                    proficiency=proficiency,
                    context=context.strip(),
                    years_experience=years,
                    has_expert_indicator=has_expert,
                ))
        
        return matches
    
    def _extract_from_body(self, text: str) -> List[SkillMatch]:
        """Extract skills from full body text."""
        matches = []
        text_lower = text.lower()
        
        # Simple pattern matching with lower confidence
        for skill, pattern in self.skill_patterns.items():
            if pattern.search(text_lower):
                # Count occurrences
                count = len(pattern.findall(text_lower))
                
                # Base proficiency based on frequency
                proficiency = min(0.50 + (count * 0.05), 0.75)
                
                matches.append(SkillMatch(
                    name=skill,
                    canonical_name=skill,
                    source=SkillSource.BODY_TEXT,
                    confidence=0.65,
                    proficiency=proficiency,
                    mention_count=count,
                ))
        
        return matches
    
    def _analyze_context(self, skill: str, context: str) -> Tuple[float, bool]:
        """Analyze context around skill mention for proficiency estimation."""
        base_proficiency = 0.60
        has_expert = False
        
        # Check for expert indicators
        for level, indicators in self.EXPERT_INDICATORS.items():
            for indicator in indicators:
                if indicator in context:
                    if level == 'high':
                        base_proficiency = max(base_proficiency, 0.90)
                        has_expert = True
                    elif level == 'medium_high':
                        base_proficiency = max(base_proficiency, 0.80)
                        has_expert = True
                    elif level == 'medium':
                        base_proficiency = max(base_proficiency, 0.65)
                    else:  # low
                        base_proficiency = min(base_proficiency, 0.45)
                    break
        
        # Check for action verbs (indicates hands-on experience)
        action_count = sum(1 for verb in self.ACTION_VERBS if verb in context)
        if action_count >= 2:
            base_proficiency = min(base_proficiency + 0.10, 0.95)
        elif action_count == 1:
            base_proficiency = min(base_proficiency + 0.05, 0.90)
        
        return base_proficiency, has_expert
    
    def _extract_years_experience(self, skill: str, context: str) -> Optional[float]:
        """Extract years of experience for a skill."""
        skill_escaped = re.escape(skill.lower())
        
        for pattern_template in self.EXPERIENCE_PATTERNS:
            pattern = pattern_template.format(skill=skill_escaped)
            match = re.search(pattern, context, re.IGNORECASE)
            if match:
                try:
                    years = float(match.group(1))
                    return min(years, 20)  # Cap at 20 years
                except (ValueError, IndexError):
                    pass
        
        return None
    
    def _get_canonical_skill(self, skill_name: str) -> Optional[str]:
        """Get canonical skill name from lookup with bracket stripping."""
        if not skill_name:
            return None
        
        # 1. Strip parenthetical content: "Python (Advanced)" -> "Python"
        s = skill_name
        s = re.sub(r'\s*[\(\[\{].*?[\)\]\}]', '', s)
        s = re.sub(r'\s*[\(\[\{].*', '', s)
        s = re.sub(r'[\)\]\}]', '', s)
        skill_lower = s.lower().strip()
        
        # Direct lookup
        if skill_lower in self.canonical_lookup:
            return self.canonical_lookup[skill_lower]
        
        # Try variations
        variations = [
            skill_lower,
            skill_lower.replace(' ', '-'),
            skill_lower.replace('-', ' '),
            skill_lower.replace('.', ''),
            skill_lower.replace(' ', ''),
        ]
        
        for var in variations:
            if var in self.canonical_lookup:
                return self.canonical_lookup[var]
        
        return None
    
    def _is_likely_skill(self, text: str) -> bool:
        """Check if text is likely a skill (heuristic)."""
        text_lower = text.lower()
        
        # Too short or too long
        if len(text) < 1 or len(text) > 50:
            return False
        
        # Single char must be R or C
        if len(text) == 1 and text.upper() not in ['R', 'C']:
            return False
        
        # Contains numbers only
        if text.replace(' ', '').isdigit():
            return False
        
        # Common non-skill words
        non_skills = {
            'and', 'or', 'the', 'with', 'for', 'etc', 'using', 'including',
            'other', 'more', 'various', 'multiple', 'several', 'many',
        }
        if text_lower in non_skills:
            return False
        
        return True
    
    def _aggregate_matches(
        self, 
        matches: List[SkillMatch]
    ) -> Dict[str, Dict]:
        """Aggregate multiple matches for the same skill."""
        aggregated = defaultdict(lambda: {
            'proficiencies': [],
            'confidences': [],
            'sources': [],
            'contexts': [],
            'years': [],
            'has_expert': False,
            'total_mentions': 0,
        })
        
        for match in matches:
            skill = match.canonical_name
            data = aggregated[skill]
            
            # Apply source weight
            weight = self.SOURCE_WEIGHTS.get(match.source, 1.0)
            weighted_prof = match.proficiency * weight
            weighted_conf = match.confidence * weight
            
            data['proficiencies'].append(weighted_prof)
            data['confidences'].append(weighted_conf)
            data['sources'].append(match.source.value)
            data['total_mentions'] += match.mention_count
            
            if match.context:
                data['contexts'].append(match.context[:100])
            if match.years_experience:
                data['years'].append(match.years_experience)
            if match.has_expert_indicator:
                data['has_expert'] = True
        
        # Calculate final scores
        final = {}
        for skill, data in aggregated.items():
            # Weighted average proficiency
            avg_prof = sum(data['proficiencies']) / len(data['proficiencies'])
            
            # Boost for multiple sources
            source_diversity = len(set(data['sources']))
            diversity_boost = min(source_diversity * 0.03, 0.12)
            
            # Boost for high mention count
            mention_boost = min(data['total_mentions'] * 0.02, 0.10)
            
            # Max years if available
            max_years = max(data['years']) if data['years'] else None
            years_boost = min(max_years * 0.03, 0.15) if max_years else 0
            
            # Expert boost
            expert_boost = 0.10 if data['has_expert'] else 0
            
            final_proficiency = min(
                avg_prof + diversity_boost + mention_boost + years_boost + expert_boost,
                0.98
            )
            
            # Confidence based on source agreement
            avg_conf = sum(data['confidences']) / len(data['confidences'])
            final_confidence = min(
                avg_conf + (source_diversity * 0.05),
                0.95
            )
            
            final[skill] = {
                'proficiency': round(final_proficiency, 2),
                'confidence': round(final_confidence, 2),
                'source_count': len(data['sources']),
                'sources': list(set(data['sources'])),
                'mention_count': data['total_mentions'],
                'years_experience': max_years,
                'has_expert_indicator': data['has_expert'],
            }
        
        return final
    
    def _apply_ranking_and_limits(
        self, 
        skills: Dict[str, Dict],
        full_text: str
    ) -> Dict[str, Dict]:
        """Apply ranking, category limits, and filtering."""
        # Sort by proficiency * confidence * weight
        ranked = []
        for skill, data in skills.items():
            weight = self.weights.get(skill, 1.0)
            score = data['proficiency'] * data['confidence'] * weight
            category = self.skill_to_category.get(skill, 'other')
            ranked.append((skill, data, score, category))
        
        ranked.sort(key=lambda x: x[2], reverse=True)
        
        # Apply limits
        final = {}
        category_counts = defaultdict(int)
        soft_skill_limit = 5
        total_limit = 35
        
        for skill, data, score, category in ranked:
            # Skip if at total limit
            if len(final) >= total_limit:
                break
            
            # Limit soft skills
            if category == 'soft-skills':
                if category_counts['soft-skills'] >= soft_skill_limit:
                    continue
            
            final[skill] = data
            category_counts[category] += 1
        
        return final
    
    def extract_skills_simple(self, text: str) -> List[str]:
        """
        Simple extraction - returns just skill names.
        Useful for backward compatibility.
        """
        result = self.extract_skills(text)
        return list(result.skills.keys())
    
    def extract_skills_with_proficiency(self, text: str) -> List[Dict]:
        """
        Extract skills with proficiency data.
        Returns list of {skill_name, proficiency, confidence}.
        """
        result = self.extract_skills(text)
        return [
            {
                'skill_name': skill,
                'proficiency': data['proficiency'],
                'confidence': data['confidence'],
                'sources': data.get('sources', []),
            }
            for skill, data in result.skills.items()
        ]
