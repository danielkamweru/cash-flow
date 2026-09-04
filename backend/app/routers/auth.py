from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    hash_pin,
    user_public,
    verify_password,
)
from app.db import get_db
from app.models import new_id
from app.provisioning import provision_starter_workspace

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignUpRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=6, max_length=128)
    phone: str | None = None
    # Every account sets its transaction PIN up front, so money movement is
    # never blocked on a later setup step.
    pin: str = Field(min_length=4, max_length=4)


class SignInRequest(BaseModel):
    email: str
    password: str


class SetPinRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=4)
    password: str


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _auth_response(user: models.User, entities: list[models.Entity]) -> dict:
    token = create_access_token(user.Id, user.Email)
    return {
        "token": token,
        "tokenType": "Bearer",
        "user": user_public(user, entities),
    }


@router.post("/signup")
def signup(body: SignUpRequest, db: Session = Depends(get_db)):
    email = _normalize_email(body.email)
    existing = db.query(models.User).filter(models.User.Email == email).first()
    if existing:
        return JSONResponse(status_code=409, content={"error": "An account with this email already exists"})

    if not body.pin.isdigit():
        return JSONResponse(status_code=400, content={"error": "Transaction PIN must be 4 digits"})

    db.add(user)
    db.flush()

    # A bare empty entity leaves every analysis surface blank, so start the
    # account with explorable demo books the user can replace with real figures.
    provision_starter_workspace(db, user)
    db.refresh(user)

    entities = (
        db.query(models.Entity).filter(models.Entity.UserId == user.Id).order_by(models.Entity.Type).all()
    )
    return _auth_response(user, entities)


@router.post("/signin")
def signin(body: SignInRequest, db: Session = Depends(get_db)):
    email = _normalize_email(body.email)
    user = db.query(models.User).filter(models.User.Email == email).first()
    if user is None or not verify_password(body.password, user.PasswordHash):
        return JSONResponse(status_code=401, content={"error": "Invalid email or password"})

    entities = (
        db.query(models.Entity).filter(models.Entity.UserId == user.Id).order_by(models.Entity.Type).all()
    )
    user.UpdatedAt = datetime.now(timezone.utc)
    db.commit()
    return _auth_response(user, entities)


@router.get("/me")
def me(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entities = (
        db.query(models.Entity).filter(models.Entity.UserId == user.Id).order_by(models.Entity.Type).all()
    )
    return {
        "user": user_public(user, entities),
    }


@router.post("/pin")
def set_pin(
    body: SetPinRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set or replace the 4-digit PIN required for M-Pesa / Pesalink send-money."""
    if not verify_password(body.password, user.PasswordHash):
        return JSONResponse(status_code=401, content={"error": "Incorrect password"})
    if not body.pin.isdigit():
        return JSONResponse(status_code=400, content={"error": "PIN must be 4 digits"})
    user.PinHash = hash_pin(body.pin)
    user.UpdatedAt = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "hasPin": True}
