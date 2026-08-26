from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import get_settings


@dataclass(frozen=True)
class ParsedBill:
    payee: str | None = None
    amount: float | None = None
    due_date: str | None = None
    account_number: str | None = None
    currency: str = "KES"
    raw: str | None = None


_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def _gemini_headers(api_key: str) -> dict[str, str]:
    # AI Studio now issues Authentication Keys (AQ. prefix) alongside the legacy
    # Traffic keys (AIza). Auth Keys are rejected when sent as `?key=` — they
    # must go in the x-goog-api-key header.
    return {"x-goog-api-key": api_key, "Content-Type": "application/json"}


def _gemini_api_key() -> str | None:
    settings = get_settings()
    return getattr(settings, "gemini_api_key", None) or os.getenv("GEMINI_API_KEY")


def _extract_json(text: str) -> dict[str, Any]:
    match = re_search_json(text)
    if match:
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            pass
    return {"raw": text}


def re_search_json(text: str) -> str | None:
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return None


async def parse_receipt_with_gemini(text: str, mime_type: str = "text/plain") -> dict[str, Any]:
    api_key = _gemini_api_key()
    if not api_key:
        return {"success": False, "error": "GEMINI_API_KEY is not configured."}

    prompt = (
        "You are a finance assistant. Extract structured billing data from the text below. "
        "Return JSON with keys: payee, amount (number), due_date (YYYY-MM-DD), account_number, currency. "
        "If a field is missing, use null.\n\n"
        f"Text:\n{text[:4000]}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 256},
    }
    url = _GEMINI_URL
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url, json=payload, headers=_gemini_headers(api_key)
            )
        response.raise_for_status()
        body = response.json()
        parts = (((body.get("candidates") or [{}])[0]).get("content") or {}).get("parts") or []
        text_out = " ".join(p.get("text", "") for p in parts).strip()
        data = _extract_json(text_out)
        return {"success": True, "data": data, "raw": text_out}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}


def plain_money_advice(prompt: str, context: dict[str, Any]) -> dict[str, Any]:
    api_key = _gemini_api_key()
    if not api_key:
        return {"success": False, "error": "GEMINI_API_KEY is not configured."}

    system = (
        "You are a simple-money coach for a Kenyan user. "
        "Use plain language, no jargon. "
        "Keep answers short and actionable. "
        "Never promise returns or give credit-bureau advice."
    )
    user = f"{prompt}\n\nContext: {json.dumps(context, default=str)[:2000]}"
    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": f"{system}\n\n{user}"}]}
        ],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 256},
    }
    url = _GEMINI_URL
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=_gemini_headers(api_key))
        response.raise_for_status()
        body = response.json()
        parts = (((body.get("candidates") or [{}])[0]).get("content") or {}).get("parts") or []
        text_out = " ".join(p.get("text", "") for p in parts).strip()
        return {"success": True, "message": text_out}
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "error": str(exc)}
