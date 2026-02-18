"""HuggingFace-based skill extraction using free Inference API."""
import os
import json
import re
import requests
from typing import List, Dict, Optional

# Import PDF/DOCX readers
try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None

try:
    from docx import Document
except ImportError:
    Document = None


class HuggingFaceSkillExtractor:
    """Extract skills from resume using HuggingFace free Inference API."""
    
    # Free serverless inference models that actually work
    MODELS = [
        "microsoft/Phi-3.5-mini-instruct",
        "mistralai/Mistral-7B-Instruct-v0.3",
        "google/flan-t5-large",
    ]
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize with HuggingFace API key."""
        self.api_key = api_key or os.getenv('HUGGINGFACE_API_KEY') or os.getenv('HF_TOKEN')
        self.api_url = "https://router.huggingface.co/hf-inference/"
        self.current_model = self.MODELS[0]
        
        if not self.api_key:
            print("⚠️ No HUGGINGFACE_API_KEY found. Add it to .env file.")
            print("   Get free API key at: https://huggingface.co/settings/tokens")
        else:
            print(f"✅ HuggingFace API initialized with model: {self.current_model}")
    
    def is_available(self) -> bool:
        """Check if HuggingFace API is available."""
        return bool(self.api_key)
    
    def extract_text_from_file(self, file_path: str) -> str:
        """Extract text from PDF, DOCX, or TXT file."""
        if not os.path.exists(file_path):
            return ""
        
        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext == '.pdf' and PdfReader:
                reader = PdfReader(file_path)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                return text
            
            elif ext in ['.docx', '.doc'] and Document:
                doc = Document(file_path)
                return "\n".join([para.text for para in doc.paragraphs])
            
            elif ext == '.txt':
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            
            else:
                return ""
        except Exception as e:
            print(f"Error reading file: {e}")
            return ""
    
    def _call_api(self, prompt: str, max_tokens: int = 500) -> str:
        """Call HuggingFace Inference API."""
        if not self.api_key:
            return ""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": max_tokens,
                "temperature": 0.1,
                "do_sample": False
            }
        }
        
        # Try each model until one works
        for model in self.MODELS:
            try:
                url = f"{self.api_url}{model}"
                print(f"🤖 Calling HuggingFace API ({model.split('/')[-1]})...")
                
                response = requests.post(url, headers=headers, json=payload, timeout=60)
                
                if response.status_code == 200:
                    result = response.json()
                    if isinstance(result, list) and len(result) > 0:
                        return result[0].get('generated_text', '')
                    return str(result)
                
                elif response.status_code == 503:
                    # Model loading, try next
                    print(f"   Model loading, trying next...")
                    continue
                    
                elif response.status_code == 429:
                    print(f"   Rate limited, trying next model...")
                    continue
                    
                else:
                    print(f"   API error {response.status_code}: {response.text[:100]}")
                    continue
                    
            except Exception as e:
                print(f"   Error with {model}: {e}")
                continue
        
        return ""
    
    def extract_skills_from_resume(self, resume_text: str) -> List[str]:
        """
        Extract skills from resume using HuggingFace LLM.
        Returns a list of skill names.
        """
        if not self.api_key:
            print("❌ HuggingFace API key not configured")
            return []
        
        if not resume_text or len(resume_text.strip()) < 50:
            print("❌ Resume text too short")
            return []
        
        # Truncate to fit model context
        resume_text = resume_text[:4000]
        
        prompt = f"""Extract ONLY technical skills from this resume. Return ONLY a JSON array of skill names in lowercase with hyphens for multi-word skills.

Include: programming languages (including single-letter ones like 'r'), frameworks, libraries, tools, platforms, technical concepts.
Exclude: soft skills (communication, leadership, teamwork), personal details (names, locations), dates, URLs, company names, and noise like "windows" or "resume".

IMPORTANT RULES:
1. Return ONLY a valid JSON array of strings.
2. Include programming languages (Python, Java, SQL, etc.)
3. Include frameworks and libraries (React, TensorFlow, Pandas, etc.)
4. Include tools and platforms (Git, Docker, AWS, etc.)
5. Include technical concepts (Machine Learning, Data Analysis, etc.)
6. Do NOT include soft skills (communication, leadership, teamwork, etc.)
7. Do NOT include personal details (names, locations, dates, URLs)
8. Do NOT include job titles or company names
9. Do NOT make up skills that aren't in the resume
10. Return skills in lowercase with hyphens for multi-word skills (e.g., "machine-learning", "business-intelligence", "exploratory-data-analysis").
11. Do NOT split multi-word skills into individual components (e.g., "business-intelligence" should NOT become "business" and "intelligence").
12. Include single-letter programming languages like "r" if mentioned.
13. Limit to the 15-25 most relevant technical skills
Format example: ["python", "machine-learning", "react", "exploratory-data-analysis", "r"]

RESUME:
{resume_text}

JSON array of skills:"""


        response = self._call_api(prompt)
        
        if not response:
            print("❌ No response from API")
            return []
        
        print(f"📝 Response: {response[:200]}...")
        
        # Extract JSON array from response
        try:
            # Find JSON array in response
            json_match = re.search(r'\[.*?\]', response, re.DOTALL)
            if json_match:
                skills_json = json_match.group(0)
                skills = json.loads(skills_json)
                
                # Clean skills
                cleaned = []
                for skill in skills:
                    if isinstance(skill, str):
                        s = skill.strip().lower()
                        # Aggressive bracket stripping
                        s = re.sub(r'[\(\[\{].*?[\)\]\}]', '', s)
                        s = re.sub(r'[\(\[\{].*', '', s)
                        s = re.sub(r'[\)\]\}]', '', s)
                        s = s.strip()
                        s = re.sub(r'[\s\-]+', '-', s)
                        if s and len(s) >= 1 and len(s) < 50:
                            cleaned.append(s)
                
                print(f"✅ Extracted {len(cleaned)} skills")
                return cleaned
            else:
                # Try to extract skills from plain text
                print("⚠️ No JSON found, parsing text...")
                skills = self._extract_from_text(response)
                return skills
                
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}")
            return self._extract_from_text(response)
    
    def _extract_from_text(self, text: str) -> List[str]:
        """Fallback: extract skills from plain text response."""
        # Common skill patterns
        skill_patterns = [
            r'python', r'java(?:script)?', r'sql', r'react', r'node\.?js',
            r'tensorflow', r'pytorch', r'docker', r'kubernetes', r'aws',
            r'machine[- ]?learning', r'deep[- ]?learning', r'nlp',
            r'data[- ]?analysis', r'data[- ]?science', r'pandas', r'numpy',
            r'git', r'linux', r'flask', r'django', r'fastapi', r'mongodb',
            r'postgresql', r'html', r'css', r'typescript', r'angular', r'vue',
            r'exploratory[- ]?data[- ]?analysis', r'business[- ]?intelligence', r'eda'
        ]
        
        text_lower = text.lower()
        found = []
        for pattern in skill_patterns:
            if re.search(pattern, text_lower):
                # Normalize the skill name
                skill = re.sub(r'[- ]', '-', pattern.replace(r'\.?', '').replace(r'[- ]?', '-'))
                found.append(skill)
        
        return list(set(found))
    
    def extract_skills_with_proficiency(self, resume_text: str) -> List[Dict]:
        """
        Extract skills with estimated proficiency levels.
        Returns list of {skill_name, proficiency, confidence}.
        """
        skills = self.extract_skills_from_resume(resume_text)
        
        # Estimate proficiency based on mentions and context
        resume_lower = resume_text.lower()
        skill_data = []
        
        for skill in skills:
            # Count mentions
            skill_variations = [skill, skill.replace('-', ' '), skill.replace('-', '')]
            mentions = sum(resume_lower.count(v) for v in skill_variations)
            
            # Base proficiency on mentions
            if mentions >= 5:
                proficiency = 0.85
            elif mentions >= 3:
                proficiency = 0.75
            elif mentions >= 2:
                proficiency = 0.65
            else:
                proficiency = 0.55
            
            # Check for expertise indicators
            expertise_patterns = [
                f"expert.*{skill}", f"proficient.*{skill}", f"advanced.*{skill}",
                f"{skill}.*expert", f"strong.*{skill}", f"lead.*{skill}"
            ]
            for pattern in expertise_patterns:
                if re.search(pattern.replace('-', '.?'), resume_lower):
                    proficiency = min(proficiency + 0.1, 0.95)
                    break
            
            skill_data.append({
                'skill_name': skill,
                'proficiency': round(proficiency, 2),
                'confidence': 0.75
            })
        
        return skill_data
