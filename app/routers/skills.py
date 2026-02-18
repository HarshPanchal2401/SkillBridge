"""Skills extraction endpoints router - LLM-only version."""
import json
import os
import re
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Optional, Tuple
from difflib import SequenceMatcher
from app.database import get_db
from app import schemas
from app.routers.dependencies import get_services

router = APIRouter(prefix="/api/skills", tags=["Skills"])

# Soft skills to filter out - these aren't actionable for gap analysis/roadmaps
SOFT_SKILLS = {
    'communication', 'leadership', 'project-management', 'problem-solving',
    'critical-thinking', 'teamwork', 'collaboration', 'presentation',
    'public-speaking', 'negotiation', 'conflict-resolution', 'time-management',
    'adaptability', 'creativity', 'analytical-thinking', 'attention-to-detail',
    'stakeholder-management', 'mentoring', 'coaching', 'interpersonal-skills',
    'emotional-intelligence', 'decision-making', 'strategic-thinking',
    'customer-service', 'work-ethic', 'self-motivation', 'flexibility',
    'organizational-skills', 'multitasking', 'active-listening',
    'written-communication', 'verbal-communication', 'team-management',
    'people-management', 'relationship-building', 'initiative',
    'detail-oriented', 'self-starter', 'motivated', 'results-driven',
    'goal-oriented', 'proactive', 'resourceful', 'dependable',
}


def is_technical_skill(skill_name: str) -> bool:
    """Check if a skill is technical (not a soft skill)."""
    normalized = skill_name.lower().strip().replace(' ', '-')
    return normalized not in SOFT_SKILLS


def normalize_skill_name(name: str) -> str:
    """
    Standardize skill names:
    1. Remove parenthetical content: Python (Advanced) -> Python
    2. Lowercase and strip whitespace
    3. Consolidate multiple spaces/hyphens
    """
    if not name:
        return ""
    
    # 1. Strip anything in brackets/parentheses (balanced)
    s = re.sub(r'\s*[\(\[\{].*?[\)\]\}]', '', name)
    
    # 2. Strip any unclosed opening brackets and everything after
    s = re.sub(r'\s*[\(\[\{].*', '', s)
    
    # 3. Strip any stray closing brackets
    s = re.sub(r'[\)\]\}]', '', s)
    
    # 4. Lowercase and strip
    s = s.lower().strip()
    
    # 5. Handle multi-word preservation: 
    # Replace spaces with hyphens for internal storage consistency, 
    # but don't split them.
    s = re.sub(r'[\s\-]+', '-', s)
    
    return s


def is_valid_skill(skill_name: str) -> bool:
    """
    Universal structural validation — checks format only, not content.
    Content validation is handled by validate_against_taxonomy().
    """
    s = normalize_skill_name(skill_name)
    if not s:
        return False
    
    # Length check (allow single-char 'R' and 'C')
    if len(s) < 1 or len(s) > 40:
        return False
    if len(s) == 1 and s.upper() not in ['R', 'C']:
        return False
    
    # Contains URL fragments
    if any(x in s for x in ['http', '//', 'www.', '.com', '.org', '.io']):
        return False
    
    # Contains date patterns
    date_words = {'january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december',
                  'present', 'current'}
    words = set(s.replace('-', ' ').split())
    if words & date_words:
        return False
    
    # Contains year numbers
    if re.search(r'\b(19|20)\d{2}\b', s):
        return False
    
    # Too many words — real skills are 1-4 words max
    if len(s.replace('-', ' ').split()) > 4:
        return False
    
    # Triple hyphens (malformed parsing)
    if '---' in s:
        return False
    
    # Mostly digits
    if sum(c.isdigit() for c in s) > len(s) * 0.5:
        return False
    
    return True


# ---- Taxonomy-based universal validation ----

_taxonomy_cache: Optional[Dict] = None

def _load_taxonomy() -> Dict:
    """Load and cache the skills taxonomy for whitelist validation."""
    global _taxonomy_cache
    if _taxonomy_cache is not None:
        return _taxonomy_cache
    
    taxonomy_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'data', 'healthcare_skills.json'
    )
    with open(taxonomy_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Build lookup sets
    skills_set = set()
    for skill in data.get('skills', []):
        normalized = normalize_skill_name(skill)
        if normalized:
            skills_set.add(normalized)
    
    synonym_map = {}
    for variant, canonical in data.get('synonyms', {}).items():
        norm_variant = normalize_skill_name(variant)
        norm_canonical = normalize_skill_name(canonical)
        if norm_variant and norm_canonical:
            synonym_map[norm_variant] = norm_canonical
    
    _taxonomy_cache = {
        'skills': skills_set,
        'synonyms': synonym_map,
        'all_known': skills_set | set(synonym_map.keys()),
    }
    return _taxonomy_cache


def _fuzzy_score(a: str, b: str) -> float:
    """Similarity score between two strings (0.0 to 1.0)."""
    return SequenceMatcher(None, a, b).ratio()


def validate_against_taxonomy(skill_name: str, threshold: float = 0.85) -> Tuple[bool, str]:
    """
    Universal skill validation: check if a skill matches anything in the
    known skills taxonomy (exact or fuzzy).
    
    Returns: (is_valid, canonical_name)
    - If exact match in skills list → (True, skill_name)
    - If exact match in synonyms → (True, canonical_synonym)
    - If fuzzy match (>= threshold) → (True, best_match)
    - Otherwise → (False, '')
    """
    taxonomy = _load_taxonomy()
    s = normalize_skill_name(skill_name)
    if not s:
        return False, ''
    
    # 1. Exact match in skills list
    if s in taxonomy['skills']:
        return True, s
    
    # 2. Exact match in synonyms → map to canonical
    if s in taxonomy['synonyms']:
        return True, taxonomy['synonyms'][s]
    
    # 3. Fuzzy match against all known skills + synonyms
    best_score = 0.0
    best_match = ''
    for known in taxonomy['all_known']:
        score = _fuzzy_score(s, known)
        if score > best_score:
            best_score = score
            best_match = known
    
    if best_score >= threshold:
        # Map through synonyms if the match is a synonym
        canonical = taxonomy['synonyms'].get(best_match, best_match)
        return True, canonical
    
    return False, ''


def reunify_skills(skills_data: List[dict], taxonomy: set) -> List[dict]:
    """
    Join fragmented skills like 'exploratory-data' and 'analysis' 
    if the combined phrase is in the taxonomy.
    """
    if not skills_data:
        return []
    
    # Map for quick lookup: {skill_name: index}
    skill_map = {s['skill_name']: i for i, s in enumerate(skills_data)}
    names = set(skill_map.keys())
    
    to_remove = set()
    new_skills = []
    
    # 1. Check taxonomy for multi-word skills that could be fragmented
    # Focus on skills with at least one hyphen
    multi_word_taxa = [t for t in taxonomy if '-' in t]
    
    for taxon in multi_word_taxa:
        parts = taxon.split('-')
        if len(parts) < 2: continue
        
        # Possible fragmentations to look for:
        # 1. Full split: ['exploratory', 'data', 'analysis']
        # 2. Partial split (head): ['exploratory-data', 'analysis']
        # 3. Partial split (tail): ['exploratory', 'data-analysis']
        fragment_groups = [
            parts,
            ['-'.join(parts[:2])] + parts[2:],
            parts[:1] + ['-'.join(parts[1:])]
        ]
        
        for frags in fragment_groups:
            # Filter out empty fragments and check if all exist in extracted list
            valid_frags = [f for f in frags if f]
            if len(valid_frags) > 1 and all(f in names for f in valid_frags):
                # Found a match!
                # Use the highest proficiency/confidence among fragments
                max_prof = max(skills_data[skill_map[f]]['proficiency'] for f in valid_frags)
                max_conf = max(skills_data[skill_map[f]]['confidence'] for f in valid_frags)
                
                # Check if we already merged this taxon
                if taxon not in [s['skill_name'] for s in new_skills]:
                    new_skills.append({
                        'skill_name': taxon,
                        'proficiency': max_prof,
                        'confidence': max_conf
                    })
                
                # Mark fragments for removal
                for f in valid_frags:
                    to_remove.add(f)
                break
    
    # 2. Handle known common cases even if not strictly in taxonomy fragments
    # (Safety net for things like "Exploratory" + "Analysis" -> "exploratory-data-analysis")
    common_merges = {
        'exploratory-data-analysis': ['exploratory', 'analysis'],
        'data-visualization': ['data', 'visualization'],
        'machine-learning': ['machine', 'learning']
    }
    
    for target, fragments in common_merges.items():
        if target not in [ns['skill_name'] for ns in new_skills] and all(f in names for f in fragments):
            max_prof = max(skills_data[skill_map[f]]['proficiency'] for f in fragments)
            max_conf = max(skills_data[skill_map[f]]['confidence'] for f in fragments)
            new_skills.append({
                'skill_name': target,
                'proficiency': max_prof,
                'confidence': max_conf
            })
            for f in fragments: to_remove.add(f)

    # 3. Combine results
    result = [s for s in skills_data if s['skill_name'] not in to_remove]
    result.extend(new_skills)
    
    return result


@router.get("/users/{user_id}", response_model=List[schemas.UserSkillResponse])
def get_user_skills(user_id: int):
    """Get all extracted skills for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        rows = cursor.fetchall()
        
        skills = []
        for row in rows:
            skill = dict(row)
            if skill.get('sources'):
                try:
                    skill['sources'] = json.loads(skill['sources'])
                except:
                    skill['sources'] = []
            skills.append(skill)
        
        return skills


@router.post("/extract/{user_id}")
def extract_user_skills(user_id: int):
    """
    Extract skills from user's resume using LLM.
    Simple and direct: Resume -> LLM -> Skills -> Database
    """
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Get user and resume
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        resume_path = user_dict.get('resume_path')
        resume_text = user_dict.get('resume_text', '')
        
        # 2. Extract text from resume file if needed
        if resume_path and os.path.exists(resume_path) and not resume_text:
            print(f"📄 Reading resume from: {resume_path}")
            resume_text = services.skill_extractor.extract_text_from_file(resume_path)
            
            # Save text to database for future use
            if resume_text:
                cursor.execute(
                    "UPDATE users SET resume_text = ? WHERE id = ?",
                    (resume_text, user_id)
                )
                print(f"   Saved {len(resume_text)} chars of resume text")
        
        if not resume_text:
            raise HTTPException(
                status_code=400, 
                detail="No resume found. Please upload a resume first."
            )
        
        # 3. Extract skills using unified SkillExtractor (handles HF, Gemini, and NLP fallbacks)
        print("🤖 Extracting skills from resume...")
        
        # Get skill names first (this handles the HF/Gemini/NLP logic internally now)
        skill_names = services.skill_extractor.extract_skills_from_resume(resume_text)
        
        # Calculate proficiency for each skill
        skills_data = []
        for skill_item in skill_names:
            # Handle both string (legacy) and dict (priority extractor) formats
            if isinstance(skill_item, dict):
                skill = skill_item['name']
                # Use priority as base for proficiency, but maybe cap/adjust
                # Priority 1.0 (Skills section) -> 1.0 proficiency? 
                # Let's trust the priority extractor's judgment or verify with text
                prof = skill_item.get('priority', 0.5)
                conf = skill_item.get('confidence', 0.8)
                source_tag = skill_item.get('source', 'resume')
                
                # If source is priority, we want to tag it specially
                source_id = 'priority:0' if source_tag == 'priority' else 'resume:0'
            else:
                skill = skill_item
                prof, conf = services.skill_extractor.calculate_proficiency_from_resume(skill, resume_text)
                source_id = 'resume:0'
            
            skills_data.append({
                'skill_name': skill,
                'proficiency': prof,
                'confidence': conf,
                'source_id': source_id
            })


        
        print(f"✅ Extracted {len(skills_data)} skills from resume")
        
        # Filter out soft skills and invalid entries - keep only real technical skills
        # Normalize names, validate structure, then match against taxonomy
        filtered_skills = []
        seen_skills = set()
        for s in skills_data:
            normalized_name = normalize_skill_name(s['skill_name'])
            if not is_valid_skill(normalized_name):
                continue
            if not is_technical_skill(normalized_name):
                continue
            # Universal taxonomy validation — only accept known skills
            is_known, canonical = validate_against_taxonomy(normalized_name)
            if is_known and canonical not in seen_skills:
                s['skill_name'] = canonical
                filtered_skills.append(s)
                seen_skills.add(canonical)
        
        skills_data = filtered_skills
        print(f"🔧 After filtering: {len(skills_data)} valid technical skills")
        
        # 4. Re-unify multi-word skills that might have been split
        taxonomy = set(services.skill_extractor.skills_list)
        skills_data = reunify_skills(skills_data, taxonomy)
        print(f"🧩 After re-unification: {len(skills_data)} skills")
        
        # 5. Clear old skills and save new ones
        cursor.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        
        saved_skills = {}
        for skill_info in skills_data:
            skill_name = skill_info['skill_name']
            proficiency = skill_info['proficiency']
            confidence = skill_info['confidence']
            
            source_id = skill_info.get('source_id', 'resume:0')
            cursor.execute('''
                INSERT INTO user_skills 
                (user_id, skill_name, proficiency, confidence, source_count, sources)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                skill_name,
                proficiency,
                confidence,
                1,
                json.dumps([source_id])
            ))
            
            saved_skills[skill_name] = {
                'proficiency': proficiency,
                'confidence': confidence,
                'sources': [source_id]
            }
        
        print(f"💾 Saved {len(saved_skills)} skills to database")
        
        return {
            "message": "Skills extracted successfully using LLM",
            "user_id": user_id,
            "skills_extracted": len(saved_skills),
            "skills": saved_skills
        }


@router.delete("/users/{user_id}")
def clear_user_skills(user_id: int):
    """Clear all skills for a user."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        
        cursor.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        
        return {"message": "User skills cleared", "user_id": user_id}


@router.post("/extract-all/{user_id}")
def extract_all_skills(user_id: int):
    """
    Extract skills from Resume (primary source).
    GitHub and LinkedIn extraction removed as per user request.
    """
    services = get_services()
    
    results = {
        "user_id": user_id,
        "sources": {},
        "total_skills": 0,
        "resume_skills": 0
    }
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        
        # ========== Extract from Resume ==========
        print("📄 Extracting skills from resume...")
        resume_path = user_dict.get('resume_path')
        resume_text = user_dict.get('resume_text', '')
        
        if resume_path and os.path.exists(resume_path) and not resume_text:
            resume_text = services.skill_extractor.extract_text_from_file(resume_path)
            if resume_text:
                cursor.execute(
                    "UPDATE users SET resume_text = ? WHERE id = ?",
                    (resume_text, user_id)
                )
        
        if resume_text:
            # Clear old skills first
            cursor.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
            
            # Extract skills from resume using unified extractor
            skill_names = services.skill_extractor.extract_skills_from_resume(resume_text)
            
            skills_data = []
            skills_data = []
            for skill_item in skill_names:
                if isinstance(skill_item, dict):
                    skill = skill_item['name']
                    prof = skill_item.get('priority', 0.5)
                    conf = skill_item.get('confidence', 0.8)
                    source_tag = skill_item.get('source', 'resume')
                    source_id = 'priority:0' if source_tag == 'priority' else 'resume:0'
                else:
                    skill = skill_item
                    prof, conf = services.skill_extractor.calculate_proficiency_from_resume(skill, resume_text)
                    source_id = 'resume:0'

                skills_data.append({
                    'skill_name': skill,
                    'proficiency': prof,
                    'confidence': conf,
                    'source_id': source_id
                })
            
            # Filter out soft skills and invalid entries
            # Normalize names, validate structure, then match against taxonomy
            filtered_skills = []
            seen_skills = set()
            for s in skills_data:
                normalized_name = normalize_skill_name(s['skill_name'])
                if not is_valid_skill(normalized_name):
                    continue
                if not is_technical_skill(normalized_name):
                    continue
                # Universal taxonomy validation — only accept known skills
                is_known, canonical = validate_against_taxonomy(normalized_name)
                if is_known and canonical not in seen_skills:
                    s['skill_name'] = canonical
                    filtered_skills.append(s)
                    seen_skills.add(canonical)
            
            skills_data = filtered_skills
            print(f"   🔧 After filtering: {len(skills_data)} valid technical skills")
            
            # 4. Re-unify multi-word skills that might have been split
            taxonomy = set(services.skill_extractor.skills_list)
            skills_data = reunify_skills(skills_data, taxonomy)
            print(f"   🧩 After re-unification: {len(skills_data)} skills")
            
            # Save resume skills
            for skill_info in skills_data:
                source_id = skill_info.get('source_id', 'resume:0')
                cursor.execute('''
                    INSERT INTO user_skills 
                    (user_id, skill_name, proficiency, confidence, source_count, sources)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    skill_info['skill_name'],
                    skill_info['proficiency'],
                    skill_info['confidence'],
                    1,
                    json.dumps([source_id])
                ))
            
            results["resume_skills"] = len(skills_data)
            results["sources"]["resume"] = {"status": "success", "skills": len(skills_data)}
            print(f"   ✅ Extracted {len(skills_data)} technical skills from resume")
        else:
            results["sources"]["resume"] = {"status": "skipped", "reason": "No resume uploaded"}
            print("   ⚠️ No resume found, skipping...")
        
        conn.commit()
        
        # Get total skills count
        cursor.execute("SELECT COUNT(*) as count FROM user_skills WHERE user_id = ?", (user_id,))
        total = cursor.fetchone()
        results["total_skills"] = total['count'] if total else 0
        
        print(f"✅ Extraction complete! Total skills: {results['total_skills']}")
        
        return {
            "message": "Skills extracted from resume",
            **results
        }

