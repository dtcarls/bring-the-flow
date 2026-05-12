from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


PaperSize = Literal["A5", "A4", "A3", "A2", "Letter", "Legal", "Tabloid", "Square"]
ExportFormat = Literal["png", "pdf", "svg"]


class FieldParams(BaseModel):
    seed: int = 1
    noiseScale: float = 0.004
    octaves: int = 2
    persistence: float = 0.5
    rotationOffset: float = 0.0
    curl: bool = False
    angleMult: float = 1.0
    noiseZ: float = 0.0


class TracingParams(BaseModel):
    lineSpacing: float = 0.25
    stepSize: float = 0.06
    minLength: float = 0.8
    maxLength: float = 32.0
    numSeeds: int = 4000
    margin: float = 0.0


class StyleParams(BaseModel):
    strokeMin: float = 1.0  # brush index 0–12 → sizes 0,1,2,4,6,8,10,12,14,16,18,20,24
    strokeMax: float = 3.0  # brush index 0–12
    strokeOpacity: float = 1.0
    paletteId: str = "fidenza-warm"
    colorAssignment: Literal["random", "banded", "by-length", "by-angle"] = "random"
    background: str | None = None


class LayerParams(BaseModel):
    showFlowField: bool = False
    showColors: bool = True
    flowFieldOpacity: float = 0.25


class CanvasParams(BaseModel):
    widthIn: float = 48.0
    heightIn: float = 60.0


class ProjectParams(BaseModel):
    canvas: CanvasParams = Field(default_factory=CanvasParams)
    field: FieldParams = Field(default_factory=FieldParams)
    tracing: TracingParams = Field(default_factory=TracingParams)
    style: StyleParams = Field(default_factory=StyleParams)
    layers: LayerParams = Field(default_factory=LayerParams)


class ProjectCreate(BaseModel):
    name: str
    params: ProjectParams = Field(default_factory=ProjectParams)


class ProjectUpdate(BaseModel):
    name: str | None = None
    params: ProjectParams | None = None
    previewSvg: str | None = None


class Project(BaseModel):
    id: str
    name: str
    params: ProjectParams
    createdAt: str
    updatedAt: str


class PaletteColor(BaseModel):
    hex: str
    weight: float = 1.0


class Palette(BaseModel):
    id: str
    name: str
    colors: list[PaletteColor]
    background: str | None = None
    inspiredBy: str | None = None


class PaletteCreate(BaseModel):
    name: str
    colors: list[PaletteColor]
    background: str | None = None
    inspiredBy: str | None = None


class ExportRequest(BaseModel):
    svg: str
    paperSize: PaperSize = "A3"
    dpi: int = 300
    format: ExportFormat = "pdf"
    orientation: Literal["portrait", "landscape"] = "portrait"


class ExportResult(BaseModel):
    filename: str
    url: str
    bytes: int
    format: ExportFormat
