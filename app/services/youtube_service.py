import os
import requests
from typing import List, Dict, Optional
from app.logging_config import get_logger

logger = get_logger("youtube_service")

class YoutubeService:
    """Service to search for high-quality YouTube learning resources."""
    
    def __init__(self, tavily_api_key: Optional[str] = None):
        self.tavily_key = tavily_api_key or os.getenv("TAVILY_API_KEY")
        
    def search_playlists(self, skill: str, language: str = "English", limit: int = 3) -> List[Dict]:
        """
        Search for best YouTube playlists for a specific skill.
        Uses Tavily to find curated learning lists.
        """
        if not self.tavily_key:
            logger.warning("⚠️ YoutubeService: No Tavily key. Using mock results.")
            return self._get_mock_playlists(skill)
            
        query = f"best youtube playlist to learn {skill} in {language} for developers 2025"
        
        try:
            # Note: In a real scenario, we might use the YouTube Data API.
            # Here we use Tavily to find the actual best-rated lists mentioned in blogs/reddit.
            response = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.tavily_key,
                    "query": query,
                    "search_depth": "advanced",
                    "max_results": 5
                },
                timeout=10
            )
            
            results = response.json().get("results", [])
            playlists = []
            
            for res in results:
                url = res.get("url", "")
                if "youtube.com/playlist" in url or "youtube.com/watch" in url:
                    # Extract playlist/video details
                    playlists.append({
                        "title": res.get("title", f"{skill} Mastery"),
                        "url": url,
                        "thumbnail": self._get_thumbnail(url),
                        "snippet": res.get("content", "")[:200]
                    })
            
            if not playlists:
                return self._get_mock_playlists(skill)
                
            return playlists[:limit]
            
        except Exception as e:
            logger.error(f"❌ Youtube search failed: {e}")
            return self._get_mock_playlists(skill)

    def _get_thumbnail(self, url: str) -> str:
        """Extract thumbnail from youtube URL."""
        video_id = ""
        if "v=" in url:
            video_id = url.split("v=")[1].split("&")[0]
        elif "playlist?list=" in url:
            # We don't easily get the first video thumb from a playlist URL without API
            return "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg" # Fallback
            
        if video_id:
            return f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
        return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=300"

    def _get_mock_playlists(self, skill: str) -> List[Dict]:
        """Fallback mock data."""
        return [
            {
                "title": f"Complete {skill} Roadmap 2025",
                "url": "https://www.youtube.com/playlist?list=PL4Gr5tOafJJn9v3z-F7K0yG1-v-Vv-VvV",
                "thumbnail": "https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&q=80&w=300",
                "snippet": f"The ultimate guide to mastering {skill} from scratch."
            }
        ]
