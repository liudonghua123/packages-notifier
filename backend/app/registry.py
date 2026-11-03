"""npm registry client: package metadata + replicate changes feed."""
from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from . import providers
from .config import config

_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=20, follow_redirects=True)
    return _client


async def close_client() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


def normalize_package(name: str) -> str:
    """Normalize an npm package name (case, scope slashes)."""
    name = name.strip().strip("/")
    # npm names are case-sensitive-ish but registry treats them lowercased in URLs
    return name


async def fetch_package_meta(name: str) -> dict[str, Any]:
    """Fetch https://registry.npmjs.org/{pkg} and return distilled metadata."""
    url = f"{config.registry['npm_registry']}/{name}"
    resp = await client().get(url)
    resp.raise_for_status()
    data = resp.json()
    latest = (data.get("dist-tags") or {}).get("latest")
    versions = list((data.get("versions") or {}).keys())
    time_map = data.get("time") or {}
    modified = time_map.get("modified")
    latest_time = time_map.get(latest) if latest else None
    version_meta = (data.get("versions") or {}).get(latest) or {}
    return {
        "name": data.get("name", name),
        "latest": latest,
        "description": data.get("description") or version_meta.get("description") or "",
        "versions_count": len(versions),
        "recent_versions": versions[-8:],
        "modified": modified,
        "latest_published_at": latest_time,
        "homepage": data.get("homepage") or "",
        "license": (version_meta.get("license") if isinstance(version_meta.get("license"), str) else None) or "",
        "author": _author_str(version_meta.get("author")),
        "dist_tags": data.get("dist-tags") or {},
    }


def _author_str(author: Any) -> str:
    if isinstance(author, dict):
        return author.get("name") or ""
    if isinstance(author, str):
        return author
    return ""


async def fetch_changes_since(seq: int, limit: int = 100) -> dict[str, Any]:
    """Poll the replicate changes feed. Returns {"seq": last_seq, "changes": [...]}."""
    url = config.registry["replicate_changes"]
    resp = await client().get(
        url,
        params={"since": seq, "limit": limit},
        headers={"accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()
    return {
        "seq": int(data.get("last_seq", seq)),
        "changes": [
            {
                "id": c.get("id"),
                "seq": c.get("seq"),
            }
            for c in data.get("results", [])
            if c.get("id")
        ],
    }


# ---------- polling worker ----------

def _interval_for(package_type: str) -> int:
    """Check interval for an ecosystem; falls back to the global poll interval."""
    overrides = (config.ecosystems or {}).get("interval_overrides") or {}
    try:
        v = int(overrides.get(package_type, 0))
    except (TypeError, ValueError):
        v = 0
    if v > 0:
        return v
    return int(config.poll.get("interval_seconds", 300))


class Poller:
    """Periodically checks watched packages and emails subscribers on updates.

    Multi-ecosystem: each package row carries a package_type (npm, pypi,
    crates, go, rubygems, maven, nuget). Packages of every type are checked
    on every tick, but each type's last_run is tracked separately so
    per-ecosystem intervals are respected. npm packages that have never
    been checked start with their initial version recorded (no email for
    the first observation).
    """

    def __init__(self, check_fn):
        # check_fn(package, old_version, new_version, meta) -> coroutine
        self.check_fn = check_fn
        self._task: asyncio.Task | None = None
        self._running = False
        self.last_run: float | None = None
        self.last_error: str | None = None
        self._type_last_run: dict[str, float] = {}

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None

    async def _loop(self) -> None:
        while self._running:
            try:
                await self.run_once()
                self.last_error = None
            except Exception as exc:  # keep the loop alive
                self.last_error = repr(exc)
            # sleep a fraction of the smallest configured interval
            intervals = [_interval_for(t) for t in providers.supported_types()]
            intervals.append(int(config.poll.get("interval_seconds", 300)))
            await asyncio.sleep(max(30, min(intervals) // 2))

    async def run_once(self, force: bool = False) -> list[dict[str, Any]]:
        """Check watched packages whose per-type interval has elapsed.

        Returns list of detected updates. With force=True every package
        is checked regardless of intervals.
        """
        from . import db

        updates: list[dict[str, Any]] = []
        packages = await db.run(db.list_packages)
        now = time.time()
        checked_types: set[str] = set()
        for pkg in packages:
            name = pkg["package"]
            ptype = pkg.get("package_type") or "npm"
            old = pkg.get("latest_version")
            never_checked = not pkg.get("last_checked_at")

            # respect per-type intervals
            if not force and not never_checked:
                interval = _interval_for(ptype)
                last = self._type_last_run.get(ptype, 0)
                if now - last < interval and pkg.get("last_checked_at") and now - pkg["last_checked_at"] < interval:
                    continue

            try:
                result = await providers.fetch_latest(ptype, name)
            except Exception:
                await db.run(db.upsert_package, name, old, pkg.get("added_by"), ptype, pkg.get("description"))
                continue

            if result is None:
                # package vanished from its registry; keep last known state
                await db.run(db.upsert_package, name, old, pkg.get("added_by"), ptype, pkg.get("description"))
                continue

            latest = result.get("version")
            desc = result.get("description")
            checked_types.add(ptype)

            if latest and old and latest != old:
                meta = {
                    "name": name,
                    "latest": latest,
                    "description": desc or "",
                    "package_type": ptype,
                }
                updates.append(
                    {
                        "package": name,
                        "package_type": ptype,
                        "old_version": old,
                        "new_version": latest,
                        "meta": meta,
                    }
                )
                await self.check_fn(name, old, latest, meta)
            elif latest and not old:
                # first observation: record initial version, no notification
                await db.run(db.update_package_version, name, latest)
            else:
                await db.run(db.upsert_package, name, latest or old, pkg.get("added_by"), ptype, desc)

        for t in checked_types:
            self._type_last_run[t] = now
        self.last_run = now
        return updates
