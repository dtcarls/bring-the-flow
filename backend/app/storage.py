"""Filesystem-backed storage on the mounted /data volume."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

DATA_ROOT = Path(os.environ.get("BTF_DATA_DIR", "/data"))
PROJECTS_DIR = DATA_ROOT / "projects"
PALETTES_DIR = DATA_ROOT / "palettes"

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


def ensure_dirs() -> None:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    PALETTES_DIR.mkdir(parents=True, exist_ok=True)


def safe_id(value: str) -> str:
    if not _SAFE_ID.match(value):
        raise ValueError(f"unsafe id: {value!r}")
    return value


def project_dir(project_id: str) -> Path:
    return PROJECTS_DIR / safe_id(project_id)


def palette_path(palette_id: str) -> Path:
    return PALETTES_DIR / f"{safe_id(palette_id)}.json"


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True))
    tmp.replace(path)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())
