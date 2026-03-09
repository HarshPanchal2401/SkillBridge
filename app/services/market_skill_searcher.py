"""Market skill searcher using Tavily web search for real-time skill requirements."""
import os
import re
import json
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import Counter


class MarketSkillSearcher:
    """Search for current trending skills for any role using Tavily web search."""
    
    def __init__(self, tavily_api_key: Optional[str] = None):
        """
        Initialize with Tavily API key.
        
        Get free API key from: https://tavily.com
        """
        self.api_key = tavily_api_key or os.getenv('TAVILY_API_KEY')
        
        if not self.api_key:
            print("⚠️ MarketSkillSearcher: No Tavily API key. Will use fallback data.")
        
        self.tavily_url = "https://api.tavily.com/search"
        self.cache_dir = "app/data/skills_cache"
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Common technical skills to look for in search results
        self.known_skills = self._load_known_skills()
        
        # Alias mapping: alternate name -> canonical name
        # When both forms appear in text, they merge into one skill
        self.skill_aliases = {
            # Data Science & ML
            "nlp": "natural language processing",
            "ml": "machine learning",
            "dl": "deep learning",
            "cv": "computer vision",
            "sklearn": "scikit-learn",
            
            # Cloud & DevOps
            "k8s": "kubernetes",
            "gcp": "google cloud",
            "ci/cd": "continuous integration/continuous deployment",
            "ci cd": "continuous integration/continuous deployment",
            
            # Databases
            "postgres": "postgresql",
            
            # JavaScript ecosystem
            "nodejs": "node.js",
            "vuejs": "vue.js",
            "nextjs": "next.js",
            "nestjs": "nest.js",
            "express": "express.js",
            
            # Frameworks
            "springboot": "spring boot",
            "rails": "ruby on rails",
            "react-native": "react native",
            "tailwind": "tailwindcss",
            "tailwind css": "tailwindcss",
            
            # APIs
            "restful": "rest api",
            "rest": "rest api",
            
            # General
            "js": "javascript",
            "ts": "typescript",
            "vcs": "version control",
            "data viz": "data visualization",
        }
    
    def _load_known_skills(self) -> set:
        """Load comprehensive list of known technical skills."""
        skills = {
            # Programming languages
            "python", "javascript", "java", "c++", "c#", "ruby", "go", "rust", "swift", 
            "kotlin", "typescript", "php", "scala", "r", "matlab", "perl", "bash", "shell",
            "ai", "artificial intelligence", "genai", "generative ai",
            
            # Frontend
            "react", "angular", "vue", "vue.js", "next.js", "nuxt.js", "svelte", "jquery",
            "html", "css", "sass", "scss", "less", "tailwind", "tailwindcss", "bootstrap",
            "webpack", "vite", "redux", "mobx", "graphql", "apollo",
            
            # Backend
            "node.js", "express", "express.js", "fastapi", "flask", "django", "spring",
            "spring boot", "asp.net", ".net", "rails", "ruby on rails", "laravel",
            "nest.js", "nestjs", "gin", "fiber",
            
            # Databases
            "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
            "cassandra", "dynamodb", "firebase", "sqlite", "oracle", "sql server", "neo4j",
            
            # Cloud & DevOps
            "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s",
            "terraform", "ansible", "jenkins", "gitlab ci", "github actions", "ci/cd",
            "linux", "nginx", "apache", "prometheus", "grafana", "datadog",
            
            # Data Science & ML
            "machine learning", "deep learning", "tensorflow", "pytorch", "keras",
            "scikit-learn", "pandas", "numpy", "scipy", "matplotlib", "seaborn",
            "jupyter", "spark", "pyspark", "hadoop", "airflow", "mlops", "mlflow",
            "natural language processing", "nlp", "computer vision", "opencv",
            "huggingface", "transformers", "bert", "gpt", "llm",
            
            # Data tools
            "tableau", "power bi", "looker", "excel", "data visualization",
            "etl", "data warehouse", "snowflake", "databricks", "bigquery",
            "statistics", "a/b testing", "data analysis", "data engineering",
            
            # Mobile
            "react native", "flutter", "ios", "android", "swiftui", "jetpack compose",
            
            # Testing
            "jest", "pytest", "selenium", "cypress", "testing", "unit testing",
            "integration testing", "tdd", "bdd",
            
            # APIs & Protocols
            "rest", "rest api", "restful", "graphql", "grpc", "websocket", "soap",
            "microservices", "api design",
            
            # Security
            "security", "oauth", "jwt", "encryption", "penetration testing", "owasp",
            
            # Agile & Tools
            "agile", "scrum", "jira", "git", "version control", "github", "gitlab",
            
            # Soft skills (for completeness)
            "communication", "problem solving", "teamwork", "leadership"
        }
        return skills
    
    def search_role_skills(
        self,
        role_title: str,
        force_refresh: bool = False,
        max_skills: int = 30
    ) -> Dict:
        """
        Search the web for required skills for a given role.
        
        Args:
            role_title: Job role to search for (e.g., "Frontend Developer")
            force_refresh: If True, bypass cache and search fresh
            max_skills: Maximum number of skills to return
        
        Returns:
            {
                "role": "Frontend Developer",
                "skills": {
                    "skill_name": {
                        "frequency": 0.85,
                        "requirement_level": "critical",
                        "avg_proficiency_needed": 0.75,
                        "trending": True
                    }
                },
                "source": "web_search" | "fallback",
                "searched_at": "2026-02-02T22:30:00"
            }
        """
        print(f"🔍 Searching market skills for: {role_title}")
        
        # Check cache first (unless force refresh)
        cache_key = role_title.lower().replace(" ", "_").replace("/", "_")
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        if not force_refresh and os.path.exists(cache_file):
            # Check if cache is less than 24 hours old
            file_age = datetime.now().timestamp() - os.path.getmtime(cache_file)
            if file_age < 24 * 3600:  # 24 hours
                print(f"   📦 Loading cached skills (valid for {int(24 - file_age/3600)}h more)")
                try:
                    with open(cache_file, 'r') as f:
                        return json.load(f)
                except Exception as e:
                    print(f"   ⚠️ Cache read error: {e}")
        
        # If no API key, use fallback
        if not self.api_key:
            return self._get_fallback_skills(role_title)
        
        try:
            # Search for required skills
            skills_result = self._search_required_skills(role_title)
            
            # Search for trending skills
            trending_result = self._search_trending_skills(role_title)
            
            # Merge and analyze results
            merged_skills = self._merge_search_results(
                skills_result, 
                trending_result, 
                max_skills
            )
            
            result = {
                "role": role_title,
                "skills": merged_skills,
                "source": "web_search",
                "searched_at": datetime.now().isoformat(),
                "total_skills": len(merged_skills)
            }
            
            # Cache results
            with open(cache_file, 'w') as f:
                json.dump(result, f, indent=2)
            
            print(f"   ✅ Found {len(merged_skills)} skills from web search")
            return result
            
        except Exception as e:
            print(f"   ❌ Search error: {e}")
            return self._get_fallback_skills(role_title)
    
    def _search_required_skills(self, role_title: str) -> List[Dict]:
        """Search for required/must-have skills for a role."""
        query = f"{role_title} required skills must have qualifications 2025 2026"
        
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "advanced",
            "max_results": 10,
            "include_domains": [
                "linkedin.com",
                "indeed.com",
                "glassdoor.com",
                "stackoverflow.com",
                "medium.com",
                "dev.to"
            ]
        }
        
        response = requests.post(self.tavily_url, json=payload, timeout=20)
        
        if response.status_code == 200:
            return response.json().get('results', [])
        else:
            print(f"   ⚠️ Tavily API error: {response.status_code}")
            return []
    
    def _search_trending_skills(self, role_title: str) -> List[Dict]:
        """Search for trending/emerging skills for a role."""
        query = f"{role_title} trending skills in demand 2025 2026 emerging technologies"
        
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": 5
        }
        
        try:
            response = requests.post(self.tavily_url, json=payload, timeout=15)
            
            if response.status_code == 200:
                return response.json().get('results', [])
        except Exception:
            pass
        
        return []
    
    def _merge_search_results(
        self, 
        required_results: List[Dict],
        trending_results: List[Dict],
        max_skills: int
    ) -> Dict[str, Dict]:
        """
        Extract and merge skills from search results.
        
        Returns skills with frequency and requirement level.
        """
        skill_mentions = Counter()
        trending_skills = set()
        
        # Process required skills results
        for result in required_results:
            content = result.get('content', '') + ' ' + result.get('title', '')
            extracted = self._extract_skills_from_text(content)
            
            for skill in extracted:
                canonical = self._normalize_skill_name(skill)
                skill_mentions[canonical] += 2  # Weight required mentions higher
        
        # Process trending skills results
        for result in trending_results:
            content = result.get('content', '') + ' ' + result.get('title', '')
            extracted = self._extract_skills_from_text(content)
            
            for skill in extracted:
                canonical = self._normalize_skill_name(skill)
                skill_mentions[canonical] += 1
                trending_skills.add(canonical)
        
        # Convert to skills dictionary
        total_mentions = sum(skill_mentions.values()) or 1
        skills_dict = {}
        
        # Calculate max mentions for normalization
        max_count = skill_mentions.most_common(1)[0][1] if skill_mentions else 1
        
        # Get top skills sorted by demand (mention count)
        for skill, count in skill_mentions.most_common(max_skills):
            # Calculate demand as percentage of max mentions (0.0 to 1.0)
            demand = count / max_count
            
            # Classify based on DEMAND only:
            # ≥70% demand = Critical, 40-70% = Important, <40% = Emerging
            if demand >= 0.70:
                requirement_level = "critical"
            elif demand >= 0.40:
                requirement_level = "important"
            else:
                requirement_level = "emerging"
            
            skills_dict[skill] = {
                "frequency": round(demand, 2),  # This IS the demand
                "demand_percentage": int(demand * 100),
                "requirement_level": requirement_level,
                "trending": skill in trending_skills,
                "mention_count": count
            }
        
        return skills_dict
    
    def _normalize_skill_name(self, skill: str) -> str:
        """Normalize a skill name to its canonical form using the alias map."""
        return self.skill_aliases.get(skill, skill)
    
    def _extract_skills_from_text(self, text: str) -> List[str]:
        """Extract skill names from text using pattern matching."""
        text_lower = text.lower()
        found_skills = []
        
        # ONLY return known skills - don't extract random words
        for skill in self.known_skills:
            # Use word boundary matching for more accurate extraction
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text_lower):
                # Normalize to canonical name so synonyms merge
                canonical = self._normalize_skill_name(skill)
                if canonical not in found_skills:
                    found_skills.append(canonical)
        
        return found_skills

    
    def _get_fallback_skills(self, role_title: str) -> Dict:
        """Load skills from static role_requirements.json as fallback."""
        print(f"   📚 Using fallback skill data")
        
        roles_file = os.path.join("app", "data", "role_requirements.json")
        
        try:
            with open(roles_file, 'r') as f:
                roles_data = json.load(f)
        except Exception as e:
            print(f"   ⚠️ Could not load fallback: {e}")
            return {
                "role": role_title,
                "skills": {},
                "source": "fallback_empty",
                "searched_at": datetime.now().isoformat()
            }
        
        # Try to match role title to a key in the JSON
        role_lower = role_title.lower()
        matched_role = None
        
        # Role name mappings — maps keywords to role_requirements.json keys
        mappings = {
            # AI / ML
            "ai/ml": "ai_ml_engineer",
            "ai ml": "ai_ml_engineer",
            "ai engineer": "ai_ml_engineer",
            "ml engineer": "ai_ml_engineer",
            "machine learning engineer": "ai_ml_engineer",
            "machine learning": "machine_learning_engineer",
            "ml": "machine_learning_engineer",
            # Frontend
            "frontend": "frontend_developer",
            "front-end": "frontend_developer",
            "front end": "frontend_developer",
            # Backend
            "backend": "backend_developer",
            "back-end": "backend_developer",
            "back end": "backend_developer",
            # Full Stack
            "full stack": "fullstack_developer",
            "fullstack": "fullstack_developer",
            "full-stack": "fullstack_developer",
            # Data
            "data science": "data_science_analyst",
            "data scientist": "data_science_analyst",
            "data analyst": "data_science_analyst",
            "data engineer": "data_engineer",
            "data engineering": "data_engineer",
            # DevOps
            "devops": "devops_engineer",
            "dev ops": "devops_engineer",
            "site reliability": "devops_engineer",
            "sre": "devops_engineer",
            # Others
            "software engineer": "software_engineer",
            "software developer": "software_engineer",
            "healthcare data": "healthcare_data_analyst",
            "mobile": "mobile_developer",
            "android": "mobile_developer",
            "ios": "mobile_developer",
        }
        
        for key, value in mappings.items():
            if key in role_lower:
                matched_role = value
                break
        
        if matched_role and matched_role in roles_data:
            role_data = roles_data[matched_role]
            return {
                "role": role_title,
                "skills": role_data.get("skills", {}),
                "source": "fallback",
                "searched_at": datetime.now().isoformat(),
                "total_skills": len(role_data.get("skills", {}))
            }
        
        # If no match, return first available role as default
        if roles_data:
            first_role = list(roles_data.keys())[0]
            role_data = roles_data[first_role]
            return {
                "role": role_title,
                "skills": role_data.get("skills", {}),
                "source": "fallback_default",
                "searched_at": datetime.now().isoformat()
            }
        
        return {
            "role": role_title,
            "skills": {},
            "source": "fallback_empty",
            "searched_at": datetime.now().isoformat()
        }
    
    def clear_cache(self, role_title: Optional[str] = None):
        """
        Clear cached skill data.
        
        Args:
            role_title: If provided, clear only this role's cache. 
                       Otherwise, clear all cached data.
        """
        if role_title:
            cache_key = role_title.lower().replace(" ", "_").replace("/", "_")
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
            if os.path.exists(cache_file):
                os.remove(cache_file)
                print(f"🗑️ Cleared cache for: {role_title}")
        else:
            import glob
            for cache_file in glob.glob(os.path.join(self.cache_dir, "*.json")):
                os.remove(cache_file)
            print("🗑️ Cleared all skill cache")
