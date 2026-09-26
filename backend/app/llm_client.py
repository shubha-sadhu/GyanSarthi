"""
Thin wrapper around the Gemini API (via the google-genai SDK).

Centralised so every module (quiz generation, RAG answers, domain tagging)
calls the LLM the same way, with the same model/config and the same JSON
parsing safety net. Uses Gemini's free tier (Google AI Studio) — no credit
card needed, see README for how to get a key.
"""
from __future__ import annotations

import json
import re
import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.config import get_settings

_client: genai.Client | None = None

# How many times to retry a Gemini call that fails with a transient
# server-side error (503 "high demand" is common on the free tier — it's
# Google's servers being temporarily overloaded, not a bug on our end),
# and how long to wait between attempts (doubles each time: 2s, 4s, 8s).
_MAX_RETRIES = 3
_BASE_RETRY_DELAY_SECONDS = 2.0


def get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to your .env file. "
                "Get a free key at https://aistudio.google.com/apikey"
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _generate_with_retry(**kwargs):
    """
    Calls client.models.generate_content, retrying on transient server
    errors (503 and similar) with exponential backoff. Client errors (bad
    request, invalid API key, etc.) are not retried — retrying those would
    just fail the same way every time.
    """
    client = get_client()
    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            return client.models.generate_content(**kwargs)
        except genai_errors.ServerError as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES - 1:
                delay = _BASE_RETRY_DELAY_SECONDS * (2**attempt)
                time.sleep(delay)

    raise RuntimeError(
        "Gemini's servers are currently unavailable (high demand on the free "
        "tier is the most common cause). Please try again in a minute."
    ) from last_exc


def complete(
    system: str,
    user: str,
    max_tokens: int = 1500,
    temperature: float = 0.4,
) -> str:
    """Single-turn completion, returns raw text."""
    settings = get_settings()
    response = _generate_with_retry(
        model=settings.gemini_model,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    return response.text or ""


def complete_json(
    system: str,
    user: str,
    max_tokens: int = 1500,
    temperature: float = 0.3,
) -> dict:
    """
    Completion where the model is instructed to return ONLY JSON.
    Uses Gemini's native JSON response mode, with markdown-fence stripping
    kept as a defensive fallback in case a fence slips through anyway.
    """
    settings = get_settings()
    response = _generate_with_retry(
        model=settings.gemini_model,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
        ),
    )
    raw = response.text or ""
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {raw[:500]}") from exc
