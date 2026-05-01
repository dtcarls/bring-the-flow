FROM python:3.12-bookworm

# System deps for CairoSVG and Node 20
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        curl \
        git \
        libcairo2-dev \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libffi-dev \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# Install Python backend deps so they're cached in the image layer
COPY ../backend/pyproject.toml /tmp/pyproject.toml
RUN pip install --upgrade pip \
 && pip install \
        "fastapi>=0.115" \
        "uvicorn[standard]>=0.32" \
        "pydantic>=2.9" \
        "cairosvg>=2.7" \
        "pillow>=10.4" \
        "pytest>=8.3" \
        "httpx>=0.27"
