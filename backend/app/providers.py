"""Multi-ecosystem package version providers.

Each provider knows how to fetch the latest version + description
for a package in its ecosystem. All use plain public HTTP APIs,
so no auth is required. Update detection strategy per ecosystem:

- npm:    registry dist-tags (+ replicate changes feed, already wired)
- pypi:   JSON API (https://pypi.org/pypi/{pkg}/json) — INFO.classifiers
- crates: crates.io API (https://crates.io/api/v1/crates/{pkg}) — max_version
- go:     Go module proxy (https://proxy.golang.org/{module}/@latest)
- rubygems: RubyGems API (https://rubygems.org/api/v1/gems/{pkg}.json)
- maven:  Maven Central search (https://search.maven.org/solrsearch/select)
- nuget:  NuGet flat container index (https://api.nuget.org/v3-flatcontainer/)
"""
from __future__ import annotations

import re
from typing import Any, Callable

import httpx

from .config import config

# shared httpx client (lazy, same lifecycle as registry.client)
_client: httpx.AsyncClient | None = None


def http() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": "packages-notifier/0.1 (multi-ecosystem watcher)"},
        )
    return _client


async def close() -> None:
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# ---------------------------------------------------------------- npm

async def fetch_npm(name: str) -> dict[str, Any] | None:
    from .registry import fetch_package_meta

    try:
        meta = await fetch_package_meta(name)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return None
        raise
    return {"version": meta.get("latest"), "description": meta.get("description") or None}


# ---------------------------------------------------------------- pypi

async def fetch_pypi(name: str) -> dict[str, Any] | None:
    url = f"{config.ecosystems['pypi_index']}/{name}/json"
    resp = await http().get(url)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    info = data.get("info") or {}
    version = info.get("version")
    if not version:
        return None
    return {"version": version, "description": (info.get("summary") or None)}


# ---------------------------------------------------------------- crates.io (rust)

_CRATES_UA = {"User-Agent": "packages-notifier/0.1 (https://github.com/liudonghua123/packages-notifier)"}

async def fetch_crates(name: str) -> dict[str, Any] | None:
    url = f"{config.ecosystems['crates_api']}/{name}"
    resp = await http().get(url, headers=_CRATES_UA)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    crate = data.get("crate") or {}
    version = crate.get("max_version") or crate.get("newest_version")
    if not version:
        return None
    return {"version": version, "description": (crate.get("description") or None)}


# ---------------------------------------------------------------- go modules

# Go module paths may include major-version suffix (module/path/v2).
_GO_VERSION_SUFFIX = re.compile(r"/v([2-9]|[1-9]\d+)$")

async def fetch_go(name: str) -> dict[str, Any] | None:
    module = name.strip().rstrip("/")
    base = _GO_VERSION_SUFFIX.sub("", module)
    url = f"{config.ecosystems['go_proxy']}/{base}/@latest"
    resp = await http().get(url)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    version = data.get("Version")
    if not version:
        return None
    # strip the pseudo-version part if any; keep the semantic version
    return {"version": version, "description": None}


# ---------------------------------------------------------------- rubygems

async def fetch_rubygems(name: str) -> dict[str, Any] | None:
    url = f"{config.ecosystems['rubygems_api']}/{name}.json"
    resp = await http().get(url)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    data = resp.json()
    version = data.get("version")
    if not version:
        return None
    return {"version": version, "description": (data.get("info") or None)}


# ---------------------------------------------------------------- maven central

# groupId:artifactId
_MAVEN_COORD = re.compile(r"^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$")

async def fetch_maven(name: str) -> dict[str, Any] | None:
    if not _MAVEN_COORD.match(name.strip()):
        return None
    g, a = name.split(":", 1)
    url = config.ecosystems["maven_search"]
    resp = await http().get(
        url,
        params={"q": f'g:"{g}" AND a:"{a}"', "rows": 1, "wt": "json"},
    )
    resp.raise_for_status()
    docs = (resp.json().get("response") or {}).get("docs") or []
    if not docs:
        return None
    version = docs[0].get("latestVersion")
    if not version:
        return None
    return {"version": version, "description": None}


# ---------------------------------------------------------------- nuget

async def fetch_nuget(name: str) -> dict[str, Any] | None:
    base = config.ecosystems["nuget_flat"].rstrip("/")
    lower = name.strip().lower()
    url = f"{base}/{lower}/index.json"
    resp = await http().get(url)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    pages = resp.json().get("versions") or []
    if not pages:
        return None
    # versions are listed in ascending order; last is the latest
    return {"version": pages[-1], "description": None}


# ---------------------------------------------------------------- registry

PROVIDERS: dict[str, Callable[[str], Any]] = {
    "npm": fetch_npm,
    "pypi": fetch_pypi,
    "crates": fetch_crates,
    "go": fetch_go,
    "rubygems": fetch_rubygems,
    "maven": fetch_maven,
    "nuget": fetch_nuget,
}

ECOSYSTEM_LABELS = {
    "npm": "npm (Node.js)",
    "pypi": "PyPI (Python)",
    "crates": "crates.io (Rust)",
    "go": "Go modules",
    "rubygems": "RubyGems (Ruby)",
    "maven": "Maven Central (Java)",
    "nuget": "NuGet (.NET)",
}


def supported_types() -> list[str]:
    return list(PROVIDERS.keys())


async def fetch_latest(package_type: str, name: str) -> dict[str, Any] | None:
    """Fetch the latest version for a package of the given ecosystem.

    Returns {"version", "description"} or None if the package
    does not exist in that registry. Raises on network errors.
    """
    provider = PROVIDERS.get(package_type)
    if provider is None:
        raise ValueError(f"unsupported package type: {package_type}")
    return await provider(name)
