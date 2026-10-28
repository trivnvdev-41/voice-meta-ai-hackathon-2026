"""One job: voice note -> archived recipe + WhatsApp reply."""
from __future__ import annotations

import uuid

from . import dispatch as dispatch_mod
from .config import WorkerConfig
from .meta import download_media
from .store import DuplicateRecipe, save_recipe, upload_bytes
from .structure import structure_recipe
from .stt import transcribe
from .tts import synthesize

HELP_TEXT = (
    "Halo! Kirim voice note berisi resep keluarga (bahan + cara masak), "
    "nanti saya simpan otomatis ke Recipe Vault keluarga."
)
REPLY_TEMPLATE = (
    "Terima kasih! Resep '{name}' sudah tersimpan di Family Vault "
    "({nings} bahan, {nsteps} langkah). Voice note asli ikut diarsipkan."
)
ALREADY_SAVED_TEXT = "Resep ini sudah pernah tersimpan di Family Vault, tidak diduplikat."
FAILURE_TEXT = "Maaf, resepnya gagal diproses. Coba kirim ulang voice note-nya ya."


def summarize_reply(
    recipe_name: str, n_ingredients: int, n_steps: int, clarification: str
) -> str:
    base = REPLY_TEMPLATE.format(
        name=recipe_name, nings=n_ingredients, nsteps=n_steps
    )
    if clarification.strip():
        base += f" Boleh dilengkapi? {clarification.strip()}"
    return base


def run_job(cfg: WorkerConfig, job: dict) -> None:
    to = str(job.get("waFrom", ""))
    if not to:
        return
    try:
        audio_id = job.get("audioId")
        if not isinstance(audio_id, str) or not audio_id:
            dispatch_mod.dispatch(cfg, to, text=HELP_TEXT)
            return
        audio_bytes, mime = download_media(audio_id, cfg.whatsapp_token)
        ext = "ogg" if "ogg" in mime else "mp3"
        voice_url = upload_bytes(
            cfg, f"voice/{uuid.uuid4()}.{ext}", audio_bytes, mime
        )
        transcript = transcribe(audio_bytes, f"recipe.{ext}", cfg.openai_api_key)
        draft = structure_recipe(transcript, cfg.gemini_api_key)
        save_recipe(cfg, to, str(job.get("messageId", "")), draft, transcript, voice_url)
        reply = summarize_reply(
            draft.recipe_name,
            len(draft.ingredients),
            len(draft.steps),
            draft.needs_clarification,
        )
        voice_reply = synthesize(reply, cfg.elevenlabs_api_key, cfg.elevenlabs_voice_id)
        reply_url = upload_bytes(
            cfg, f"replies/{uuid.uuid4()}.mp3", voice_reply, "audio/mpeg"
        )
        dispatch_mod.dispatch(cfg, to, text=reply, audio_link=reply_url)
    except DuplicateRecipe:
        dispatch_mod.dispatch(cfg, to, text=ALREADY_SAVED_TEXT)
    except Exception as exc:
        print(f"job failed: {type(exc).__name__}: {exc}", flush=True)
        dispatch_mod.dispatch(cfg, to, text=FAILURE_TEXT)
