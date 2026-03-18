import os
import httpx
import asyncio
from typing import List, Dict, Optional
from app.logging_config import get_logger

logger = get_logger("youtube_service")

class YoutubeService:
    """Service to search for high-quality YouTube learning resources."""
    
    def __init__(self, tavily_api_key: Optional[str] = None):
        self.tavily_key = tavily_api_key or os.getenv("TAVILY_API_KEY")
        self._cache = {} # Simple memory cache for search results
        
    async def search_playlists(self, skill: str, language: str = "English", limit: int = 3) -> List[Dict]:
        """
        Search for best YouTube playlists for a specific skill.
        Uses Tavily to find curated learning lists.
        """
        if not self.tavily_key:
            logger.warning("⚠️ YoutubeService: No Tavily key. Using fallback results.")
            return self._get_smart_fallback(skill)
            
        # Check cache first
        cache_key = f"{skill}_{language}_{limit}"
        if cache_key in self._cache:
            return self._cache[cache_key]
            
        # Try YouTube-specific search first
        yt_query = f"best youtube playlist or complete course to learn {skill} in {language} 2025"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.tavily_key,
                        "query": yt_query,
                        "search_depth": "advanced",
                        "max_results": 10
                    },
                    timeout=15
                )
            
            results = response.json().get("results", [])
            resources = []
            
            for res in results:
                url = res.get("url", "")
                is_youtube = "youtube.com" in url or "youtu.be" in url
                
                res_type = "video"
                if "playlist?list=" in url:
                    res_type = "playlist"
                elif not is_youtube:
                    res_type = "article" # Documentation or Blog

                resources.append({
                    "title": res.get("title", f"{skill} Mastery"),
                    "url": url,
                    "thumbnail": self._get_thumbnail(url) if is_youtube else "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=300",
                    "snippet": res.get("content", "")[:200],
                    "platform": "YouTube" if is_youtube else self._extract_platform(url),
                    "type": res_type
                })
            
            # Prioritize YouTube, then others
            yt_only = [r for r in resources if r["platform"] == "YouTube"]
            others = [r for r in resources if r["platform"] != "YouTube"]
            
            final_list = (yt_only + others)
            
            result = final_list[:limit] if final_list else self._get_smart_fallback(skill)
            
            # Save to cache
            self._cache[cache_key] = result
            return result
            
        except Exception as e:
            logger.error(f"❌ Resource search failed: {e}")
            return self._get_smart_fallback(skill)

    def _extract_platform(self, url: str) -> str:
        """Extract a readable platform name from URL."""
        if "coursera.org" in url: return "Coursera"
        if "udemy.com" in url: return "Udemy"
        if "github.com" in url: return "GitHub"
        if "medium.com" in url: return "Medium"
        if "mozilla.org" in url: return "MDN"
        if "freecodecamp.org" in url: return "freeCodeCamp"
        return "Documentation"

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

    def _get_smart_fallback(self, skill: str) -> List[Dict]:
        """Highly reliable fallback search queries."""
        return [
            {
                "title": f"{skill} Official Documentation",
                "url": f"https://www.google.com/search?q={skill}+official+docs",
                "thumbnail": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=300",
                "snippet": f"The definitive guide to learning {skill} from the creators.",
                "platform": "Official Docs",
                "type": "article"
            },
            {
                "title": f"Complete {skill} Mastery 2025",
                "url": "https://www.youtube.com/playlist?list=PL4Gr5tOafJJn9v3z-F7K0yG1-v-Vv-VvV",
                "thumbnail": "https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&q=80&w=300",
                "snippet": f"The ultimate guide to mastering {skill} from scratch.",
                "platform": "YouTube",
                "type": "playlist"
            }
        ]
