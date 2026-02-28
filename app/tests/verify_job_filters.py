
import json
from app.services.job_fetcher import JobFetcher
from app.routers.dependencies import get_services

def test_job_fetcher_with_experience():
    print("Testing JobFetcher with experience level...")
    fetcher = JobFetcher()
    
    # Test with Fresher
    data_fresher = fetcher.fetch_jobs("Software Engineer", experience_level="entry_level", limit=2)
    print(f"Fresher search params: {data_fresher['search_params']}")
    for job in data_fresher['jobs']:
        print(f" - Job: {job.get('job_title') or job.get('title')}")
        
    # Test with Experienced
    data_exp = fetcher.fetch_jobs("Software Engineer", experience_level="mid_senior_level", limit=2)
    print(f"\nExperienced search params: {data_exp['search_params']}")
    for job in data_exp['jobs']:
        print(f" - Job: {job.get('job_title') or job.get('title')}")

if __name__ == "__main__":
    try:
        test_job_fetcher_with_experience()
        print("\n✅ Verification script completed.")
    except Exception as e:
        print(f"\n❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()
