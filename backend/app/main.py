"""App entrypoint: FastAPI serves REST + admin + static frontend; fastmcp mounts at /mcp."""
from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db, notify
from .api import admin_router, router
from .config import FRONTEND_DIST, config
from .mcp_server import mcp
from .registry import Poller, close_client

poller = Poller(notify.notify_update)

# Mount MCP (streamable HTTP) on the same port at /mcp
mcp_app = mcp.http_app(path="/")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # init db schema
    await db.run(lambda: None)
    if config.poll.get("interval_seconds", 0) > 0:
        await poller.start()
    async with mcp_app.lifespan(app):
        yield
    await poller.stop()
    await close_client()


app = FastAPI(title="packages-notifier", version="0.1.0", lifespan=lifespan)

app.include_router(router)
app.include_router(admin_router)

app.mount("/mcp", mcp_app)


class MCPSlashFix:
    """Starlette's Mount("/mcp") does not match the bare path "/mcp", so requests
    to /mcp (no trailing slash) fall through to the SPA catch-all and return
    HTML — clients then fail with 'Invalid content type, expected
    "text/event-stream"'. Rewrite /mcp -> /mcp/ before routing."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == "/mcp":
            scope = dict(scope, path="/mcp/")
        await self.app(scope, receive, send)


app.add_middleware(MCPSlashFix)


@app.get("/api/poller/status")
async def poller_status() -> dict:
    return {
        "running": poller._running,
        "last_run": poller.last_run,
        "last_error": poller.last_error,
        "interval_seconds": config.poll.get("interval_seconds"),
    }


@app.post("/api/poller/check-now")
async def poller_check_now() -> dict:
    """Trigger an immediate poll cycle (also used by the admin console)."""
    updates = await poller.run_once(force=True)
    return {
        "ok": True,
        "updates": len(updates),
        "last_run": poller.last_run,
        "last_error": poller.last_error,
    }


# ---------------- static frontend (built SPA) ----------------

if FRONTEND_DIST.exists():
    assets = FRONTEND_DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        candidate = FRONTEND_DIST / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
