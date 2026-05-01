"""FastAPI entrypoint: API + static frontend."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import export, palettes, projects
from .storage import ensure_dirs


@asynccontextmanager
async def _lifespan(app: FastAPI):
    ensure_dirs()
    yield


app = FastAPI(title="bring-the-flow", version="0.1.0", lifespan=_lifespan)
app.include_router(projects.router)
app.include_router(palettes.router)
app.include_router(export.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# Serve built frontend if present. In dev (no build), this directory may not exist.
STATIC_DIR = Path(os.environ.get("BTF_STATIC_DIR", "/app/static"))
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
