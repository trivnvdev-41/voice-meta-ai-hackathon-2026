"""Text-to-speech via ElevenLabs (warm reply voice)."""
from __future__ import annotations

import httpx


def synthesize(text: str, api_key: str, voice_id: str) -> bytes:
    with httpx.Client(timeout=120) as client:
        response = client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={"text": text, "model_id": "eleven_multilingual_v2"},
        )
        response.raise_for_status()
        return response.content
