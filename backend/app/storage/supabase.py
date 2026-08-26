from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import get_settings

try:  # pragma: no cover - optional dependency
    from supabase import create_client as _supabase_create_client
except ImportError:  # pragma: no cover
    _supabase_create_client = None


@dataclass(frozen=True)
class StoragePreset:
    bucket: str
    path_prefix: str
    content_types: tuple[str, ...] = ("image/jpeg", "image/png", "application/pdf", "text/plain")


PRESETS: dict[str, StoragePreset] = {
    "receipts": StoragePreset(bucket="receipts", path_prefix="receipts/", content_types=("image/jpeg", "image/png", "application/pdf")),
    "statements": StoragePreset(bucket="statements", path_prefix="statements/", content_types=("application/pdf", "text/csv", "text/plain")),
    "documents": StoragePreset(bucket="documents", path_prefix="documents/", content_types=("application/pdf", "image/jpeg", "image/png")),
}


class SupabaseStorageClient:
    def __init__(self) -> None:
        settings = get_settings()
        url = settings.supabase_url
        key = settings.supabase_service_role_key or settings.supabase_anon_key
        self._enabled = bool(url and key and _supabase_create_client is not None)
        self._client = _supabase_create_client(url, key) if self._enabled else None

    def upload(self, preset_name: str, file_bytes: bytes, file_name: str, content_type: str = "application/octet-stream") -> dict[str, Any]:
        if not self._enabled or self._client is None:
            return {"success": False, "error": "Supabase is not configured or library is missing."}
        preset = PRESETS.get(preset_name)
        if preset is None:
            return {"success": False, "error": f"Unknown storage preset '{preset_name}'. Available: {sorted(PRESETS)}"}
        if content_type not in preset.content_types:
            return {"success": False, "error": f"Content type '{content_type}' not allowed for preset '{preset_name}'."}
        storage_path = f"{preset.path_prefix}{file_name}"
        try:
            self._client.storage.from_(preset.bucket).upload(storage_path, file_bytes, {"content-type": content_type, "upsert": "true"})
            public_url = self._client.storage.from_(preset.bucket).get_public_url(storage_path)
            return {"success": True, "path": storage_path, "publicUrl": public_url}
        except Exception as exc:  # noqa: BLE001
            return {"success": False, "error": str(exc)}

    def signed_url(self, preset_name: str, file_name: str, expires_in: int = 3600) -> dict[str, Any]:
        if not self._enabled or self._client is None:
            return {"success": False, "error": "Supabase is not configured."}
        preset = PRESETS.get(preset_name)
        if preset is None:
            return {"success": False, "error": f"Unknown storage preset '{preset_name}'."}
        storage_path = f"{preset.path_prefix}{file_name}"
        try:
            res = self._client.storage.from_(preset.bucket).create_signed_url(storage_path, expires_in)
            return {"success": True, "url": res.get("signedURL")}
        except Exception as exc:  # noqa: BLE001
            return {"success": False, "error": str(exc)}

    def list_presets(self) -> dict[str, dict[str, Any]]:
        return {
            name: {
                "bucket": preset.bucket,
                "pathPrefix": preset.path_prefix,
                "allowedContentTypes": list(preset.content_types),
            }
            for name, preset in PRESETS.items()
        }


_storage_client = None


def get_storage() -> SupabaseStorageClient | None:
    global _storage_client
    if _storage_client is None:
        _storage_client = SupabaseStorageClient()
    return _storage_client if _storage_client._enabled else None
