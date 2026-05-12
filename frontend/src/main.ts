import { api } from "./api";
import type { ProjectParams } from "./api";
import { defaultParams, store } from "./state";
import { FlowField } from "./engine/field";
import { Tracer } from "./engine/tracer";
import type { CanvasSize, TracingParams } from "./engine/tracer";
import { paintCanvas, paintSvg } from "./engine/painter";
import { mountControls } from "./ui/controls";
import { mountPaletteEditor } from "./ui/paletteEditor";
import { mountLayersPanel } from "./ui/layersPanel";

const canvas = document.getElementById("preview") as HTMLCanvasElement;
const status = document.getElementById("status")!;
const projectSelect = document.getElementById("project-select") as HTMLSelectElement;

/** Preview resolution: pixels per inch. 48×60" → 1200×1500 px. */
const PREVIEW_PPI = 25;

function canvasPx(p: ProjectParams): CanvasSize {
  return {
    width: Math.round(p.canvas.widthIn * PREVIEW_PPI),
    height: Math.round(p.canvas.heightIn * PREVIEW_PPI),
  };
}

function tracingPx(p: ProjectParams, ppi: number): TracingParams {
  return {
    ...p.tracing,
    lineSpacing: p.tracing.lineSpacing * ppi,
    stepSize: p.tracing.stepSize * ppi,
    minLength: p.tracing.minLength * ppi,
    maxLength: p.tracing.maxLength * ppi,
  };
}

let renderToken = 0;

function setStatus(text: string): void {
  status.textContent = text;
}

function fitCanvasToParams(): void {
  const { width, height } = canvasPx(store.params);
  canvas.width = width;
  canvas.height = height;
  // Fit-to-screen visually (CSS sizing).
  const wrap = canvas.parentElement!;
  const maxW = wrap.clientWidth - 32;
  const maxH = wrap.clientHeight - 32;
  const scale = Math.min(1, maxW / width, maxH / height);
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
}

async function render(): Promise<void> {
  const myToken = ++renderToken;
  fitCanvasToParams();
  const ctx = canvas.getContext("2d")!;
  const t0 = performance.now();
  const sizePx = canvasPx(store.params);
  const ppi = sizePx.width / store.params.canvas.widthIn;
  const field = new FlowField(store.params.field);
  const tracer = new Tracer(
    field,
    sizePx,
    tracingPx(store.params, ppi),
  );
  // Yield once so UI can paint sliders before we crunch.
  await new Promise(requestAnimationFrame);
  if (myToken !== renderToken) return;

  const lines = tracer.trace(store.params.field.seed);
  if (myToken !== renderToken) return;

  paintCanvas(ctx, {
    size: sizePx,
    ppi,
    lines,
    palette: store.currentPalette(),
    style: store.params.style,
    layers: store.params.layers,
    seed: store.params.field.seed,
  });
  const t1 = performance.now();
  setStatus(`${lines.length} curves · ${(t1 - t0).toFixed(0)} ms`);
}

function buildSvgForExport(): string {
  const sizePx = canvasPx(store.params);
  const ppi = sizePx.width / store.params.canvas.widthIn;
  const field = new FlowField(store.params.field);
  const tracer = new Tracer(field, sizePx, tracingPx(store.params, ppi));
  const lines = tracer.trace(store.params.field.seed);
  return paintSvg({
    size: sizePx,
    ppi,
    lines,
    palette: store.currentPalette(),
    style: store.params.style,
    layers: store.params.layers,
    seed: store.params.field.seed,
  });
}

let renderScheduled = false;
function scheduleRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
}

function refreshProjectSelect(): void {
  projectSelect.innerHTML = "";
  if (store.projects.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(no saved projects)";
    projectSelect.append(opt);
  } else {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = `— ${store.currentProjectName} (unsaved) —`;
    projectSelect.append(empty);
  }
  for (const p of store.projects) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === store.currentProjectId) opt.selected = true;
    projectSelect.append(opt);
  }
}

async function loadProject(id: string): Promise<void> {
  const p = await api.getProject(id);
  store.currentProjectId = p.id;
  store.currentProjectName = p.name;
  store.params = p.params;
  store.emit();
  scheduleRender();
}

async function saveProject(): Promise<void> {
  if (store.currentProjectId) {
    await api.updateProject(store.currentProjectId, {
      name: store.currentProjectName,
      params: store.params,
    });
  } else {
    const name = prompt("Project name?", store.currentProjectName);
    if (!name) return;
    const created = await api.createProject({ name, params: store.params });
    store.currentProjectId = created.id;
    store.currentProjectName = created.name;
  }
  store.projects = await api.listProjects();
  refreshProjectSelect();
  setStatus("Saved.");
}

async function deleteProject(): Promise<void> {
  if (!store.currentProjectId) return;
  if (!confirm(`Delete project "${store.currentProjectName}"?`)) return;
  await api.deleteProject(store.currentProjectId);
  store.currentProjectId = null;
  store.currentProjectName = "Untitled";
  store.projects = await api.listProjects();
  refreshProjectSelect();
}

async function newProject(): Promise<void> {
  store.currentProjectId = null;
  store.currentProjectName = "Untitled";
  store.params = defaultParams();
  store.emit();
  refreshProjectSelect();
  scheduleRender();
}

async function openExport(): Promise<void> {
  const dialog = document.getElementById("export-dialog") as HTMLDialogElement;
  const form = document.getElementById("export-form") as HTMLFormElement;
  if (!store.currentProjectId) {
    if (!confirm("Save the project first?")) return;
    await saveProject();
    if (!store.currentProjectId) return;
  }
  dialog.returnValue = "";
  dialog.showModal();
  dialog.addEventListener(
    "close",
    async () => {
      if (dialog.returnValue !== "confirm") return;
      const fd = new FormData(form);
      setStatus("Rendering print-res…");
      try {
        const svg = buildSvgForExport();
        const result = await api.exportProject(store.currentProjectId!, {
          svg,
          paperSize: String(fd.get("paperSize")),
          orientation: fd.get("orientation") as "portrait" | "landscape",
          dpi: parseInt(String(fd.get("dpi") || "300"), 10),
          format: fd.get("format") as "png" | "pdf" | "svg",
        });
        setStatus(`Saved ${result.filename} (${(result.bytes / 1024).toFixed(1)} KB)`);
        const a = document.createElement("a");
        a.href = result.url;
        a.download = result.filename;
        a.click();
      } catch (err) {
        setStatus(`Export failed: ${(err as Error).message}`);
      }
    },
    { once: true },
  );
}

async function init(): Promise<void> {
  store.palettes = await api.listPalettes();
  store.projects = await api.listProjects();

  mountControls(document.getElementById("controls")!, scheduleRender);
  mountPaletteEditor(document.getElementById("palette-panel")!, scheduleRender);
  mountLayersPanel(document.getElementById("layers-panel")!, scheduleRender);

  refreshProjectSelect();
  projectSelect.addEventListener("change", () => {
    if (projectSelect.value) loadProject(projectSelect.value);
  });

  document.getElementById("project-new")!.addEventListener("click", newProject);
  document.getElementById("project-save")!.addEventListener("click", saveProject);
  document.getElementById("project-delete")!.addEventListener("click", deleteProject);
  document.getElementById("export-open")!.addEventListener("click", openExport);

  window.addEventListener("resize", scheduleRender);
  scheduleRender();
}

init().catch((err) => {
  setStatus(`Init failed: ${err.message}`);
  console.error(err);
});
