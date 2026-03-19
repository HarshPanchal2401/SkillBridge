"""Tutor Router - AI Tutor chatbot endpoints for video-based learning."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.routers.dependencies import get_services
from app.logging_config import get_logger

router = APIRouter(prefix="/api/tutor", tags=["AI Tutor"])
logger = get_logger("tutor_router")


class TutorChatRequest(BaseModel):
    """Request body for tutor chat."""
    video_id: str
    video_title: str
    message: str
    session_id: Optional[str] = None
    language: Optional[str] = "English"


class TutorChatResponse(BaseModel):
    """Response body for tutor chat."""
    reply: str
    session_id: str


@router.post("/chat", response_model=TutorChatResponse)
async def tutor_chat(request: TutorChatRequest):
    """
    Chat with the AI tutor about a specific YouTube video.
    Supports bilingual (Hindi/English) conversations.
    """
    services = get_services()
    tutor = services.tutor_service

    if not tutor:
        raise HTTPException(status_code=503, detail="AI Tutor service is not configured")

    result = await tutor.chat(
        video_id=request.video_id,
        video_title=request.video_title,
        user_message=request.message,
        session_id=request.session_id,
        language=request.language or "English",
    )

    return TutorChatResponse(
        reply=result["reply"],
        session_id=result["session_id"]
    )


@router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear a tutor chat session."""
    services = get_services()
    tutor = services.tutor_service

    if tutor and tutor.clear_session(session_id):
        return {"message": "Session cleared successfully"}
    
    raise HTTPException(status_code=404, detail="Session not found")


class FindVideoRequest(BaseModel):
    """Request body for finding a YouTube video."""
    title: str
    channel: Optional[str] = None


@router.post("/find-video")
async def find_video(request: FindVideoRequest):
    """
    Search for a YouTube video by title and channel name.
    Returns the video ID that can be used to embed the video.
    """
    import httpx
    import os
    import re

    tavily_key = os.getenv("TAVILY_API_KEY", "")
    
    query = f"youtube {request.title}"
    if request.channel:
        query += f" {request.channel}"

    video_id = ""

    if tavily_key:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": tavily_key,
                        "query": query,
                        "search_depth": "basic",
                        "max_results": 5
                    },
                    timeout=10
                )
            
            results = response.json().get("results", [])
            for res in results:
                url = res.get("url", "")
                if "youtube.com" in url or "youtu.be" in url:
                    # Extract video ID
                    if "v=" in url:
                        video_id = url.split("v=")[1].split("&")[0]
                    elif "youtu.be/" in url:
                        video_id = url.split("youtu.be/")[1].split("?")[0]
                    if video_id:
                        break
        except Exception as e:
            logger.warning(f"Tavily search failed: {e}")

    # Fallback: construct a search-based result
    if not video_id:
        # Return empty - frontend will use YouTube search embed
        return {"video_id": "", "search_query": query}

    return {"video_id": video_id, "search_query": query}
