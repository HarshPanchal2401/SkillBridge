"""Course recommender using Tavily web search."""
import os
import json
import requests
from typing import List, Dict, Optional
from datetime import datetime


class CourseRecommender:
    """Recommend courses using Tavily AI-powered web search."""
    
    def __init__(self, tavily_api_key: Optional[str] = None):
        """
        Initialize with Tavily API key.
        
        Get free API key from: https://tavily.com
        """
        self.api_key = tavily_api_key or os.getenv('TAVILY_API_KEY')
        
        if not self.api_key:
            print("⚠️ Warning: No Tavily API key provided. Course recommendations will be limited.")
        
        self.tavily_url = "https://api.tavily.com/search"
        self.cache_dir = "app/data/course_cache"
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def search_courses_for_skill(
        self,
        skill: str,
        max_results: int = 5
    ) -> List[Dict]:
        """
        Search for courses to learn a specific skill.
        
        Args:
            skill: Skill to learn (e.g., "SQL", "Machine Learning")
            max_results: Maximum number of courses to return
        
        Returns:
            List of course recommendations with details
        """
        print(f"🔍 Searching courses for skill: {skill}")
        
        # Check cache
        cache_file = os.path.join(self.cache_dir, f"{skill.replace(' ', '_').lower()}.json")
        
        if os.path.exists(cache_file):
            # Check if cache is less than 7 days old
            file_age = datetime.now().timestamp() - os.path.getmtime(cache_file)
            if file_age < 7 * 24 * 3600:  # 7 days
                print(f"   📦 Loading from cache")
                with open(cache_file, 'r') as f:
                    return json.load(f)
        
        if not self.api_key:
            return self._get_fallback_courses(skill, max_results)
        
        try:
            # Search query optimized for course results
            query = f"best online courses to learn {skill} for beginners Coursera edX Udemy"
            
            # Tavily API request
            payload = {
                "api_key": self.api_key,
                "query": query,
                "search_depth": "advanced",
                "max_results": 10,
                "include_domains": [
                    "coursera.org",
                    "edx.org",
                    "udemy.com",
                    "linkedin.com/learning",
                    "udacity.com",
                    "pluralsight.com"
                ]
            }
            
            response = requests.post(self.tavily_url, json=payload, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                courses = self._parse_tavily_results(data, skill, max_results)
                
                # Cache results
                with open(cache_file, 'w') as f:
                    json.dump(courses, f, indent=2)
                
                print(f"   ✅ Found {len(courses)} courses")
                return courses
            else:
                print(f"   ⚠️ Tavily API error: {response.status_code}")
                return self._get_fallback_courses(skill, max_results)
        
        except Exception as e:
            print(f"   ❌ Error searching courses: {e}")
            return self._get_fallback_courses(skill, max_results)
    
    def _parse_tavily_results(self, tavily_data: Dict, skill: str, max_results: int) -> List[Dict]:
        """Parse Tavily search results into course recommendations."""
        courses = []
        results = tavily_data.get('results', [])
        
        for result in results[:max_results]:
            # Extract course info from search result
            title = result.get('title', '')
            url = result.get('url', '')
            content = result.get('content', '')
            
            # Determine platform from URL
            platform = 'Unknown'
            if 'coursera.org' in url:
                platform = 'Coursera'
            elif 'edx.org' in url:
                platform = 'edX'
            elif 'udemy.com' in url:
                platform = 'Udemy'
            elif 'linkedin.com/learning' in url:
                platform = 'LinkedIn Learning'
            elif 'udacity.com' in url:
                platform = 'Udacity'
            elif 'pluralsight.com' in url:
                platform = 'Pluralsight'
            
            # Estimate course details from content
            rating = self._extract_rating(content)
            duration = self._extract_duration(content)
            
            courses.append({
                'course_name': title,
                'platform': platform,
                'url': url,
                'description': content[:200] + '...' if len(content) > 200 else content,
                'skill_targeted': skill,
                'rating': rating,
                'duration': duration,
                'cost': self._estimate_cost(platform),
                'source': 'tavily_search',
                'relevance_score': result.get('score', 0.5)
            })
        
        return courses
    
    def _extract_rating(self, text: str) -> Optional[float]:
        """Try to extract rating from text."""
        import re
        
        # Look for patterns like "4.7", "4.5/5", "4.8 stars"
        patterns = [
            r'(\d\.\d)\s*(?:out of 5|/5|stars?)',
            r'rating:?\s*(\d\.\d)',
            r'(\d\.\d)\s*star'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except:
                    pass
        
        return None
    
    def _extract_duration(self, text: str) -> Optional[str]:
        """Try to extract duration from text."""
        import re
        
        # Look for patterns like "4 weeks", "20 hours", "3 months"
        patterns = [
            r'(\d+\s*(?:weeks?|months?|hours?))',
            r'duration:?\s*(\d+\s*\w+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _estimate_cost(self, platform: str) -> str:
        """Estimate typical cost for platform."""
        cost_map = {
            'Coursera': 'Free (audit) / $49+ (certificate)',
            'edX': 'Free (audit) / $50-300 (certificate)',
            'Udemy': '$10-200 (one-time)',
            'LinkedIn Learning': '$29.99/month (subscription)',
            'Udacity': '$399/month (subscription)',
            'Pluralsight': '$29/month (subscription)',
            'Unknown': 'Varies'
        }
        
        return cost_map.get(platform, 'Varies')
    
    def _get_fallback_courses(self, skill: str, max_results: int) -> List[Dict]:
        """
        Fallback: Return curated courses from external JSON file when Tavily is unavailable.
        Courses are loaded from app/data/fallback_courses.json for easy maintenance.
        """
        print(f"   📚 Using fallback course database")
        
        # Load courses from external JSON file
        fallback_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'fallback_courses.json')
        
        try:
            if os.path.exists(fallback_file):
                with open(fallback_file, 'r', encoding='utf-8') as f:
                    fallback_db = json.load(f)
            else:
                print(f"   ⚠️ Fallback courses file not found, using empty database")
                fallback_db = {}
        except Exception as e:
            print(f"   ⚠️ Error loading fallback courses: {e}")
            fallback_db = {}
        
        # Normalize skill name
        skill_lower = skill.lower().replace(' ', '-')
        
        # Try exact match
        if skill_lower in fallback_db:
            courses = fallback_db[skill_lower][:max_results]
        else:
            # Try partial match
            courses = []
            for key, course_list in fallback_db.items():
                if skill_lower in key or key in skill_lower:
                    courses.extend(course_list[:max_results])
                    break
        
        # Add skill_targeted field and metadata
        result_courses = []
        for course in courses:
            course_copy = course.copy()
            course_copy['skill_targeted'] = skill
            course_copy['source'] = 'fallback_database'
            course_copy['relevance_score'] = 0.8
            result_courses.append(course_copy)
        
        return result_courses[:max_results]
    
    def recommend_for_gaps(
        self,
        gap_analysis: Dict,
        max_per_skill: int = 3,
        prioritize: str = 'critical'
    ) -> Dict[str, List[Dict]]:
        """
        Recommend courses for all gaps in gap analysis.
        
        Args:
            gap_analysis: Output from GapAnalyzer.analyze_gaps()
            max_per_skill: Max courses to recommend per skill
            prioritize: 'critical', 'important', or 'all'
        
        Returns:
            {
                'critical_gaps': {skill: [courses]},
                'important_gaps': {skill: [courses]},
                'emerging_gaps': {skill: [courses]},
                'summary': {...}
            }
        """
        recommendations = {
            'critical_gaps': {},
            'important_gaps': {},
            'emerging_gaps': {},
            'summary': {
                'total_skills': 0,
                'total_courses': 0,
                'estimated_time': '0 months',
                'estimated_cost': '$0'
            }
        }
        
        total_courses = 0
        
        # Recommend for critical gaps
        if prioritize in ['critical', 'all']:
            print("🎯 Finding courses for CRITICAL gaps...")
            for gap in gap_analysis['critical_gaps']:
                skill = gap['skill']
                courses = self.search_courses_for_skill(skill, max_per_skill)
                recommendations['critical_gaps'][skill] = courses
                total_courses += len(courses)
        
        # Recommend for important gaps
        if prioritize in ['important', 'all']:
            print("📚 Finding courses for IMPORTANT gaps...")
            for gap in gap_analysis['important_gaps'][:5]:  # Limit to top 5
                skill = gap['skill']
                courses = self.search_courses_for_skill(skill, max_per_skill)
                recommendations['important_gaps'][skill] = courses
                total_courses += len(courses)
        
        # Recommend for emerging gaps
        if prioritize == 'all':
            print("🚀 Finding courses for EMERGING skills...")
            for gap in gap_analysis['emerging_gaps'][:3]:  # Limit to top 3
                skill = gap['skill']
                courses = self.search_courses_for_skill(skill, max_per_skill)
                recommendations['emerging_gaps'][skill] = courses
                total_courses += len(courses)
        
        # Calculate summary
        total_skills = (
            len(recommendations['critical_gaps']) +
            len(recommendations['important_gaps']) +
            len(recommendations['emerging_gaps'])
        )
        
        recommendations['summary'] = {
            'total_skills': total_skills,
            'total_courses': total_courses,
            'estimated_time': self._estimate_total_time(recommendations),
            'estimated_cost_range': '$0 - $500',
            'recommendation': self._generate_recommendation(gap_analysis, total_skills)
        }
        
        return recommendations
    
    def _estimate_total_time(self, recommendations: Dict) -> str:
        """Estimate total learning time."""
        # Rough estimate: 1 month per critical skill, 2 weeks per important skill
        critical_count = len(recommendations['critical_gaps'])
        important_count = len(recommendations['important_gaps'])
        
        months = critical_count * 1 + important_count * 0.5
        
        if months < 1:
            return "2-4 weeks"
        elif months < 2:
            return "1-2 months"
        elif months < 4:
            return "2-4 months"
        elif months < 6:
            return "4-6 months"
        else:
            return "6+ months"
    
    def _generate_recommendation(self, gap_analysis: Dict, total_skills: int) -> str:
        """Generate learning recommendation."""
        critical_count = len(gap_analysis['critical_gaps'])
        
        if critical_count == 0:
            return "You're job-ready! Focus on emerging skills to stay ahead."
        elif critical_count <= 2:
            return f"Focus on {critical_count} critical skill(s) first. You'll be ready in 1-2 months."
        elif critical_count <= 4:
            return f"Prioritize top 2 critical skills now. Address remaining {critical_count - 2} next."
        else:
            return f"Start with SQL and one domain skill. Build progressively over 4-6 months."