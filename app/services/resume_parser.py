"""Resume parser to extract structured information."""
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from collections import defaultdict


class ResumeParser:
    """Parse resume text to extract structured information."""
    
    def __init__(self):
        # Section headers to identify different parts
        self.section_patterns = {
            'experience': r'(experience|work\s+experience|professional\s+experience|employment\s+history|career\s+history)',
            'education': r'(education|academic\s+background|qualifications|academic\s+record)',
            'projects': r'(projects|personal\s+projects|academic\s+projects|selected\s+projects)',
            'skills': r'(skills|technical\s+skills|core\s+competencies|expertise|technologies|tools)',
            'certifications': r'(certifications|certificates|licenses|certification|awards)',
        }
    
    def split_into_sections(self, text: str) -> Dict[str, str]:
        """Split resume text into sections."""
        text_lower = text.lower()
        sections = {}
        
        # Find all section headers and their positions
        section_positions = []
        for section_type, pattern in self.section_patterns.items():
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                section_positions.append((match.start(), section_type, match.group()))
        
        # Sort by position
        section_positions.sort(key=lambda x: x[0])
        
        # Extract text for each section
        for i, (start_pos, section_type, header) in enumerate(section_positions):
            # Get end position (start of next section or end of text)
            end_pos = section_positions[i + 1][0] if i + 1 < len(section_positions) else len(text)
            
            # Extract section text
            section_text = text[start_pos:end_pos].strip()
            
            # Remove the header from the section text
            section_text = re.sub(re.escape(header), '', section_text, flags=re.IGNORECASE, count=1).strip()
            
            sections[section_type] = section_text
        
        return sections
    
    def extract_experience(self, experience_text: str) -> List[Dict]:
        """Extract work experience entries."""
        experiences = []
        
        # Split by company/position patterns - look for lines with dates
        # Pattern: Company name followed by position and dates
        lines = experience_text.split('\n')
        current_exp = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Check if this line looks like a company name (usually capitalized, no bullets)
            if not line.startswith('•') and not line.startswith('-') and len(line) > 5:
                # Check if next line has a position and date
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    # Look for date pattern in next line
                    date_match = re.search(r'(\w{3,9}/\d{4}|\w+\s+\d{4})\s*[-–—]\s*(\w{3,9}/\d{4}|\w+\s+\d{4}|present|current)', next_line, re.IGNORECASE)
                    
                    if date_match:
                        # Save previous experience if exists
                        if current_exp and (current_exp['company_name'] or current_exp['job_title']):
                            experiences.append(current_exp)
                        
                        # Start new experience
                        current_exp = {
                            'company_name': line,
                            'job_title': next_line.split(date_match.group(0))[0].strip() if date_match else '',
                            'employment_type': 'Internship' if 'intern' in next_line.lower() else 'Full-time',
                            'start_date': date_match.group(1).strip() if date_match else '',
                            'end_date': date_match.group(2).strip() if date_match else '',
                            'location': '',
                            'description': '',
                            'technologies_used': []
                        }
                        continue
            
            # If we have a current experience, add bullet points to description
            if current_exp and (line.startswith('•') or line.startswith('-')):
                bullet_text = line.lstrip('•-').strip()
                if current_exp['description']:
                    current_exp['description'] += '\n' + bullet_text
                else:
                    current_exp['description'] = bullet_text
                
                # Extract technologies from bullet points
                tech_keywords = ['python', 'java', 'javascript', 'sql', 'react', 'node', 'aws', 
                               'docker', 'kubernetes', 'tensorflow', 'pytorch', 'pandas', 'flask',
                               'numpy', 'nlp', 'fasttext', 'streamlit', 'machine learning', 'ml',
                               'deep learning', 'data analytics', 'ai']
                line_lower = bullet_text.lower()
                for tech in tech_keywords:
                    if tech in line_lower and tech not in current_exp['technologies_used']:
                        current_exp['technologies_used'].append(tech)
        
        # Add last experience
        if current_exp and (current_exp['company_name'] or current_exp['job_title']):
            experiences.append(current_exp)
        
        return experiences
    
    def extract_projects(self, projects_text: str) -> List[Dict]:
        """Extract project entries."""
        projects = []
        
        # Split by project name patterns (lines with dates)
        lines = projects_text.split('\n')
        current_project = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Check if line has date pattern (project header)
            date_match = re.search(r'(\w{3,9}/\d{4}|\w+\s+\d{4})\s*[-–—]\s*(\w{3,9}/\d{4}|\w+\s+\d{4}|present|current)', line, re.IGNORECASE)
            
            if date_match and not line.startswith('•') and not line.startswith('-'):
                # Save previous project
                if current_project and current_project['project_name']:
                    projects.append(current_project)
                
                # Extract project name (everything before date)
                project_name = line.split(date_match.group(0))[0].strip()
                
                current_project = {
                    'project_name': project_name,
                    'description': '',
                    'tech_stack': [],
                    'role': 'Developer',
                    'github_link': '',
                    'deployed_link': '',
                    'project_type': 'Personal'
                }
                continue
            
            # Add bullet points to current project description
            if current_project and (line.startswith('•') or line.startswith('-')):
                bullet_text = line.lstrip('•-').strip()
                if current_project['description']:
                    current_project['description'] += '\n' + bullet_text
                else:
                    current_project['description'] = bullet_text
                
                # Extract tech stack from description
                tech_keywords = ['python', 'java', 'javascript', 'react', 'node', 'sql', 'mongodb',
                               'tensorflow', 'pytorch', 'flask', 'django', 'fastapi', 'aws', 'docker',
                               'streamlit', 'sqlite', 'pandas', 'numpy', 'scikit-learn', 'keras',
                               'nltk', 'spacy', 'jupyter', 'mysql', 'chromadb', 'rag', 'transformers',
                               'ai', 'ml', 'nlp', 'deep learning', 'machine learning', 'computer vision',
                               'geospatial', 'satellite', 'ndvi', 'automation']
                line_lower = bullet_text.lower()
                for tech in tech_keywords:
                    if tech in line_lower and tech not in current_project['tech_stack']:
                        current_project['tech_stack'].append(tech)
                
                # Extract URLs
                url_pattern = r'https?://[^\s]+'
                urls = re.findall(url_pattern, bullet_text)
                for url in urls:
                    if 'github' in url.lower():
                        current_project['github_link'] = url
                    elif any(domain in url.lower() for domain in ['heroku', 'netlify', 'vercel', '.app', '.io']):
                        current_project['deployed_link'] = url
        
        # Add last project
        if current_project and current_project['project_name']:
            projects.append(current_project)
        
        return projects
    
    def extract_certifications(self, cert_text: str) -> List[Dict]:
        """Extract certification entries."""
        certifications = []
        
        # Split by newlines and filter
        lines = [l.strip() for l in cert_text.split('\n') if l.strip()]
        
        for line in lines:
            # Skip bullets
            line = line.lstrip('•·-').strip()
        
            if len(line) < 10:
                continue
            
            cert = {
                'certification_name': '', 
                'issuing_organization': '', 
                'issue_date': '',
                'credential_url': ''
            }
            
            # Split by dash or hyphen
            parts = re.split(r'\s*[–—-]\s*', line, maxsplit=1)
            cert['certification_name'] = parts[0].strip()
            
            # Issuer is usually after the dash
            if len(parts) > 1:
                issuer_text = parts[1].strip()
                # Remove any date or extra info
                cert['issuing_organization'] = issuer_text.split('(')[0].split(',')[0].strip()
            
            # Extract date
            date_pattern = r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b|\b\d{4}\b'
            date_match = re.search(date_pattern, line, re.IGNORECASE)
            if date_match:
                cert['issue_date'] = date_match.group()
            
            # Extract URL
            url_match = re.search(r'https?://[^\s]+', line)
            if url_match:
                cert['credential_url'] = url_match.group()
            
            certifications.append(cert)
        
        return certifications
    
    def extract_education(self, edu_text: str) -> List[Dict]:
        """Extract education entries."""
        education = []
        
        # Split by common separators
        entries = re.split(r'\n\s*\n|---+|___+', edu_text)
        
        for entry in entries:
            if len(entry.strip()) < 20:  # Skip very short entries
                continue
            
            edu = {
                'degree': '',
                'university': '',
                'graduation_year': None,
                'field': ''
            }
            
            lines = [l.strip() for l in entry.split('\n') if l.strip()]
            
            if not lines:
                continue
            
            # First line often has degree
            edu['degree'] = lines[0]
            
            # University usually on second line or in first line after separator
            if len(lines) > 1:
                edu['university'] = lines[1].split(',')[0].strip()
            
            # Extract year
            year_match = re.search(r'\b(19|20)\d{2}\b', entry)
            if year_match:
                edu['graduation_year'] = int(year_match.group())
            
            # Extract field/major
            field_keywords = ['major:', 'specialization:', 'in ', ' - ']
            for keyword in field_keywords:
                if keyword in entry.lower():
                    parts = re.split(keyword, entry, maxsplit=1, flags=re.IGNORECASE)
                    if len(parts) > 1:
                        edu['field'] = parts[1].split(',')[0].split('\n')[0].strip()
                        break
            
            education.append(edu)
        
        return education
    
    def extract_skills_section(self, skills_text: str) -> List[str]:
        """Extract skills from dedicated skills section."""
        skills = []
        
        # Handle bullet points with colons (e.g., "Languages & ML: Python, SQL")
        lines = skills_text.split('\n')
        for line in lines:
            line = line.strip().lstrip('•·-').strip()
            if not line:
                continue
            
            # If line has colon, extract everything after it
            if ':' in line:
                parts = line.split(':', 1)
                if len(parts) > 1:
                    skill_list = parts[1]
                else:
                    skill_list = line
            else:
                skill_list = line
            
            # Split by comma
            if ',' in skill_list:
                items = skill_list.split(',')
                for item in items:
                    skill = item.strip().strip('•·-').strip()
                    if skill and len(skill) > 1 and len(skill) < 80:
                        skills.append(skill)
            else:
                # Single skill
                skill = skill_list.strip()
                if skill and len(skill) > 1 and len(skill) < 80:
                    skills.append(skill)
        
        return skills
    
    def parse_resume(self, resume_text: str) -> Dict:
        """Parse entire resume and return structured data."""
        sections = self.split_into_sections(resume_text)
        
        parsed_data = {
            'experience': [],
            'projects': [],
            'certifications': [],
            'education': [],
            'skills': []
        }
        
        # Extract from each section
        if 'experience' in sections:
            parsed_data['experience'] = self.extract_experience(sections['experience'])
        
        if 'projects' in sections:
            parsed_data['projects'] = self.extract_projects(sections['projects'])
        
        if 'certifications' in sections:
            parsed_data['certifications'] = self.extract_certifications(sections['certifications'])
        
        if 'education' in sections:
            parsed_data['education'] = self.extract_education(sections['education'])
        
        if 'skills' in sections:
            parsed_data['skills'] = self.extract_skills_section(sections['skills'])
        
        return parsed_data
