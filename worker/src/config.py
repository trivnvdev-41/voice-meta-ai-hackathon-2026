"""Worker configuration from environment."""
from __future__ import annotations

import os
from dataclasses import dataclass

from .llm import DEFAULT_BASE_URL, DEFAULT_MODEL


def _req(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing env: {name}")
    return value


@dataclass(frozen=True)
class WorkerConfig:
    redis_url: str
    queue_name: str
    whatsapp_token: str
    openai_api_key: str
    meta_api_key: str
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    database_url: str
    s3_endpoint: str
    s3_bucket: str
    s3_access_key: str
    s3_secret_key: str
    gateway_url: str
    internal_token: str
    meta_base_url: str = DEFAULT_BASE_URL
    meta_model: str = DEFAULT_MODEL


def load_config() -> WorkerConfig:
    return WorkerConfig(
        redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379"),
        queue_name=os.environ.get("QUEUE_NAME", "recipe:jobs"),
        whatsapp_token=_req("WHATSAPP_TOKEN"),
        openai_api_key=_req("OPENAI_API_KEY"),
        meta_api_key=_req("META_API_KEY"),
        meta_base_url=os.environ.get("META_BASE_URL", DEFAULT_BASE_URL),
        meta_model=os.environ.get("META_MODEL", DEFAULT_MODEL),
        elevenlabs_api_key=_req("ELEVENLABS_API_KEY"),
        elevenlabs_voice_id=_req("ELEVENLABS_VOICE_ID"),
        database_url=_req("DATABASE_URL"),
        s3_endpoint=_req("S3_ENDPOINT"),
        s3_bucket=_req("S3_BUCKET"),
        s3_access_key=_req("S3_ACCESS_KEY"),
        s3_secret_key=_req("S3_SECRET_KEY"),
        gateway_url=os.environ.get("GATEWAY_URL", "http://localhost:3000"),
        internal_token=_req("INTERNAL_TOKEN"),
    )
