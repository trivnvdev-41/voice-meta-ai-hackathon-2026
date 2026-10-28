"""Speech-to-text via Whisper API."""
from __future__ import annotations

import httpx


def transcribe(audio_bytes: bytes, filename: str, api_key: str) -> str:
    with httpx.Client(timeout=120) as client:
        response = client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": "whisper-1"},
            files={"file": (filename, audio_bytes, "audio/ogg")},
        )
        response.raise_for_status()
        data = response.json()
    text = data.get("text", "")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Empty transcription")
    return text.strip()
