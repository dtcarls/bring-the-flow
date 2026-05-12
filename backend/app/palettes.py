"""Palette CRUD on the mounted volume.

Built-in presets are bundled with the app and always returned;
user-saved palettes live under /data/palettes/.
"""
from __future__ import annotations

import io
import secrets
from collections import Counter

from fastapi import APIRouter, HTTPException, UploadFile
from PIL import Image

from .models import Palette, PaletteColor, PaletteCreate
from .storage import (
    PALETTES_DIR,
    ensure_dirs,
    palette_path,
    read_json,
    safe_id,
    write_json,
)

router = APIRouter(prefix="/api/palettes", tags=["palettes"])


def _c(hex_: str, w: float = 1.0) -> PaletteColor:
    return PaletteColor(hex=hex_, weight=w)


PRESETS: list[Palette] = [
    Palette(
        id="fidenza-warm",
        name="Fidenza · Warm",
        inspiredBy="Tyler Hobbs — Fidenza (warm)",
        background="#f3ecd8",
        colors=[
            _c("#b8412f"), _c("#d97a2c"), _c("#e7b04a"),
            _c("#356b5b"), _c("#2c3e57"), _c("#efe4c8"),
        ],
    ),
    Palette(
        id="fidenza-cool",
        name="Fidenza · Cool",
        inspiredBy="Tyler Hobbs — Fidenza (cool)",
        background="#eef0ea",
        colors=[
            _c("#1f4e7a"), _c("#2c8aa6"), _c("#7fb7be"),
            _c("#a07cbe"), _c("#3b3b46"), _c("#dfe6e0"),
        ],
    ),
    Palette(
        id="bring-the-end",
        name="Bring the End",
        inspiredBy="Tyler Hobbs — Bring the End",
        background="#101418",
        colors=[
            _c("#ff3b1f", 1.4), _c("#ff8a1e"), _c("#ffd23f"),
            _c("#e23ea0"), _c("#2455c4", 0.8), _c("#f5e9d2", 0.5),
        ],
    ),
    Palette(
        id="return-one",
        name="Return One",
        inspiredBy="Tyler Hobbs — Return One",
        background="#e8e2d4",
        colors=[
            _c("#3b3a36", 1.5), _c("#7c6a4f"), _c("#b89968"),
            _c("#5b6e5f"), _c("#c44a2a", 0.4), _c("#d8cfc0", 0.6),
        ],
    ),
    Palette(
        id="blue-literal",
        name="Blue Literal",
        inspiredBy="Tyler Hobbs — Blue Literal",
        background="#f1ece0",
        colors=[
            _c("#1c3f8f", 2.0), _c("#2a5fb5", 1.5), _c("#0c1a3a", 1.0),
            _c("#7f9ed3", 0.8), _c("#0a0a0a", 0.3), _c("#c8d8f0", 0.5),
        ],
    ),
    Palette(
        id="red-literal",
        name="Red Literal",
        inspiredBy="Tyler Hobbs — Red Literal",
        background="#f1ece0",
        colors=[
            _c("#b8201f", 2.0), _c("#e23a2e", 1.5), _c("#5a0e10", 1.0),
            _c("#d68b7c", 0.8), _c("#0a0a0a", 0.3), _c("#f0d8d0", 0.5),
        ],
    ),
]


def _preset_ids() -> set[str]:
    return {p.id for p in PRESETS}


def _extract_colors_from_image(data: bytes, n_colors: int = 7) -> tuple[list[str], str]:
    """Return (palette_colors[6], background_hex) extracted from image bytes."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((200, 200), Image.LANCZOS)
    quantized = img.quantize(colors=n_colors, method=Image.Quantize.MEDIANCUT)
    palette_data = quantized.getpalette() or []
    actual_n = len(palette_data) // 3
    counts: Counter[int] = Counter(quantized.getdata())
    # Build list of (hex, frequency) sorted by frequency descending
    items = []
    for i in range(actual_n):
        r, g, b = palette_data[i * 3], palette_data[i * 3 + 1], palette_data[i * 3 + 2]
        items.append((f"#{r:02x}{g:02x}{b:02x}", counts.get(i, 0)))
    items.sort(key=lambda x: -x[1])
    # Pad with neutral greys if the image has very few distinct colors
    while len(items) < 7:
        items.append(("#888888", 0))
    background = items[0][0]
    colors = [c[0] for c in items[1:7]]
    return colors, background


@router.post("/extract-from-image")
async def extract_palette_from_image(file: UploadFile) -> dict:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="uploaded file must be an image")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="image too large (max 10 MB)")
    try:
        colors, background = _extract_colors_from_image(data)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"could not process image: {exc}") from exc
    return {
        "colors": [{"hex": h, "weight": 1.0} for h in colors],
        "background": background,
    }


@router.get("")
def list_palettes() -> list[dict]:
    ensure_dirs()
    out: list[dict] = [p.model_dump() for p in PRESETS]
    if PALETTES_DIR.exists():
        for f in sorted(PALETTES_DIR.glob("*.json")):
            try:
                data = read_json(f)
                if data.get("id") not in _preset_ids():
                    out.append(data)
            except Exception:
                continue
    return out


@router.get("/{palette_id}")
def get_palette(palette_id: str) -> Palette:
    pid = safe_id(palette_id)
    for p in PRESETS:
        if p.id == pid:
            return p
    path = palette_path(pid)
    if not path.exists():
        raise HTTPException(status_code=404, detail="palette not found")
    return Palette.model_validate(read_json(path))


@router.post("", response_model=Palette)
def create_palette(payload: PaletteCreate) -> Palette:
    ensure_dirs()
    pid = "user-" + secrets.token_urlsafe(6).replace("_", "-").replace("=", "")
    p = Palette(
        id=pid,
        name=payload.name,
        colors=payload.colors,
        background=payload.background,
        inspiredBy=payload.inspiredBy,
    )
    write_json(palette_path(pid), p.model_dump())
    return p


@router.put("/{palette_id}", response_model=Palette)
def update_palette(palette_id: str, payload: PaletteCreate) -> Palette:
    pid = safe_id(palette_id)
    if pid in _preset_ids():
        raise HTTPException(status_code=400, detail="cannot edit a built-in preset; duplicate it first")
    p = Palette(
        id=pid,
        name=payload.name,
        colors=payload.colors,
        background=payload.background,
        inspiredBy=payload.inspiredBy,
    )
    write_json(palette_path(pid), p.model_dump())
    return p


@router.delete("/{palette_id}")
def delete_palette(palette_id: str) -> dict:
    pid = safe_id(palette_id)
    if pid in _preset_ids():
        raise HTTPException(status_code=400, detail="cannot delete a built-in preset")
    path = palette_path(pid)
    if not path.exists():
        raise HTTPException(status_code=404, detail="palette not found")
    path.unlink()
    return {"ok": True}
