"""Meta Llama chat completion: one place for endpoint, auth, and model.

Llama API is OpenAI-compatible (POST /v1/chat/completions, Bearer auth), so the
same helper also works for Meta-hosted Llama on other gateways by overriding
META_BASE_URL / META_MODEL.
"""
from __future__ import annotations

import httpx

DEFAULT_BASE_URL = "https://api.llama.com/v1"
DEFAULT_MODEL = "Llama-4-Maverick-17B-128E-Instruct-FP8"


def chat(
    prompt: str,
    api_key: str,
    base_url: str = DEFAULT_BASE_URL,
    model: str = DEFAULT_MODEL,
) -> str:
    """Single-turn completion; returns the assistant text."""
    url = f"{base_url.rstrip('/')}/chat/completions"
    with httpx.Client(timeout=60) as client:
        response = client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            },
        )
        response.raise_for_status()
        return str(response.json()["choices"][0]["message"]["content"]).strip()
