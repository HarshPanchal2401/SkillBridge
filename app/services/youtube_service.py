"""YouTube Service — Uses YouTube Data API v3 to find playlists and high-view oneshot videos."""
import os
import re
import httpx
from typing import List, Dict, Optional, Any
from app.logging_config import get_logger

logger = get_logger("youtube_service")


class YoutubeService:
    """
    Service to search YouTube for the best learning resources per skill.
    Returns exactly 1 playlist (with all its videos) + 1 high-view oneshot video.
    Supports Hindi/English language switching.
    """

    YT_API_BASE = "https://www.googleapis.com/youtube/v3"

    def __init__(self, youtube_api_key: Optional[str] = None, tavily_api_key: Optional[str] = None):
        self.api_key = youtube_api_key or os.getenv("YOUTUBE_API_KEY", "")
        self.tavily_key = tavily_api_key or os.getenv("TAVILY_API_KEY", "")
        self._cache: Dict[str, Any] = {}

        if not self.api_key:
            logger.warning("⚠️ YoutubeService: YOUTUBE_API_KEY not set. Will use Tavily fallback.")

    # ────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ────────────────────────────────────────────────────────────────────

    async def get_resources_for_skill(
        self, skill: str, language: str = "English"
    ) -> Dict[str, Any]:
        """
        Get exactly 2 resources for a skill:
          - playlist: full playlist with list of videos
          - oneshot: single high-view video
        """
        cache_key = f"{skill}_{language}"
        if cache_key in self._cache:
            logger.info(f"📦 Cache hit for {cache_key}")
            return self._cache[cache_key]

        playlist = await self._search_playlist(skill, language)
        oneshot = await self._search_oneshot(skill, language)

        result = {"playlist": playlist, "oneshot": oneshot}
        self._cache[cache_key] = result
        return result

    # ────────────────────────────────────────────────────────────────────
    # PLAYLIST SEARCH
    # ────────────────────────────────────────────────────────────────────

    async def _search_playlist(self, skill: str, language: str) -> Dict[str, Any]:
        """Find the best playlist for a skill and fetch all its video items."""
        lang_kw = "in Hindi" if language.lower() == "hindi" else ""
        relevance_lang = "hi" if language.lower() == "hindi" else "en"

        if self.api_key:
            try:
                return await self._yt_api_playlist(skill, lang_kw, relevance_lang)
            except Exception as e:
                logger.error(f"❌ YouTube API playlist search failed: {e}")

        # Fallback to Tavily
        return await self._tavily_playlist_fallback(skill, language)

    async def _yt_api_playlist(self, skill: str, lang_kw: str, relevance_lang: str) -> Dict[str, Any]:
        """Use YouTube Data API v3 to find a popular playlist."""
        query = f"best {skill} complete course playlist {lang_kw} 2025 most viewed".strip()

        async with httpx.AsyncClient(timeout=15) as client:
            # Step 1: Search for playlists
            resp = await client.get(f"{self.YT_API_BASE}/search", params={
                "key": self.api_key,
                "q": query,
                "type": "playlist",
                "part": "snippet",
                "maxResults": 5,
                "relevanceLanguage": relevance_lang,
                "order": "viewCount", # Favor highly viewed playlists
            })
            data = resp.json()

            if "error" in data:
                logger.error(f"YouTube API error: {data['error']}")
                raise Exception(data["error"].get("message", "API error"))

            items = data.get("items", [])
            if not items:
                return self._empty_playlist(skill)

            # Pick first playlist
            pl = items[0]
            playlist_id = pl["id"]["playlistId"]
            snippet = pl["snippet"]

            # Step 2: Get playlist items (videos inside the playlist)
            videos = await self._fetch_playlist_items(client, playlist_id)

            return {
                "playlist_id": playlist_id,
                "title": snippet.get("title", f"{skill} Playlist"),
                "channel": snippet.get("channelTitle", "Unknown"),
                "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url",
                    snippet.get("thumbnails", {}).get("medium", {}).get("url", "")),
                "video_count": len(videos),
                "videos": videos,
            }

    async def _fetch_playlist_items(self, client: httpx.AsyncClient, playlist_id: str) -> List[Dict]:
        """Fetch all videos in a playlist (up to 250)."""
        videos = []
        next_page = None

        for _ in range(5):  # Max 5 pages = 250 videos
            params: Dict[str, Any] = {
                "key": self.api_key,
                "playlistId": playlist_id,
                "part": "snippet,contentDetails",
                "maxResults": 50,
            }
            if next_page:
                params["pageToken"] = next_page

            resp = await client.get(f"{self.YT_API_BASE}/playlistItems", params=params)
            data = resp.json()

            for item in data.get("items", []):
                snip = item.get("snippet", {})
                cd = item.get("contentDetails", {})
                vid_id = cd.get("videoId", "")
                if vid_id:
                    videos.append({
                        "video_id": vid_id,
                        "title": snip.get("title", "Untitled"),
                        "thumbnail": snip.get("thumbnails", {}).get("medium", {}).get("url", ""),
                        "position": snip.get("position", 0),
                    })

            next_page = data.get("nextPageToken")
            if not next_page:
                break

        return videos

    # ────────────────────────────────────────────────────────────────────
    # ONESHOT VIDEO SEARCH
    # ────────────────────────────────────────────────────────────────────

    async def _search_oneshot(self, skill: str, language: str) -> Dict[str, Any]:
        """Find 1 high-view oneshot/complete-course video."""
        lang_kw = "in Hindi" if language.lower() == "hindi" else ""
        relevance_lang = "hi" if language.lower() == "hindi" else "en"

        if self.api_key:
            try:
                return await self._yt_api_oneshot(skill, lang_kw, relevance_lang)
            except Exception as e:
                logger.error(f"❌ YouTube API oneshot search failed: {e}")

        return await self._tavily_oneshot_fallback(skill, language)

    async def _yt_api_oneshot(self, skill: str, lang_kw: str, relevance_lang: str) -> Dict[str, Any]:
        """Use YouTube Data API to find the highest-view oneshot video."""
        query = f"best {skill} full course one shot tutorial {lang_kw} 2025 most viewed".strip()

        async with httpx.AsyncClient(timeout=15) as client:
            # Search for long videos sorted by view count
            resp = await client.get(f"{self.YT_API_BASE}/search", params={
                "key": self.api_key,
                "q": query,
                "type": "video",
                "part": "snippet",
                "maxResults": 10,
                "relevanceLanguage": relevance_lang,
                "order": "viewCount",
                "videoDuration": "long",  # > 20 minutes
            })
            data = resp.json()

            if "error" in data:
                raise Exception(data["error"].get("message", "API error"))

            items = data.get("items", [])
            if not items:
                return self._empty_oneshot(skill)

            # Get video IDs to fetch view counts & durations
            video_ids = [item["id"]["videoId"] for item in items]

            # Fetch video statistics
            stats_resp = await client.get(f"{self.YT_API_BASE}/videos", params={
                "key": self.api_key,
                "id": ",".join(video_ids),
                "part": "statistics,contentDetails,snippet",
            })
            stats_data = stats_resp.json()

            # Pick the video with highest view count
            best = None
            best_views = 0
            for v in stats_data.get("items", []):
                views = int(v.get("statistics", {}).get("viewCount", "0"))
                if views > best_views:
                    best_views = views
                    best = v

            if not best:
                return self._empty_oneshot(skill)

            duration_iso = best.get("contentDetails", {}).get("duration", "PT0M")
            snip = best.get("snippet", {})

            return {
                "video_id": best["id"],
                "title": snip.get("title", f"{skill} Complete Course"),
                "channel": snip.get("channelTitle", "Unknown"),
                "thumbnail": snip.get("thumbnails", {}).get("high", {}).get("url",
                    snip.get("thumbnails", {}).get("medium", {}).get("url", "")),
                "duration": duration_iso,
                "duration_text": self._format_duration(duration_iso),
                "view_count": best_views,
                "view_count_text": self._format_views(best_views),
            }

    # ────────────────────────────────────────────────────────────────────
    # TAVILY FALLBACKS (when YouTube API key is not available)
    # ────────────────────────────────────────────────────────────────────

    async def _tavily_playlist_fallback(self, skill: str, language: str) -> Dict[str, Any]:
        """Search for a playlist using Tavily web search."""
        if not self.tavily_key:
            return self._empty_playlist(skill)

        lang_kw = "Hindi" if language.lower() == "hindi" else "English"
        query = f"best youtube playlist complete course {skill} in {lang_kw} 2025"

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post("https://api.tavily.com/search", json={
                    "api_key": self.tavily_key,
                    "query": query,
                    "search_depth": "advanced",
                    "max_results": 5,
                })
            results = resp.json().get("results", [])

            for res in results:
                url = res.get("url", "")
                if "playlist?list=" in url:
                    pl_id = url.split("list=")[1].split("&")[0]
                    
                    # If we found an ID, and we have a YouTube API key, let's fetch the videos!
                    videos = []
                    if self.api_key:
                        async with httpx.AsyncClient(timeout=10) as client_yt:
                            videos = await self._fetch_playlist_items(client_yt, pl_id)
                    
                    return {
                        "playlist_id": pl_id,
                        "title": res.get("title", f"{skill} Complete Playlist").split(" - YouTube")[0],
                        "channel": "YouTube",
                        "thumbnail": f"https://img.youtube.com/vi/default/mqdefault.jpg",
                        "video_count": len(videos),
                        "videos": videos,
                    }

            # If no playlist URL found, return first YouTube result as a pseudo playlist
            for res in results:
                url = res.get("url", "")
                if "youtube.com/watch" in url or "youtu.be/" in url:
                    vid = ""
                    if "v=" in url:
                        vid = url.split("v=")[1].split("&")[0]
                    elif "youtu.be/" in url:
                        vid = url.split("youtu.be/")[1].split("?")[0]
                    
                    if vid:
                        return {
                            "playlist_id": "",
                            "title": res.get("title", f"{skill} Complete Course").split(" - YouTube")[0],
                            "channel": "YouTube",
                            "thumbnail": f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                            "video_count": 1,
                            "videos": [{"video_id": vid, "title": res.get("title", ""), "thumbnail": "", "position": 0}],
                        }
        except Exception as e:
            logger.error(f"Tavily playlist fallback failed: {e}")

        return self._empty_playlist(skill)

    async def _tavily_oneshot_fallback(self, skill: str, language: str) -> Dict[str, Any]:
        """Search for a oneshot video using Tavily."""
        if not self.tavily_key:
            return self._empty_oneshot(skill)

        lang_kw = "Hindi" if language.lower() == "hindi" else "English"
        query = f"best youtube one shot video full course {skill} in {lang_kw} most popular tutorial 2025"

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post("https://api.tavily.com/search", json={
                    "api_key": self.tavily_key,
                    "query": query,
                    "search_depth": "advanced",
                    "max_results": 8, # More results to find a better video link
                })
            results = resp.json().get("results", [])

            for res in results:
                url = res.get("url", "")
                if "youtube.com" in url or "youtu.be" in url:
                    if "playlist" in url: continue # Skip playlists here
                    
                    vid = ""
                    if "v=" in url:
                        vid = url.split("v=")[1].split("&")[0]
                    elif "youtu.be/" in url:
                        vid = url.split("youtu.be/")[1].split("?")[0]
                    
                    if vid:
                        return {
                            "video_id": vid,
                            "title": res.get("title", f"{skill} Complete Course").split(" - YouTube")[0],
                            "channel": "YouTube",
                            "thumbnail": f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                            "duration": "",
                            "duration_text": "",
                            "view_count": 0,
                            "view_count_text": "Popular",
                        }
        except Exception as e:
            logger.error(f"Tavily oneshot fallback failed: {e}")

        return self._empty_oneshot(skill)

    # ────────────────────────────────────────────────────────────────────
    # HELPERS
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def _empty_playlist(skill: str) -> Dict[str, Any]:
        return {
            "playlist_id": "",
            "title": f"{skill} — No playlist found",
            "channel": "",
            "thumbnail": "",
            "video_count": 0,
            "videos": [],
        }

    @staticmethod
    def _empty_oneshot(skill: str) -> Dict[str, Any]:
        return {
            "video_id": "",
            "title": f"{skill} — No oneshot found",
            "channel": "",
            "thumbnail": "",
            "duration": "",
            "duration_text": "",
            "view_count": 0,
            "view_count_text": "",
        }

    @staticmethod
    def _format_duration(iso_dur: str) -> str:
        """Convert ISO 8601 duration like PT1H2M30S to '1h 2m'."""
        m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_dur or "")
        if not m:
            return ""
        parts = []
        if m.group(1):
            parts.append(f"{m.group(1)}h")
        if m.group(2):
            parts.append(f"{m.group(2)}m")
        if not parts and m.group(3):
            parts.append(f"{m.group(3)}s")
        return " ".join(parts)

    @staticmethod
    def _format_views(count: int) -> str:
        if count >= 1_000_000:
            return f"{count / 1_000_000:.1f}M views"
        if count >= 1_000:
            return f"{count / 1_000:.1f}K views"
        return f"{count} views"
