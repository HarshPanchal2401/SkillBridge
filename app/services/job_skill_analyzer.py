"""Analyze job descriptions to extract required skills."""
import re
from typing import List, Dict, Tuple
from collections import defaultdict


class JobSkillAnalyzer:
    """Extract and analyze skills from job descriptions."""
    
    def __init__(self, skill_extractor):
        """Initialize with skill extractor."""
        self.skill_extractor = skill_extractor
        
        # Keywords that indicate requirement level
        self.required_keywords = [
            'required', 'must have', 'essential', 'mandatory',
            'needs', 'requires', 'should have', 'necessary'
        ]
        
        self.preferred_keywords = [
            'preferred', 'nice to have', 'bonus', 'plus',
            'desired', 'ideal', 'good to have', 'advantageous'
        ]
    
    def extract_skills_from_job(self, job_description: str) -> Dict[str, Dict]:
        """
        Extract skills from a single job description.
        
        Returns:
            {
                'required': {skill: proficiency_needed},
                'preferred': {skill: proficiency_needed},
                'all': {skill: {'level': 'required'|'preferred', 'proficiency': float}}
            }
        """
        if not job_description:
            return {'required': {}, 'preferred': {}, 'all': {}}
        
        description_lower = job_description.lower()
        
        # Split into sections
        required_section = ""
        preferred_section = ""
        
        # Try to find "Required" section
        for keyword in self.required_keywords:
            pattern = f"{keyword}[:\s]+(.*?)(?:{'|'.join(self.preferred_keywords)}|$)"
            match = re.search(pattern, description_lower, re.DOTALL | re.IGNORECASE)
            if match:
                required_section += match.group(1) + " "
        
        # Try to find "Preferred" section
        for keyword in self.preferred_keywords:
            pattern = f"{keyword}[:\s]+(.*?)$"
            match = re.search(pattern, description_lower, re.DOTALL | re.IGNORECASE)
            if match:
                preferred_section += match.group(1) + " "
        
        # If no clear sections, use entire description
        if not required_section and not preferred_section:
            required_section = description_lower
        
        # Extract skills from each section
        required_skills = self.skill_extractor.extract_skills_from_text(required_section)
        preferred_skills = self.skill_extractor.extract_skills_from_text(preferred_section)
        
        # Calculate proficiency needed based on context
        required_dict = {}
        for skill in required_skills:
            proficiency = self._estimate_proficiency_needed(skill, description_lower)
            required_dict[skill] = proficiency
        
        preferred_dict = {}
        for skill in preferred_skills:
            if skill not in required_dict:  # Avoid duplicates
                proficiency = self._estimate_proficiency_needed(skill, description_lower) * 0.8
                preferred_dict[skill] = proficiency
        
        # Combine all
        all_skills = {}
        for skill, prof in required_dict.items():
            all_skills[skill] = {'level': 'required', 'proficiency': prof}
        for skill, prof in preferred_dict.items():
            all_skills[skill] = {'level': 'preferred', 'proficiency': prof}
        
        return {
            'required': required_dict,
            'preferred': preferred_dict,
            'all': all_skills
        }
    
    def _estimate_proficiency_needed(self, skill: str, description: str) -> float:
        """Estimate proficiency level needed based on context around skill mention."""
        base_proficiency = 0.70  # Default requirement level
        
        skill_lower = skill.lower()
        description_lower = description.lower()
        
        # Find context around skill mention (100 chars before and after)
        pattern = f".{{0,100}}{re.escape(skill_lower)}.{{0,100}}"
        matches = re.findall(pattern, description_lower)
        
        if not matches:
            return base_proficiency
        
        context = " ".join(matches)
        
        # Expertise indicators
        expert_terms = ['expert', 'advanced', 'proficient', 'strong', 'extensive', 'deep', 'senior']
        for term in expert_terms:
            if term in context:
                base_proficiency += 0.15
                break
        
        # Experience years
        years_pattern = r'(\d+)\+?\s*years?'
        years_match = re.search(years_pattern, context)
        if years_match:
            years = int(years_match.group(1))
            if years >= 5:
                base_proficiency += 0.15
            elif years >= 3:
                base_proficiency += 0.10
            elif years >= 1:
                base_proficiency += 0.05
        
        # Production/deployment terms
        production_terms = ['production', 'deployed', 'scalable', 'enterprise', 'large-scale']
        for term in production_terms:
            if term in context:
                base_proficiency += 0.10
                break
        
        return min(base_proficiency, 1.0)
    
    def aggregate_job_requirements(self, jobs: List[Dict]) -> Dict[str, Dict]:
        """
        Aggregate skill requirements across multiple jobs.
        
        Args:
            jobs: List of job dicts with 'description' field
        
        Returns:
            {
                skill_name: {
                    'frequency': float (0-1),
                    'requirement_level': 'critical'|'important'|'emerging',
                    'avg_proficiency_needed': float,
                    'required_count': int,
                    'preferred_count': int,
                    'total_mentions': int
                }
            }
        """
        total_jobs = len(jobs)
        if total_jobs == 0:
            return {}
        
        print(f"📊 Analyzing {total_jobs} job descriptions...")
        
        skill_stats = defaultdict(lambda: {
            'required_count': 0,
            'preferred_count': 0,
            'total_proficiency': 0.0,
            'total_mentions': 0
        })
        
        # Process each job
        for i, job in enumerate(jobs):
            description = job.get('description', '')
            
            if not description:
                continue
            
            # Extract skills
            job_skills = self.extract_skills_from_job(description)
            
            # Count required skills
            for skill, proficiency in job_skills['required'].items():
                skill_stats[skill]['required_count'] += 1
                skill_stats[skill]['total_proficiency'] += proficiency
                skill_stats[skill]['total_mentions'] += 1
            
            # Count preferred skills
            for skill, proficiency in job_skills['preferred'].items():
                skill_stats[skill]['preferred_count'] += 1
                skill_stats[skill]['total_proficiency'] += proficiency
                skill_stats[skill]['total_mentions'] += 1
            
            if (i + 1) % 10 == 0:
                print(f"   Processed {i + 1}/{total_jobs} jobs...")
        
        # Calculate aggregated metrics
        market_requirements = {}
        
        for skill, stats in skill_stats.items():
            frequency = stats['total_mentions'] / total_jobs
            avg_proficiency = stats['total_proficiency'] / stats['total_mentions'] if stats['total_mentions'] > 0 else 0
            
            # Determine requirement level
            required_ratio = stats['required_count'] / total_jobs
            
            if required_ratio >= 0.70:
                requirement_level = 'critical'
            elif frequency >= 0.50:
                requirement_level = 'important'
            elif frequency >= 0.25:
                requirement_level = 'emerging'
            else:
                requirement_level = 'optional'
            
            market_requirements[skill] = {
                'frequency': round(frequency, 3),
                'requirement_level': requirement_level,
                'avg_proficiency_needed': round(avg_proficiency, 2),
                'required_count': stats['required_count'],
                'preferred_count': stats['preferred_count'],
                'total_mentions': stats['total_mentions']
            }
        
        # Sort by frequency
        market_requirements = dict(
            sorted(market_requirements.items(), key=lambda x: x[1]['frequency'], reverse=True)
        )
        
        print(f"✅ Identified {len(market_requirements)} unique skills across all jobs")
        
        return market_requirements