"""Persist WhatsApp call lifecycle events into call_sessions."""
from __future__ import annotations

from datetime import datetime, timezone

import psycopg

from .config import WorkerConfig


def parse_cook_payload(cta: str) -> str | None:
    if isinstance(cta, str) and cta.startswith("cook:") and len(cta) > 5:
        return cta[5:]
    return None


def handle_call_event(cfg: WorkerConfig, job: dict) -> None:
    call_id = str(job.get("callId", ""))
    event = str(job.get("event", ""))
    sender = str(job.get("from", ""))
    session_id = parse_cook_payload(str(job.get("ctaPayload", "")))
    now = datetime.now(timezone.utc)
    with psycopg.connect(cfg.database_url) as conn:
        with conn.cursor() as cur:
            if event == "connect":
                if session_id:
                    cur.execute(
                        """UPDATE call_sessions
                           SET status = 'ringing', wa_call_id = %s
                           WHERE id = %s""",
                        (call_id or None, session_id),
                    )
                    if cur.rowcount:
                        conn.commit()
                        return
                cur.execute(
                    """INSERT INTO call_sessions
                       (id, user_id, wa_caller, recipe_id, wa_call_id, cta_payload, status, direction)
                       VALUES (gen_random_uuid()::text, NULL, %s, NULL, %s, %s, 'ringing',
                               %s)
                       ON CONFLICT (wa_call_id) DO NOTHING""",
                    (sender, call_id or None, str(job.get("ctaPayload", "")),
                     str(job.get("direction", "")) or "USER_INITIATED"),
                )
            elif event == "terminate":
                status = "ended" if str(job.get("status", "")) == "Completed" else "failed"
                cur.execute(
                    "UPDATE call_sessions SET status = %s, ended_at = %s WHERE wa_call_id = %s",
                    (status, now, call_id),
                )
                if not cur.rowcount and session_id:
                    cur.execute(
                        "UPDATE call_sessions SET status = %s, ended_at = %s WHERE id = %s",
                        (status, now, session_id),
                    )
        conn.commit()
