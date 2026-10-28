import src.copilot as copilot_mod
from src.copilot import CopilotSession


def _recipe() -> dict:
    return {
        "name": "Rendang",
        "family_name": "Siregar",
        "region": "Sumatera Barat",
        "ingredients": [
            {"name": "santan", "amount_original": "1 butir"},
            {"name": "cabai", "amount_original": "sejemput"},
        ],
        "steps": ["Masak santan.", "Masukkan bumbu.", "Masak sampai minyak naik."],
    }


def test_greeting_names_recipe_and_first_step() -> None:
    text = CopilotSession(_recipe()).greeting("Budi")
    assert "Rendang" in text and "Masak santan" in text and "Budi" in text


def test_navigation_next_prev_repeat() -> None:
    session = CopilotSession(_recipe())
    assert "Masukkan bumbu" in session.respond("lanjut", "key")
    assert "Masak sampai minyak naik" in session.respond("lanjut", "key")
    assert "terakhir" in session.respond("lanjut", "key")
    assert "Masukkan bumbu" in session.respond("kembali", "key")
    assert "Masukkan bumbu" in session.respond("ulangi dong", "key")


def test_ingredients_answer() -> None:
    text = CopilotSession(_recipe()).respond("bahannya apa saja", "key")
    assert "santan" in text and "cabai" in text


def test_question_goes_to_llm(monkeypatch) -> None:
    seen: dict = {}

    def fake_chat(prompt: str, api_key: str, base_url: str, model: str) -> str:
        seen["prompt"] = prompt
        seen["model"] = model
        return "Secukupnya saja."

    monkeypatch.setattr(copilot_mod, "chat", fake_chat)
    session = CopilotSession(_recipe())
    assert session.respond("garamnya berapa", "key") == "Secukupnya saja."
    assert "Rendang" in seen["prompt"] and "garamnya berapa" in seen["prompt"]
    assert seen["model"]
