"""AI Tutor Service - Groq-powered RAG chatbot for YouTube video learning."""
import os
import uuid
import json
from typing import Dict, List, Optional, Any
from app.logging_config import get_logger

logger = get_logger("tutor_service")


class TutorService:
    """
    RAG-based AI Tutor that uses YouTube video transcripts as context
    to answer user questions about video content via Groq LLM.
    """

    def __init__(self, groq_api_key: Optional[str] = None):
        self.api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ TutorService: GROQ_API_KEY not found. Tutor will not work.")

        # In-memory session storage: { session_id: { messages: [...], transcript: str, video_title: str } }
        self._sessions: Dict[str, Dict[str, Any]] = {}
        # Transcript cache: { video_id: transcript_text }
        self._transcript_cache: Dict[str, str] = {}

    def _fetch_transcript(self, video_id: str) -> str:
        """Fetch YouTube video transcript using youtube-transcript-api."""
        if video_id in self._transcript_cache:
            return self._transcript_cache[video_id]

        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.fetch(video_id)

            # Combine all text segments
            full_text = " ".join([entry.text for entry in transcript_list])

            # Truncate to ~8000 chars to fit in context window
            if len(full_text) > 8000:
                full_text = full_text[:8000] + "... [transcript truncated]"

            self._transcript_cache[video_id] = full_text
            logger.info(f"✅ Fetched transcript for video {video_id} ({len(full_text)} chars)")
            return full_text

        except Exception as e:
            logger.warning(f"⚠️ Could not fetch transcript for {video_id}: {e}")
            return ""

    def _get_or_create_session(self, session_id: Optional[str], video_id: str, video_title: str) -> str:
        """Get existing session or create a new one."""
        if session_id and session_id in self._sessions:
            return session_id

        new_id = session_id or str(uuid.uuid4())

        # Fetch transcript for context
        transcript = self._fetch_transcript(video_id)

        self._sessions[new_id] = {
            "video_id": video_id,
            "video_title": video_title,
            "transcript": transcript,
            "messages": []
        }

        logger.info(f"📝 Created tutor session {new_id} for video: {video_title}")
        return new_id

    async def chat(
        self,
        video_id: str,
        video_title: str,
        user_message: str,
        session_id: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Send a message to the AI tutor and get a response.
        
        Returns: { "reply": str, "session_id": str }
        """
        if not self.api_key:
            return {
                "reply": "I'm sorry, the AI Tutor is not configured. Please set the GROQ_API_KEY.",
                "session_id": session_id or "error"
            }

        # Get or create session
        sid = self._get_or_create_session(session_id, video_id, video_title)
        session = self._sessions[sid]

        # Add user message to history
        session["messages"].append({"role": "user", "content": user_message})

        # Build system prompt with transcript context
        transcript = session["transcript"]
        has_transcript = bool(transcript)

        system_prompt = f"""# Role: SkillBridge AI Tutor

You are an expert, friendly AI tutor helping a student learn from a YouTube video.

## Video Information
- **Title**: {video_title}
- **Transcript Available**: {"Yes" if has_transcript else "No"}

{"## Video Transcript (Use as primary knowledge source):" if has_transcript else ""}
{transcript if has_transcript else ""}

## Your Behavior
1. **Answer questions** about the video content accurately using the transcript
2. **Explain concepts** mentioned in the video in simpler terms when asked
3. **Quiz the student** - periodically ask them questions to test understanding
4. **Be encouraging** and supportive, celebrate correct answers
5. **Provide examples** and analogies to help explain complex topics
6. **Stay focused** on the video topic but can expand to related concepts
7. Keep responses concise (2-4 paragraphs max) and use markdown formatting
8. If transcript is not available, answer based on the video title/topic using your general knowledge

{"" if has_transcript else "Note: No transcript was available for this video. Answer based on the topic and your general knowledge about: " + video_title}
"""

        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)

            # Build messages list for Groq
            groq_messages = [{"role": "system", "content": system_prompt}]

            # Add last 10 messages from history for context
            recent_messages = session["messages"][-10:]
            groq_messages.extend(recent_messages)

            chat_completion = client.chat.completions.create(
                messages=groq_messages,
                model="llama-3.3-70b-versatile",
                temperature=0.4,
                max_tokens=1024,
            )

            reply = chat_completion.choices[0].message.content

            # Add assistant reply to history
            session["messages"].append({"role": "assistant", "content": reply})

            return {
                "reply": reply,
                "session_id": sid
            }

        except Exception as e:
            logger.error(f"❌ Tutor chat failed: {e}")
            return {
                "reply": "I'm sorry, I encountered an error processing your question. Please try again.",
                "session_id": sid
            }

    def clear_session(self, session_id: str) -> bool:
        """Clear a tutor chat session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
