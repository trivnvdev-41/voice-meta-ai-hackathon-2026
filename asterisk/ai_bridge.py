#!/usr/bin/env python3
"""EAGI voice copilot: call audio <-> cooking guidance. Runs inside Asterisk.

Audio arrives on fd 3 as 8 kHz slinear16; replies are written back there.
Turn-based (no barge-in yet): listen -> transcribe -> copilot -> speak.
"""
from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

for _cand in (
    Path(__file__).resolve().parent / "worker",
    Path(__file__).resolve().parent.parent / "worker",
):
    if (_cand / "src" / "stt.py").exists():
        sys.path.insert(0, str(_cand))
        break

import psycopg  # noqa: E402

from src.call_audio import FRAME_BYTES, UtteranceSegmenter, decode_to_slinear8k  # noqa: E402
from src.copilot import CopilotSession  # noqa: E402
from src.llm import DEFAULT_BASE_URL, DEFAULT_MODEL  # noqa: E402
from src.stt import transcribe  # noqa: E402
from src.tts import synthesize  # noqa: E402


def _req(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing env: {name}")
    return value


@dataclass(frozen=True)
class BridgeConfig:
    database_url: str
    openai_api_key: str
    meta_api_key: str
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    meta_base_url: str = DEFAULT_BASE_URL
    meta_model: str = DEFAULT_MODEL


def load_bridge_config() -> BridgeConfig:
    return BridgeConfig(
        database_url=_req("DATABASE_URL"),
        openai_api_key=_req("OPENAI_API_KEY"),
        meta_api_key=_req("META_API_KEY"),
        meta_base_url=os.environ.get("META_BASE_URL", DEFAULT_BASE_URL),
        meta_model=os.environ.get("META_MODEL", DEFAULT_MODEL),
        elevenlabs_api_key=_req("ELEVENLABS_API_KEY"),
        elevenlabs_voice_id=_req("ELEVENLABS_VOICE_ID"),
    )


def parse_agi_env(lines: list[str]) -> dict:
    env: dict[str, str] = {}
    for line in lines:
        line = line.strip()
        if not line:
            break
        if ":" in line:
            key, value = line.split(":", 1)
            env[key.strip()] = value.strip()
    return env


def normalize_wa(raw: str) -> str:
    return re.sub(r"\D", "", raw or "")


def wa_match(a: str, b: str) -> bool:
    a, b = normalize_wa(a), normalize_wa(b)
    if not a or not b:
        return False
    if a == b:
        return True
    # 0812... vs +62812... share the last 10 digits
    return len(a) >= 10 and len(b) >= 10 and a[-10:] == b[-10:]


RECIPE_COLS = "id, name, creator_name, family_name, region, language, ingredients, steps, story"


def _row_to_recipe(row: tuple) -> dict:
    keys = ["id", "name", "creator_name", "family_name", "region", "language",
            "ingredients", "steps", "story"]
    return dict(zip(keys, row))


def find_user(conn, callerid: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute("SELECT id, display_name, wa_id FROM users WHERE wa_id IS NOT NULL")
        for uid, name, wa in cur.fetchall():
            if wa and wa_match(str(wa), callerid):
                return {"id": str(uid), "display_name": str(name or "")}
    return None


def parse_session_hint(hint: str | None) -> str | None:
    if hint and hint.startswith("cook:") and len(hint) > 5:
        return hint[5:]
    return hint or None


def find_session_recipe(conn, callerid: str, hint: str | None) -> dict | None:
    session_id = parse_session_hint(hint)
    with conn.cursor() as cur:
        if session_id:
            cur.execute(
                f"SELECT {RECIPE_COLS} FROM recipes WHERE id = "
                "(SELECT recipe_id FROM call_sessions WHERE id = %s)",
                (session_id,),
            )
            row = cur.fetchone()
            if row:
                return _row_to_recipe(row)
        cur.execute(
            "SELECT id, recipe_id, wa_caller FROM call_sessions "
            "WHERE status IN ('pending', 'ringing', 'active') "
            "ORDER BY created_at DESC LIMIT 20"
        )
        for sid, recipe_id, wa in cur.fetchall():
            if wa and wa_match(str(wa), callerid) and recipe_id:
                cur.execute(f"SELECT {RECIPE_COLS} FROM recipes WHERE id = %s", (recipe_id,))
                row = cur.fetchone()
                if row:
                    return _row_to_recipe(row)
    return None


def find_recipe(conn, user_id: str | None, hint: str | None) -> dict | None:
    with conn.cursor() as cur:
        if hint:
            cur.execute(f"SELECT {RECIPE_COLS} FROM recipes WHERE id = %s", (hint,))
            row = cur.fetchone()
            if row:
                return _row_to_recipe(row)
        if user_id:
            cur.execute(
                f"SELECT {RECIPE_COLS} FROM recipes WHERE author_user_id = %s "
                "ORDER BY created_at DESC LIMIT 1",
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                return _row_to_recipe(row)
        cur.execute(
            f"SELECT {RECIPE_COLS} FROM recipes WHERE visibility = 'public' "
            "ORDER BY created_at DESC LIMIT 1"
        )
        row = cur.fetchone()
        return _row_to_recipe(row) if row else None


def speak(audio_out, text: str, cfg: BridgeConfig) -> None:
    mp3 = synthesize(text, cfg.elevenlabs_api_key, cfg.elevenlabs_voice_id)
    audio_out.write(decode_to_slinear8k(mp3))
    audio_out.flush()


def process_utterance(cfg: BridgeConfig, session: CopilotSession, pcm: bytes) -> str:
    transcript = transcribe(pcm, "turn.ogg", cfg.openai_api_key)
    return session.respond(
        transcript, cfg.meta_api_key, cfg.meta_base_url, cfg.meta_model
    )


def run_call(env: dict, audio_in, audio_out, cfg: BridgeConfig, conn) -> None:
    callerid = env.get("agi_callerid", "")
    hint = env.get("agi_arg_1") or None
    recipe = find_session_recipe(conn, callerid, hint)
    user = find_user(conn, callerid)
    if recipe is None:
        recipe = find_recipe(conn, user["id"] if user else None, hint)
    if recipe is None:
        speak(audio_out, "Maaf, belum ada resep yang bisa dipakai.", cfg)
        return
    cook = (user or {}).get("display_name") or "chef"
    session = CopilotSession(recipe)
    speak(audio_out, session.greeting(cook), cfg)

    segmenter = UtteranceSegmenter()

    def handle(utterance: bytes) -> None:
        try:
            reply = process_utterance(cfg, session, utterance)
        except Exception as exc:
            print(f"turn failed: {type(exc).__name__}: {exc}", flush=True)
            reply = "Maaf, saya tidak dengar jelas. Bisa diulangi?"
        speak(audio_out, reply, cfg)

    while True:
        frame = audio_in.read(FRAME_BYTES)
        if not frame:
            utterance = segmenter.flush()
            if utterance is None:
                break
            handle(utterance)
            break
        utterance = segmenter.feed(frame)
        if utterance is None:
            continue
        handle(utterance)


def main() -> None:
    lines = []
    while True:
        line = sys.stdin.readline()
        if not line or line.strip() == "":
            break
        lines.append(line)
    env = parse_agi_env(lines)
    cfg = load_bridge_config()
    audio = os.fdopen(3, "r+b", buffering=0)
    try:
        with psycopg.connect(cfg.database_url) as conn:
            run_call(env, audio, audio, cfg, conn)
    except (BrokenPipeError, EOFError, OSError):
        pass


if __name__ == "__main__":
    main()
