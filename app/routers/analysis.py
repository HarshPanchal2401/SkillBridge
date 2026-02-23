"""Analysis endpoints router - Gap Analysis, Course Recommendations, GitHub Analysis."""
import json
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.database import get_db
from app.routers.dependencies import get_services, get_sample_market_requirements
from app.routers.skills import _is_similar_project

router = APIRouter(prefix="/api", tags=["Analysis"])


# ===== GAP ANALYSIS ENDPOINTS =====
@router.get("/users/{user_id}/gap-analysis")
def analyze_user_gaps(
    user_id: int,
    job_title: str = "Healthcare Data Analyst",
    location: str = "United States"
):
    """
    Perform comprehensive skill gap analysis for a user.
    
    Compares user's skills against market requirements.
    """
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        # Use user's target role if available, otherwise use job_title parameter
        target_role = user_dict.get('target_role') or job_title
        
        # Get user skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        
        if not user_skills_rows:
            raise HTTPException(
                status_code=400, 
                detail="No skills found for user. Run skill extraction first."
            )
        
        # Format user skills
        user_skills = {}
        for row in user_skills_rows:
            skill_dict = dict(row)
            user_skills[skill_dict['skill_name']] = {
                'proficiency': skill_dict['proficiency'],
                'confidence': skill_dict['confidence']
            }
        
        # Use Tavily market skill searcher for live skills
        market_searcher = services.market_skill_searcher
        print(f"🔍 Searching live market skills for: {target_role}")
        live_result = market_searcher.search_role_skills(target_role)
        market_requirements = live_result.get("skills", {})
        skills_source = live_result.get("source", "web_search")
        
        # Print fetched skills to terminal
        print(f"\n{'='*60}")
        print(f"📋 FETCHED MARKET SKILLS FOR: {target_role}")
        print(f"   Source: {skills_source}")
        print(f"   Total Skills: {len(market_requirements)}")
        print(f"{'='*60}")
        for i, (skill, data) in enumerate(market_requirements.items(), 1):
            level = data.get('requirement_level', 'unknown')
            freq = int(data.get('frequency', 0) * 100)
            trending = "🔥" if data.get('trending', False) else ""
            print(f"   {i:2}. {skill:<25} | {level:<10} | {freq}% demand {trending}")
        print(f"{'='*60}\n")
        
        # Fallback to sample if no live skills
        if not market_requirements:
            market_requirements = get_sample_market_requirements()
            skills_source = "fallback"
        
        # Perform gap analysis
        gap_analyzer = services.gap_analyzer
        gap_result = gap_analyzer.analyze_gaps(user_skills, market_requirements)
        
        # Format fetched market skills for frontend display
        fetched_market_skills = []
        for skill, req in market_requirements.items():
            fetched_market_skills.append({
                "skill": skill,
                "demand": req.get('frequency', 0),
                "demand_percentage": f"{int(req.get('frequency', 0) * 100)}%",
                "requirement_level": req.get('requirement_level', 'important'),
                "trending": req.get("trending", False)
            })
        
        # Sort by demand (descending) - highest demand first
        fetched_market_skills.sort(key=lambda x: x['demand'], reverse=True)
        
        # Find matching and missing skills
        matched_skills = []
        missing_skills = []
        
        # Helper for partial matching
        def normalize_skill(s):
            return s.lower().strip().replace('-', ' ').replace('_', ' ')
        
        user_skill_names = list(user_skills.keys())
        
        for skill, req in market_requirements.items():
            skill_normalized = normalize_skill(skill)
            
            # Try exact match first
            user_prof = user_skills.get(skill_normalized, {}).get('proficiency', 0)
            
            # Partial matching
            if user_prof == 0:
                for user_skill_name in user_skill_names:
                    user_normalized = normalize_skill(user_skill_name)
                    if skill_normalized in user_normalized or user_normalized in skill_normalized:
                        user_prof = user_skills[user_skill_name].get('proficiency', 0)
                        if user_prof > 0:
                            break
            
            if user_prof > 0:
                matched_skills.append({
                    "skill": skill,
                    "user_proficiency": round(user_prof, 2),
                    "required_proficiency": req.get('avg_proficiency_needed', 0.6),
                    "gap": round(req.get('avg_proficiency_needed', 0.6) - user_prof, 2),
                    "requirement_level": req.get('requirement_level', 'important'),
                    "market_frequency": f"{int(req.get('frequency', 0.5)*100)}%"
                })
            else:
                missing_skills.append({
                    "skill": skill,
                    "required_proficiency": req.get('avg_proficiency_needed', 0.6),
                    "requirement_level": req.get('requirement_level', 'important'),
                    "market_frequency": f"{int(req.get('frequency', 0.5)*100)}%"
                })
        
        # Sort by requirement level and demand
        level_priority = {"critical": 0, "important": 1, "emerging": 2}
        missing_skills.sort(key=lambda x: (level_priority.get(x["requirement_level"], 3), -float(x["market_frequency"].rstrip('%'))/100))
        matched_skills.sort(key=lambda x: (-x["gap"], level_priority.get(x["requirement_level"], 3)))

        return {
            "message": "Gap analysis complete",
            "user_id": user_id,
            "target_role": { "id": "default", "title": target_role },
            "skills_source": skills_source,
            "fetched_market_skills": fetched_market_skills,
            "user_skills_count": len(user_skills),
            "market_skills_count": len(market_requirements),
            "overall_readiness": gap_result['overall_readiness'],
            "summary": gap_result['summary'],
            "critical_gaps": gap_result['critical_gaps'][:5],
            "important_gaps": gap_result['important_gaps'][:5],
            "emerging_gaps": gap_result['emerging_gaps'][:5],
            "matched_skills": matched_skills[:10],
            "missing_skills": missing_skills[:10],
            "strengths": gap_result['strengths'][:5]
        }


# ===== COURSE RECOMMENDATION ENDPOINTS =====
@router.get("/users/{user_id}/recommended-courses")
@router.get("/users/{user_id}/gap-courses")  # Alias for frontend compatibility
def get_recommended_courses(
    user_id: int,
    max_courses_per_skill: int = 3,
    refresh: bool = False
):
    """
    Get course recommendations based on user's skill gaps.
    """
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user_row)
        
        # Get user skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        
        user_skills = {}
        for row in user_skills_rows:
            skill_dict = dict(row)
            user_skills[skill_dict['skill_name']] = {
                'proficiency': skill_dict['proficiency'],
                'confidence': skill_dict['confidence']
            }
        
        # Get market requirements (from cache or API)
        # Use user's target role from DB if available, otherwise default
        target_role = user_dict.get('target_role') or 'Healthcare Data Analyst'
        location = user_dict.get('location', 'United States')

        if services.has_tavily_api():
            # Use real-time search for much better accuracy
            market_searcher = services.market_skill_searcher
            print(f"🔍 Searching live market skills for recommended courses: {target_role} (Refresh: {refresh})")
            live_result = market_searcher.search_role_skills(target_role, force_refresh=refresh)
            market_requirements = live_result.get("skills", {})
        elif services.has_linkedin_api():
            linkedin_fetcher = services.linkedin_fetcher
            job_analyzer = services.job_analyzer
            
            # Note: linkedin_fetcher doesn't have a direct refresh but clearing cache works
            jobs_data = linkedin_fetcher.fetch_jobs(target_role, location, limit=30)
            jobs = linkedin_fetcher.get_job_details(jobs_data)
            market_requirements = job_analyzer.aggregate_job_requirements(jobs)
        else:
            market_requirements = get_sample_market_requirements()
        
        # Perform gap analysis
        gap_analyzer = services.gap_analyzer
        course_recommender = services.course_recommender
        
        gap_result = gap_analyzer.analyze_gaps(user_skills, market_requirements)
        
        # Get skills to improve (prioritize critical gaps)
        critical_gaps = [g['skill'] for g in gap_result['critical_gaps']]
        important_gaps = [g['skill'] for g in gap_result['important_gaps']]
        
        # Take top 3 critical and top 2 important
        skills_to_improve = critical_gaps[:3]
        if len(skills_to_improve) < 5:
            skills_to_improve += important_gaps[:(5 - len(skills_to_improve))]
        
        # Get course recommendations for each skill
        recommendations = []
        for skill in skills_to_improve:
            # Pass refresh parameter down to course_recommender
            courses = course_recommender.search_courses_for_skill(skill, max_courses_per_skill, force_refresh=refresh)
            recommendations.append({
                'skill': skill,
                'gap_priority': 'critical' if skill in critical_gaps else 'important',
                'courses': courses
            })
        
        return {
            "message": "Course recommendations generated",
            "user_id": user_id,
            "skills_targeted": len(skills_to_improve),
            "total_courses": sum(len(r['courses']) for r in recommendations),
            "recommendations": recommendations,
            "refreshed": refresh
        }


@router.get("/courses/search/{skill}")
def search_courses_for_skill(skill: str, max_results: int = 5, refresh: bool = False):
    """
    Search for courses to learn a specific skill.
    """
    services = get_services()
    course_recommender = services.course_recommender
    
    courses = course_recommender.search_courses_for_skill(skill, max_results, force_refresh=refresh)
    
    return {
        "skill": skill,
        "total_courses": len(courses),
        "courses": courses,
        "refreshed": refresh
    }


# ===== GITHUB ANALYSIS ENDPOINTS =====
@router.post("/users/{user_id}/analyze-github")
def analyze_user_github(user_id: int, github_url: Optional[str] = None):
    """
    Analyze user's GitHub profile to extract unique technical skills from repositories.
    
    Only extracts technical skills (not soft skills) and skips skills that
    already exist in the user's profile (e.g., from resume).
    """
    services = get_services()
    github_analyzer = services.github_analyzer
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        
        # Use provided URL or user's stored GitHub URL
        url = github_url or user_dict.get('github_url')
        
        if not url:
            raise HTTPException(
                status_code=400, 
                detail="No GitHub URL provided. Pass github_url or update user profile."
            )
        
        # Get existing user skills FIRST (to avoid duplicates)
        cursor.execute("SELECT skill_name FROM user_skills WHERE user_id = ?", (user_id,))
        existing_skills = {row['skill_name'].lower() for row in cursor.fetchall()}
        print(f"📋 User has {len(existing_skills)} existing skills")
        
        # Analyze GitHub profile (returns only technical skills)
        result = github_analyzer.analyze_github_profile(url, max_repos=10, fetch_readmes=True)
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        # Save only UNIQUE skills (not already in resume/profile)
        skills_added = 0
        skills_skipped = 0
        new_skills = []
        
        for skill, (proficiency, confidence) in result['skills_found'].items():
            skill_lower = skill.lower()
            
            # Skip if skill already exists (from resume or previous extraction)
            if skill_lower in existing_skills:
                skills_skipped += 1
                print(f"   ⏭️ Skipping duplicate: {skill}")
                continue
            
            # Insert new unique skill
            cursor.execute('''
                INSERT INTO user_skills (user_id, skill_name, proficiency, confidence, source_count, sources)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, skill, proficiency, confidence, 1, json.dumps(['github'])))
            skills_added += 1
            new_skills.append(skill)
            print(f"   ✅ Added new skill: {skill}")
        
        conn.commit()
        
        # Save repositories as projects
        projects_saved = 0
        for repo in result.get('repo_details', []):
            repo_name = repo.get('name', '')
            if not repo_name:
                continue
                
            # Check if project already exists with robust deduplication
            repo_url = repo.get('url', f'https://github.com/{result["username"]}/{repo_name}')
            
            if not _is_similar_project(cursor, user_id, repo_name, repo_url):
                # Extract tech stack from skills found in the repo
                tech_stack = repo.get('skills_found', [])
                if isinstance(tech_stack, dict):
                    tech_stack = list(tech_stack.keys())
                
                cursor.execute('''
                    INSERT INTO projects 
                    (user_id, project_name, description, tech_stack, github_link, project_type, skills_extracted)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    repo_name,
                    repo.get('description', '')[:500] if repo.get('description') else f'GitHub repository: {repo_name}',
                    json.dumps(tech_stack[:10]) if tech_stack else '[]',
                    repo.get('url', f'https://github.com/{result["username"]}/{repo_name}'),
                    'personal',
                    json.dumps(tech_stack[:10]) if tech_stack else '[]'
                ))
                projects_saved += 1
        
        conn.commit()
        
        print(f"✅ GitHub analysis complete: {skills_added} new skills, {skills_skipped} duplicates skipped")
        
        return {
            "message": "GitHub analysis complete",
            "user_id": user_id,
            "github_username": result['username'],
            "repos_analyzed": result['repos_analyzed'],
            "skills_found": len(result['skills_found']),
            "skills_added": skills_added,
            "skills_skipped_duplicate": skills_skipped,
            "new_skills": new_skills,
            "projects_saved": projects_saved,
            "repo_details": result['repo_details']
        }


# ===== COMPLETE ANALYSIS PIPELINE =====
@router.post("/users/{user_id}/complete-analysis")
def run_complete_analysis(
    user_id: int,
    target_job: str = "Healthcare Data Analyst",
    location: str = "United States"
):
    """
    Run complete skill intelligence pipeline:
    1. Extract skills from resume
    2. Analyze GitHub (if available)
    3. Fetch and analyze job market
    4. Perform gap analysis
    5. Generate course recommendations
    """
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        results = {"user_id": user_id, "stages": {}}
        
        # Stage 1: Extract skills from resume
        print("📄 Stage 1: Extracting skills from resume...")
        try:
            # Import here to avoid circular dependency
            from app.routers.skills import extract_user_skills
            skill_result = extract_user_skills(user_id)
            results['stages']['skill_extraction'] = {
                "status": "success",
                "skills_extracted": skill_result['total_skills_extracted']
            }
        except Exception as e:
            results['stages']['skill_extraction'] = {"status": "failed", "error": str(e)}
        
        # Stage 2: Analyze GitHub (if URL available)
        print("🐙 Stage 2: Analyzing GitHub...")
        github_url = user_dict.get('github_url')
        github_analyzer = services.github_analyzer
        
        if github_url:
            try:
                github_result = github_analyzer.analyze_github_profile(github_url, max_repos=5)
                results['stages']['github_analysis'] = {
                    "status": "success",
                    "repos_analyzed": github_result.get('repos_analyzed', 0),
                    "skills_found": len(github_result.get('skills_found', {}))
                }
            except Exception as e:
                results['stages']['github_analysis'] = {"status": "failed", "error": str(e)}
        else:
            results['stages']['github_analysis'] = {"status": "skipped", "reason": "No GitHub URL"}
        
        # Stage 3: Get market requirements
        print("📊 Stage 3: Analyzing job market...")
        if services.has_linkedin_api():
            linkedin_fetcher = services.linkedin_fetcher
            job_analyzer = services.job_analyzer
            
            try:
                jobs_data = linkedin_fetcher.fetch_jobs(target_job, location, limit=30)
                jobs = linkedin_fetcher.get_job_details(jobs_data)
                market_requirements = job_analyzer.aggregate_job_requirements(jobs)
                results['stages']['market_analysis'] = {
                    "status": "success",
                    "jobs_analyzed": len(jobs),
                    "skills_identified": len(market_requirements)
                }
            except Exception as e:
                market_requirements = get_sample_market_requirements()
                results['stages']['market_analysis'] = {"status": "fallback", "error": str(e)}
        else:
            market_requirements = get_sample_market_requirements()
            results['stages']['market_analysis'] = {"status": "fallback", "reason": "API not configured"}
        
        # Stage 4: Gap analysis
        print("🔍 Stage 4: Performing gap analysis...")
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        
        user_skills = {}
        for row in user_skills_rows:
            skill_dict = dict(row)
            user_skills[skill_dict['skill_name']] = {
                'proficiency': skill_dict['proficiency'],
                'confidence': skill_dict['confidence']
            }
        
        gap_analyzer = services.gap_analyzer
        gap_result = gap_analyzer.analyze_gaps(user_skills, market_requirements)
        results['stages']['gap_analysis'] = {
            "status": "success",
            "overall_readiness": gap_result['overall_readiness'],
            "critical_gaps": len(gap_result['critical_gaps']),
            "strengths": len(gap_result['strengths'])
        }
        
        # Stage 5: Course recommendations
        print("📚 Stage 5: Generating course recommendations...")
        course_recommender = services.course_recommender
        
        skills_to_improve = [g['skill'] for g in gap_result['critical_gaps'][:3]]
        recommendations = []
        for skill in skills_to_improve:
            courses = course_recommender.search_courses_for_skill(skill, 2)
            recommendations.extend(courses)
        
        results['stages']['course_recommendations'] = {
            "status": "success",
            "skills_targeted": len(skills_to_improve),
            "courses_found": len(recommendations)
        }
        
        # Final summary
        results['summary'] = {
            "target_role": target_job,
            "overall_readiness": gap_result['overall_readiness'],
            "interpretation": gap_result['summary']['interpretation'],
            "top_priorities": gap_result['summary'].get('top_3_priorities', []),
            "user_skills": list(user_skills.keys()),
            "critical_gaps": [g['skill'] for g in gap_result['critical_gaps'][:5]],
            "recommended_courses": recommendations[:5]
        }
        
        return results


# ===== ROLE-BASED GAP ANALYSIS =====

def load_role_requirements():
    """Load role-specific market requirements from JSON file."""
    import os
    roles_file = os.path.join("app", "data", "role_requirements.json")
    try:
        with open(roles_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading role requirements: {e}")
        return {}


@router.get("/roles")
def get_available_roles():
    """Get list of available target roles for gap analysis."""
    roles_data = load_role_requirements()
    
    roles = []
    for role_id, role_info in roles_data.items():
        roles.append({
            "id": role_id,
            "title": role_info.get("title", role_id),
            "skills_count": len(role_info.get("skills", {}))
        })
    
    return {
        "message": "Available target roles",
        "total_roles": len(roles),
        "roles": roles
    }


@router.get("/roles/{role_id}/requirements")
def get_role_requirements(role_id: str):
    """Get market skills required for a specific role."""
    roles_data = load_role_requirements()
    
    if role_id not in roles_data:
        raise HTTPException(status_code=404, detail=f"Role '{role_id}' not found")
    
    role = roles_data[role_id]
    skills = role.get("skills", {})
    
    # Categorize skills
    critical = [s for s, d in skills.items() if d["requirement_level"] == "critical"]
    important = [s for s, d in skills.items() if d["requirement_level"] == "important"]
    emerging = [s for s, d in skills.items() if d["requirement_level"] == "emerging"]
    
    return {
        "role_id": role_id,
        "role_title": role.get("title", role_id),
        "total_skills": len(skills),
        "critical_skills": critical,
        "important_skills": important,
        "emerging_skills": emerging,
        "skills": skills
    }


@router.get("/market-skills/search/{role_name}")
def get_live_market_skills(
    role_name: str,
    force_refresh: bool = False,
    max_skills: int = 20
):
    """
    Fetch current trending skills for a role from the internet.
    
    Uses Tavily API to search for latest skill requirements.
    Results are cached for 24 hours unless force_refresh is True.
    
    Args:
        role_name: Job role title (e.g., "Frontend Developer", "Data Scientist")
        force_refresh: If True, bypass cache and search fresh
        max_skills: Maximum number of skills to return (default 20)
    
    Returns:
        Skills dictionary with frequency, requirement level, and trending status
    """
    services = get_services()
    market_searcher = services.market_skill_searcher
    
    # Search for role skills
    result = market_searcher.search_role_skills(
        role_title=role_name,
        force_refresh=force_refresh,
        max_skills=max_skills
    )
    
    skills = result.get("skills", {})
    
    # Categorize skills
    critical = [s for s, d in skills.items() if d.get("requirement_level") == "critical"]
    important = [s for s, d in skills.items() if d.get("requirement_level") == "important"]
    emerging = [s for s, d in skills.items() if d.get("requirement_level") == "emerging"]
    trending = [s for s, d in skills.items() if d.get("trending", False)]
    
    return {
        "message": "Live market skills fetched",
        "role": role_name,
        "source": result.get("source", "unknown"),
        "searched_at": result.get("searched_at"),
        "total_skills": len(skills),
        "critical_skills": critical,
        "important_skills": important,
        "emerging_skills": emerging,
        "trending_skills": trending,
        "skills": skills
    }

@router.get("/users/{user_id}/analyze-role/{role_id:path}")
def analyze_user_for_role(
    user_id: int,
    role_id: str,
    include_courses: bool = True,
    max_courses_per_skill: int = 3
):
    """
    Complete skill gap analysis for a user targeting a specific role.
    
    This endpoint:
    1. Searches internet for current trending skills for the role
    2. Fetches user's extracted skills
    3. Performs gap analysis (matching user skills vs role requirements)
    4. Identifies critical, important, and emerging skill gaps
    5. Recommends courses for each gap
    
    Args:
        role_id: Can be a role ID (like "frontend_developer") or a role name (like "Frontend Developer")
    
    Returns comprehensive analysis with readiness score and learning path.
    """
    services = get_services()
    roles_data = load_role_requirements()
    
    # Decode and normalize role name
    # role_id can be "frontend_developer" (old format) or "Frontend Developer" (new format)
    import urllib.parse
    role_name = urllib.parse.unquote(role_id)
    
    # Check if it's a role ID in our static data, otherwise use it as-is
    if role_name in roles_data:
        role_title = roles_data[role_name].get("title", role_name)
    else:
        # It's a free-text role name, use it directly
        role_title = role_name
    
    # Update user's target role in database for persistence
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET target_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (role_title, user_id))
    except Exception as e:
        print(f"⚠️ Failed to update target_role for user {user_id}: {e}")
    
    # Always use live market skills from Tavily search
    market_searcher = services.market_skill_searcher
    
    print(f"🔍 Searching live market skills for: {role_title}")
    live_result = market_searcher.search_role_skills(role_title)
    market_requirements = live_result.get("skills", {})
    skills_source = live_result.get("source", "web_search")
    
    # Print fetched skills to terminal
    print(f"\n{'='*60}")
    print(f"📋 FETCHED MARKET SKILLS FOR: {role_title}")
    print(f"   Source: {skills_source}")
    print(f"   Total Skills: {len(market_requirements)}")
    print(f"{'='*60}")
    for i, (skill, data) in enumerate(market_requirements.items(), 1):
        level = data.get('requirement_level', 'unknown')
        freq = int(data.get('frequency', 0) * 100)
        trending = "🔥" if data.get('trending', False) else ""
        print(f"   {i:2}. {skill:<25} | {level:<10} | {freq}% demand {trending}")
    print(f"{'='*60}\n")
    
    # Fallback to static data only if live search returns nothing
    if not market_requirements:
        print(f"⚠️ No live skills found, checking fallback data")
        # Try to find a matching role in static data
        role_lower = role_name.lower()
        matched_role_id = None
        
        for rid, rdata in roles_data.items():
            if rid == role_name or rdata.get("title", "").lower() == role_lower:
                matched_role_id = rid
                break
        
        if matched_role_id:
            market_requirements = roles_data[matched_role_id].get("skills", {})
            skills_source = "fallback"
            print(f"   ✅ Using fallback data for: {matched_role_id}")
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"No skills found for role '{role_title}'. Please check your internet connection or try a different role."
            )

    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify user exists
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's extracted skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        
        if not user_skills_rows:
            raise HTTPException(
                status_code=400, 
                detail="No skills found. Please extract skills from resume/GitHub first."
            )
        
        # Format user skills for comparison
        user_skills = {}
        for row in user_skills_rows:
            skill_dict = dict(row)
            skill_name = skill_dict['skill_name'].lower().strip()
            user_skills[skill_name] = {
                'proficiency': skill_dict['proficiency'],
                'confidence': skill_dict['confidence']
            }
        
        # Perform gap analysis
        gap_analyzer = services.gap_analyzer
        gap_result = gap_analyzer.analyze_gaps(user_skills, market_requirements)
        
        # Find matching and missing skills
        matched_skills = []
        missing_skills = []
        
        # Helper for partial matching (same logic as gap_analyzer)
        def normalize_skill(s):
            return s.lower().strip().replace('-', ' ').replace('_', ' ')
        
        user_skill_names = list(user_skills.keys())
        
        for skill, req in market_requirements.items():
            skill_normalized = normalize_skill(skill)
            
            # Try exact match first
            user_prof = user_skills.get(skill_normalized, {}).get('proficiency', 0)
            
            # If no exact match, try partial matching (e.g., "ml" in "machine learning")
            if user_prof == 0:
                for user_skill_name in user_skill_names:
                    user_normalized = normalize_skill(user_skill_name)
                    if skill_normalized in user_normalized or user_normalized in skill_normalized:
                        user_prof = user_skills[user_skill_name].get('proficiency', 0)
                        if user_prof > 0:
                            break
            
            if user_prof > 0:
                matched_skills.append({
                    "skill": skill,
                    "user_proficiency": round(user_prof, 2),
                    "required_proficiency": req.get('avg_proficiency_needed', 0.6),
                    "gap": round(req.get('avg_proficiency_needed', 0.6) - user_prof, 2),
                    "requirement_level": req.get('requirement_level', 'important'),
                    "market_frequency": f"{int(req.get('frequency', 0.5)*100)}%"
                })
            else:
                missing_skills.append({
                    "skill": skill,
                    "required_proficiency": req.get('avg_proficiency_needed', 0.6),
                    "requirement_level": req.get('requirement_level', 'important'),
                    "market_frequency": f"{int(req.get('frequency', 0.5)*100)}%"
                })
        
        # Sort by requirement level priority
        level_priority = {"critical": 0, "important": 1, "emerging": 2}
        missing_skills.sort(key=lambda x: (level_priority.get(x["requirement_level"], 3), -float(x["market_frequency"].rstrip('%'))/100))
        matched_skills.sort(key=lambda x: (-x["gap"], level_priority.get(x["requirement_level"], 3)))
        
        # Get course recommendations for gaps
        recommendations = []
        if include_courses:
            course_recommender = services.course_recommender
            
            # Recommend courses for top gaps
            skills_to_learn = []
            # Add missing critical skills first
            skills_to_learn.extend([s["skill"] for s in missing_skills if s["requirement_level"] == "critical"][:3])
            # Add skills with largest gaps
            skills_to_learn.extend([s["skill"] for s in gap_result['critical_gaps'][:2]])
            skills_to_learn.extend([s["skill"] for s in gap_result['important_gaps'][:2]])
            
            # Remove duplicates while preserving order
            seen = set()
            unique_skills = [s for s in skills_to_learn if not (s.lower() in seen or seen.add(s.lower()))]
            
            for skill in unique_skills[:5]:  # Limit to top 5
                courses = course_recommender.search_courses_for_skill(skill, max_courses_per_skill)
                if courses:
                    recommendations.append({
                        "skill": skill,
                        "priority": "critical" if skill in [s["skill"] for s in missing_skills if s["requirement_level"] == "critical"] else "important",
                        "courses": courses[:max_courses_per_skill]
                    })
        
        # Build response
        # Get role title (handle case when using live skills without role in static data)
        role_title = roles_data.get(role_id, {}).get("title", role_id.replace("_", " ").title())
        
        # Format market skills for display (skills fetched from internet for the target role)
        # Already sorted by demand (highest first) from market_skill_searcher
        fetched_market_skills = []
        for skill, req in market_requirements.items():
            fetched_market_skills.append({
                "skill": skill,
                "demand": req.get('frequency', 0),
                "demand_percentage": f"{int(req.get('frequency', 0) * 100)}%",
                "requirement_level": req.get('requirement_level', 'important'),
                "trending": req.get("trending", False)
            })
        
        # Sort by demand (descending) - highest demand first
        fetched_market_skills.sort(key=lambda x: x['demand'], reverse=True)
        
        return {
            "message": "Role-based skill gap analysis complete",
            "user_id": user_id,
            "target_role": {
                "id": role_id,
                "title": role_title
            },
            "skills_source": skills_source,  # "static", "web_search", or "fallback"
            "fetched_market_skills": fetched_market_skills,  # Skills fetched from internet for the target role
            "readiness": {
                "score": gap_result['overall_readiness'],
                "interpretation": gap_result['summary']['interpretation'],
                "level": "ready" if gap_result['overall_readiness'] >= 75 else "developing" if gap_result['overall_readiness'] >= 50 else "early"
            },
            "skills_analysis": {
                "total_role_skills": len(market_requirements),
                "user_skills_matched": len(matched_skills),
                "skills_missing": len(missing_skills),
                "match_percentage": round(len(matched_skills) / len(market_requirements) * 100, 1) if market_requirements else 0
            },
            "skill_gaps": {
                "critical": gap_result['critical_gaps'][:5],
                "important": gap_result['important_gaps'][:5],
                "emerging": gap_result['emerging_gaps'][:3]
            },
            "missing_skills": missing_skills[:10],
            "matched_skills": matched_skills[:10],
            "strengths": gap_result['strengths'][:5],
            "course_recommendations": recommendations,
            "learning_path": {
                "immediate_focus": [s["skill"] for s in missing_skills if s["requirement_level"] == "critical"][:3],
                "next_steps": [s["skill"] for s in missing_skills if s["requirement_level"] == "important"][:3],
                "future_skills": [s["skill"] for s in missing_skills if s["requirement_level"] == "emerging"][:2],
                "estimated_months": 3 if gap_result['overall_readiness'] >= 60 else 6 if gap_result['overall_readiness'] >= 40 else 9
            }
        }


@router.get("/users/{user_id}/gap-based-courses")
def get_gap_based_course_recommendations(
    user_id: int,
    role_id: Optional[str] = None,
    max_per_skill: int = 3
):
    """
    Get course recommendations based on skill gaps for a target role.
    Uses Tavily API to search for top courses for each skill gap.
    
    If role_id is not provided, tries to use user's profile target_role.
    """
    services = get_services()
    roles_data = load_role_requirements()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Get user and their target role
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_dict = dict(user)
        
        # Determine role to use
        target_role = role_id
        if not target_role:
            # Try to map user's target_role from profile
            profile_role = user_dict.get('target_role', '')
            if profile_role:
                # Map text to role ID
                role_mapping = {
                    'full stack': 'fullstack_developer',
                    'fullstack': 'fullstack_developer',
                    'frontend': 'frontend_developer',
                    'backend': 'backend_developer',
                    'data science': 'data_science_analyst',
                    'data analyst': 'data_science_analyst',
                    'machine learning': 'machine_learning_engineer',
                    'ml engineer': 'machine_learning_engineer',
                    'devops': 'devops_engineer',
                    'healthcare': 'healthcare_data_analyst',
                    'mobile': 'mobile_developer',
                }
                profile_lower = profile_role.lower()
                for key, value in role_mapping.items():
                    if key in profile_lower:
                        target_role = value
                        break
        
        if not target_role or target_role not in roles_data:
            # Default to fullstack if no match
            target_role = 'fullstack_developer'
        
        role = roles_data[target_role]
        market_requirements = role.get("skills", {})
        
        # Get user's skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        user_skills_rows = cursor.fetchall()
        
        if not user_skills_rows:
            raise HTTPException(
                status_code=400, 
                detail="No skills found. Please extract skills first."
            )
        
        # Format user skills
        user_skills = {}
        for row in user_skills_rows:
            skill_dict = dict(row)
            skill_name = skill_dict['skill_name'].lower().strip()
            user_skills[skill_name] = {
                'proficiency': skill_dict['proficiency'],
                'confidence': skill_dict['confidence']
            }
        
        # Perform gap analysis
        gap_analyzer = services.gap_analyzer
        gap_result = gap_analyzer.analyze_gaps(user_skills, market_requirements)
        
        # Get missing skills (not in user's skillset at all)
        missing_skills = []
        for skill, req in market_requirements.items():
            skill_lower = skill.lower()
            if skill_lower not in user_skills:
                missing_skills.append({
                    "skill": skill,
                    "requirement_level": req.get('requirement_level', 'important'),
                    "market_frequency": req.get('frequency', 0.5)
                })
        
        # Prioritize skills to get courses for
        skills_to_search = []
        
        # Add critical missing skills
        critical_missing = [s["skill"] for s in missing_skills if s["requirement_level"] == "critical"]
        skills_to_search.extend(critical_missing[:3])
        
        # Add critical gaps (have skill but need more)
        critical_gaps = [g["skill"] for g in gap_result["critical_gaps"]]
        skills_to_search.extend(critical_gaps[:2])
        
        # Add important gaps
        important_gaps = [g["skill"] for g in gap_result["important_gaps"]]
        skills_to_search.extend(important_gaps[:2])
        
        # Remove duplicates while preserving order
        seen = set()
        unique_skills = []
        for s in skills_to_search:
            s_lower = s.lower()
            if s_lower not in seen:
                seen.add(s_lower)
                unique_skills.append(s)
        
        # Search courses for each skill using Tavily
        course_recommender = services.course_recommender
        recommendations = []
        
        for skill in unique_skills[:6]:  # Limit to 6 skills
            priority = "critical" if skill.lower() in [s.lower() for s in critical_missing + critical_gaps] else "important"
            courses = course_recommender.search_courses_for_skill(skill, max_per_skill)
            
            if courses:
                recommendations.append({
                    "skill": skill,
                    "gap_priority": priority,
                    "courses": courses
                })
        
        return {
            "message": "Gap-based course recommendations",
            "user_id": user_id,
            "target_role": {
                "id": target_role,
                "title": role.get("title", target_role)
            },
            "readiness_score": gap_result['overall_readiness'],
            "skills_targeted": len(recommendations),
            "total_courses": sum(len(r["courses"]) for r in recommendations),
            "recommendations": recommendations,
            "learning_priority": {
                "critical_skills": critical_missing[:3] + critical_gaps[:2],
                "important_skills": important_gaps[:3]
            }
        }


