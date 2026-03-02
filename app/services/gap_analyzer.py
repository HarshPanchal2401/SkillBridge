"""Refined skill gap analysis logic for career intelligence."""
from typing import Dict, List, Optional, Set
import re


class GapAnalyzer:
    """Performs intelligent skill gap analysis between user skills and market requirements."""

    def __init__(self):
        # Soft skills set to filter for technical relevance
        self.soft_skills = {
            'communication', 'leadership', 'project-management', 'problem-solving',
            'critical-thinking', 'teamwork', 'collaboration', 'presentation',
            'public-speaking', 'negotiation', 'conflict-resolution', 'time-management',
            'adaptability', 'creativity', 'analytical-thinking', 'attention-to-detail',
            'stakeholder-management', 'mentoring', 'coaching', 'interpersonal-skills',
            'emotional-intelligence', 'decision-making', 'strategic-thinking',
            'customer-service', 'work-ethic', 'self-motivation', 'flexibility'
        }

    def _normalize_skill(self, skill: str, synonym_map: Optional[Dict[str, List[str]]] = None) -> str:
        """Normalize skill name using synonym map."""
        s = skill.lower().strip()
        if not synonym_map:
            return s
            
        for canonical, variants in synonym_map.items():
            if s == canonical.lower() or s in [v.lower() for v in variants]:
                return canonical.lower()
        return s

    def analyze_gaps(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        synonym_map: Dict[str, List[str]] = None
    ) -> Dict:
        """
        Analyze gaps between user skills and market requirements.
        Categorizes and sorts by demand (descending).
        """
        norm_user_skills = {}
        for skill, data in user_skills.items():
            norm_name = self._normalize_skill(skill, synonym_map)
            norm_user_skills[norm_name] = data

        critical_gaps = []
        important_gaps = []
        emerging_gaps = []
        strengths = []

        for skill, req in market_requirements.items():
            norm_market_name = self._normalize_skill(skill, synonym_map)
            demand = req.get('frequency', 0)
            req_level = req.get('requirement_level', 'important')
            
            # Prepare skill data for result
            skill_data = {
                "skill": skill,
                "demand": demand,
                "demand_percentage": f"{int(demand * 100)}%",
                "requirement_level": req_level,
                "trending": req.get("trending", False),
                "llm_validated": req.get("llm_validated", False)
            }

            if norm_market_name in norm_user_skills:
                # User has the skill - it's a strength
                user_data = norm_user_skills[norm_market_name]
                skill_data["user_proficiency"] = user_data.get('proficiency', 0)
                strengths.append(skill_data)
            else:
                # User lacks the skill - it's a gap
                # Filter out soft skills for the gap list to keep it technical
                if skill.lower().replace(' ', '-') in self.soft_skills:
                    continue
                    
                if req_level == 'critical':
                    critical_gaps.append(skill_data)
                elif req_level == 'important':
                    important_gaps.append(skill_data)
                else:
                    emerging_gaps.append(skill_data)

        # Sort all lists by demand descending
        critical_gaps.sort(key=lambda x: x['demand'], reverse=True)
        important_gaps.sort(key=lambda x: x['demand'], reverse=True)
        emerging_gaps.sort(key=lambda x: x['demand'], reverse=True)
        strengths.sort(key=lambda x: x['demand'], reverse=True)

        readiness_score = self._calculate_readiness(user_skills, market_requirements, synonym_map)

        return {
            'critical_gaps': critical_gaps,
            'important_gaps': important_gaps,
            'emerging_gaps': emerging_gaps,
            'strengths': strengths,
            'overall_readiness': readiness_score,
            'summary': {
                'total_gaps': len(critical_gaps) + len(important_gaps) + len(emerging_gaps),
                'critical_gap_count': len(critical_gaps),
                'important_gap_count': len(important_gaps),
                'emerging_gap_count': len(emerging_gaps),
                'strength_count': len(strengths),
                'overall_readiness_pct': int(readiness_score * 100),
                'interpretation': self._get_interpretation(readiness_score),
                'top_3_priorities': [s['skill'] for s in critical_gaps[:3]]
            },
            'detailed_results': {
                'critical': critical_gaps,
                'important': important_gaps,
                'emerging': emerging_gaps,
                'strengths': strengths
            }
        }

    def _calculate_readiness(self, user_skills, market_requirements, synonym_map) -> float:
        """Calculate a weighted readiness score."""
        if not market_requirements:
            return 0.0
            
        total_weight = 0
        attained_weight = 0
        
        norm_user_skills = {self._normalize_skill(s, synonym_map) for s in user_skills.keys()}
        
        for skill, req in market_requirements.items():
            demand = req.get('frequency', 0)
            norm_name = self._normalize_skill(skill, synonym_map)
            
            # Critical skills carry 3x weight, important 2x, emerging 1x
            multiplier = 3 if req.get('requirement_level') == 'critical' else \
                         2 if req.get('requirement_level') == 'important' else 1
            
            weight = demand * multiplier
            total_weight += weight
            
            if norm_name in norm_user_skills:
                attained_weight += weight
                
        return round(attained_weight / total_weight, 2) if total_weight > 0 else 0.0

    def _get_interpretation(self, score: float) -> str:
        if score >= 0.8: return "Excellent match. You are highly ready for this role."
        if score >= 0.6: return "Good match. Focus on a few key missing skills to be competitive."
        if score >= 0.4: return "Moderate match. Significant learning required in core areas."
        return "Developing match. Consider foundational courses in this role's technology stack."

    def get_missing_skills(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        min_frequency: float = 0.3,
        synonym_map: Dict[str, List[str]] = None
    ) -> List[str]:
        """Identifies skills present in market but missing from user profile."""
        missing = []
        norm_user_skills = {self._normalize_skill(s, synonym_map) for s in user_skills.keys()}
        
        for skill, data in market_requirements.items():
            if data.get('frequency', 0) >= min_frequency:
                norm_name = self._normalize_skill(skill, synonym_map)
                if norm_name not in norm_user_skills:
                    # Filter for technical relevance
                    if skill.lower().replace(' ', '-') not in self.soft_skills:
                        missing.append(skill)
        return missing