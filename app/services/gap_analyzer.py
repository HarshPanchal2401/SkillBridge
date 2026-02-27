"""Analyze skill gaps between user and market requirements."""
from typing import Dict, List, Tuple


class GapAnalyzer:
    """Compare user skills against market requirements."""
    
    def __init__(self):
        # Common technical skill synonyms to help matching
        # market_skill (canonical) -> [synonyms]
        self.default_synonyms = {
            "natural language processing": ["nlp", "text mining", "text analysis"],
            "machine learning": ["ml", "ai", "artificial intelligence"],
            "deep learning": ["dl", "neural networks", "cnn", "rnn"],
            "scikit-learn": ["sklearn", "sk-learn"],
            "tensorflow": ["tf"],
            "kubernetes": ["k8s", "kube"],
            "google cloud": ["gcp"],
            "postgresql": ["postgres", "psql"],
            "react": ["reactjs", "react.js"],
            "node.js": ["nodejs", "node"],
            "typescript": ["ts"],
            "javascript": ["js"],
            "continuous integration/continuous deployment": ["ci/cd", "ci cd", "cicd"],
            "version control": ["git", "github", "vcs"]
        }

    def _normalize_skill(self, s: str) -> str:
        """Normalize skill string for better matching."""
        if not s: return ""
        # Lowercase, replace hyphens/underscores with space, trim
        return s.lower().strip().replace('-', ' ').replace('_', ' ')

    def _matches_skill(self, target_skill: str, user_skill: str, synonym_map: Dict[str, List[str]] = None) -> bool:
        """
        Robustly check if target market skill matches a user skill.
        Handles exact matches, synonyms, and prevents short-word false positives.
        """
        t_norm = self._normalize_skill(target_skill)
        u_norm = self._normalize_skill(user_skill)
        
        # 1. Exact normalized match
        if t_norm == u_norm:
            return True
            
        # 2. Check synonyms (combined from provided map and defaults)
        full_synonyms = self.default_synonyms.copy()
        if synonym_map:
            # If map is canonical -> variants, we merge
            for canonical, variants in synonym_map.items():
                c_norm = self._normalize_skill(canonical)
                if c_norm not in full_synonyms:
                    full_synonyms[c_norm] = []
                full_synonyms[c_norm].extend([self._normalize_skill(v) for v in variants])

        # Check if t_norm is a synonym of u_norm OR vice versa
        for canonical, variants in full_synonyms.items():
            if (t_norm == canonical or t_norm in variants) and (u_norm == canonical or u_norm in variants):
                return True

        # 3. Robust partial matching (token-based / word boundaries)
        # Check if t_norm exists as a full word in u_norm or vice versa
        import re
        if re.search(r'\b' + re.escape(t_norm) + r'\b', u_norm) or \
           re.search(r'\b' + re.escape(u_norm) + r'\b', t_norm):
            return True
                
        return False

    def analyze_gaps(
        self,
        user_skills: Dict[str, Dict],  # {skill: {proficiency, confidence}}
        market_requirements: Dict[str, Dict],  # {skill: {frequency, requirement_level}}
        synonym_map: Dict[str, List[str]] = None
    ) -> Dict:
        critical_gaps = []
        important_gaps = []
        emerging_gaps = []
        strengths = []
        
        print(f"\n{'='*60}")
        print(f"🔍 SKILL GAP MATCHING")
        print(f"   User skills: {len(user_skills)}")
        print(f"   Market skills: {len(market_requirements)}")
        print(f"{'='*60}")
        
        for market_skill, market_data in market_requirements.items():
            user_prof = 0.0
            matched_user_skill = None
            
            # Find best matching user skill
            for user_skill_name, user_data in user_skills.items():
                if self._matches_skill(market_skill, user_skill_name, synonym_map):
                    user_prof = user_data.get('proficiency', 0.0)
                    matched_user_skill = user_skill_name
                    if user_prof > 0:
                        break
            
            market_demand = market_data.get('frequency', 0.5)
            avg_needed = market_data.get('avg_proficiency_needed', 0.6)
        
            gap_info = {
                'skill': market_skill,
                'matched_as': matched_user_skill if matched_user_skill else market_skill,
                'has_skill': user_prof > 0,
                'user_proficiency': round(user_prof, 2),
                'required_proficiency': avg_needed,
                'gap': round(max(0, avg_needed - user_prof), 2) if user_prof < avg_needed else 0,
                'market_demand': market_demand,
                'requirement_level': market_data.get('requirement_level', 'important'),
                'demand_percentage': int(market_demand * 100),
                'market_frequency': f"{int(market_demand * 100)}%"
            }
            
            if user_prof > 0:
                gap_info['priority'] = 'STRENGTH'
                gap_info['advantage'] = f"You have this skill ({gap_info['demand_percentage']}% market demand)"
                strengths.append(gap_info)
                print(f"   ✅ STRENGTH: {market_skill} (matched: {matched_user_skill})")
            else:
                if market_demand >= 0.70:
                    gap_info['priority'] = 'CRITICAL'
                    gap_info['impact'] = f"Missing! Required by {gap_info['demand_percentage']}% of jobs"
                    critical_gaps.append(gap_info)
                elif market_demand >= 0.40:
                    gap_info['priority'] = 'IMPORTANT'
                    gap_info['impact'] = f"Missing - mentioned in {gap_info['demand_percentage']}% of jobs"
                    important_gaps.append(gap_info)
                else:
                    gap_info['priority'] = 'EMERGING'
                    gap_info['impact'] = f"Emerging skill ({gap_info['demand_percentage']}% of listings)"
                    emerging_gaps.append(gap_info)
        
        # Sort and return
        critical_gaps.sort(key=lambda x: x['market_demand'], reverse=True)
        important_gaps.sort(key=lambda x: x['market_demand'], reverse=True)
        
        readiness = self._calculate_readiness(user_skills, market_requirements, synonym_map)
        
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
        market_requirements: Dict[str, Dict],
        synonym_map: Dict[str, List[str]] = None
    ) -> float:
        if not market_requirements: return 0.0
        
        total_weight = 0
        achieved_weight = 0
        
        for market_skill, market_data in market_requirements.items():
            weight = market_data.get('frequency', 0.5)
            if market_data.get('requirement_level') == 'critical': weight *= 2.0
            elif market_data.get('requirement_level') == 'important': weight *= 1.5
            
            total_weight += weight
            
            has_skill = False
            for user_skill_name in user_skills:
                if self._matches_skill(market_skill, user_skill_name, synonym_map):
                    has_skill = True
                    break
            
            if has_skill:
                achieved_weight += weight
        
        return round((achieved_weight / total_weight) * 100, 1) if total_weight > 0 else 0

    def _interpret_readiness(self, readiness: float) -> str:
        if readiness >= 90: return "Excellent - Ready to apply immediately!"
        if readiness >= 75: return "Good - Strong candidate with minor gaps"
        if readiness >= 60: return "Fair - Nearly ready, 1-2 key gaps to address"
        if readiness >= 45: return "Developing - Several important skills needed (3-4 months)"
        return "Early stage - Significant skill development needed (6+ months)"

    def get_missing_skills(
        self,
        user_skills: Dict[str, Dict],
        market_requirements: Dict[str, Dict],
        min_frequency: float = 0.3,
        synonym_map: Dict[str, List[str]] = None
    ) -> List[str]:
        missing = []
        for market_skill, market_data in market_requirements.items():
            if market_data.get('frequency', 0) >= min_frequency:
                has_skill = False
                for user_skill_name in user_skills:
                    if self._matches_skill(market_skill, user_skill_name, synonym_map):
                        has_skill = True
                        break
                if not has_skill:
                    missing.append(market_skill)
        return missing