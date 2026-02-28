"""Job fetcher using JobSpy (free scraping) with Mock Data fallback."""
import os
import json
import random
import csv
import math
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

# Try importing jobspy, but don't fail if not installed (fallback to mock)
try:
    from jobspy import scrape_jobs
    import pandas as pd
    HAS_JOBSPY = True
except ImportError:
    HAS_JOBSPY = False
    print("⚠️ JobSpy or Pandas not installed. Using mock data only.")


class JobFetcher:
    """Fetch jobs using JobSpy (free) or return mock data."""
    
    def __init__(self, api_key: str = None):
        """Initialize (api_key is ignored/optional now)."""
        self.cache_dir = "app/data/cached_jobs"
        os.makedirs(self.cache_dir, exist_ok=True)
        # We don't really need an API key for JobSpy, but keeping signature compatible

    def _clean_data(self, data: Any) -> Any:
        """Recursively remove NaNs from data to ensure JSON compliance."""
        if isinstance(data, float) and (math.isnan(data) or math.isinf(data)):
            return None
        if isinstance(data, dict):
            return {k: self._clean_data(v) for k, v in data.items()}
        if isinstance(data, list):
            return [self._clean_data(v) for v in data]
        return data
    
    def _get_cache_filename(self, title: str, location: str, experience_level: str = None) -> str:
        """Generate cache filename."""
        safe_title = title.replace(' ', '_').replace('/', '_')
        safe_location = location.replace(' ', '_').replace('/', '_')
        exp_suffix = f"_{experience_level}" if experience_level else ""
        return f"jobspy_{safe_title}_{safe_location}{exp_suffix}.json"
    
    def _load_from_cache(self, title: str, location: str, experience_level: str = None) -> Optional[Dict]:
        """Load from cache if fresh (< 4 hours)."""
        cache_file = os.path.join(self.cache_dir, self._get_cache_filename(title, location, experience_level))
        if os.path.exists(cache_file):
            if (datetime.now().timestamp() - os.path.getmtime(cache_file)) < 4 * 3600:
                print(f"📦 Loading jobs from cache: {cache_file}")
                with open(cache_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return self._clean_data(data)
        return None
    
    def _save_to_cache(self, title: str, location: str, jobs_data: Dict, experience_level: str = None):
        """Save to cache."""
        cache_file = os.path.join(self.cache_dir, self._get_cache_filename(title, location, experience_level))
        with open(cache_file, 'w', encoding='utf-8') as f:
            clean_data = self._clean_data(jobs_data)
            json.dump(clean_data, f, indent=2, ensure_ascii=False)
    
    def fetch_jobs(
        self,
        title: str,
        location: str = "United States",
        limit: int = 10,
        page: int = 1,
        use_cache: bool = True,
        experience_level: str = None
    ) -> Dict:
        """
        Fetch jobs using JobSpy (LinkedIn, Indeed, etc.) or fallback to mock.
        """
        # Safety check for FastAPI Query objects leaking into internal calls
        if not isinstance(title, str): title = str(getattr(title, 'default', ''))
        if not isinstance(location, str): location = str(getattr(location, 'default', 'United States'))
        if not isinstance(experience_level, (str, type(None))): 
            experience_level = str(getattr(experience_level, 'default', '')) or None

        if use_cache:
            cached = self._load_from_cache(title, location, experience_level)
            if cached:
                cached['cached'] = True
                return cached

        # Refine search term if experience level is provided
        search_term = title
        if experience_level and isinstance(experience_level, str):
            if experience_level.lower() in ['fresher', 'entry', 'entry_level']:
                search_term = f"{title} entry level"
            elif experience_level.lower() in ['experienced', 'senior', 'mid_senior_level']:
                search_term = f"{title} experienced"

        print(f"🔍 Scraping jobs for '{search_term}' in '{location}'...")
        
        jobs_list = []
        error = None
        
        # 1. Attempt JobSpy Scrape
        if HAS_JOBSPY:
            try:
                # Scrape from multiple sites
                jobs_df = scrape_jobs(
                    site_name=["linkedin", "indeed", "glassdoor"],
                    search_term=search_term,
                    location=location,
                    results_wanted=limit,
                    country_indeed='USA' if 'states' in location.lower() or 'usa' in location.lower() else 'India',
                    # proxies=["http://..."] # Add proxies if needed
                )
                
                if jobs_df is not None and not jobs_df.empty:
                    print(f"✅ JobSpy found {len(jobs_df)} jobs")
                    
                    # Convert DataFrame to list of dicts, replacing NaN with None
                    jobs_df = jobs_df.replace({float('nan'): None})
                    jobs_list = jobs_df.to_dict('records')
                    
                    # Normalize keys locally
                    normalized_jobs = []
                    for job in jobs_list:
                        normalized_jobs.append({
                            'job_id': str(job.get('id', '')),
                            'job_title': job.get('title'),
                            'employer_name': job.get('company'),
                            'job_city': job.get('location'),
                            'job_country': location, # Approximation
                            'job_description': job.get('description'),
                            'job_posted_at_datetime_utc': str(job.get('date_posted', '')),
                            'job_apply_link': job.get('job_url'),
                            'job_employment_type': job.get('job_type', 'Full-time'),
                            'site': job.get('site', 'unknown')
                        })
                    jobs_list = normalized_jobs
                else:
                    print("⚠️ JobSpy returned no jobs (blocked or empty).")
                    
            except Exception as e:
                print(f"❌ JobSpy failed: {e}")
                error = str(e)
        
        # 2. Fallback to Mock Data if scraping failed or returned nothing
        if not jobs_list:
            print("⚠️ Switching to MOCK DATA fallback.")
            jobs_list = self._generate_mock_jobs(title, location, limit, experience_level)
            
        result = {
            'jobs': jobs_list,
            'total': len(jobs_list),
            'search_params': {
                'title': title, 
                'location': location,
                'experience_level': experience_level
            },
            'cached': False,
            'timestamp': datetime.now().isoformat()
        }
        
        if use_cache and jobs_list:
            self._save_to_cache(title, location, result, experience_level)
            
        return self._clean_data(result)

    def get_job_details(self, jobs_data: Dict) -> List[Dict]:
        """Normalize job data."""
        raw_jobs = jobs_data.get('jobs', [])
        extracted = []
        
        for job in raw_jobs:
            extracted.append({
                'id': job.get('job_id') or str(random.randint(10000, 99999)),
                'title': job.get('job_title', 'Job Opportunity'),
                'company': job.get('employer_name', 'Hiring Company'),
                'location': job.get('job_city', '') or jobs_data['search_params']['location'],
                'description': job.get('job_description', 'No description available.'),
                'posted_date': self._format_date(job.get('job_posted_at_datetime_utc')),
                'salary': None, # JobSpy often doesn't get salary
                'url': job.get('job_apply_link', '#'),
                'employment_type': job.get('job_employment_type', 'Full-time'),
                'logo': None,
                'source': job.get('site', 'unknown').capitalize()
            })
            
        return self._clean_data(extracted)

    def _format_date(self, date_val: Any) -> str:
        """Format date."""
        if not date_val:
            return "Recently"
        return str(date_val).split(' ')[0] # Keep it simple

    def _generate_mock_jobs(self, title: str, location: str, count: int, experience_level: str = None) -> List[Dict]:
        """Generate realistic mock jobs for fallback with diverse sources."""
        mock_jobs = []
        
        companies = [
            "TechFlow Solutions", "DataDriven Corp", "HealthCure Systems", 
            "InnovateX", "CloudScale Inc", "CyberGuard", "EcoSoft", 
            "FinTech Global", "EduTech Pioneers", "RetailNext"
        ]
        
        sources = ["indeed", "glassdoor", "linkedin"]
        
        # Adjust title based on experience level for mock data
        display_title = title
        if experience_level:
            if experience_level.lower() in ['fresher', 'entry', 'entry_level']:
                display_title = f"Entry Level {title}"
            elif experience_level.lower() in ['experienced', 'senior', 'mid_senior_level']:
                display_title = f"Senior {title}"

        for i in range(count):
            site = random.choice(sources)
            company = random.choice(companies)
            job_title = f"{display_title} at {company}"
            
            # Create source-specific links
            if site == "indeed":
                apply_link = f"https://www.indeed.com/jobs?q={title.replace(' ', '+')}"
            elif site == "glassdoor":
                apply_link = f"https://www.glassdoor.com/Job/jobs.htm?sc.keyword={title.replace(' ', '%20')}"
            else:
                apply_link = "https://www.linkedin.com/jobs"
                
            mock_jobs.append({
                'job_id': f"mock-{site}-{random.randint(1000, 9999)}",
                'job_title': job_title,
                'employer_name': company,
                'job_city': location,
                'job_country': "India" if "india" in location.lower() else "USA",
                'job_description': f"We are looking for a talented {title} to join our team at {company}. "
                                   f"This role is based in {location} and involves working on {site} projects.",
                'job_posted_at_datetime_utc': (datetime.now() - timedelta(days=random.randint(0, 5))).isoformat(),
                'job_apply_link': apply_link,
                'job_employment_type': "Full-time",
                'site': site
            })
            
        return mock_jobs
