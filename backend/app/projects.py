"""Project CRUD on the mounted volume."""
from __future__ import annotations

import secrets
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from .models import Project, ProjectCreate, ProjectParams, ProjectUpdate
from .storage import ensure_dirs, project_dir, read_json, safe_id, write_json, PROJECTS_DIR

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return secrets.token_urlsafe(8).replace("_", "-").replace("=", "")


def _load(project_id: str) -> dict:
    pdir = project_dir(project_id)
    pfile = pdir / "project.json"
    if not pfile.exists():
        raise HTTPException(status_code=404, detail="project not found")
    return read_json(pfile)


@router.get("")
def list_projects() -> list[dict]:
    ensure_dirs()
    out: list[dict] = []
    for child in sorted(PROJECTS_DIR.iterdir()) if PROJECTS_DIR.exists() else []:
        pfile = child / "project.json"
        if pfile.exists():
            try:
                data = read_json(pfile)
                out.append(
                    {
                        "id": data["id"],
                        "name": data["name"],
                        "createdAt": data["createdAt"],
                        "updatedAt": data["updatedAt"],
                    }
                )
            except Exception:
                continue
    out.sort(key=lambda p: p["updatedAt"], reverse=True)
    return out


@router.post("", response_model=Project)
def create_project(payload: ProjectCreate) -> Project:
    ensure_dirs()
    pid = _new_id()
    now = _now()
    project = Project(
        id=pid,
        name=payload.name,
        params=payload.params,
        createdAt=now,
        updatedAt=now,
    )
    pdir = project_dir(pid)
    pdir.mkdir(parents=True, exist_ok=True)
    (pdir / "exports").mkdir(exist_ok=True)
    write_json(pdir / "project.json", project.model_dump())
    return project


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str) -> Project:
    return Project.model_validate(_load(safe_id(project_id)))


@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, payload: ProjectUpdate) -> Project:
    pid = safe_id(project_id)
    data = _load(pid)
    if payload.name is not None:
        data["name"] = payload.name
    if payload.params is not None:
        data["params"] = payload.params.model_dump()
    data["updatedAt"] = _now()
    pdir = project_dir(pid)
    write_json(pdir / "project.json", data)
    if payload.previewSvg is not None:
        (pdir / "preview.svg").write_text(payload.previewSvg)
    return Project.model_validate(data)


@router.delete("/{project_id}")
def delete_project(project_id: str) -> dict:
    pid = safe_id(project_id)
    pdir = project_dir(pid)
    if not pdir.exists():
        raise HTTPException(status_code=404, detail="project not found")
    shutil.rmtree(pdir)
    return {"ok": True}


def project_params(project_id: str) -> ProjectParams:
    return ProjectParams.model_validate(_load(safe_id(project_id))["params"])
