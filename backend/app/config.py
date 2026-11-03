"""Application configuration loaded from config.json / environment."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CONFIG_FILE = DATA_DIR / "config.json"
DB_FILE = DATA_DIR / "notifier.db"
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

DEFAULTS: dict[str, Any] = {
    "host": "0.0.0.0",
    "port": 8800,
    "base_url": "http://localhost:8800",
    "db_path": str(DB_FILE),
    "smtp": {
        "host": "",
        "port": 465,
        "use_tls": True,
        "username": "",
        "password": "",
        "from_addr": "",
        "from_name": "Packages Notifier",
    },
    "admin": {
        "token": "change-me-admin-token",
    },
    "poll": {
        # how often to check watched packages for new versions (seconds)
        "interval_seconds": 300,
        "changes_feed_enabled": True,
    },
    "registry": {
        "npm_registry": "https://registry.npmjs.org",
        "replicate_changes": "https://replicate.npmjs.com/registry/_changes",
    },
    "ecosystems": {
        "pypi_index": "https://pypi.org/pypi",
        "crates_api": "https://crates.io/api/v1/crates",
        "go_proxy": "https://goproxy.cn",
        "rubygems_api": "https://rubygems.org/api/v1/gems",
        "maven_search": "https://search.maven.org/solrsearch/select",
        "nuget_flat": "https://api.nuget.org/v3-flatcontainer",
        # per-ecosystem check interval in seconds; falls back to poll.interval_seconds
        "interval_overrides": {
            "npm": 300,
            "pypi": 600,
            "crates": 900,
            "go": 900,
            "rubygems": 900,
            "maven": 1800,
            "nuget": 1800,
        },
    },
    "verification": {
        "code_ttl_seconds": 600,
        "code_length": 6,
        "max_attempts": 5,
        "subscribe_requires_code": True,
        "unsubscribe_requires_code": True,
    },
    "rate_limit": {
        "code_request_per_email_per_hour": 5,
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


class Config(BaseModel):
    """Mutable app config, persisted to data/config.json."""

    host: str = "0.0.0.0"
    port: int = 8800
    base_url: str = "http://localhost:8800"
    db_path: str = str(DB_FILE)
    smtp: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["smtp"]))
    admin: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["admin"]))
    poll: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["poll"]))
    registry: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["registry"]))
    ecosystems: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["ecosystems"]))
    verification: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["verification"]))
    rate_limit: dict[str, Any] = Field(default_factory=lambda: dict(DEFAULTS["rate_limit"]))

    model_config = {"validate_assignment": True}


def load_config() -> Config:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    raw: dict[str, Any] = {}
    if CONFIG_FILE.exists():
        try:
            raw = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            raw = {}
    # environment overrides (secrets preferred via env)
    env_map = {
        "PN_SMTP_HOST": ("smtp", "host"),
        "PN_SMTP_PORT": ("smtp", "port"),
        "PN_SMTP_USER": ("smtp", "username"),
        "PN_SMTP_PASS": ("smtp", "password"),
        "PN_SMTP_FROM": ("smtp", "from_addr"),
        "PN_ADMIN_TOKEN": ("admin", "token"),
        "PN_BASE_URL": ("base_url",),
    }
    for env_key, path in env_map.items():
        val = os.environ.get(env_key)
        if val is None:
            continue
        node = raw
        for p in path[:-1]:
            node = node.setdefault(p, {})
        node[path[-1]] = val
    merged = _deep_merge(DEFAULTS, raw)
    # secrets from env win even over file
    for env_key, path in env_map.items():
        val = os.environ.get(env_key)
        if val is not None:
            node = merged
            for p in path[:-1]:
                node = node.setdefault(p, {})
            node[path[-1]] = val
    return Config(**merged)


def save_config(cfg: Config) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = json.loads(cfg.model_dump_json())
    # do not persist env-only secrets back into file? keep simple: persist everything
    CONFIG_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


config = load_config()
