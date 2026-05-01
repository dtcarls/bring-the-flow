from __future__ import annotations

import os
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def _data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point storage at a per-test temp dir, then reload modules so they pick it up."""
    monkeypatch.setenv("BTF_DATA_DIR", str(tmp_path))
    import importlib
    from app import storage  # noqa: WPS433

    importlib.reload(storage)
    # Modules that captured DATA_ROOT at import time also need a refresh.
    from app import projects, palettes, export  # noqa: WPS433

    importlib.reload(projects)
    importlib.reload(palettes)
    importlib.reload(export)
    return tmp_path
