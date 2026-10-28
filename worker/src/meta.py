"""Meta Graph API helpers (media download)."""
from __future__ import annotations

import os

import httpx

GRAPH_VERSION = os.environ.get("GRAPH_API_VERSION", "v21.0")


def download_media(media_id: str, wa_token: str) -> tuple[bytes, str]:
    headers = {"Authorization": f"Bearer {wa_token}"}
    with httpx.Client(timeout=60) as client:
        meta = client.get(
            f"https://graph.facebook.com/{GRAPH_VERSION}/{media_id}", headers=headers
        )
        meta.raise_for_status()
        info = meta.json()
        data = client.get(info["url"], headers=headers)
        data.raise_for_status()
    mime = info.get("mime_type", "audio/ogg")
    return data.content, mime if isinstance(mime, str) else "audio/ogg"
