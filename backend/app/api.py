"""FastAPI routes: public API + admin API."""
from __future__ import annotations

import random
import re
import secrets
import string
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from . import db, notify
from .config import config, save_config
from .email_sender import send_email, verification_email_html
from .registry import client
from .registry import fetch_package_meta

router = APIRouter()
admin_router = APIRouter(prefix="/admin")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PKG_RE = re.compile(r"^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$", re.IGNORECASE)


def _gen_code() -> str:
    length = int(config.verification.get("code_length", 6))
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _ttl_minutes() -> int:
    return max(1, int(config.verification.get("code_ttl_seconds", 600)) // 60)


async def _validate_email(email: str) -> None:
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "invalid email")


async def _validate_package(name: str) -> str:
    name = name.strip()
    if not PKG_RE.match(name):
        raise HTTPException(400, "invalid package name")
    return name


def _rate_limit_key_guard(email: str) -> None:
    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    # run sync in thread via db.run in caller context
    raise RuntimeError("unused")


# ---------------------------------------------------------------- public API


@router.get("/api/health")
async def health() -> dict:
    return {"ok": True, "time": time.time()}


@router.get("/api/search")
async def search_packages(q: str) -> dict:
    """Search npm packages (proxy to the official search API) for input autocomplete."""
    q = q.strip()
    if not q:
        return {"results": []}
    url = f"{config.registry['npm_registry']}/-/v1/search"
    try:
        resp = await client().get(url, params={"text": q, "size": 8})
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return {"results": []}
    results = []
    for obj in data.get("objects", []):
        pkg = obj.get("package", {})
        results.append(
            {
                "name": pkg.get("name", ""),
                "version": pkg.get("version", ""),
                "description": pkg.get("description", ""),
                "date": pkg.get("date"),
                "publisher": (pkg.get("publisher") or {}).get("username", ""),
            }
        )
    return {"results": results}


@router.get("/api/packages")
async def list_packages() -> dict:
    """Public list of watched packages with latest versions."""
    pkgs = await db.run(db.list_packages)
    return {"packages": pkgs}


@router.get("/api/packages/{name:path}")
async def package_detail(name: str) -> dict:
    """Query live metadata for a package from the npm registry."""
    name = await _validate_package(name)
    try:
        meta = await fetch_package_meta(name)
    except Exception:
        raise HTTPException(404, f"package not found: {name}")
    watched = await db.run(db.get_package, name)
    return {"package": meta, "watched": bool(watched)}


@router.post("/api/subscribe/request-code")
async def subscribe_request_code(body: dict[str, Any]) -> dict:
    """Step 1 of subscribe: email + package -> send verification code."""
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    await _validate_email(email)
    package = await _validate_package(package)

    # confirm the package actually exists on the registry
    try:
        meta = await fetch_package_meta(package)
    except Exception:
        raise HTTPException(404, f"package not found on npm: {package}")

    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    n = await db.run(db.code_requests_in_window, email, 3600)
    if n >= max_req:
        raise HTTPException(429, "too many code requests, try later")

    code = _gen_code()
    await db.run(
        db.create_code, email, "subscribe", code,
        {"package": package, "latest": meta.get("latest")},
        int(config.verification.get("code_ttl_seconds", 600)),
    )
    subject, html = verification_email_html(code, "subscribe", package, _ttl_minutes())
    await send_email(email, subject, html)
    return {"ok": True, "package": package, "latest": meta.get("latest"), "dev_code": code if not config.smtp.get("host") else None}


@router.post("/api/subscribe/verify")
async def subscribe_verify(body: dict[str, Any]) -> dict:
    """Step 2 of subscribe: email + package + code -> activate subscription."""
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    code = str(body.get("code", "")).strip()
    await _validate_email(email)
    package = await _validate_package(package)

    row = await db.run(db.verify_code, email, "subscribe", code)
    if not row:
        raise HTTPException(400, "invalid or expired code")
    payload = db.code_payload(row)
    pkg_from_code = payload.get("package", package)
    if pkg_from_code != package:
        raise HTTPException(400, "code does not match this package")

    await db.run(db.add_subscription, email, package)
    await db.run(db.mark_verified, email, package)
    # make sure the package is watched
    meta = None
    try:
        meta = await fetch_package_meta(package)
    except Exception:
        pass
    await db.run(db.upsert_package, package, (meta or {}).get("latest"), email)
    return {"ok": True, "email": email, "package": package}


@router.post("/api/unsubscribe/request-code")
async def unsubscribe_request_code(body: dict[str, Any]) -> dict:
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    await _validate_email(email)
    package = await _validate_package(package)

    subs = await db.run(db.list_subscriptions, email, package)
    if not subs:
        raise HTTPException(404, "subscription not found")

    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    n = await db.run(db.code_requests_in_window, email, 3600)
    if n >= max_req:
        raise HTTPException(429, "too many code requests, try later")

    code = _gen_code()
    await db.run(
        db.create_code, email, "unsubscribe", code, {"package": package},
        int(config.verification.get("code_ttl_seconds", 600)),
    )
    subject, html = verification_email_html(code, "unsubscribe", package, _ttl_minutes())
    await send_email(email, subject, html)
    return {"ok": True, "dev_code": code if not config.smtp.get("host") else None}


@router.post("/api/unsubscribe/verify")
async def unsubscribe_verify(body: dict[str, Any]) -> dict:
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    code = str(body.get("code", "")).strip()
    await _validate_email(email)
    package = await _validate_package(package)

    row = await db.run(db.verify_code, email, "unsubscribe", code)
    if not row:
        raise HTTPException(400, "invalid or expired code")
    payload = db.code_payload(row)
    if payload.get("package", package) != package:
        raise HTTPException(400, "code does not match this package")

    deleted = await db.run(db.delete_subscription, email, package)
    return {"ok": True, "deleted": deleted}


@router.get("/api/subscriptions")
async def my_subscriptions(email: str) -> dict:
    """Query a user's subscriptions (email only; no sensitive data returned)."""
    email = email.strip().lower()
    await _validate_email(email)
    subs = await db.run(db.list_subscriptions, email, None)
    return {
        "email": email,
        "subscriptions": [
            {
                "package": s["package"],
                "verified": bool(s["verified"]),
                "created_at": s["created_at"],
                "last_notified_version": s["last_notified_version"],
            }
            for s in subs
        ],
    }


# ---------------------------------------------------------------- admin API


def _admin_auth(authorization: str | None) -> None:
    from . import config as cfgmod
    token = cfgmod.config.admin.get("token", "")
    if not token or authorization != f"Bearer {token}":
        raise HTTPException(401, "admin token required")


@admin_router.get("/config")
async def admin_get_config(authorization: str | None = Header(None)) -> dict:
    _admin_auth(authorization)
    cfg = config.model_dump()
    # mask smtp password
    if cfg["smtp"].get("password"):
        cfg["smtp"]["password"] = "******"
    return cfg


@admin_router.put("/config")
async def admin_set_config(body: dict[str, Any], authorization: str | None = Header(None)) -> dict:
    _admin_auth(authorization)
    current = config.model_dump()

    def merge(dst: dict, src: dict) -> dict:
        for k, v in src.items():
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                merge(dst[k], v)
            else:
                dst[k] = v
        return dst

    merged = merge(current, body)
    # keep masked password untouched
    if body.get("smtp", {}).get("password") == "******":
        merged["smtp"]["password"] = config.smtp.get("password", "")
    new_cfg = config.__class__(**merged)
    # swap the shared module-level config object so every importer sees the new values
    from . import config as cfgmod
    cfgmod.config = new_cfg
    save_config(new_cfg)
    # also rebind the `config` name inside api.py
    globals()["config"] = new_cfg
    return {"ok": True, "config": {**new_cfg.model_dump(), "smtp": {**new_cfg.smtp, "password": "******" if new_cfg.smtp.get("password") else ""}}}
