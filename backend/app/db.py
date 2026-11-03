"""SQLite persistence layer (aiosqlite-free, uses sqlite3 in a thread)."""
from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from .config import config


def _connect() -> sqlite3.Connection:
    Path(config.db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            package TEXT NOT NULL,
            created_at REAL NOT NULL,
            verified INTEGER NOT NULL DEFAULT 0,
            last_notified_version TEXT,
            version_match TEXT NOT NULL DEFAULT 'any',
            version_pattern TEXT,
            UNIQUE(email, package)
        );
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            package TEXT,
            purpose TEXT NOT NULL,          -- subscribe | unsubscribe | add_package
            code TEXT NOT NULL,
            payload TEXT,                   -- json blob for pending action
            created_at REAL NOT NULL,
            expires_at REAL NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            used INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS packages (
            package TEXT PRIMARY KEY,
            latest_version TEXT,
            last_checked_at REAL,
            added_at REAL NOT NULL,
            added_by TEXT,                  -- email of first subscriber
            package_type TEXT NOT NULL DEFAULT 'npm',
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            package TEXT NOT NULL,
            version TEXT NOT NULL,
            sent_at REAL NOT NULL,
            ok INTEGER NOT NULL DEFAULT 1,
            error TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_subs_email ON subscriptions(email);
        CREATE INDEX IF NOT EXISTS idx_subs_pkg ON subscriptions(package);
        CREATE INDEX IF NOT EXISTS idx_codes_email ON verification_codes(email);
        """
    )
    # migrate pre-existing databases: add version match columns if missing
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(subscriptions)").fetchall()}
    if "version_match" not in cols:
        conn.execute(
            "ALTER TABLE subscriptions ADD COLUMN version_match TEXT NOT NULL DEFAULT 'any'"
        )
    if "version_pattern" not in cols:
        conn.execute("ALTER TABLE subscriptions ADD COLUMN version_pattern TEXT")
    # multi-ecosystem support: package_type + description
    pcols = {r["name"] for r in conn.execute("PRAGMA table_info(packages)").fetchall()}
    if "package_type" not in pcols:
        conn.execute("ALTER TABLE packages ADD COLUMN package_type TEXT NOT NULL DEFAULT 'npm'")
    if "description" not in pcols:
        conn.execute("ALTER TABLE packages ADD COLUMN description TEXT")
    conn.commit()


_conn: sqlite3.Connection | None = None
_lock = asyncio.Lock()


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _connect()
        _init_schema(_conn)
    return _conn


def run(fn, *args, **kwargs):
    """Run a blocking DB function in a thread."""

    async def _inner():
        async with _lock:
            return await asyncio.to_thread(fn, *args, **kwargs)

    return _inner()


# ---------- subscriptions ----------

def add_subscription(
    email: str,
    package: str,
    version_match: str = "any",
    version_pattern: str | None = None,
) -> dict[str, Any]:
    conn = get_conn()
    now = time.time()
    cur = conn.execute(
        "INSERT INTO subscriptions(email, package, created_at, verified, version_match, version_pattern) "
        "VALUES(?,?,?,0,?,?) "
        "ON CONFLICT(email, package) DO UPDATE SET created_at=excluded.created_at, "
        "version_match=excluded.version_match, version_pattern=excluded.version_pattern",
        (email, package, now, version_match, version_pattern),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM subscriptions WHERE email=? AND package=?", (email, package)
    ).fetchone()
    return dict(row)


def mark_verified(email: str, package: str) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE subscriptions SET verified=1 WHERE email=? AND package=?", (email, package)
    )
    conn.commit()


def delete_subscription(email: str, package: str) -> bool:
    conn = get_conn()
    cur = conn.execute(
        "DELETE FROM subscriptions WHERE email=? AND package=?", (email, package)
    )
    conn.commit()
    return cur.rowcount > 0


def list_subscriptions(email: str | None = None, package: str | None = None) -> list[dict]:
    conn = get_conn()
    q = "SELECT * FROM subscriptions WHERE 1=1"
    args: list[Any] = []
    if email:
        q += " AND email=?"
        args.append(email)
    if package:
        q += " AND package=?"
        args.append(package)
    q += " ORDER BY created_at DESC"
    return [dict(r) for r in conn.execute(q, args).fetchall()]


def verified_packages() -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT package FROM subscriptions WHERE verified=1"
    ).fetchall()
    return sorted(r["package"] for r in rows)


def verified_subscribers(package: str) -> list[dict]:
    """Verified subscribers of a package with their version match rules."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT email, version_match, version_pattern FROM subscriptions "
        "WHERE package=? AND verified=1",
        (package,),
    ).fetchall()
    return [
        {
            "email": r["email"],
            "version_match": r["version_match"] or "any",
            "version_pattern": r["version_pattern"],
        }
        for r in rows
    ]


# ---------- verification codes ----------

def create_code(email: str, purpose: str, code: str, payload: dict | None, ttl: float) -> int:
    conn = get_conn()
    now = time.time()
    cur = conn.execute(
        "INSERT INTO verification_codes(email, purpose, code, payload, created_at, expires_at) "
        "VALUES(?,?,?,?,?,?)",
        (email, purpose, code, json.dumps(payload or {}), now, now + ttl),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def code_requests_in_window(email: str, window_seconds: float) -> int:
    conn = get_conn()
    since = time.time() - window_seconds
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM verification_codes WHERE email=? AND created_at>?",
        (email, since),
    ).fetchone()
    return int(row["n"])


def verify_code(email: str, purpose: str, code: str) -> dict | None:
    """Return the matching code row (as dict) and mark it used; None if invalid."""
    conn = get_conn()
    now = time.time()
    rows = conn.execute(
        "SELECT * FROM verification_codes WHERE email=? AND purpose=? AND used=0 "
        "ORDER BY id DESC LIMIT 3",
        (email, purpose),
    ).fetchall()
    for row in rows:
        if row["expires_at"] < now:
            continue
        if row["attempts"] >= 5:
            continue
        if row["code"] == code:
            conn.execute("UPDATE verification_codes SET used=1 WHERE id=?", (row["id"],))
            conn.commit()
            return dict(row)
        conn.execute(
            "UPDATE verification_codes SET attempts=attempts+1 WHERE id=?", (row["id"],)
        )
        conn.commit()
    return None


def code_payload(row: dict) -> dict:
    try:
        return json.loads(row.get("payload") or "{}")
    except Exception:
        return {}


def cleanup_expired_codes() -> None:
    conn = get_conn()
    conn.execute("DELETE FROM verification_codes WHERE expires_at < ?", (time.time() - 3600,))
    conn.commit()


# ---------- packages ----------

def upsert_package(
    package: str,
    latest_version: str | None,
    added_by: str | None,
    package_type: str = "npm",
    description: str | None = None,
) -> None:
    conn = get_conn()
    now = time.time()
    conn.execute(
        "INSERT INTO packages(package, latest_version, last_checked_at, added_at, added_by, package_type, description) "
        "VALUES(?,?,?,?,?,?,?) "
        "ON CONFLICT(package) DO UPDATE SET latest_version=excluded.latest_version, "
        "last_checked_at=excluded.last_checked_at, "
        "description=COALESCE(excluded.description, packages.description)",
        (package, latest_version, now, now, added_by, package_type, description),
    )
    conn.commit()


def update_package_version(package: str, version: str) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE packages SET latest_version=?, last_checked_at=? WHERE package=?",
        (version, time.time(), package),
    )
    conn.commit()


def set_package_checked(package: str) -> None:
    """Only bump last_checked_at (no version change)."""
    conn = get_conn()
    conn.execute(
        "UPDATE packages SET last_checked_at=? WHERE package=?",
        (time.time(), package),
    )
    conn.commit()


def get_package(package: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM packages WHERE package=?", (package,)).fetchone()
    return dict(row) if row else None


def list_packages() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute("SELECT * FROM packages ORDER BY added_at DESC")]


# ---------- notifications ----------

def record_notification(email: str, package: str, version: str, ok: bool, error: str | None) -> None:
    conn = get_conn()
    conn.execute(
        "INSERT INTO notifications(email, package, version, sent_at, ok, error) VALUES(?,?,?,?,?,?)",
        (email, package, version, time.time(), 1 if ok else 0, error),
    )
    conn.commit()


def set_last_notified(email: str, package: str, version: str) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE subscriptions SET last_notified_version=? WHERE email=? AND package=?",
        (version, email, package),
    )
    conn.commit()


def list_notifications(limit: int = 100) -> list[dict]:
    conn = get_conn()
    return [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM notifications ORDER BY sent_at DESC LIMIT ?", (limit,)
        )
    ]


# ---------- settings ----------

def get_setting(key: str) -> str | None:
    conn = get_conn()
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else None


def set_setting(key: str, value: str) -> None:
    conn = get_conn()
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()
