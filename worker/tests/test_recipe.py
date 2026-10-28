import src.pipeline as pipeline_mod
from src.config import WorkerConfig
from src.pipeline import run_job, summarize_reply
from src.store import DuplicateRecipe
from src.structure import RecipeDraft, build_prompt, parse_recipe_json


def _dummy_config() -> WorkerConfig:
    return WorkerConfig(
        redis_url="redis://localhost:6379",
        queue_name="recipe:jobs",
        whatsapp_token="d",
        openai_api_key="d",
        gemini_api_key="d",
        elevenlabs_api_key="d",
        elevenlabs_voice_id="d",
        database_url="postgresql://localhost/grv",
        s3_endpoint="d",
        s3_bucket="d",
        s3_access_key="d",
        s3_secret_key="d",
        gateway_url="http://localhost:3000",
        internal_token="d",
    )


def test_parse_plain_json() -> None:
    draft = parse_recipe_json(
        '{"recipe_name": "Rendang", '
        '"ingredients": [{"name": "santan", "amount_original": "1 butir", '
        '"amount_standardized": "400 ml"}], '
        '"steps": ["Masak sampai minyak naik"]}'
    )
    assert draft.recipe_name == "Rendang"
    assert draft.ingredients[0].amount_original == "1 butir"
    assert draft.steps == ["Masak sampai minyak naik"]
    assert draft.needs_clarification == ""


def test_parse_code_fence() -> None:
    draft = parse_recipe_json('```json\n{"recipe_name": "Opor"}\n```')
    assert draft.recipe_name == "Opor"
    assert draft.ingredients == []


def test_prompt_keeps_transcript() -> None:
    assert "sejemput garam" in build_prompt("tambahkan sejemput garam")


def test_parse_family_name() -> None:
    draft = parse_recipe_json(
        '{"recipe_name": "Arsik", "creator_name": "Opung", "family_name": "Siregar"}'
    )
    assert draft.creator_name == "Opung"
    assert draft.family_name == "Siregar"


def test_summarize_reply_with_clarification() -> None:
    text = summarize_reply("Gudeg", 5, 7, "berapa lama merebus nangka?")
    assert "Gudeg" in text
    assert "5 bahan" in text
    assert "berapa lama merebus nangka?" in text


def test_summarize_reply_without_clarification() -> None:
    text = summarize_reply("Soto", 8, 6, "  ")
    assert "Soto" in text
    assert "Boleh dilengkapi" not in text


def test_run_job_duplicate_recipe(monkeypatch) -> None:
    """Meta retry of the same message dispatches 'already saved', no crash."""
    calls: list[tuple[str, str]] = []

    monkeypatch.setattr(pipeline_mod, "download_media", lambda *a: (b"a", "audio/ogg"))
    monkeypatch.setattr(pipeline_mod, "upload_bytes", lambda *a: "https://s3/x")
    monkeypatch.setattr(pipeline_mod, "transcribe", lambda *a: "transkrip")
    monkeypatch.setattr(
        pipeline_mod, "structure_recipe", lambda *a: RecipeDraft(recipe_name="X")
    )

    def _dup(*a):
        raise DuplicateRecipe("wamid.dup")

    monkeypatch.setattr(pipeline_mod, "save_recipe", _dup)
    monkeypatch.setattr(
        pipeline_mod.dispatch_mod,
        "dispatch",
        lambda cfg, to, text="", audio_link="": calls.append((to, text)),
    )

    run_job(
        _dummy_config(),
        {"waFrom": "62812", "messageId": "wamid.dup", "audioId": "m1"},
    )
    assert calls == [("62812", pipeline_mod.ALREADY_SAVED_TEXT)]


def test_run_job_failure_hides_details(monkeypatch) -> None:
    """Internal error details go to logs, never to the user."""
    calls: list[tuple[str, str]] = []

    def _boom(*a):
        raise RuntimeError("https://internal:5432 secret-token-xyz")

    monkeypatch.setattr(pipeline_mod, "download_media", _boom)
    monkeypatch.setattr(
        pipeline_mod.dispatch_mod,
        "dispatch",
        lambda cfg, to, text="", audio_link="": calls.append((to, text)),
    )

    run_job(
        _dummy_config(),
        {"waFrom": "62812", "messageId": "wamid.x", "audioId": "m1"},
    )
    assert len(calls) == 1
    assert calls[0][0] == "62812"
    assert calls[0][1] == pipeline_mod.FAILURE_TEXT
    assert "secret-token-xyz" not in calls[0][1]
