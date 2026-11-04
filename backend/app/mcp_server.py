"""MCP tools exposing the full API via fastmcp, mounted on the same port at /mcp."""
from __future__ import annotations

import time
from typing import Any

from fastmcp import FastMCP

from . import db, notify
from .config import config as _cfg
from .registry import fetch_package_meta

mcp = FastMCP("packages-notifier")


def _cfg_current():
    from . import config as cfgmod
    return cfgmod.config


@mcp.tool
async def health() -> dict[str, Any]:
    """Check the service health."""
    return {"ok": True, "time": time.time()}


@mcp.tool
async def list_watched_packages() -> dict[str, Any]:
    """List all packages currently watched by the notifier with their latest known versions."""
    pkgs = await db.run(db.list_packages)
    return {"packages": pkgs}


@mcp.tool
async def get_package_info(package: str) -> dict[str, Any]:
    """Query live metadata for an npm package (latest version, description, recent versions, publish time)."""
    meta = await fetch_package_meta(package.strip())
    watched = await db.run(db.get_package, package.strip())
    return {"package": meta, "watched": bool(watched)}


@mcp.tool
async def list_ecosystems() -> dict[str, Any]:
    """List supported package ecosystems (npm, pypi, crates, go, rubygems, maven, nuget) with their check intervals."""
    from .api import list_ecosystems as _list
    return await _list()


@mcp.tool
async def request_subscription_code(
    email: str,
    package: str,
    version_match: str = "any",
    version_pattern: str = "",
    package_type: str = "npm",
) -> dict[str, Any]:
    """Step 1 of subscribing: request a verification code sent to the email for watching a package.

    package_type selects the ecosystem (npm, pypi, crates, go,
    rubygems, maven, nuget). Optional version filtering:
    version_match is one of "any" (default), "equals",
    "startswith", "regexmatch"; version_pattern is the value
    compared against the new version string (required unless "any").
    """
    from .api import subscribe_request_code
    body = {"email": email, "package": package, "package_type": package_type}
    if version_match != "any":
        body["version_match"] = version_match
        body["version_pattern"] = version_pattern
    return await subscribe_request_code(body)


@mcp.tool
async def verify_subscription(email: str, package: str, code: str) -> dict[str, Any]:
    """Step 2 of subscribing: confirm the emailed verification code to activate the subscription."""
    from .api import subscribe_verify
    return await subscribe_verify({"email": email, "package": package, "code": code})


@mcp.tool
async def request_unsubscribe_code(email: str, package: str) -> dict[str, Any]:
    """Step 1 of unsubscribing: request a verification code sent to the email."""
    from .api import unsubscribe_request_code
    return await unsubscribe_request_code({"email": email, "package": package})


@mcp.tool
async def verify_unsubscribe(email: str, package: str, code: str) -> dict[str, Any]:
    """Step 2 of unsubscribing: confirm the emailed verification code to remove the subscription."""
    from .api import unsubscribe_verify
    return await unsubscribe_verify({"email": email, "package": package, "code": code})


@mcp.tool
async def list_subscriptions(email: str) -> dict[str, Any]:
    """List a user's subscriptions by email address."""
    from .api import my_subscriptions
    return await my_subscriptions(email)


@mcp.tool
async def search_packages_tool(query: str, package_type: str = "npm") -> dict[str, Any]:
    """Search packages by keyword in a registry (autocomplete).

    package_type selects the ecosystem (npm, pypi, crates, go,
    rubygems, maven, nuget).
    """
    from .api import search_packages
    return await search_packages(query, package_type)


@mcp.tool
async def check_updates_now() -> dict[str, Any]:
    """Trigger an immediate update check across all watched packages and email subscribers of any new versions."""
    from .registry import Poller
    poller = Poller(notify.notify_update)
    updates = await poller.run_once()
    return {"updates": updates}
