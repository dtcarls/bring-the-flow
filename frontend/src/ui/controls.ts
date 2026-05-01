import { store } from "../state";

interface SliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  format?: (v: number) => string;
}

function slider(spec: SliderSpec, onChange: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "control-row";
  const labelEl = document.createElement("label");
  labelEl.textContent = spec.label;
  const valueEl = document.createElement("span");
  valueEl.className = "value";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step);
  input.value = String(spec.get());
  const fmt = spec.format ?? ((v: number) => v.toString());
  valueEl.textContent = fmt(spec.get());
  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    spec.set(v);
    valueEl.textContent = fmt(v);
    onChange();
  });
  row.append(labelEl, valueEl, input);
  return row;
}

function group(title: string, ...children: HTMLElement[]): HTMLElement {
  const g = document.createElement("div");
  g.className = "control-group";
  const h = document.createElement("h3");
  h.textContent = title;
  g.append(h, ...children);
  return g;
}

function toggle(label: string, get: () => boolean, set: (v: boolean) => void, onChange: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "toggle-row";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = get();
  cb.addEventListener("change", () => {
    set(cb.checked);
    onChange();
  });
  const l = document.createElement("label");
  l.append(cb, document.createTextNode(" " + label));
  row.append(l);
  return row;
}

export function mountControls(host: HTMLElement, onChange: () => void): void {
  const render = () => {
    host.innerHTML = "";
    const p = store.params;

    // Field group
    const seedRow = document.createElement("div");
    seedRow.className = "control-row";
    const seedLabel = document.createElement("label");
    seedLabel.textContent = "Seed";
    const seedInput = document.createElement("input");
    seedInput.type = "number";
    seedInput.value = String(p.field.seed);
    seedInput.addEventListener("change", () => {
      p.field.seed = parseInt(seedInput.value || "0", 10);
      onChange();
    });
    const reroll = document.createElement("button");
    reroll.textContent = "🎲 Re-roll";
    reroll.addEventListener("click", () => {
      p.field.seed = Math.floor(Math.random() * 1e9);
      seedInput.value = String(p.field.seed);
      onChange();
    });
    const seedWrap = document.createElement("div");
    seedWrap.style.gridColumn = "1 / span 2";
    seedWrap.style.display = "flex";
    seedWrap.style.gap = "6px";
    seedWrap.append(seedInput, reroll);
    seedRow.append(seedLabel, document.createElement("span"), seedWrap);

    host.append(
      group(
        "Field",
        seedRow,
        slider(
          {
            label: "Noise scale",
            min: 0.0005,
            max: 0.02,
            step: 0.0001,
            get: () => p.field.noiseScale,
            set: (v) => (p.field.noiseScale = v),
            format: (v) => v.toFixed(4),
          },
          onChange,
        ),
        slider(
          {
            label: "Octaves",
            min: 1,
            max: 6,
            step: 1,
            get: () => p.field.octaves,
            set: (v) => (p.field.octaves = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
        slider(
          {
            label: "Persistence",
            min: 0.1,
            max: 0.9,
            step: 0.05,
            get: () => p.field.persistence,
            set: (v) => (p.field.persistence = v),
            format: (v) => v.toFixed(2),
          },
          onChange,
        ),
        slider(
          {
            label: "Rotation (°)",
            min: 0,
            max: 360,
            step: 1,
            get: () => (p.field.rotationOffset * 180) / Math.PI,
            set: (v) => (p.field.rotationOffset = (v * Math.PI) / 180),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
        toggle("Curl (divergence-free)", () => p.field.curl, (v) => (p.field.curl = v), onChange),
      ),
      group(
        "Tracing",
        slider(
          {
            label: "Line spacing",
            min: 2,
            max: 40,
            step: 0.5,
            get: () => p.tracing.lineSpacing,
            set: (v) => (p.tracing.lineSpacing = v),
            format: (v) => v.toFixed(1),
          },
          onChange,
        ),
        slider(
          {
            label: "Step size",
            min: 0.5,
            max: 4,
            step: 0.1,
            get: () => p.tracing.stepSize,
            set: (v) => (p.tracing.stepSize = v),
            format: (v) => v.toFixed(1),
          },
          onChange,
        ),
        slider(
          {
            label: "Min length",
            min: 0,
            max: 200,
            step: 1,
            get: () => p.tracing.minLength,
            set: (v) => (p.tracing.minLength = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
        slider(
          {
            label: "Max length",
            min: 50,
            max: 2000,
            step: 10,
            get: () => p.tracing.maxLength,
            set: (v) => (p.tracing.maxLength = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
        slider(
          {
            label: "Seed attempts",
            min: 200,
            max: 20000,
            step: 100,
            get: () => p.tracing.numSeeds,
            set: (v) => (p.tracing.numSeeds = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
        slider(
          {
            label: "Margin",
            min: 0,
            max: 200,
            step: 1,
            get: () => p.tracing.margin,
            set: (v) => (p.tracing.margin = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
      ),
      group(
        "Stroke",
        slider(
          {
            label: "Stroke min",
            min: 0.2,
            max: 8,
            step: 0.1,
            get: () => p.style.strokeMin,
            set: (v) => (p.style.strokeMin = v),
            format: (v) => v.toFixed(1),
          },
          onChange,
        ),
        slider(
          {
            label: "Stroke max",
            min: 0.2,
            max: 12,
            step: 0.1,
            get: () => p.style.strokeMax,
            set: (v) => (p.style.strokeMax = v),
            format: (v) => v.toFixed(1),
          },
          onChange,
        ),
      ),
      group(
        "Canvas",
        slider(
          {
            label: "Width",
            min: 600,
            max: 3000,
            step: 50,
            get: () => p.canvas.width,
            set: (v) => (p.canvas.width = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
        slider(
          {
            label: "Height",
            min: 600,
            max: 3000,
            step: 50,
            get: () => p.canvas.height,
            set: (v) => (p.canvas.height = v),
            format: (v) => v.toFixed(0),
          },
          onChange,
        ),
      ),
    );
  };

  store.subscribe(render);
  render();
}
