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
        Performs gap analysis based on user proficiency and market demand.
        
        Rules:
        - Gap = Market Demand (%) - User Proficiency (%)
        - Gap > 70%: Immediate Learning (Critical)
        - 30% <= Gap <= 70%: Skill Learning (Important)
        - Gap < 20%: Ignore
        """
        critical_gaps = []
        important_gaps = []
        emerging_gaps = []
        strengths = []
        
        # Normalize user skills for easier lookup
        norm_user_skills = {}
        for s, data in user_skills.items():
            norm_name = self._normalize_skill(s, synonym_map)
            norm_user_skills[norm_name] = data

        total_market_skills = 0
        matched_count = 0
        
        for market_skill, market_data in market_requirements.items():
            # Skip if not a technical skill (contextual relevance)
            skill_key = market_skill.lower().replace(' ', '-')
            if skill_key in self.soft_skills:
                continue
                
            total_market_skills += 1
            norm_market_name = self._normalize_skill(market_skill, synonym_map)
            
            market_demand = market_data.get('frequency', 0)
            user_data = norm_user_skills.get(norm_market_name)
            user_proficiency = user_data.get('proficiency', 0) if user_data else 0
            
            # Match found
            if user_data:
                matched_count += 1
            
            # Calculate simple gap percentage
            gap_pct = (market_demand - user_proficiency) * 100
            
            skill_info = {
                'skill': market_skill,
                'market_demand': round(market_demand * 100, 1),
                'demand_percentage': round(market_demand * 100, 1), # Added for frontend compatibility
                'user_proficiency': round(user_proficiency * 100, 1),
                'gap': round(max(0, gap_pct), 1),
                'requirement_level': market_data.get('requirement_level', 'important')
            }

            if user_data:
                strengths.append(skill_info)
            else:
                # If skill is NOT matched, it's a gap
                gap_pct = market_demand * 100
                skill_info['gap'] = round(gap_pct, 1)
                
                if gap_pct > 70:
                    critical_gaps.append(skill_info)
                elif 30 <= gap_pct <= 70:
                    important_gaps.append(skill_info)
                else:
                    emerging_gaps.append(skill_info)

        # Sort gaps by priority (highest gap first)
        critical_gaps.sort(key=lambda x: x['gap'], reverse=True)
        important_gaps.sort(key=lambda x: x['gap'], reverse=True)
        
        overall_readiness = (matched_count / total_market_skills * 100) if total_market_skills > 0 else 0

        # Build interpretation
        interpretation = "You are well-prepared for this role." if overall_readiness > 80 else \
                         "You have a solid foundation but some critical gaps remain." if overall_readiness > 50 else \
                         "Extensive learning is required to be competitive for this role."

        return {
            'critical_gaps': critical_gaps, # Return objects instead of names
            'important_gaps': important_gaps,
            'emerging_gaps': emerging_gaps,
            'strengths': strengths,
            'overall_readiness': round(overall_readiness, 1),
            'summary': {
                'total_gaps': len(critical_gaps) + len(important_gaps),
                'critical_gap_count': len(critical_gaps),
                'important_gap_count': len(important_gaps),
                'emerging_gap_count': len(emerging_gaps),
                'strength_count': len(strengths),
                'overall_readiness_pct': round(overall_readiness, 1),
                'interpretation': interpretation,
                'top_3_priorities': [g['skill'] for g in critical_gaps[:3]]
            },
            'detailed_results': {
                'critical': critical_gaps,
                'important': important_gaps,
                'emerging': emerging_gaps,
                'strengths': strengths
            }
        }

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