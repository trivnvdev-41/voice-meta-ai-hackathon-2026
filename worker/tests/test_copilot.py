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

    class FakeResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict:
            return {"candidates": [{"content": {"parts": [{"text": "Secukupnya saja."}]}}]}

    class FakeClient:
        def __init__(self, *a, **k) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a) -> bool:
            return False

        def post(self, url, headers=None, json=None):
            seen["prompt"] = json["contents"][0]["parts"][0]["text"]
            return FakeResponse()

    monkeypatch.setattr(copilot_mod.httpx, "Client", FakeClient)
    session = CopilotSession(_recipe())
    assert session.respond("garamnya berapa", "key") == "Secukupnya saja."
    assert "Rendang" in seen["prompt"] and "garamnya berapa" in seen["prompt"]
