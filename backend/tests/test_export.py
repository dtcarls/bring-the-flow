from __future__ import annotations

from fastapi.testclient import TestClient

SAMPLE_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    '<rect width="100" height="100" fill="#1c3f8f"/>'
    '<path d="M10 10 C 40 80, 80 20, 95 95" stroke="#f1ece0" '
    'stroke-width="2" fill="none"/>'
    "</svg>"
)


def _client() -> TestClient:
    from app.main import app

    return TestClient(app)


def _make_project(c: TestClient) -> str:
    return c.post("/api/projects", json={"name": "Export Test"}).json()["id"]


def test_export_svg_round_trip() -> None:
    c = _client()
    pid = _make_project(c)
    res = c.post(
        f"/api/projects/{pid}/export",
        json={"svg": SAMPLE_SVG, "format": "svg", "paperSize": "A4"},
    ).json()
    assert res["format"] == "svg"
    assert res["bytes"] > 0

    listing = c.get(f"/api/projects/{pid}/exports").json()
    assert any(item["filename"] == res["filename"] for item in listing)

    dl = c.get(res["url"])
    assert dl.status_code == 200
    assert b"<svg" in dl.content


def test_export_png_has_correct_pixel_dimensions() -> None:
    c = _client()
    pid = _make_project(c)
    # A5 portrait at 72 DPI -> 148mm x 210mm = 419 x 595 px
    res = c.post(
        f"/api/projects/{pid}/export",
        json={"svg": SAMPLE_SVG, "format": "png", "paperSize": "A5", "dpi": 72},
    ).json()
    assert res["format"] == "png"

    from io import BytesIO
    from PIL import Image

    dl = c.get(res["url"]).content
    img = Image.open(BytesIO(dl))
    # 148mm x 210mm at 72 DPI ≈ 420 x 595 px (depending on rounding)
    assert abs(img.size[0] - 420) <= 1
    assert abs(img.size[1] - 595) <= 1


def test_export_pdf_produced() -> None:
    c = _client()
    pid = _make_project(c)
    res = c.post(
        f"/api/projects/{pid}/export",
        json={"svg": SAMPLE_SVG, "format": "pdf", "paperSize": "A4"},
    ).json()
    assert res["format"] == "pdf"
    dl = c.get(res["url"]).content
    assert dl[:5] == b"%PDF-"
