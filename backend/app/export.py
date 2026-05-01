"""SVG → PNG/PDF export via CairoSVG, written to /data/projects/<id>/exports/."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import cairosvg
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .models import ExportRequest, ExportResult
from .storage import project_dir, safe_id

router = APIRouter(prefix="/api/projects/{project_id}", tags=["export"])


# Paper sizes in millimeters (width, height) at portrait orientation.
PAPER_MM: dict[str, tuple[float, float]] = {
    "A5": (148.0, 210.0),
    "A4": (210.0, 297.0),
    "A3": (297.0, 420.0),
    "A2": (420.0, 594.0),
    "Letter": (215.9, 279.4),
    "Legal": (215.9, 355.6),
    "Tabloid": (279.4, 431.8),
    "Square": (300.0, 300.0),
}


def _mm_to_px(mm: float, dpi: int) -> int:
    return int(round(mm / 25.4 * dpi))


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


@router.post("/export", response_model=ExportResult)
def export(project_id: str, req: ExportRequest) -> ExportResult:
    pid = safe_id(project_id)
    pdir = project_dir(pid)
    if not (pdir / "project.json").exists():
        raise HTTPException(status_code=404, detail="project not found")

    if req.paperSize not in PAPER_MM:
        raise HTTPException(status_code=400, detail=f"unknown paper size: {req.paperSize}")
    w_mm, h_mm = PAPER_MM[req.paperSize]
    if req.orientation == "landscape":
        w_mm, h_mm = h_mm, w_mm

    exports = pdir / "exports"
    exports.mkdir(exist_ok=True)
    base = f"{_ts()}-{req.paperSize.lower()}-{req.orientation}-{req.dpi}dpi"

    if req.format == "svg":
        out = exports / f"{base}.svg"
        out.write_text(req.svg)
    elif req.format == "png":
        out = exports / f"{base}.png"
        px_w = _mm_to_px(w_mm, req.dpi)
        px_h = _mm_to_px(h_mm, req.dpi)
        cairosvg.svg2png(
            bytestring=req.svg.encode("utf-8"),
            write_to=str(out),
            output_width=px_w,
            output_height=px_h,
        )
    elif req.format == "pdf":
        out = exports / f"{base}.pdf"
        cairosvg.svg2pdf(
            bytestring=req.svg.encode("utf-8"),
            write_to=str(out),
            output_width=w_mm * 96.0 / 25.4,
            output_height=h_mm * 96.0 / 25.4,
        )
    else:
        raise HTTPException(status_code=400, detail=f"unknown format: {req.format}")

    return ExportResult(
        filename=out.name,
        url=f"/api/projects/{pid}/exports/{out.name}",
        bytes=out.stat().st_size,
        format=req.format,
    )


@router.get("/exports")
def list_exports(project_id: str) -> list[dict]:
    pid = safe_id(project_id)
    pdir = project_dir(pid) / "exports"
    if not pdir.exists():
        return []
    out: list[dict] = []
    for f in sorted(pdir.iterdir(), reverse=True):
        if f.is_file():
            out.append(
                {
                    "filename": f.name,
                    "bytes": f.stat().st_size,
                    "url": f"/api/projects/{pid}/exports/{f.name}",
                }
            )
    return out


@router.get("/exports/{filename}")
def download_export(project_id: str, filename: str) -> FileResponse:
    pid = safe_id(project_id)
    safe_name = Path(filename).name  # strip any path components
    target = project_dir(pid) / "exports" / safe_name
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="export not found")
    media = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".pdf": "application/pdf",
    }.get(target.suffix.lower(), "application/octet-stream")
    return FileResponse(str(target), media_type=media, filename=safe_name)
