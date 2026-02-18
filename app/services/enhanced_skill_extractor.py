"""
Enhanced Skill Extraction Engine

Extracts technical skills from GitHub and LinkedIn with:
- Skill normalization (py → Python, tf → TensorFlow)
- GitHub code inference from languages and README
- LinkedIn profile text parsing
- Frequency-based confidence scoring (0-100)
- Soft skill and vague term filtering
"""

from typing import Dict, List, Tuple, Set
import re
from collections import Counter


class EnhancedSkillExtractor:
    """
    Production-grade skill extraction engine.
    
    Rules:
    - Extract ONLY real technical and domain skills
    - Normalize skill names
    - Remove duplicates, soft skills, vague terms
    - Assign confidence score (0-100) based on frequency and usage
    - No hallucination
    """
    
    def __init__(self):
        # Comprehensive skill normalization map
        self.skill_normalization = {
            # Programming Languages
            'py': 'python', 'python3': 'python', 'python2': 'python',
            'js': 'javascript', 'node': 'node.js', 'nodejs': 'node.js',
            'ts': 'typescript', 'tsx': 'typescript', 'jsx': 'javascript',
            'rb': 'ruby', 'cpp': 'c++', 'c++11': 'c++', 'c++14': 'c++', 'c++17': 'c++',
            'csharp': 'c#', 'c-sharp': 'c#', 'golang': 'go', 'rs': 'rust',
            'kt': 'kotlin', 'sh': 'bash', 'shell': 'bash', 'zsh': 'bash',
            
            # Frameworks
            'tf': 'tensorflow', 'pytorch': 'pytorch', 'torch': 'pytorch',
            'sklearn': 'scikit-learn', 'sk-learn': 'scikit-learn',
            'np': 'numpy', 'pd': 'pandas', 'plt': 'matplotlib',
            'nextjs': 'next.js', 'nuxtjs': 'nuxt.js', 'vuejs': 'vue.js',
            'reactjs': 'react', 'react.js': 'react', 'angular': 'angular',
            'expressjs': 'express.js', 'express': 'express.js',
            'fastapi': 'fastapi', 'flask': 'flask', 'django': 'django',
            'spring': 'spring boot', 'springboot': 'spring boot',
            
            # Databases
            'postgres': 'postgresql', 'psql': 'postgresql', 'pg': 'postgresql',
            'mongo': 'mongodb', 'mysql': 'mysql', 'mssql': 'sql server',
            'sqlite3': 'sqlite', 'dynamodb': 'dynamodb', 'redis': 'redis',
            
            # Cloud & DevOps
            'aws': 'aws', 'gcp': 'google cloud', 'azure': 'azure',
            'k8s': 'kubernetes', 'kube': 'kubernetes', 'docker-compose': 'docker',
            'ci/cd': 'ci/cd', 'cicd': 'ci/cd', 'jenkins': 'jenkins',
            'gh-actions': 'github actions', 'github-actions': 'github actions',
            'tf': 'terraform', 'cloudformation': 'aws cloudformation',
            
            # Data Science / ML
            'ml': 'machine learning', 'dl': 'deep learning', 'ai': 'artificial intelligence',
            'nlp': 'natural language processing', 'cv': 'computer vision',
            'bert': 'bert', 'gpt': 'gpt', 'llm': 'large language models',
            'huggingface': 'hugging face', 'hf': 'hugging face',
            'xgboost': 'xgboost', 'lgbm': 'lightgbm',
            
            # Tools
            'git': 'git', 'github': 'github', 'gitlab': 'gitlab',
            'vscode': 'vs code', 'vim': 'vim', 'jupyter': 'jupyter notebook',
            'postman': 'postman', 'swagger': 'swagger', 
            
            # Healthcare specific
            'ehr': 'ehr systems', 'emr': 'emr systems', 'hl7': 'hl7',
            'fhir': 'fhir', 'dicom': 'dicom', 'hipaa': 'hipaa compliance',
        }
        
        # GitHub language to skill mapping
        self.github_language_skills = {
            'python': ['python'],
            'javascript': ['javascript'],
            'typescript': ['typescript', 'javascript'],
            'java': ['java'],
            'c++': ['c++'],
            'c#': ['c#', '.net'],
            'go': ['go'],
            'rust': ['rust'],
            'ruby': ['ruby'],
            'php': ['php'],
            'swift': ['swift', 'ios development'],
            'kotlin': ['kotlin', 'android development'],
            'dart': ['dart', 'flutter'],
            'scala': ['scala'],
            'r': ['r', 'statistical analysis'],
            'jupyter notebook': ['python', 'data science', 'jupyter notebook'],
            'html': ['html', 'web development'],
            'css': ['css', 'web development'],
            'scss': ['sass', 'css'],
            'shell': ['bash', 'shell scripting'],
            'dockerfile': ['docker'],
            'hcl': ['terraform', 'infrastructure as code'],
        }
        
        # Patterns to infer skills from README content
        self.readme_skill_patterns = {
            r'\bpip install\b': 'python',
            r'\bnpm install\b': 'node.js',
            r'\byarn add\b': 'node.js',
            r'\bcargo build\b': 'rust',
            r'\bgo get\b': 'go',
            r'\bdocker-compose\b': 'docker',
            r'\bkubectl\b': 'kubernetes',
            r'\baws\s+\w+\b': 'aws',
            r'\bgcloud\b': 'google cloud',
            r'\bazure\b': 'azure',
            r'\bfrom\s+tensorflow\b': 'tensorflow',
            r'\bimport\s+torch\b': 'pytorch',
            r'\bimport\s+pandas\b': 'pandas',
            r'\bimport\s+numpy\b': 'numpy',
            r'\bfrom\s+sklearn\b': 'scikit-learn',
            r'\bfrom\s+fastapi\b': 'fastapi',
            r'\bfrom\s+flask\b': 'flask',
            r'\bfrom\s+django\b': 'django',
            r'\bReact\b': 'react',
            r'\bVue\.js\b': 'vue.js',
            r'\bAngular\b': 'angular',
            r'\bNext\.js\b': 'next.js',
            r'\bMongoDB\b': 'mongodb',
            r'\bPostgreSQL\b': 'postgresql',
            r'\bMySQL\b': 'mysql',
            r'\bRedis\b': 'redis',
            r'\bElasticsearch\b': 'elasticsearch',
            r'\bGraphQL\b': 'graphql',
            r'\bREST\s*API\b': 'rest api',
            r'\bJWT\b': 'jwt authentication',
            r'\bOAuth\b': 'oauth',
            r'\bCI/CD\b': 'ci/cd',
            r'\bGitHub Actions\b': 'github actions',
            r'\bJenkins\b': 'jenkins',
            r'\bTerraform\b': 'terraform',
            r'\bAnsible\b': 'ansible',
        }
        
        # Soft skills and vague terms to filter out
        self.excluded_terms = {
            # Soft skills
            'communication', 'leadership', 'teamwork', 'collaboration',
            'problem solving', 'problem-solving', 'critical thinking',
            'time management', 'adaptability', 'creativity', 'flexibility',
            'attention to detail', 'self-motivated', 'proactive',
            'interpersonal', 'negotiation', 'presentation', 'public speaking',
            'mentoring', 'coaching', 'decision making', 'strategic thinking',
            # Vague terms
            'experience', 'knowledge', 'skills', 'proficient', 'expert',
            'advanced', 'beginner', 'intermediate', 'familiar', 'exposure',
            'understanding', 'ability', 'capable', 'competent', 'working',
            'learning', 'studying', 'interested', 'passionate', 'enthusiastic',
            'various', 'multiple', 'several', 'many', 'some', 'other',
            'etc', 'including', 'such as', 'like', 'similar',
            'development', 'developer', 'engineer', 'engineering', 'programming',
            'software', 'application', 'system', 'project', 'code', 'coding',
        }
        
        # Minimum confidence threshold
        self.min_confidence = 20
    
    def normalize_skill(self, skill: str) -> str:
        """Normalize skill name to canonical form."""
        skill = skill.lower().strip()
        skill = re.sub(r'[^\w\s\-\.\+\#]', '', skill)
        skill = re.sub(r'\s+', ' ', skill)
        
        # Check normalization map
        if skill in self.skill_normalization:
            return self.skill_normalization[skill]
        
        # Handle common variations
        if skill.endswith('.js') or skill.endswith('js'):
            base = skill.replace('.js', '').replace('js', '')
            if base in self.skill_normalization:
                return self.skill_normalization[base]
        
        return skill
    
    def is_valid_skill(self, skill: str) -> bool:
        """Check if skill is valid (not soft skill or vague term)."""
        skill_lower = skill.lower()
        
        # Check against excluded terms
        if skill_lower in self.excluded_terms:
            return False
        
        # Too short
        if len(skill_lower) < 2:
            return False
        
        # Only numbers or special chars
        if not re.search(r'[a-zA-Z]', skill):
            return False
        
        # Common non-skill words
        if skill_lower in {'the', 'and', 'for', 'with', 'using', 'used', 'use', 'to', 'in', 'on', 'a', 'an'}:
            return False
        
        return True
    
    def extract_from_github(
        self, 
        languages: Dict[str, int],
        readme_content: str,
        topics: List[str],
        repo_name: str = "",
        description: str = ""
    ) -> Dict[str, int]:
        """
        Extract skills from GitHub repository data.
        
        Args:
            languages: Dict of {language: bytes_of_code}
            readme_content: README file content
            topics: Repository topics/tags
            repo_name: Repository name
            description: Repository description
            
        Returns:
            Dict of {skill: confidence_score}
        """
        skill_counts = Counter()
        
        # 1. Extract from languages (weighted by code volume)
        total_bytes = sum(languages.values()) or 1
        for lang, bytes_count in languages.items():
            lang_lower = lang.lower()
            if lang_lower in self.github_language_skills:
                weight = min(100, int((bytes_count / total_bytes) * 100) + 30)
                for skill in self.github_language_skills[lang_lower]:
                    skill_counts[self.normalize_skill(skill)] += weight
        
        # 2. Extract from topics (high confidence - explicit tags)
        for topic in topics:
            normalized = self.normalize_skill(topic)
            if self.is_valid_skill(normalized):
                skill_counts[normalized] += 60
        
        # 3. Infer from README patterns
        readme_lower = readme_content.lower()
        for pattern, skill in self.readme_skill_patterns.items():
            if re.search(pattern, readme_content, re.IGNORECASE):
                skill_counts[self.normalize_skill(skill)] += 40
        
        # 4. Extract explicit mentions in README
        readme_skills = self._extract_skills_from_text(readme_content)
        for skill in readme_skills:
            skill_counts[self.normalize_skill(skill)] += 30
        
        # 5. Extract from repo name and description
        if repo_name:
            name_skills = self._extract_skills_from_text(repo_name)
            for skill in name_skills:
                skill_counts[self.normalize_skill(skill)] += 25
        
        if description:
            desc_skills = self._extract_skills_from_text(description)
            for skill in desc_skills:
                skill_counts[self.normalize_skill(skill)] += 25
        
        # Filter and normalize confidence to 0-100
        result = {}
        for skill, count in skill_counts.items():
            if self.is_valid_skill(skill) and count >= self.min_confidence:
                result[skill] = min(100, count)
        
        return result
    
    def extract_from_linkedin(self, profile_text: str) -> Dict[str, int]:
        """
        Extract skills from LinkedIn profile text.
        
        Args:
            profile_text: Combined text from About, Experience, Skills sections
            
        Returns:
            Dict of {skill: confidence_score}
        """
        skill_counts = Counter()
        
        # 1. Extract explicit skills (from Skills section)
        skills_section = self._extract_section(profile_text, 'skills')
        if skills_section:
            explicit_skills = self._extract_skills_from_text(skills_section)
            for skill in explicit_skills:
                normalized = self.normalize_skill(skill)
                if self.is_valid_skill(normalized):
                    skill_counts[normalized] += 80  # High confidence for listed skills
        
        # 2. Extract from experience descriptions
        experience_section = self._extract_section(profile_text, 'experience')
        if experience_section:
            exp_skills = self._extract_skills_from_text(experience_section)
            for skill in exp_skills:
                normalized = self.normalize_skill(skill)
                if self.is_valid_skill(normalized):
                    skill_counts[normalized] += 50  # Medium-high for real usage
        
        # 3. Extract from About section
        about_section = self._extract_section(profile_text, 'about')
        if about_section:
            about_skills = self._extract_skills_from_text(about_section)
            for skill in about_skills:
                normalized = self.normalize_skill(skill)
                if self.is_valid_skill(normalized):
                    skill_counts[normalized] += 30  # Lower for self-description
        
        # 4. General extraction if no sections found
        if not any([skills_section, experience_section, about_section]):
            all_skills = self._extract_skills_from_text(profile_text)
            for skill in all_skills:
                normalized = self.normalize_skill(skill)
                if self.is_valid_skill(normalized):
                    skill_counts[normalized] += 40
        
        # Filter and normalize
        result = {}
        for skill, count in skill_counts.items():
            if count >= self.min_confidence:
                result[skill] = min(100, count)
        
        return result
    
    def _extract_section(self, text: str, section_name: str) -> str:
        """Extract a section from profile text."""
        patterns = {
            'skills': [r'skills?\s*[:\-]?\s*(.+?)(?=experience|education|about|$)', 
                      r'technical skills?\s*[:\-]?\s*(.+?)(?=experience|education|about|$)'],
            'experience': [r'experience\s*[:\-]?\s*(.+?)(?=skills|education|about|$)',
                          r'work history\s*[:\-]?\s*(.+?)(?=skills|education|about|$)'],
            'about': [r'about\s*[:\-]?\s*(.+?)(?=skills|experience|education|$)',
                     r'summary\s*[:\-]?\s*(.+?)(?=skills|experience|education|$)']
        }
        
        for pattern in patterns.get(section_name, []):
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        
        return ""
    
    def _extract_skills_from_text(self, text: str) -> List[str]:
        """Extract potential skill keywords from text."""
        if not text:
            return []
        
        # Common technical skill patterns
        skill_patterns = [
            r'\b(python|java|javascript|typescript|c\+\+|c#|go|rust|ruby|php|swift|kotlin)\b',
            r'\b(react|angular|vue|next\.js|node\.js|express|django|flask|fastapi|spring)\b',
            r'\b(aws|azure|gcp|docker|kubernetes|terraform|jenkins|github actions)\b',
            r'\b(postgresql|mysql|mongodb|redis|elasticsearch|dynamodb|sql)\b',
            r'\b(tensorflow|pytorch|scikit-learn|pandas|numpy|keras|opencv)\b',
            r'\b(machine learning|deep learning|nlp|computer vision|data science)\b',
            r'\b(git|linux|bash|rest api|graphql|microservices|ci/cd)\b',
            r'\b(html|css|sass|tailwind|bootstrap|webpack|vite)\b',
            r'\b(jwt|oauth|authentication|authorization|security)\b',
            r'\b(agile|scrum|devops|cloud computing|serverless)\b',
            r'\b(hl7|fhir|dicom|hipaa|ehr|emr|medical imaging)\b',
        ]
        
        found_skills = []
        text_lower = text.lower()
        
        for pattern in skill_patterns:
            matches = re.findall(pattern, text_lower)
            found_skills.extend(matches)
        
        # Also look for comma/bullet separated lists
        list_items = re.findall(r'(?:^|\n|\•|\*|\-)\s*([A-Za-z][A-Za-z0-9\.\+\#\s]{1,30}?)(?:,|\n|$)', text)
        for item in list_items:
            item = item.strip()
            if len(item) > 1 and len(item) < 30:
                found_skills.append(item.lower())
        
        return list(set(found_skills))
    
    def merge_skills(
        self,
        github_skills: Dict[str, int],
        linkedin_skills: Dict[str, int],
        resume_skills: Dict[str, int] = None
    ) -> Dict[str, int]:
        """
        Merge skills from multiple sources with combined confidence.
        
        Args:
            github_skills: Skills from GitHub {skill: confidence}
            linkedin_skills: Skills from LinkedIn {skill: confidence}
            resume_skills: Skills from resume (optional)
            
        Returns:
            Merged dict of {skill: combined_confidence}
        """
        all_skills = Counter()
        
        # Weight: GitHub (real code), LinkedIn (explicit claims), Resume (verified)
        for skill, conf in github_skills.items():
            all_skills[skill] += int(conf * 0.4)  # 40% weight
        
        for skill, conf in linkedin_skills.items():
            all_skills[skill] += int(conf * 0.3)  # 30% weight
        
        if resume_skills:
            for skill, conf in resume_skills.items():
                all_skills[skill] += int(conf * 0.3)  # 30% weight
        
        # Normalize to 0-100 and filter
        result = {}
        for skill, combined in all_skills.items():
            if combined >= self.min_confidence:
                result[skill] = min(100, combined)
        
        return dict(sorted(result.items(), key=lambda x: x[1], reverse=True))


# Singleton instance
enhanced_extractor = EnhancedSkillExtractor()
