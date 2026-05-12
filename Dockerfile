# ─── Stage 1: build the frontend bundle ──────────────────────────────────
FROM node:20-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python runtime serving FastAPI + static frontend ───────────
FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    BTF_DATA_DIR=/data \
    BTF_STATIC_DIR=/app/static

# CairoSVG needs Cairo + Pango (for any text), plus libffi for cffi.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        libcairo2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libffi8 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for cache reuse.
COPY backend/pyproject.toml ./backend/pyproject.toml
RUN pip install --upgrade pip \
 && pip install \
        "fastapi>=0.115" \
        "uvicorn[standard]>=0.32" \
        "pydantic>=2.9" \
        "cairosvg>=2.7" \
        "python-multipart>=0.0.6" \
        "pillow>=10.4"

COPY backend/ ./backend/
COPY --from=frontend /build/dist /app/static

VOLUME ["/data"]
EXPOSE 8080
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
