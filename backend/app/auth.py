from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app import models

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256$120000${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algo, rounds_s, salt, digest_hex = password_hash.split("$", 3)
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    rounds = int(rounds_s)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), rounds)
    return hmac.compare_digest(digest.hex(), digest_hex)


# A transaction PIN is a second factor for money movement, so it is hashed with
# the same PBKDF2 scheme as the password but stored in its own column.
hash_pin = hash_password
verify_pin = verify_password


def require_pin(user: models.User, pin: str | None) -> None:
    """Guard money-movement endpoints that demand a 4-digit transaction PIN."""
    if not user.PinHash:
        raise HTTPException(
            status_code=400,
            detail={"error": "Set a 4-digit transaction PIN in Settings before sending money."},
        )
    if not pin or not verify_pin(pin, user.PinHash):
        raise HTTPException(status_code=401, detail={"error": "Incorrect transaction PIN"})


def create_access_token(user_id: str, email: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail={"error": "Invalid or expired token"}) from exc


def authorize_with_loop() -> dict[str, Any]:
    """Call LOOP Authorisation (OAuth2 client_credentials) for the Wealth Loop app."""
    settings = get_settings()
    key = settings.loop_consumer_key.strip()
    secret = settings.loop_consumer_secret.strip()
    if not key or not secret:
        return {
            "authorized": False,
            "provider": "LOOP",
            "product": "Authorisation",
            "message": "Add LOOP_CONSUMER_KEY and LOOP_CONSUMER_SECRET from https://sandbox.loop.co.ke/devportal/my-apps",
            "myApps": "https://sandbox.loop.co.ke/devportal/my-apps",
        }

    from base64 import b64encode

    credentials = b64encode(f"{key}:{secret}".encode()).decode()
    token_url = f"{settings.loop_base_url.rstrip('/')}/oauth2/token"
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                token_url,
                headers={"Authorization": f"Basic {credentials}"},
                data={"grant_type": "client_credentials"},
            )
        if response.status_code >= 400:
            return {
                "authorized": False,
                "provider": "LOOP",
                "product": "Authorisation",
                "message": f"LOOP Authorisation failed ({response.status_code}): {response.text[:200]}",
                "tokenUrl": token_url,
                "myApps": "https://sandbox.loop.co.ke/devportal/my-apps",
            }
        payload = response.json()
        return {
            "authorized": True,
            "provider": "LOOP",
            "product": "Authorisation",
            "tokenType": payload.get("token_type", "Bearer"),
            "expiresIn": payload.get("expires_in"),
            "message": "Authorized with LOOP sandbox via OAuth2 client credentials.",
            "tokenUrl": token_url,
            "myApps": "https://sandbox.loop.co.ke/devportal/my-apps",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "authorized": False,
            "provider": "LOOP",
            "product": "Authorisation",
            "message": f"LOOP Authorisation error: {exc}",
            "tokenUrl": token_url,
            "myApps": "https://sandbox.loop.co.ke/devportal/my-apps",
        }


def user_public(user: models.User, entities: list[models.Entity] | None = None) -> dict[str, Any]:
    entity_list = entities
    if entity_list is None:
        entity_list = []
    return {
        "id": user.Id,
        "name": user.Name,
        "email": user.Email,
        "phone": user.Phone,
        "location": user.Location,
        "hasPin": bool(user.PinHash),
        "createdAt": user.CreatedAt.isoformat() if user.CreatedAt else None,
        "updatedAt": user.UpdatedAt.isoformat() if user.UpdatedAt else None,
        "entities": [
            {
                "id": e.Id,
                "userId": e.UserId,
                "type": e.Type,
                "name": e.Name,
                "description": e.Description,
                "createdAt": e.CreatedAt.isoformat() if e.CreatedAt else None,
                "updatedAt": e.UpdatedAt.isoformat() if e.UpdatedAt else None,
            }
            for e in entity_list
        ],
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail={"error": "Sign in required"})
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail={"error": "Invalid token"})
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail={"error": "User not found"})
    return user
