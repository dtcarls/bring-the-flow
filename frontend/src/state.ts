import type { Palette } from "./palettes/types";
import type { ProjectParams, ProjectSummary } from "./api";

export function defaultParams(): ProjectParams {
  return {
    canvas: { width: 1200, height: 1500 },
    field: {
      seed: 1,
      noiseScale: 0.0035,
      octaves: 2,
      persistence: 0.5,
      rotationOffset: 0,
      curl: false,
      angleMult: 1.0,
      noiseZ: 0.0,
    },
    tracing: {
      lineSpacing: 6,
      stepSize: 1.5,
      minLength: 20,
      maxLength: 800,
      numSeeds: 4000,
      margin: 0,
    },
    style: {
      strokeMin: 1.0,
      strokeMax: 3.5,
      strokeOpacity: 1.0,
      paletteId: "fidenza-warm",
      colorAssignment: "random",
      background: null,
    },
    layers: {
      showFlowField: false,
      showColors: true,
      flowFieldOpacity: 0.25,
    },
  };
}

type Listener = () => void;

export class Store {
  params: ProjectParams = defaultParams();
  palettes: Palette[] = [];
  projects: ProjectSummary[] = [];
  currentProjectId: string | null = null;
  currentProjectName: string = "Untitled";
  private listeners: Listener[] = [];

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(): void {
    for (const l of this.listeners) l();
  }

  paletteById(id: string): Palette | undefined {
    return this.palettes.find((p) => p.id === id);
  }

  currentPalette(): Palette {
    return (
      this.paletteById(this.params.style.paletteId) ??
      this.palettes[0] ?? {
        id: "fallback",
        name: "Fallback",
        background: "#f1ece0",
        colors: [{ hex: "#1c3f8f", weight: 1 }],
        inspiredBy: null,
      }
    );
  }
}

export const store = new Store();
