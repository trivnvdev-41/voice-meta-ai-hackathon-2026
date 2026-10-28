"""Transcript -> structured recipe via Gemini."""
from __future__ import annotations

import json

import httpx
from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    name: str
    amount_original: str = ""
    amount_standardized: str = ""


class RecipeDraft(BaseModel):
    recipe_name: str
    creator_name: str = ""
    family_name: str = ""
    region: str = ""
    language: str = ""
    ingredients: list[Ingredient] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    story: str = ""
    needs_clarification: str = ""


PROMPT_TEMPLATE = """You turn a spoken family recipe transcript into structured JSON.
Keep original expressions (e.g. "sejemput", "sampai minyak naik") in amount_original / steps,
and add metric estimates in amount_standardized when possible.
family_name is the creator's family/clan/surname/marga (e.g. Siregar, Tan) when mentioned, else empty.
Reply ONLY with JSON matching this shape:
{{"recipe_name": str, "creator_name": str, "family_name": str, "region": str, "language": str,
 "ingredients": [{{"name": str, "amount_original": str, "amount_standardized": str}}],
 "steps": [str], "story": str, "needs_clarification": str}}

Transcript:
\"\"\"{transcript}\"\"\"
"""


def build_prompt(transcript: str) -> str:
    return PROMPT_TEMPLATE.format(transcript=transcript)


def parse_recipe_json(raw: str) -> RecipeDraft:
    text = raw.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.startswith("json"):
            text = text[4:].strip()
    return RecipeDraft.model_validate(json.loads(text))


def structure_recipe(transcript: str, api_key: str) -> RecipeDraft:
    with httpx.Client(timeout=60) as client:
        response = client.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": build_prompt(transcript)}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            },
        )
        response.raise_for_status()
        raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    return parse_recipe_json(raw)
