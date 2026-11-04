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


# ---------------------------------------------------------------- search
#
# Autocomplete search per ecosystem. Not every registry has a public
# search API — for those we fall back to exact/prefix checks.


def _hit(name: str, version: str, description: str | None) -> dict[str, Any]:
    return {"name": name, "version": version or "", "description": description or ""}


async def search_npm(q: str) -> list[dict[str, Any]]:
    from .registry import client

    url = f"{config.registry['npm_registry']}/-/v1/search"
    try:
        resp = await client().get(url, params={"text": q, "size": 8})
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []
    results = []
    for obj in data.get("objects", []):
        pkg = obj.get("package", {})
        results.append(_hit(pkg.get("name", ""), pkg.get("version", ""), pkg.get("description", "")))
    return results


async def search_pypi(q: str) -> list[dict[str, Any]]:
    # PyPI has no official search API; do exact + prefix lookups on the JSON endpoint
    candidates = [q, q.replace("-", "_"), q.replace("_", "-")]
    results: list[dict[str, Any]] = []
    for name in candidates:
        if any(r["name"].lower() == name.lower() for r in results):
            continue
        try:
            hit = await fetch_pypi(name)
        except Exception:
            hit = None
        if hit:
            results.append(_hit(name, hit["version"], hit.get("description")))
        if len(results) >= 3:
            break
    return results


async def search_crates(q: str) -> list[dict[str, Any]]:
    url = f"{config.ecosystems['crates_api']}?q={q}&per_page=8"
    try:
        resp = await http().get(url, headers=_CRATES_UA)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []
    return [
        _hit(c.get("name", ""), c.get("max_version") or c.get("newest_version") or "", c.get("description"))
        for c in (data.get("crates") or [])
    ]


async def search_go(q: str) -> list[dict[str, Any]]:
    # Go module proxy has no search; probe the exact module path (with optional /vN)
    module = q.strip().strip("/")
    if not module:
        return []
    base = _GO_VERSION_SUFFIX.sub("", module)
    for candidate in (module, base):
        try:
            hit = await fetch_go(candidate)
        except Exception:
            hit = None
        if hit:
            return [_hit(candidate, hit["version"], None)]
    return []


async def search_rubygems(q: str) -> list[dict[str, Any]]:
    url = f"{config.ecosystems['rubygems_api'].rsplit('/gems', 1)[0]}/search.json?query={q}"
    try:
        resp = await http().get(url)
        if resp.status_code != 200:
            # search endpoint missing for this mirror; fall back to exact
            return await _rubygems_exact(q)
        data = resp.json()
    except Exception:
        return await _rubygems_exact(q)
    results = []
    for g in (data or [])[:8]:
        results.append(_hit(g.get("name", ""), g.get("version") or "", g.get("info")))
    if not results:
        return await _rubygems_exact(q)
    return results


async def _rubygems_exact(q: str) -> list[dict[str, Any]]:
    try:
        hit = await fetch_rubygems(q)
    except Exception:
        hit = None
    return [_hit(q, hit["version"], hit.get("description"))] if hit else []


async def search_maven(q: str) -> list[dict[str, Any]]:
    # Search by artifact keyword. The solr fielded queries with quotes return
    # empty on search.maven.org, so use plain keyword queries and post-filter.
    url = config.ecosystems["maven_search"]
    keyword = q.split(":")[-1].strip() if ":" in q else q.strip()
    if not keyword:
        return []
    try:
        resp = await http().get(url, params={"q": keyword, "rows": 8, "wt": "json"})
        resp.raise_for_status()
        docs = (resp.json().get("response") or {}).get("docs") or []
    except Exception:
        return []
    results = []
    ql = keyword.lower()
    full = q.lower()
    for d in docs:
        g, a = d.get("g") or "", d.get("a") or ""
        coord = f"{g}:{a}".lower()
        # keep docs whose artifact matches; when q is a full coordinate, prefer exact match
        if ql in a.lower() or (":" in q and coord == full):
            results.append(_hit(coord, d.get("latestVersion") or "", None))
        if len(results) >= 8:
            break
    return results


async def search_nuget(q: str) -> list[dict[str, Any]]:
    url = "https://azuresearch-usnc.nuget.org/query"
    try:
        resp = await http().get(url, params={"q": q, "take": 8})
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []
    results = []
    for d in data.get("data") or []:
        results.append(_hit(d.get("id", ""), d.get("version") or "", d.get("description")))
    return results


SEARCHERS: dict[str, Callable[[str], Any]] = {
    "npm": search_npm,
    "pypi": search_pypi,
    "crates": search_crates,
    "go": search_go,
    "rubygems": search_rubygems,
    "maven": search_maven,
    "nuget": search_nuget,
}


async def search_packages(package_type: str, q: str) -> list[dict[str, Any]]:
    """Search a package in its registry. Returns [{name, version, description}]."""
    searcher = SEARCHERS.get(package_type)
    if searcher is None:
        raise ValueError(f"unsupported package type: {package_type}")
    return await searcher(q)


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
