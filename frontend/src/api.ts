import type { Palette } from "./palettes/types";

export interface ProjectParams {
  canvas: { width: number; height: number };
  field: {
    seed: number;
    noiseScale: number;
    octaves: number;
    persistence: number;
    rotationOffset: number;
    curl: boolean;
    angleMult: number;
    noiseZ: number;
  };
  tracing: {
    lineSpacing: number;
    stepSize: number;
    minLength: number;
    maxLength: number;
    numSeeds: number;
    margin: number;
  };
  style: {
    strokeMin: number;
    strokeMax: number;
    strokeOpacity: number;
    paletteId: string;
    colorAssignment: "random" | "banded" | "by-length" | "by-angle";
    background: string | null;
  };
  layers: {
    showFlowField: boolean;
    showColors: boolean;
    flowFieldOpacity: number;
  };
}

export interface Project {
  id: string;
  name: string;
  params: ProjectParams;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportResult {
  filename: string;
  url: string;
  bytes: number;
  format: "png" | "pdf" | "svg";
}

async function j<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

const headers = { "content-type": "application/json" };

export const api = {
  health: () => j<{ ok: boolean }>(fetch("/api/health")),

  listProjects: () => j<ProjectSummary[]>(fetch("/api/projects")),
  getProject: (id: string) => j<Project>(fetch(`/api/projects/${id}`)),
  createProject: (body: { name: string; params?: ProjectParams }) =>
    j<Project>(
      fetch("/api/projects", { method: "POST", headers, body: JSON.stringify(body) }),
    ),
  updateProject: (
    id: string,
    body: { name?: string; params?: ProjectParams; previewSvg?: string },
  ) =>
    j<Project>(
      fetch(`/api/projects/${id}`, { method: "PUT", headers, body: JSON.stringify(body) }),
    ),
  deleteProject: (id: string) =>
    j<{ ok: boolean }>(fetch(`/api/projects/${id}`, { method: "DELETE" })),

  listPalettes: () => j<Palette[]>(fetch("/api/palettes")),
  createPalette: (body: Omit<Palette, "id">) =>
    j<Palette>(
      fetch("/api/palettes", { method: "POST", headers, body: JSON.stringify(body) }),
    ),
  updatePalette: (id: string, body: Omit<Palette, "id">) =>
    j<Palette>(
      fetch(`/api/palettes/${id}`, { method: "PUT", headers, body: JSON.stringify(body) }),
    ),
  deletePalette: (id: string) =>
    j<{ ok: boolean }>(fetch(`/api/palettes/${id}`, { method: "DELETE" })),
  extractPaletteFromImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return j<{ colors: Array<{ hex: string; weight: number }>; background: string }>(
      fetch("/api/palettes/extract-from-image", { method: "POST", body: fd }),
    );
  },

  exportProject: (
    id: string,
    body: {
      svg: string;
      paperSize: string;
      orientation: "portrait" | "landscape";
      dpi: number;
      format: "png" | "pdf" | "svg";
    },
  ) =>
    j<ExportResult>(
      fetch(`/api/projects/${id}/export`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    ),
};
