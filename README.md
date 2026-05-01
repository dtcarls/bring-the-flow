# bring-the-flow

A Dockerized web app for planning and creating physical flow-field art, inspired
by Tyler Hobbs's *Fidenza*, *Bring the End*, *Return One*, *Blue Literal*, and
*Red Literal*.

You tweak parameters of a flow field with live sliders, overlay color palettes
inspired by those works, toggle the underlying field on/off, and render
print-ready PNG / PDF / SVG files at any paper size & DPI.

---

## Quickstart (Docker)

```bash
docker compose up --build
# open http://localhost:8080
```

Projects and saved palettes persist on the host under `./data/`.

## Local development

Backend (Python 3.12+):

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -e ".[dev]"
BTF_DATA_DIR=../data .venv/bin/uvicorn app.main:app --reload --port 8080
.venv/bin/pytest             # run tests
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api → :8080)
```

## How it works

- **Frontend** owns interactivity and rendering. The flow-field engine
  (`frontend/src/engine/`) generates non-overlapping curves Hobbs-style:
  - `noise.ts` — seeded simplex + fBm.
  - `field.ts` — angle field, with optional curl (divergence-free) mode.
  - `tracer.ts` — space-filling tracer with a uniform occupancy grid that
    stops curves before they cross.
  - `painter.ts` — emits identical Canvas previews and SVG exports from the
    same polyline list.
- **Backend** (`backend/app/`) is FastAPI:
  - `projects.py`, `palettes.py` — JSON CRUD on `/data/`.
  - `export.py` — receives the SVG from the browser, rasterizes via CairoSVG
    to PNG and converts to paper-sized PDF, drops the file in the project's
    `exports/` folder.
- The frontend produces the canonical SVG so what you preview is exactly
  what you export.

## Print path

`Render print-res…` lets you choose paper size, orientation, DPI, and
format. Output is saved to `data/projects/<id>/exports/` and downloaded to
your browser. Print the PDF from your OS print dialog (most reliable across
printers and print shops). The SVG is plotter-ready (e.g. AxiDraw).
