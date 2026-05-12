from __future__ import annotations

from fastapi.testclient import TestClient


def _client() -> TestClient:
    from app.main import app  # imported lazily so the env var is set first

    return TestClient(app)


def test_project_crud_round_trip() -> None:
    c = _client()

    assert c.get("/api/projects").json() == []

    created = c.post("/api/projects", json={"name": "First Flow"}).json()
    pid = created["id"]
    assert created["name"] == "First Flow"
    assert created["params"]["field"]["seed"] == 1

    listed = c.get("/api/projects").json()
    assert [p["id"] for p in listed] == [pid]

    upd = c.put(
        f"/api/projects/{pid}",
        json={
            "name": "Renamed",
            "params": {
                "canvas": {"widthIn": 24.0, "heightIn": 30.0},
                "field": {
                    "seed": 42,
                    "noiseScale": 0.005,
                    "octaves": 3,
                    "persistence": 0.5,
                    "rotationOffset": 0.0,
                    "curl": True,
                },
                "tracing": {
                    "lineSpacing": 0.2,
                    "stepSize": 0.05,
                    "minLength": 1.0,
                    "maxLength": 20.0,
                    "numSeeds": 2000,
                    "margin": 0,
                },
                "style": {
                    "strokeMin": 1.0,
                    "strokeMax": 2.5,
                    "paletteId": "blue-literal",
                    "colorAssignment": "random",
                    "background": None,
                },
                "layers": {
                    "showFlowField": False,
                    "showColors": True,
                    "flowFieldOpacity": 0.25,
                },
            },
        },
    ).json()
    assert upd["name"] == "Renamed"
    assert upd["params"]["field"]["seed"] == 42

    fetched = c.get(f"/api/projects/{pid}").json()
    assert fetched["name"] == "Renamed"

    del_ok = c.delete(f"/api/projects/{pid}")
    assert del_ok.status_code == 200
    assert c.get(f"/api/projects/{pid}").status_code == 404


def test_palette_presets_present() -> None:
    c = _client()
    palettes = c.get("/api/palettes").json()
    ids = {p["id"] for p in palettes}
    for required in {
        "fidenza-warm",
        "fidenza-cool",
        "bring-the-end",
        "return-one",
        "blue-literal",
        "red-literal",
    }:
        assert required in ids, f"missing preset {required}"


def test_custom_palette_round_trip() -> None:
    c = _client()
    created = c.post(
        "/api/palettes",
        json={
            "name": "My Palette",
            "colors": [{"hex": "#112233"}, {"hex": "#445566", "weight": 2.0}],
            "background": "#fafafa",
        },
    ).json()
    pid = created["id"]
    assert pid.startswith("user-")

    fetched = c.get(f"/api/palettes/{pid}").json()
    assert fetched["name"] == "My Palette"
    assert len(fetched["colors"]) == 2

    # cannot edit a preset
    bad = c.put(
        "/api/palettes/blue-literal",
        json={"name": "x", "colors": [{"hex": "#000000"}]},
    )
    assert bad.status_code == 400
