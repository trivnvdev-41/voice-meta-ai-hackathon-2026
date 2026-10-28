"""Send replies back through the gateway."""
from __future__ import annotations

import httpx

from .config import WorkerConfig


def dispatch(cfg: WorkerConfig, to: str, text: str = "", audio_link: str = "") -> None:
    payload: dict[str, str] = {"to": to}
    if text:
        payload["text"] = text
    if audio_link:
        payload["audio_link"] = audio_link
    with httpx.Client(timeout=30) as client:
        response = client.post(
            f"{cfg.gateway_url}/internal/dispatch",
            headers={"x-internal-token": cfg.internal_token},
            json=payload,
        )
        response.raise_for_status()
