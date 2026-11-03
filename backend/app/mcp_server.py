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
async def request_subscription_code(email: str, package: str) -> dict[str, Any]:
    """Step 1 of subscribing: request a verification code sent to the email for watching a package."""
    from .api import subscribe_request_code
    return await subscribe_request_code({"email": email, "package": package})


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
async def search_npm_packages(query: str) -> dict[str, Any]:
    """Search npm packages by keyword (official registry search API)."""
    from .api import search_packages
    return await search_packages(query)


@mcp.tool
async def check_updates_now() -> dict[str, Any]:
    """Trigger an immediate update check across all watched packages and email subscribers of any new versions."""
    from .registry import Poller
    poller = Poller(notify.notify_update)
    updates = await poller.run_once()
    return {"updates": updates}
