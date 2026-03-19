"""AI Tutor Service — Groq-powered RAG chatbot with bilingual (Hindi/English) support."""
import os
import uuid
import json
from typing import Dict, List, Optional, Any
from app.logging_config import get_logger

logger = get_logger("tutor_service")


class TutorService:
    """
    RAG-based AI Tutor that uses YouTube video transcripts as context.
    Supports Hindi ↔ English bilingual conversations.
    Hindi transcripts are translated to English before feeding to LLM.
    User can ask in Hindi or English — tutor responds in the same language.
    """

    def __init__(self, groq_api_key: Optional[str] = None):
        self.api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ TutorService: GROQ_API_KEY not found.")

        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._transcript_cache: Dict[str, str] = {}

    # ───────────────────────────────────────────
    # TRANSCRIPT FETCHING & TRANSLATION
    # ───────────────────────────────────────────

    def _fetch_transcript(self, video_id: str, language: str = "English") -> str:
        """Fetch YouTube video transcript. For Hindi videos, translate to English."""
        cache_key = f"{video_id}_{language}"
        if cache_key in self._transcript_cache:
            return self._transcript_cache[cache_key]

        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            ytt_api = YouTubeTranscriptApi()

            # Try fetching transcript in preferred language first
            transcript_text = ""
            original_lang = "en"

            try:
                if language.lower() == "hindi":
                    transcript_list = ytt_api.fetch(video_id, languages=["hi"])
                    original_lang = "hi"
                else:
                    transcript_list = ytt_api.fetch(video_id, languages=["en"])
                    original_lang = "en"
            except Exception:
                # Fallback: try any available language
                try:
                    transcript_list = ytt_api.fetch(video_id)
                    original_lang = "unknown"
                except Exception as e2:
                    logger.warning(f"⚠️ No transcript available for {video_id}: {e2}")
                    return ""

            full_text = " ".join([entry.text for entry in transcript_list])

            # Truncate to ~8000 chars
            if len(full_text) > 8000:
                full_text = full_text[:8000] + "... [transcript truncated]"

            # If original is Hindi, translate to English for LLM context
            if original_lang == "hi":
                full_text = self._translate_text(full_text, source="hi", target="en")

            self._transcript_cache[cache_key] = full_text
            logger.info(f"✅ Fetched transcript for {video_id} (lang={original_lang}, {len(full_text)} chars)")
            return full_text

        except Exception as e:
            logger.warning(f"⚠️ Could not fetch transcript for {video_id}: {e}")
            return ""

    def _translate_text(self, text: str, source: str = "hi", target: str = "en") -> str:
        """Translate text using deep_translator (Google Translate wrapper)."""
        try:
            from deep_translator import GoogleTranslator

            # deep_translator has a 5000 char limit per call, so chunk
            chunks = [text[i:i + 4500] for i in range(0, len(text), 4500)]
            translated_chunks = []

            translator = GoogleTranslator(source=source, target=target)
            for chunk in chunks:
                translated_chunks.append(translator.translate(chunk))

            result = " ".join(translated_chunks)
            logger.info(f"🌐 Translated {len(text)} chars from {source} → {target}")
            return result

        except Exception as e:
            logger.error(f"❌ Translation failed: {e}")
            return text  # Return original if translation fails

    def _detect_language(self, text: str) -> str:
        """Simple heuristic to detect if text is Hindi (Devanagari script)."""
        devanagari_count = sum(1 for ch in text if '\u0900' <= ch <= '\u097F')
        return "hi" if devanagari_count > len(text) * 0.3 else "en"

    # ───────────────────────────────────────────
    # SESSION MANAGEMENT
    # ───────────────────────────────────────────

    def _get_or_create_session(
        self, session_id: Optional[str], video_id: str, video_title: str, language: str
    ) -> str:
        if session_id and session_id in self._sessions:
            return session_id

        new_id = session_id or str(uuid.uuid4())
        transcript = self._fetch_transcript(video_id, language)

        self._sessions[new_id] = {
            "video_id": video_id,
            "video_title": video_title,
            "transcript": transcript,
            "language": language,
            "messages": [],
        }

        logger.info(f"📝 Created tutor session {new_id} for video: {video_title} (lang={language})")
        return new_id

    # ───────────────────────────────────────────
    # CHAT
    # ───────────────────────────────────────────

    async def chat(
        self,
        video_id: str,
        video_title: str,
        user_message: str,
        session_id: Optional[str] = None,
        language: str = "English",
    ) -> Dict[str, str]:
        """
        Chat with the AI tutor. Supports bilingual input.
        - Detects if user message is in Hindi
        - Translates Hindi user messages for LLM context
        - Instructs LLM to reply in the user's language
        """
        if not self.api_key:
            return {
                "reply": "I'm sorry, the AI Tutor is not configured. Please set the GROQ_API_KEY.",
                "session_id": session_id or "error",
            }

        sid = self._get_or_create_session(session_id, video_id, video_title, language)
        session = self._sessions[sid]

        # Detect user message language
        user_lang = self._detect_language(user_message)

        # If user writes in Hindi, translate for LLM context
        message_for_llm = user_message
        if user_lang == "hi":
            message_for_llm = self._translate_text(user_message, source="hi", target="en")

        session["messages"].append({"role": "user", "content": message_for_llm})

        # Build system prompt
        transcript = session["transcript"]
        has_transcript = bool(transcript)

        lang_instruction = ""
        if user_lang == "hi" or language.lower() == "hindi":
            lang_instruction = """
## Language Instruction
The user is communicating in Hindi. You MUST reply in Hindi (Devanagari script).
If they switch to English mid-conversation, respond in English.
Always match the language of the user's latest message.
"""

        system_prompt = f"""# Role: SkillBridge AI Tutor

You are an expert, friendly AI tutor helping a student learn from a YouTube video.

## Video Information
- **Title**: {video_title}
- **Transcript Available**: {"Yes" if has_transcript else "No"}

{"## Video Transcript (Use as primary knowledge source):" if has_transcript else ""}
{transcript if has_transcript else ""}

{lang_instruction}

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

            groq_messages = [{"role": "system", "content": system_prompt}]
            recent_messages = session["messages"][-10:]
            groq_messages.extend(recent_messages)

            chat_completion = client.chat.completions.create(
                messages=groq_messages,
                model="llama-3.3-70b-versatile",
                temperature=0.4,
                max_tokens=1024,
            )

            reply = chat_completion.choices[0].message.content

            session["messages"].append({"role": "assistant", "content": reply})

            return {"reply": reply, "session_id": sid}

        except Exception as e:
            logger.error(f"❌ Tutor chat failed: {e}")
            return {
                "reply": "I'm sorry, I encountered an error processing your question. Please try again.",
                "session_id": sid,
            }

    def clear_session(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
