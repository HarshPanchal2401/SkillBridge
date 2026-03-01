"""Job search and analysis endpoints router with enhanced features."""
from typing import Optional

from fastapi import APIRouter, Query, Body

from app.routers.dependencies import get_services
from app.exceptions import ServiceUnavailableError, ValidationError
from app.logging_config import get_logger
from app.cache import (
    get_cached_market_requirements,
    cache_market_requirements
)

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])
logger = get_logger("jobs")


@router.get("/search")
def search_jobs(
    title: str = Query(
        default="Data Analyst",
        max_length=200,
        description="Job title to search"
    ),
    location: str = Query(
        default="United States",
        max_length=100,
        description="Location filter"
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Number of jobs to fetch"
    ),
    refresh: bool = Query(
        default=False,
        description="Bypass cache and fetch fresh results"
    ),
    experience_level: Optional[str] = Query(
        None,
        description="Experience level (entry_level, mid_senior_level)"
    ),
    min_match: Optional[int] = Query(
        None,
        ge=0,
        le=100,
        description="Minimum skill match percentage"
    ),
    user_id: Optional[int] = Query(
        None,
        description="User ID for skill matching"
    )
):
    """
    Search for jobs from LinkedIn.
    
    - **title**: Job title to search 
    - **location**: Location filter
    - **experience_level**: entry_level or mid_senior_level
    - **min_match**: Filter by skill match percentage (requires user_id)
    - **user_id**: Required if min_match is set
    """
    services = get_services()
    from app.database import get_db
    
    if not services.has_linkedin_api():
        raise ServiceUnavailableError(
            "Job Search API",
            "Set RAPIDAPI_KEY in .env to enable job search"
        )
    
    job_fetcher = services.linkedin_fetcher
    
    try:
        jobs_data = job_fetcher.fetch_jobs(
            title, 
            location, 
            limit, 
            use_cache=not refresh,
            experience_level=experience_level
        )
        jobs = job_fetcher.get_job_details(jobs_data)
        
        # Skill matching if user_id and min_match are provided
        if user_id and (min_match is not None or True): # Always calculate if user_id provided
            user_skills = {}
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT skill_name, proficiency FROM user_skills WHERE user_id = ?", (user_id,))
                user_skills = {row[0]: {'proficiency': row[1]} for row in cursor.fetchall()}
            
            if user_skills:
                gap_analyzer = services.gap_analyzer
                job_analyzer = services.job_analyzer
                
                for job in jobs:
                    # Extract skills from job description (limit to first 1000 chars for speed if needed)
                    job_skills_data = job_analyzer.extract_skills_from_job(job.get('description', ''))
                    
                    # Create temporary market requirements for this job
                    job_market_reqs = {
                        skill: {'frequency': 1.0, 'avg_proficiency_needed': prof}
                        for skill, prof in job_skills_data.get('required', {}).items()
                    }
                    
                    if job_market_reqs:
                        analysis = gap_analyzer.analyze_gaps(user_skills, job_market_reqs)
                        job['match_score'] = analysis.get('overall_readiness', 0)
                    else:
                        job['match_score'] = 0
                
                # Filter by min_match if provided
                if min_match and min_match > 0:
                    jobs = [j for j in jobs if j.get('match_score', 0) >= min_match]
        
        logger.info(f"Searched jobs: '{title}' in '{location}' - found {len(jobs)}")
        
        return {
            "success": True,
            "message": "Jobs fetched successfully",
            "data": {
                "jobs": jobs,
                "total_jobs": jobs_data.get('total', len(jobs)),
                "cached": jobs_data.get('cached', False),
                "search_params": {
                    "title": title,
                    "location": location,
                    "limit": limit
                }
            }
        }
    except Exception as e:
        logger.error(f"Job search failed: {e}")
        raise ServiceUnavailableError("LinkedIn API", str(e))


@router.post("/analyze")
def analyze_job_skills(
    job_description: str = Body(
        ...,
        min_length=50,
        max_length=50000,
        embed=True,
        description="Full job description text"
    )
):
    """
    Extract and analyze skills from a single job description.
    
    - **job_description**: Full job description text (min 50 characters)
    
    Returns required skills, preferred skills, and skill frequencies.
    """
    services = get_services()
    job_analyzer = services.job_analyzer
    
    try:
        skills = job_analyzer.extract_skills_from_job(job_description)
        
        logger.info(f"Analyzed job description: found {len(skills.get('all', []))} skills")
        
        return {
            "success": True,
            "message": "Job analyzed successfully",
            "data": {
                "required_skills": skills.get('required', []),
                "preferred_skills": skills.get('preferred', []),
                "all_skills": skills.get('all', []),
                "total_skills": len(skills.get('all', [])),
                "skill_categories": skills.get('categories', {})
            }
        }
    except Exception as e:
        logger.error(f"Job analysis failed: {e}")
        raise ValidationError(f"Failed to analyze job description: {str(e)}")


@router.post("/market-analysis")
def analyze_market_requirements(
    title: str = Query(
        default="Data Analyst",
        max_length=200,
        description="Job title to analyze"
    ),
    location: str = Query(
        default="United States",
        max_length=100,
        description="Location filter"
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Number of jobs to analyze"
    ),
    use_cache: bool = Query(
        default=True,
        description="Use cached results if available"
    )
):
    """
    Fetch jobs and analyze market skill requirements.
    
    Returns aggregated skill requirements across all fetched jobs.
    Results are cached for 1 hour by default.
    
    Requires RAPIDAPI_KEY to be configured in .env
    """
    services = get_services()
    
    if not services.has_linkedin_api():
        raise ServiceUnavailableError(
            "Job Search API",
            "Set RAPIDAPI_KEY in .env to enable market analysis"
        )
    
    # Check cache first
    if use_cache:
        cached = get_cached_market_requirements(title, location)
        if cached:
            logger.info(f"Market analysis cache hit: '{title}' in '{location}'")
            return {
                "success": True,
                "message": "Market analysis retrieved (cached)",
                "data": {
                    **cached,
                    "cached": True
                }
            }
    
    job_fetcher = services.linkedin_fetcher
    job_analyzer = services.job_analyzer
    
    try:
        # Fetch jobs
        jobs_data = job_fetcher.fetch_jobs(title, location, limit)
        jobs = job_fetcher.get_job_details(jobs_data)
        
        if not jobs:
            return {
                "success": True,
                "message": "No jobs found for analysis",
                "data": {
                    "jobs_analyzed": 0,
                    "search_params": {"title": title, "location": location},
                    "market_requirements": {},
                    "top_skills": []
                }
            }
        
        # Analyze market requirements
        market_requirements = job_analyzer.aggregate_job_requirements(jobs)
        
        # Get top skills sorted by frequency
        top_skills = sorted(
            market_requirements.items(),
            key=lambda x: x[1].get('frequency', 0),
            reverse=True
        )[:15]
        
        result = {
            "jobs_analyzed": len(jobs),
            "search_params": {"title": title, "location": location},
            "market_requirements": market_requirements,
            "top_skills": [skill for skill, _ in top_skills],
            "skill_summary": {
                "total_unique_skills": len(market_requirements),
                "critical_skills": sum(
                    1 for s in market_requirements.values()
                    if s.get('requirement_level') == 'critical'
                ),
                "important_skills": sum(
                    1 for s in market_requirements.values()
                    if s.get('requirement_level') == 'important'
                ),
                "emerging_skills": sum(
                    1 for s in market_requirements.values()
                    if s.get('requirement_level') == 'emerging'
                )
            }
        }
        
        # Cache the result
        cache_market_requirements(title, location, result)
        
        logger.info(f"Market analysis: '{title}' in '{location}' - {len(jobs)} jobs, {len(market_requirements)} skills")
        
        return {
            "success": True,
            "message": "Market analysis complete",
            "data": {
                **result,
                "cached": False
            }
        }
        
    except Exception as e:
        logger.error(f"Market analysis failed: {e}")
        raise ServiceUnavailableError("LinkedIn API", str(e))


@router.get("/skills/trending")
def get_trending_skills(
    category: Optional[str] = Query(
        None,
        description="Filter by skill category"
    )
):
    """
    Get trending skills based on market analysis.
    
    Uses sample data when market API is not available.
    """
    from app.routers.dependencies import get_sample_market_requirements
    
    market_data = get_sample_market_requirements()
    
    # Filter by category if provided
    if category:
        category_lower = category.lower()
        market_data = {
            k: v for k, v in market_data.items()
            if category_lower in k.lower()
        }
    
    # Sort by frequency
    trending = sorted(
        market_data.items(),
        key=lambda x: x[1].get('frequency', 0),
        reverse=True
    )
    
    return {
        "success": True,
        "message": "Trending skills retrieved",
        "data": {
            "skills": [
                {
                    "skill": skill,
                    "frequency": data.get('frequency', 0),
                    "level": data.get('requirement_level', 'unknown'),
                    "proficiency_needed": data.get('avg_proficiency_needed', 0)
                }
                for skill, data in trending
            ],
            "total": len(trending),
            "category_filter": category
        }
    }


@router.get("/recommendations/{user_id}")
def get_job_recommendations(
    user_id: int,
    limit: int = 10,
    refresh: bool = Query(
        default=False,
        description="Bypass cache and fetch fresh results"
    )
):
    """
    Get job recommendations based on user's target role.
    """
    from app.database import get_db

    
    services = get_services()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT target_role, location FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
             raise ServiceUnavailableError("Database", "User not found")
        
        target_role = user[0]
        location = user[1] or "United States"
        
        if not target_role:
            return {
                "success": False,
                "message": "No target role set. Please update your profile.",
                "data": {"jobs": []}
            }
            
        # Use existing search logic
        if not services.has_linkedin_api():
             # Fallback or error
             pass

        job_fetcher = services.linkedin_fetcher
        
        try:
            jobs_data = job_fetcher.fetch_jobs(target_role, location, limit, use_cache=not refresh)
            # Re-use search logic to include match score
            search_results = search_jobs(
                title=target_role, 
                location=location, 
                limit=limit, 
                refresh=refresh,
                user_id=user_id,
                experience_level=None,
                min_match=None
            )
            
            return {
                "success": True,
                "message": f"Recommendations for '{target_role}'",
                "data": {
                    "jobs": search_results["data"]["jobs"],
                    "target_role": target_role,
                    "location": location
                }
            }
        except Exception as e:
            logger.error(f"Recommendation failed: {e}")
            raise ServiceUnavailableError("Job Search API", str(e))
