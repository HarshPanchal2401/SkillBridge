"""GitHub repository analyzer to extract skills from public repos."""
import os
import re
import json
import requests
from typing import List, Dict, Optional, Tuple
from datetime import datetime

from app.services.enhanced_skill_extractor import enhanced_extractor


class GitHubAnalyzer:
    """Fetch and analyze GitHub repositories to extract skills."""
    
    def __init__(self, skill_extractor):
        """Initialize with skill extractor for skill matching."""
        self.skill_extractor = skill_extractor
        self.enhanced = enhanced_extractor  # Use enhanced extractor
        self.cache_dir = "app/data/github_cache"
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def extract_username_from_url(self, github_url: str) -> Optional[str]:
        """Extract GitHub username from URL."""
        if not github_url:
            return None
        
        # Pattern: https://github.com/username
        pattern = r'github\.com/([^/\s]+)'
        match = re.search(pattern, github_url)
        
        if match:
            return match.group(1)
        return None
    
    def fetch_user_repos(self, username: str, max_repos: int = 10) -> List[Dict]:
        """
        Fetch public repositories for a GitHub user.
        Uses GitHub REST API (no auth required for public repos).
        """
        # Check cache first
        cache_file = os.path.join(self.cache_dir, f"{username}_repos.json")
        
        if os.path.exists(cache_file):
            # Check if cache is less than 7 days old
            file_age = datetime.now().timestamp() - os.path.getmtime(cache_file)
            if file_age < 7 * 24 * 3600:  # 7 days
                print(f"📦 Loading GitHub repos from cache for {username}")
                with open(cache_file, 'r') as f:
                    return json.load(f)
        
        print(f"🔍 Fetching GitHub repos for {username}...")
        
        try:
            # GitHub API endpoint
            url = f"https://api.github.com/users/{username}/repos"
            
            # Parameters
            params = {
                'sort': 'updated',
                'per_page': max_repos,
                'type': 'owner'  # Only repos owned by user
            }
            
            # Headers (User-Agent required by GitHub)
            headers = {
                'User-Agent': 'Healthcare-Skill-Intelligence-App',
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                repos = response.json()
                
                # Cache the response
                with open(cache_file, 'w') as f:
                    json.dump(repos, f, indent=2)
                
                print(f"✅ Fetched {len(repos)} repositories")
                return repos
            
            elif response.status_code == 404:
                print(f"❌ GitHub user '{username}' not found")
                return []
            
            else:
                print(f"❌ GitHub API error: {response.status_code}")
                return []
        
        except Exception as e:
            print(f"❌ Error fetching GitHub repos: {e}")
            return []
    
    def fetch_readme(self, username: str, repo_name: str) -> Optional[str]:
        """Fetch README content from a repository."""
        print(f"   📄 Fetching README for {repo_name}...")
        
        try:
            # Try common README filenames
            readme_names = ['README.md', 'README.MD', 'Readme.md', 'readme.md', 'README.txt', 'README']
            
            for readme_name in readme_names:
                url = f"https://raw.githubusercontent.com/{username}/{repo_name}/main/{readme_name}"
                response = requests.get(url, timeout=10)
                
                if response.status_code == 200:
                    return response.text
                
                # Try 'master' branch if 'main' doesn't work
                url = f"https://raw.githubusercontent.com/{username}/{repo_name}/master/{readme_name}"
                response = requests.get(url, timeout=10)
                
                if response.status_code == 200:
                    return response.text
            
            print(f"   ⚠️ README not found for {repo_name}")
            return None
        
        except Exception as e:
            print(f"   ❌ Error fetching README: {e}")
            return None
    
    def fetch_repo_languages(self, username: str, repo_name: str) -> Dict[str, int]:
        """Fetch programming languages used in a repository."""
        try:
            url = f"https://api.github.com/repos/{username}/{repo_name}/languages"
            headers = {
                'User-Agent': 'Healthcare-Skill-Intelligence-App',
                'Accept': 'application/vnd.github.v3+json'
            }
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                return response.json()  # {language: bytes}
            return {}
        except Exception as e:
            print(f"   ⚠️ Error fetching languages: {e}")
            return {}
    
    def extract_skills_from_repo(
        self, 
        repo_data: Dict, 
        readme_content: Optional[str] = None,
        languages: Dict[str, int] = None
    ) -> Tuple[Dict[str, int], Dict]:
        """
        Extract skills from repository using enhanced extractor.
        
        Returns:
            (skills_with_confidence, metadata)
            skills_with_confidence: {skill_name: confidence_score (0-100)}
        """
        metadata = {
            'repo_name': repo_data.get('name', ''),
            'description': repo_data.get('description', ''),
            'language': repo_data.get('language', ''),
            'topics': repo_data.get('topics', []),
            'stars': repo_data.get('stargazers_count', 0),
            'forks': repo_data.get('forks_count', 0)
        }
        
        # Use enhanced extractor for better skill inference
        skills_with_confidence = self.enhanced.extract_from_github(
            languages=languages or {metadata['language']: 10000} if metadata['language'] else {},
            readme_content=readme_content or '',
            topics=metadata['topics'],
            repo_name=metadata['repo_name'],
            description=metadata['description'] or ''
        )
        
        # Boost confidence based on stars and forks
        if metadata['stars'] > 50:
            skills_with_confidence = {k: min(100, v + 15) for k, v in skills_with_confidence.items()}
        elif metadata['stars'] > 10:
            skills_with_confidence = {k: min(100, v + 8) for k, v in skills_with_confidence.items()}
        
        if metadata['forks'] > 10:
            skills_with_confidence = {k: min(100, v + 5) for k, v in skills_with_confidence.items()}
        
        return (skills_with_confidence, metadata)
    
    def analyze_github_profile(
        self, 
        github_url: str, 
        max_repos: int = 10,
        fetch_readmes: bool = True
    ) -> Dict:
        """
        Complete GitHub profile analysis.
        
        Returns:
            {
                'username': str,
                'total_repos': int,
                'repos_analyzed': int,
                'skills_found': {skill: (proficiency, confidence)},
                'repo_details': [...]
            }
        """
        username = self.extract_username_from_url(github_url)
        
        if not username:
            return {
                'error': 'Invalid GitHub URL',
                'username': None,
                'skills_found': {}
            }
        
        # Fetch repositories
        repos = self.fetch_user_repos(username, max_repos)
        
        if not repos:
            return {
                'username': username,
                'total_repos': 0,
                'repos_analyzed': 0,
                'skills_found': {},
                'repo_details': []
            }
        
        # Analyze each repository
        all_skills = {}  # {skill: confidence_score (0-100)}
        repo_details = []
        
        for repo in repos:
            repo_name = repo.get('name', 'unknown')
            
            # Fetch README if enabled
            readme_content = None
            if fetch_readmes:
                readme_content = self.fetch_readme(username, repo_name)
            
            # Fetch languages for this repo (for better skill inference)
            languages = self.fetch_repo_languages(username, repo_name)
            
            # Extract skills with confidence scores using enhanced extractor
            skills_with_conf, metadata = self.extract_skills_from_repo(repo, readme_content, languages)
            
            # Merge skills (keep max confidence if skill appears in multiple repos)
            for skill, conf in skills_with_conf.items():
                if skill not in all_skills:
                    all_skills[skill] = conf
                else:
                    all_skills[skill] = max(all_skills[skill], conf)
            
            repo_details.append({
                'name': repo_name,
                'description': metadata['description'],
                'language': metadata['language'],
                'stars': metadata['stars'],
                'forks': metadata['forks'],
                'skills_found': list(skills_with_conf.keys()),
                'url': repo.get('html_url', '')
            })
            
            print(f"   ✅ {repo_name}: {len(skills_with_conf)} skills found")
        
        # Convert confidence (0-100) to proficiency format for backward compatibility
        # skills_found: {skill: (proficiency 0-1, confidence 0-1)}
        skills_formatted = {}
        for skill, conf in all_skills.items():
            proficiency = conf / 100.0  # Convert 0-100 to 0-1
            confidence = min(0.95, 0.5 + (conf / 200.0))  # Scale confidence
            skills_formatted[skill] = (proficiency, confidence)
        
        return {
            'username': username,
            'total_repos': len(repos),
            'repos_analyzed': len(repo_details),
            'skills_found': skills_formatted,
            'repo_details': repo_details
        }