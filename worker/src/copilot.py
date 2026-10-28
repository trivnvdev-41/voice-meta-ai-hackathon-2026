"""Cooking copilot brain: step state, keyword navigation, Meta Llama Q&A."""
from __future__ import annotations

from .llm import DEFAULT_BASE_URL, DEFAULT_MODEL, chat

NAV_NEXT = ("lanjut", "terus", "selanjutnya", "next", "oke", "ok", "siap")
NAV_REPEAT = ("ulangi", "apa tadi", "repeat")
NAV_PREV = ("kembali", "sebelumnya", "mundur", "balik")
NAV_INGREDIENTS = ("bahan", "apa saja", "apa aja")


def _is_nav(said: str, words: tuple[str, ...]) -> bool:
    """Navigation is a short command ("lanjut", "lanjut dong"), not a question."""
    cleaned = said.strip(" .,!?")
    if cleaned in words:
        return True
    return len(cleaned.split()) <= 2 and any(
        cleaned.startswith(w + " ") for w in words
    )


QA_PROMPT = """Kamu asisten masak suara. Jawab MAKSIMAL 2 kalimat, Bahasa Indonesia santai.
Resep: {recipe_name} (marga {family_name}, {region}).
Bahan: {ingredients}
Posisi: langkah {step_no} dari {step_total}: "{step}"
5 pesan terakhir: {history}

Ucapan pemasak: "{transcript}"
Jawaban:"""


class CopilotSession:
    def __init__(self, recipe: dict) -> None:
        self.recipe = recipe
        self.step_idx = 0
        self.history: list[tuple[str, str]] = []

    @property
    def steps(self) -> list:
        steps = self.recipe.get("steps") or []
        return [str(s) for s in steps]

    @property
    def name(self) -> str:
        return str(self.recipe.get("name") or "resep ini")

    def greeting(self, cook_name: str) -> str:
        total = len(self.steps)
        hello = f"Halo {cook_name}! Kita masak {self.name}, ada {total} langkah."
        if total:
            hello += f" Langkah pertama: {self.steps[0]}. Ucapkan 'lanjut' kalau sudah."
        return hello

    def _say_step(self) -> str:
        return f"Langkah {self.step_idx + 1}: {self.steps[self.step_idx]}."

    def respond(
        self,
        transcript: str,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        model: str = DEFAULT_MODEL,
    ) -> str:
        said = transcript.lower()
        if _is_nav(said, NAV_REPEAT):
            reply = self._say_step() if self.steps else "Belum ada langkah."
        elif _is_nav(said, NAV_PREV):
            self.step_idx = max(0, self.step_idx - 1)
            reply = self._say_step() if self.steps else "Belum ada langkah."
        elif any(k in said for k in NAV_INGREDIENTS):
            reply = self._say_ingredients()
        elif _is_nav(said, NAV_NEXT):
            reply = self._advance()
        else:
            reply = answer_question(self, transcript, api_key, base_url, model)
        self.history.append((transcript, reply))
        self.history = self.history[-6:]
        return reply

    def _advance(self) -> str:
        if not self.steps:
            return "Belum ada langkah."
        if self.step_idx >= len(self.steps) - 1:
            return "Itu langkah terakhir. Selamat memasak, semoga enak!"
        self.step_idx += 1
        return self._say_step()

    def _say_ingredients(self) -> str:
        items = self.recipe.get("ingredients") or []
        if not items:
            return "Tidak ada daftar bahan."
        parts = []
        for item in items:
            name = item.get("name", "") if isinstance(item, dict) else str(item)
            amount = item.get("amount_original", "") if isinstance(item, dict) else ""
            parts.append(f"{name} {amount}".strip())
        return "Bahannya: " + ", ".join(parts) + "."


def answer_question(
    session: CopilotSession,
    transcript: str,
    api_key: str,
    base_url: str = DEFAULT_BASE_URL,
    model: str = DEFAULT_MODEL,
) -> str:
    ingredients = session.recipe.get("ingredients") or []
    history = "; ".join(f"P: {t} / J: {r}" for t, r in session.history[-5:])
    prompt = QA_PROMPT.format(
        recipe_name=session.name,
        family_name=session.recipe.get("family_name") or "-",
        region=session.recipe.get("region") or "-",
        ingredients=str(ingredients)[:800],
        step_no=session.step_idx + 1,
        step_total=len(session.steps),
        step=session.steps[session.step_idx] if session.steps else "-",
        history=history or "-",
        transcript=transcript,
    )
    return chat(prompt, api_key, base_url, model)
