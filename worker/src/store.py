"""Persistence: PostgreSQL metadata + S3-compatible media archive."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import boto3
import psycopg

from .config import WorkerConfig
from .structure import RecipeDraft


class DuplicateRecipe(Exception):
    """Raised when wa_message_id was already processed."""


def upload_bytes(cfg: WorkerConfig, key: str, data: bytes, content_type: str) -> str:
    client = boto3.session.Session().client(
        "s3",
        endpoint_url=cfg.s3_endpoint,
        aws_access_key_id=cfg.s3_access_key,
        aws_secret_access_key=cfg.s3_secret_key,
    )
    client.put_object(Bucket=cfg.s3_bucket, Key=key, Body=data, ContentType=content_type)
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": cfg.s3_bucket, "Key": key},
        ExpiresIn=7 * 24 * 3600,
    )
    return str(url)


def _get_or_create_member(conn: psycopg.Connection, wa_from: str) -> tuple[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, family_id FROM members WHERE wa_id = %s", (wa_from,))
        row = cur.fetchone()
        if row:
            return str(row[0]), str(row[1])
        family_id = str(uuid.uuid4())
        member_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO families (id, name) VALUES (%s, %s)",
            (family_id, f"Keluarga {wa_from}"),
        )
        cur.execute(
            "INSERT INTO members (id, family_id, wa_id, role) VALUES (%s, %s, %s, %s)",
            (member_id, family_id, wa_from, "grandparent"),
        )
        return member_id, family_id


def save_recipe(
    cfg: WorkerConfig,
    wa_from: str,
    message_id: str,
    draft: RecipeDraft,
    transcript: str,
    voice_url: str,
) -> str:
    recipe_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    with psycopg.connect(cfg.database_url) as conn:
        member_id, family_id = _get_or_create_member(conn, wa_from)
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO recipes
                   (id, family_id, contributor_member_id, wa_message_id, name,
                    creator_name, family_name, region, language, ingredients, steps, story,
                    transcript, status, visibility, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb,
                           %s, %s, %s, %s, %s)
                   ON CONFLICT (wa_message_id) DO NOTHING RETURNING id""",
                (
                    recipe_id,
                    family_id,
                    member_id,
                    message_id,
                    draft.recipe_name,
                    draft.creator_name,
                    draft.family_name,
                    draft.region,
                    draft.language,
                    json.dumps([i.model_dump() for i in draft.ingredients]),
                    json.dumps(draft.steps),
                    draft.story,
                    transcript,
                    "draft",
                    "private",
                    now,
                ),
            )
            if cur.fetchone() is None:
                raise DuplicateRecipe(message_id)
            cur.execute(
                """INSERT INTO media_assets (id, recipe_id, kind, storage_url, created_at)
                   VALUES (%s, %s, %s, %s, %s)""",
                (str(uuid.uuid4()), recipe_id, "voice", voice_url, now),
            )
        conn.commit()
    return recipe_id
