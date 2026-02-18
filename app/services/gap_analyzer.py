"""Analyze skill gaps between user and market requirements."""
from typing import Dict, List, Tuple


class GapAnalyzer:
    """Compare user skills against market requirements."""
    
    def analyze_gaps(
        self,
        user_skills: Dict[str, Dict],  # {skill: {proficiency, confidence}}
        market_requirements: Dict[str, Dict]  # {skill: {frequency, requirement_level, avg_proficiency_needed}}
    ) -> Dict:

        critical_gaps = []
        important_gaps = []
        emerging_gaps = []
        strengths = []
        
        # Normalize user skills: lowercase, trim, and convert hyphens to spaces
        def normalize_skill(s):
            return s.lower().strip().replace('-', ' ').replace('_', ' ')
        
        normalized_user_skills = {normalize_skill(k): v for k, v in user_skills.items()}
        user_skill_names = list(normalized_user_skills.keys())
        
        print(f"\n{'='*60}")
        print(f"🔍 SKILL GAP MATCHING")
        print(f"   User skills: {len(user_skills)}")
        print(f"   Market skills: {len(market_requirements)}")
        print(f"{'='*60}")
        
        for skill, market_data in market_requirements.items():
            # Normalize market skill for matching (handles hyphens, underscores, case)
            skill_normalized = normalize_skill(skill)
            
            # Try exact match first
            user_skill_data = normalized_user_skills.get(skill_normalized, {})
            user_prof = user_skill_data.get('proficiency', 0.0)
            
            # If no exact match, try partial matching (e.g., "testing" matches "software testing")
            if user_prof == 0.0:
                for user_skill_name in user_skill_names:
                    if skill_normalized in user_skill_name or user_skill_name in skill_normalized:
                        user_prof = normalized_user_skills[user_skill_name].get('proficiency', 0.0)
                        if user_prof > 0:
                            print(f"   ⚡ Partial match: '{skill}' matched with user skill containing '{user_skill_name}' (prof: {user_prof:.2f})")
                            break
            
            market_demand = market_data.get('frequency', 0.5)  # Market demand/frequency
            
            gap_info = {
                'skill': skill,
                'has_skill': user_prof > 0,
                'market_demand': market_demand,
                'requirement_level': market_data.get('requirement_level', 'important'),
                'demand_percentage': int(market_demand * 100)
            }
            
            # Categorize based ONLY on:
            # 1. Does user HAVE the skill? (yes = strength, no = gap)
            # 2. Market DEMAND determines gap priority (critical/important/emerging)
            
            if user_prof > 0:
                # User HAS this skill - it's a STRENGTH!
                gap_info['priority'] = 'STRENGTH'
                gap_info['advantage'] = f"You have this skill ({gap_info['demand_percentage']}% market demand)"
                strengths.append(gap_info)
                print(f"   ✅ STRENGTH: {skill} (demand: {int(market_demand*100)}%)")
            else:
                # User DOESN'T have this skill - classify by DEMAND only
                if market_demand >= 0.70:
                    gap_info['priority'] = 'CRITICAL'
                    gap_info['impact'] = f"Missing! Required by {gap_info['demand_percentage']}% of jobs"
                    critical_gaps.append(gap_info)
                    print(f"   ❌ MISSING (Critical): {skill} (demand: {int(market_demand*100)}%)")
                elif market_demand >= 0.40:
                    gap_info['priority'] = 'IMPORTANT'
                    gap_info['impact'] = f"Missing - mentioned in {gap_info['demand_percentage']}% of jobs"
                    important_gaps.append(gap_info)
                    print(f"   ❌ MISSING (Important): {skill} (demand: {int(market_demand*100)}%)")
                else:
                    gap_info['priority'] = 'EMERGING'
                    gap_info['impact'] = f"Emerging skill ({gap_info['demand_percentage']}% of listings)"
                    emerging_gaps.append(gap_info)
        
        print(f"{'='*60}")
        print(f"   Strengths: {len(strengths)} | Critical gaps: {len(critical_gaps)} | Important: {len(important_gaps)} | Emerging: {len(emerging_gaps)}")
        print(f"{'='*60}\n")
        
        # Sort by MARKET DEMAND (ascending) - lowest demand first, highest demand last
        critical_gaps.sort(key=lambda x: x['market_demand'], reverse=False)
        important_gaps.sort(key=lambda x: x['market_demand'], reverse=False)
        emerging_gaps.sort(key=lambda x: x['market_demand'], reverse=False)
        strengths.sort(key=lambda x: x['market_demand'], reverse=False)


        
        # Calculate overall readiness
        readiness = self._calculate_readiness(user_skills, market_requirements)
        
        # Generate summary
        summary = {
            'total_gaps': len(critical_gaps) + len(important_gaps) + len(emerging_gaps),
            'critical_gap_count': len(critical_gaps),
            'important_gap_count': len(important_gaps),
            'emerging_gap_count': len(emerging_gaps),
            'strength_count': len(strengths),
            'overall_readiness_pct': readiness,
            'interpretation': self._interpret_readiness(readiness),
            'top_3_priorities': [g['skill'] for g in critical_gaps[:3]]
        }
        
        return {
            'critical_gaps': critical_gaps,
            'important_gaps': important_gaps,
            'emerging_gaps': emerging_gaps,
            'strengths': strengths,
            'overall_readiness': readiness,
            'summary': summary
        }
    
    def _calculate_readiness(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict]
    ) -> float:
        """Calculate overall job readiness percentage based on skill coverage."""
        if not market_requirements:
            return 0.0
        
        # Normalize user skills: lowercase, trim, and convert hyphens/underscores to spaces
        def normalize_skill(s):
            return s.lower().strip().replace('-', ' ').replace('_', ' ')
        
        normalized_user_skills = {normalize_skill(k): v for k, v in user_skills.items()}
        user_skill_names = list(normalized_user_skills.keys())
        
        total_weight = 0
        achieved_weight = 0
        
        for skill, market_data in market_requirements.items():
            # Weight by demand and criticality
            weight = market_data['frequency']
            
            if market_data['requirement_level'] == 'critical':
                weight *= 2.0
            elif market_data['requirement_level'] == 'important':
                weight *= 1.5
            
            total_weight += weight
            
            # Check if user HAS this skill (exact or partial match)
            skill_normalized = normalize_skill(skill)
            has_skill = skill_normalized in normalized_user_skills
            
            # Try partial matching if no exact match
            if not has_skill:
                for user_skill_name in user_skill_names:
                    if skill_normalized in user_skill_name or user_skill_name in skill_normalized:
                        has_skill = True
                        break
            
            # If user has the skill, they get full credit for this weight
            if has_skill:
                achieved_weight += weight
        
        readiness = (achieved_weight / total_weight) * 100 if total_weight > 0 else 0
        
        return round(readiness, 1)
    
    def _interpret_readiness(self, readiness: float) -> str:
        """Provide interpretation of readiness score."""
        if readiness >= 90:
            return "Excellent - Ready to apply immediately!"
        elif readiness >= 75:
            return "Good - Strong candidate with minor gaps"
        elif readiness >= 60:
            return "Fair - Nearly ready, 1-2 key gaps to address"
        elif readiness >= 45:
            return "Developing - Several important skills needed (3-4 months)"
        else:
            return "Early stage - Significant skill development needed (6+ months)"
    
    def get_missing_skills(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        min_frequency: float = 0.3
    ) -> List[str]:
        """
        Get list of skills user completely lacks that appear frequently in jobs.
        
        Args:
            min_frequency: Minimum frequency in market (0-1) to include skill
        
        Returns:
            List of skill names
        """
        missing = []
        
        # Normalize user skills: lowercase, trim, and convert hyphens/underscores to spaces
        def normalize_skill(s):
            return s.lower().strip().replace('-', ' ').replace('_', ' ')
        
        normalized_user_skills = {normalize_skill(k): v for k, v in user_skills.items()}
        
        for skill, market_data in market_requirements.items():
            skill_normalized = normalize_skill(skill)
            if market_data['frequency'] >= min_frequency:
                user_skill = normalized_user_skills.get(skill_normalized, {})
                if not user_skill or user_skill.get('proficiency', 0) < 0.1:
                    missing.append(skill)
        
        return missing