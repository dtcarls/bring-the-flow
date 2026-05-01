# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`bring-the-flow` is a web app for planning and creating physical flow-field art inspired by Tyler Hobbs (Fidenza, Bring the End, Return One, Blue Literal). Users tweak flow-field parameters via live sliders, toggle color palettes, and export print-ready PNG/PDF/SVG files.

## Development commands

**Docker (full stack):**
```bash
docker compose up --build   # http://localhost:8080
```

**Backend (Python 3.12+):**
```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -e ".[dev]"
BTF_DATA_DIR=../data .venv/bin/uvicorn app.main:app --reload --port 8080

# Run all tests
.venv/bin/pytest

# Run a single test
.venv/bin/pytest tests/test_projects.py::test_project_crud_round_trip
```

**Frontend (Node 20+):**
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api → :8080
npm run build    # outputs to frontend/dist/
```

## Architecture

### Data flow (render path)

All rendering happens **entirely in the browser**. The backend never touches pixels during preview.

1. `store` (`frontend/src/state.ts`) holds `ProjectParams` — the single source of truth for all parameters.
2. On any parameter change, `scheduleRender()` in `main.ts` fires.
3. `main.ts` constructs a `FlowField` → `Tracer` → calls `paintCanvas` or `paintSvg` from `painter.ts`.
4. For export: the browser generates the SVG via `paintSvg`, POSTs it to `POST /api/projects/{id}/export`, and the backend rasterizes with CairoSVG. The preview and the export are pixel-identical because they use the same `paintSvg` function.

### Frontend engine (`frontend/src/engine/`)

- **`noise.ts`** — seeded simplex + fBm (fractional Brownian motion).
- **`field.ts`** (`FlowField`) — maps `(x, y)` → angle. Normal mode uses fBm directly; curl mode approximates a divergence-free field via the gradient of fBm rotated 90°.
- **`tracer.ts`** (`Tracer`) — Hobbs-style space-filling tracer. Maintains a flat `Int32Array` occupancy grid (one cell per `lineSpacing` px). For each random seed point it walks forward then backward along the field, stopping when it hits an already-occupied cell. Produces `Polyline[]`.
- **`painter.ts`** — `paintCanvas` and `paintSvg` share the same `styleLines` logic (color assignment by `random` / `banded` / `by-length` / `by-angle`, variable stroke width). They diverge only in output format (Canvas 2D API vs SVG string).

### Frontend state & UI (`frontend/src/`)

- **`state.ts`** (`Store`) — simple event-emitter class. `store.emit()` notifies all subscribers. UI panels subscribe to re-render controls when params change.
- **`api.ts`** — typed fetch wrappers for every backend endpoint.
- **`ui/controls.ts`**, **`ui/paletteEditor.ts`**, **`ui/layersPanel.ts`** — mount control panels, mutate `store.params`, call `scheduleRender()`.

### Backend (`backend/app/`)

FastAPI app with three routers, all mounted at `/api`:

| Router | Prefix | Storage |
|--------|--------|---------|
| `projects.py` | `/api/projects` | `$BTF_DATA_DIR/projects/<id>/project.json` |
| `palettes.py` | `/api/palettes` | Built-in `PRESETS` list + `$BTF_DATA_DIR/palettes/<id>.json` for user palettes |
| `export.py` | `/api/projects/{id}/export` | Writes to `$BTF_DATA_DIR/projects/<id>/exports/` |

- **`storage.py`** — all filesystem I/O. `safe_id()` validates IDs with a regex before any path construction. `write_json` is atomic (write to `.tmp` then rename).
- **`models.py`** — all Pydantic models shared by the routers. `ProjectParams` is the canonical schema mirrored on the frontend in `api.ts`.
- Built-in palettes live in `palettes.py`; user-created palettes are stored as JSON files and returned after presets in `GET /api/palettes`.

### Data directory

`$BTF_DATA_DIR` (default `/data` in Docker, `../data` locally) layout:
```
data/
  projects/
    <id>/
      project.json
      preview.svg        # optional, saved on PUT with previewSvg
      exports/           # timestamped output files
  palettes/
    user-<id>.json
```

### Key env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `BTF_DATA_DIR` | `/data` | Root for all persistent data |
| `BTF_STATIC_DIR` | `/app/static` | Where the built frontend bundle lives |

### Tests

Tests use `pytest` with `httpx`'s `TestClient`. The `conftest.py` `autouse` fixture redirects `BTF_DATA_DIR` to a `tmp_path` and hot-reloads all storage-dependent modules, so each test gets a clean filesystem.
