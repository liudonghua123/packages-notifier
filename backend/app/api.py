"""FastAPI routes: public API + admin API."""
from __future__ import annotations

import random
import re
import secrets
import string
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from . import db, notify, providers
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


def _validate_package_name(name: str, package_type: str = "npm") -> str:
    name = name.strip()
    if package_type == "npm":
        if not PKG_RE.match(name):
            raise HTTPException(400, "invalid package name")
        return name
    # non-npm: generic sanity check (maven uses group:artifact, go uses paths)
    if not name or len(name) > 250 or any(c.isspace() for c in name):
        raise HTTPException(400, "invalid package name")
    return name


async def _validate_package(name: str) -> str:
    return _validate_package_name(name, "npm")


def _rate_limit_key_guard(email: str) -> None:
    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    # run sync in thread via db.run in caller context
    raise RuntimeError("unused")


# ---------------------------------------------------------------- public API


@router.get("/api/health")
async def health() -> dict:
    return {"ok": True, "time": time.time()}


@router.get("/api/search")
async def search_packages(q: str, type: str = "npm") -> dict:
    """Search packages in a registry (autocomplete for the package inputs)."""
    q = q.strip()
    if not q:
        return {"results": []}
    ptype = (type or "npm").strip().lower()
    if ptype not in providers.supported_types():
        raise HTTPException(400, f"unsupported package_type, must be one of {providers.supported_types()}")
    try:
        results = await providers.search_packages(ptype, q)
    except Exception:
        results = []
    return {"results": results}


@router.get("/api/packages")
async def list_packages() -> dict:
    """Public list of watched packages with latest versions."""
    pkgs = await db.run(db.list_packages)
    return {
        "packages": [
            {**p, "package_type": p.get("package_type") or "npm"}
            for p in pkgs
        ]
    }


@router.get("/api/ecosystems")
async def list_ecosystems() -> dict:
    """Supported package ecosystems with labels + configured check intervals."""
    return {
        "ecosystems": [
            {
                "type": t,
                "label": providers.ECOSYSTEM_LABELS.get(t, t),
                "interval_seconds": (config.ecosystems or {}).get("interval_overrides", {}).get(t)
                or config.poll.get("interval_seconds", 300),
            }
            for t in providers.supported_types()
        ]
    }


@router.get("/api/packages/{name:path}")
async def package_detail(name: str, type: str = "npm") -> dict:
    """Query live metadata for a package from its registry."""
    ptype = (type or "npm").strip().lower()
    if ptype not in providers.supported_types():
        raise HTTPException(400, f"unsupported package_type, must be one of {providers.supported_types()}")
    name = _validate_package_name(name, ptype)
    if ptype == "npm":
        try:
            meta = await fetch_package_meta(name)
        except Exception:
            raise HTTPException(404, f"package not found: {name}")
    else:
        try:
            result = await providers.fetch_latest(ptype, name)
        except Exception:
            result = None
        if result is None:
            raise HTTPException(404, f"package not found in {ptype}: {name}")
        meta = {
            "name": name,
            "latest": result.get("version"),
            "description": result.get("description") or "",
            "versions_count": 0,
            "recent_versions": [],
            "modified": None,
            "latest_published_at": None,
            "homepage": "",
            "license": "",
            "author": "",
            "dist_tags": {},
        }
    watched = await db.run(db.get_package, name)
    return {"package": meta, "watched": bool(watched), "package_type": ptype}


VALID_VERSION_MATCHES = {"any", "equals", "startswith", "regexmatch"}


def _version_rule(body: dict[str, Any]) -> tuple[str, str | None]:
    """Extract and validate optional version match rule from a request body."""
    vm = str(body.get("version_match") or "any").strip().lower() or "any"
    if vm not in VALID_VERSION_MATCHES:
        raise HTTPException(400, f"invalid version_match, must be one of {sorted(VALID_VERSION_MATCHES)}")
    vp = str(body.get("version_pattern") or "").strip() or None
    if vm != "any":
        if not vp:
            raise HTTPException(400, "version_pattern is required when version_match is set")
        if vm == "regexmatch":
            try:
                re.compile(vp)
            except re.error as exc:
                raise HTTPException(400, f"invalid version_pattern regex: {exc}")
        if len(vp) > 200:
            raise HTTPException(400, "version_pattern too long")
    else:
        vp = None
    return vm, vp


def _package_items(body: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    """Normalize a subscribe request body into a list of package items.

    Accepts either the legacy single-package form (package / package_type /
    version_match / version_pattern at top level) or the multi-package form
    (packages: [{package, version_match?, version_pattern?}]) with a shared
    top-level package_type.
    """
    package_type = str(body.get("package_type") or "npm").strip().lower()
    if package_type not in providers.supported_types():
        raise HTTPException(400, f"unsupported package_type, must be one of {providers.supported_types()}")

    raw_items = body.get("packages")
    if isinstance(raw_items, list) and raw_items:
        items: list[dict[str, Any]] = []
        seen: set[str] = set()
        for raw in raw_items[:20]:  # cap batch size
            if not isinstance(raw, dict):
                continue
            name = str(raw.get("package") or "").strip()
            if not name or name.lower() in seen:
                continue
            seen.add(name.lower())
            vm, vp = _version_rule(raw)
            items.append(
                {
                    "package": name,
                    "version_match": vm,
                    "version_pattern": vp,
                }
            )
        if not items:
            raise HTTPException(400, "no valid packages")
    else:
        name = str(body.get("package", "")).strip()
        vm, vp = _version_rule(body)
        items = [{"package": name, "version_match": vm, "version_pattern": vp}]

    for item in items:
        item["package"] = _validate_package_name(item["package"], package_type)
    return items, package_type


@router.post("/api/subscribe/request-code")
async def subscribe_request_code(body: dict[str, Any]) -> dict:
    """Step 1 of subscribe: email + one or more packages -> send verification code."""
    email = str(body.get("email", "")).strip().lower()
    await _validate_email(email)
    items, package_type = _package_items(body)

    # confirm every package actually exists in its registry
    verified_items: list[dict[str, Any]] = []
    for item in items:
        try:
            result = await providers.fetch_latest(package_type, item["package"])
        except Exception:
            result = None
        if result is None:
            raise HTTPException(404, f"package not found in {package_type}: {item['package']}")
        verified_items.append({**item, "latest": result.get("version")})

    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    n = await db.run(db.code_requests_in_window, email, 3600)
    if n >= max_req:
        raise HTTPException(429, "too many code requests, try later")

    code = _gen_code()
    first_pkg = verified_items[0]["package"]
    await db.run(
        db.create_code, email, "subscribe", code,
        {
            "package": first_pkg,
            "package_type": package_type,
            "latest": verified_items[0].get("latest"),
            "packages": verified_items,
        },
        int(config.verification.get("code_ttl_seconds", 600)),
    )
    subject, html = verification_email_html(code, "subscribe", first_pkg, _ttl_minutes())
    await send_email(email, subject, html)
    return {
        "ok": True,
        "package": first_pkg,
        "packages": [it["package"] for it in verified_items],
        "latest": verified_items[0].get("latest"),
        "dev_code": code if not config.smtp.get("host") else None,
    }


@router.post("/api/subscribe/verify")
async def subscribe_verify(body: dict[str, Any]) -> dict:
    """Step 2 of subscribe: email + code -> activate all pending subscriptions."""
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    code = str(body.get("code", "")).strip()
    await _validate_email(email)
    if package:
        package = _validate_package_name(package, "npm")

    row = await db.run(db.verify_code, email, "subscribe", code)
    if not row:
        raise HTTPException(400, "invalid or expired code")
    payload = db.code_payload(row)
    pkg_from_code = payload.get("package", package)
    if package and pkg_from_code != package:
        raise HTTPException(400, "code does not match this package")

    package_type = payload.get("package_type") or "npm"
    items = payload.get("packages") or [
        {
            "package": pkg_from_code,
            "version_match": payload.get("version_match") or "any",
            "version_pattern": payload.get("version_pattern"),
        }
    ]

    subscribed: list[str] = []
    for item in items:
        pkg = str(item.get("package") or "").strip()
        if not pkg:
            continue
        version_match = item.get("version_match") or "any"
        version_pattern = item.get("version_pattern")
        await db.run(db.add_subscription, email, pkg, version_match, version_pattern)
        await db.run(db.mark_verified, email, pkg)
        # make sure the package is watched (record its initial version)
        await db.run(db.upsert_package, pkg, (await _safe_latest(package_type, pkg)), email, package_type)
        subscribed.append(pkg)
    if not subscribed:
        raise HTTPException(400, "no packages in code payload")
    return {"ok": True, "email": email, "package": subscribed[0], "packages": subscribed}


async def _safe_latest(package_type: str, package: str) -> str | None:
    try:
        result = await providers.fetch_latest(package_type, package)
    except Exception:
        return None
    return (result or {}).get("version")


@router.post("/api/unsubscribe/request-code")
async def unsubscribe_request_code(body: dict[str, Any]) -> dict:
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    await _validate_email(email)
    if package:
        package = _validate_package_name(package, "npm")

    subs = await db.run(db.list_subscriptions, email, package or None)
    if not subs:
        raise HTTPException(404, "subscription not found")

    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    n = await db.run(db.code_requests_in_window, email, 3600)
    if n >= max_req:
        raise HTTPException(429, "too many code requests, try later")

    code = _gen_code()
    # empty package payload means "unsubscribe from everything"
    await db.run(
        db.create_code, email, "unsubscribe", code, {"package": package},
        int(config.verification.get("code_ttl_seconds", 600)),
    )
    subject, html = verification_email_html(
        code, "unsubscribe", package or None, _ttl_minutes()
    )
    await send_email(email, subject, html)
    return {"ok": True, "dev_code": code if not config.smtp.get("host") else None}


@router.post("/api/unsubscribe/verify")
async def unsubscribe_verify(body: dict[str, Any]) -> dict:
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    code = str(body.get("code", "")).strip()
    await _validate_email(email)
    if package:
        package = _validate_package_name(package, "npm")

    row = await db.run(db.verify_code, email, "unsubscribe", code)
    if not row:
        raise HTTPException(400, "invalid or expired code")
    payload = db.code_payload(row)
    if payload.get("package", package) != package:
        raise HTTPException(400, "code does not match this package")

    if package:
        deleted = await db.run(db.delete_subscription, email, package)
        return {"ok": True, "deleted": deleted, "deleted_count": 1 if deleted else 0}

    # no package: remove every subscription for this email
    deleted_count = await db.run(db.delete_all_subscriptions, email)
    return {"ok": True, "deleted": deleted_count > 0, "deleted_count": deleted_count}


def _query_gate(email: str) -> None:
    """Raise 403 unless this email verified a query code within the TTL window."""
    if not config.verification.get("query_requires_code", True):
        return
    verified_at = db.get_query_verified_at(email)
    if verified_at is None:
        raise HTTPException(403, "email verification required")
    ttl = int(config.verification.get("query_verify_ttl_seconds", 86400))
    if time.time() - verified_at > ttl:
        raise HTTPException(403, "verification expired, request a new code")


def _verified_remaining(email: str) -> float:
    """Seconds left in this email's verification window; 0 if none."""
    verified_at = db.get_query_verified_at(email)
    if verified_at is None:
        return 0.0
    ttl = int(config.verification.get("query_verify_ttl_seconds", 86400))
    remaining = verified_at + ttl - time.time()
    return max(0.0, remaining)


@router.get("/api/verify/status")
async def verify_status(email: str) -> dict:
    """Whether this email is inside a verification window (shared by
    subscription query / unsubscribe actions)."""
    email = email.strip().lower()
    await _validate_email(email)
    remaining = _verified_remaining(email)
    return {
        "verified": remaining > 0,
        "valid_until": (time.time() + remaining) if remaining > 0 else None,
    }


@router.post("/api/unsubscribe/direct")
async def unsubscribe_direct(body: dict[str, Any]) -> dict:
    """Unsubscribe without a verification code.

    Allowed only while the email is inside its verification window
    (the same TTL that guards /api/subscriptions). Removes one
    package, or all of them when package is omitted.
    """
    email = str(body.get("email", "")).strip().lower()
    package = str(body.get("package", "")).strip()
    await _validate_email(email)
    if package:
        package = _validate_package_name(package, "npm")

    remaining = _verified_remaining(email)
    if remaining <= 0:
        raise HTTPException(403, "email verification required")

    if package:
        deleted = await db.run(db.delete_subscription, email, package)
        if not deleted:
            raise HTTPException(404, "subscription not found")
        return {
            "ok": True,
            "deleted": True,
            "deleted_count": 1,
            "valid_until": time.time() + remaining,
        }

    deleted_count = await db.run(db.delete_all_subscriptions, email)
    return {
        "ok": True,
        "deleted": deleted_count > 0,
        "deleted_count": deleted_count,
        "valid_until": time.time() + remaining,
    }


@router.post("/api/subscriptions/request-code")
async def subscriptions_request_code(body: dict[str, Any]) -> dict:
    """Step 1 of viewing subscriptions: prove email ownership with a code."""
    email = str(body.get("email", "")).strip().lower()
    await _validate_email(email)

    max_req = int(config.rate_limit.get("code_request_per_email_per_hour", 5))
    n = await db.run(db.code_requests_in_window, email, 3600)
    if n >= max_req:
        raise HTTPException(429, "too many code requests, try later")

    code = _gen_code()
    await db.run(
        db.create_code, email, "query", code, {},
        int(config.verification.get("code_ttl_seconds", 600)),
    )
    subject, html = verification_email_html(code, "query", None, _ttl_minutes())
    await send_email(email, subject, html)
    return {"ok": True, "dev_code": code if not config.smtp.get("host") else None}


@router.post("/api/subscriptions/verify")
async def subscriptions_verify(body: dict[str, Any]) -> dict:
    """Step 2 of viewing subscriptions: confirm the code, open the TTL window."""
    email = str(body.get("email", "")).strip().lower()
    code = str(body.get("code", "")).strip()
    await _validate_email(email)
    row = await db.run(db.verify_code, email, "query", code)
    if not row:
        raise HTTPException(400, "invalid or expired code")
    await db.run(db.set_query_verified, email)
    ttl = int(config.verification.get("query_verify_ttl_seconds", 86400))
    return {"ok": True, "valid_until": time.time() + ttl}


@router.get("/api/subscriptions")
async def my_subscriptions(email: str) -> dict:
    """Query a user's subscriptions (requires a recent email verification)."""
    email = email.strip().lower()
    await _validate_email(email)
    _query_gate(email)
    subs = await db.run(db.list_subscriptions, email, None)
    # attach the package ecosystem so the UI can badge each row
    packages = {p["package"]: p for p in await db.run(db.list_packages)}
    verified_at = db.get_query_verified_at(email)
    ttl = int(config.verification.get("query_verify_ttl_seconds", 86400))
    return {
        "email": email,
        "valid_until": (verified_at + ttl) if verified_at else None,
        "subscriptions": [
            {
                "package": s["package"],
                "package_type": (packages.get(s["package"]) or {}).get("package_type") or "npm",
                "description": (packages.get(s["package"]) or {}).get("description"),
                "verified": bool(s["verified"]),
                "created_at": s["created_at"],
                "last_notified_version": s["last_notified_version"],
                "known_version": (packages.get(s["package"]) or {}).get("latest_version"),
                "version_match": s.get("version_match") or "any",
                "version_pattern": s.get("version_pattern"),
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

    # Keep the SAME config object and mutate it in place: every module did
    # `from .config import config`, so replacing the object (or rebinding
    # names one by one) leaves stale references behind — SMTP settings etc.
    # appeared not to apply until the next restart.
    # Masked password means "keep the current one".
    if body.get("smtp", {}).get("password") == "******":
        body = {**body, "smtp": {**body["smtp"], "password": config.smtp.get("password", "")}}

    merged = config.model_dump()

    def merge(dst: dict, src: dict) -> None:
        for k, v in src.items():
            if isinstance(v, dict) and isinstance(dst.get(k), dict):
                merge(dst[k], v)
            else:
                dst[k] = v

    merge(merged, body)
    new_cfg = config.__class__(**merged)

    # in-place update of every top-level field so all shared references stay valid
    for field in type(config).model_fields:
        setattr(config, field, getattr(new_cfg, field))
    save_config(config)
    return {"ok": True, "config": {**config.model_dump(), "smtp": {**config.smtp, "password": "******" if config.smtp.get("password") else ""}}}
