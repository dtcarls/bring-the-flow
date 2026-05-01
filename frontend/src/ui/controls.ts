import { store } from "../state";

interface SliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  format?: (v: number) => string;
  description?: string;
}

function slider(spec: SliderSpec, onChange: () => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "control-row";
  const fmt = spec.format ?? ((v: number) => v.toString());

  const labelWrap = document.createElement("div");
  labelWrap.className = "control-label-wrap";
  const labelEl = document.createElement("label");
  labelEl.textContent = spec.label;
  labelWrap.append(labelEl);

  if (spec.description) {
    const info = document.createElement("button");
    info.type = "button";
    info.className = "info-btn";
    info.textContent = "ⓘ";
    info.setAttribute("data-tooltip", spec.description);
    labelWrap.append(info);
  }

  const numInput = document.createElement("input");
  numInput.type = "number";
  numInput.className = "slider-num";
  numInput.min = String(spec.min);
  numInput.max = String(spec.max);
  numInput.step = String(spec.step);
  numInput.value = fmt(spec.get());

  const rangeInput = document.createElement("input");
  rangeInput.type = "range";
  rangeInput.min = String(spec.min);
  rangeInput.max = String(spec.max);
  rangeInput.step = String(spec.step);
  rangeInput.value = String(spec.get());

  rangeInput.addEventListener("input", () => {
    const v = parseFloat(rangeInput.value);
    spec.set(v);
    numInput.value = fmt(v);
    onChange();
  });

  numInput.addEventListener("change", () => {
    let v = parseFloat(numInput.value);
    if (isNaN(v)) v = spec.get();
    v = Math.max(spec.min, Math.min(spec.max, v));
    spec.set(v);
    rangeInput.value = String(v);
    numInput.value = fmt(v);
    onChange();
  });

  row.append(labelWrap, numInput, rangeInput);
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

function toggle(
  label: string,
  get: () => boolean,
  set: (v: boolean) => void,
  onChange: () => void,
  description?: string,
): HTMLElement {
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
  if (description) {
    const info = document.createElement("button");
    info.type = "button";
    info.className = "info-btn";
    info.textContent = "ⓘ";
    info.setAttribute("data-tooltip", description);
    row.append(info);
  }
  return row;
}

export function mountControls(host: HTMLElement, onChange: () => void): void {
  const render = () => {
    host.innerHTML = "";
    const p = store.params;

    // Seed row
    const seedRow = document.createElement("div");
    seedRow.className = "control-row";
    const seedLabelWrap = document.createElement("div");
    seedLabelWrap.className = "control-label-wrap";
    const seedLabel = document.createElement("label");
    seedLabel.textContent = "Seed";
    const seedInfo = document.createElement("button");
    seedInfo.type = "button";
    seedInfo.className = "info-btn";
    seedInfo.textContent = "ⓘ";
    seedInfo.setAttribute("data-tooltip", "Unique number that initialises the random noise pattern. Change this to get a completely different composition.");
    seedLabelWrap.append(seedLabel, seedInfo);
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
    seedRow.append(seedLabelWrap, document.createElement("span"), seedWrap);

    host.append(
      group(
        "Field",
        seedRow,
        slider({
          label: "Noise scale",
          description: "Controls the zoom level of the noise field. Lower values create long sweeping curves; higher values produce tightly curling patterns.",
          min: 1, max: 100, step: 1,
          get: () => Math.round((p.field.noiseScale - 0.0001) / (0.01 - 0.0001) * 99 + 1),
          set: (v) => {
            // Map 1-100 to 0.0001-0.01
            p.field.noiseScale = 0.0001 + ((v - 1) / 99) * (0.01 - 0.0001);
          },
          format: (v) => String(Math.round(v)),
        }, onChange),
        slider({
          label: "Octaves",
          description: "Number of noise layers stacked together (fractal detail). More octaves add fine texture to the field at the cost of render time.",
          min: 1, max: 6, step: 1,
          get: () => p.field.octaves,
          set: (v) => (p.field.octaves = v),
          format: (v) => v.toFixed(0),
        }, onChange),
        slider({
          label: "Persistence",
          description: "How much each successive octave contributes relative to the previous. Higher values emphasise fine detail; lower values keep the field smooth.",
          min: 0.1, max: 0.9, step: 0.05,
          get: () => p.field.persistence,
          set: (v) => (p.field.persistence = v),
          format: (v) => v.toFixed(2),
        }, onChange),
        slider({
          label: "Angle mult",
          description: "Scales how noise values map to flow angles. At 1× curves tend to flow in one direction; at 2× they span a full rotation; at 4× they curl tightly. Tyler Hobbs highlights this as a key parameter to experiment with.",
          min: 0.5, max: 4, step: 0.1,
          get: () => p.field.angleMult,
          set: (v) => (p.field.angleMult = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Noise Z",
          description: "Samples a different cross-section through 3D noise space. Slide to explore adjacent field variations without altering the overall structure — useful for finding a pleasing variant of the same seed.",
          min: 0, max: 10, step: 0.05,
          get: () => p.field.noiseZ,
          set: (v) => (p.field.noiseZ = v),
          format: (v) => v.toFixed(2),
        }, onChange),
        slider({
          label: "Rotation (°)",
          description: "Rotates all flow directions by a fixed offset. Use to tilt the overall composition without changing the noise pattern.",
          min: 0, max: 360, step: 1,
          get: () => (p.field.rotationOffset * 180) / Math.PI,
          set: (v) => (p.field.rotationOffset = (v * Math.PI) / 180),
          format: (v) => v.toFixed(0),
        }, onChange),
        toggle(
          "Curl (divergence-free)",
          () => p.field.curl,
          (v) => (p.field.curl = v),
          onChange,
          "Switches to a divergence-free (curl) field that makes curves spiral and loop rather than flow uniformly in one direction.",
        ),
      ),
      group(
        "Tracing",
        slider({
          label: "Line spacing",
          description: "Minimum separation distance between adjacent curves. Smaller values pack curves tightly for a dense look; larger values leave breathing room. Tyler Hobbs identifies this as one of the most impactful parameters.",
          min: -2, max: 40, step: 0.5,
          get: () => p.tracing.lineSpacing,
          set: (v) => (p.tracing.lineSpacing = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Step size",
          description: "Distance moved per integration step along the field. Smaller steps produce smoother curves; larger steps are faster but may look jagged.",
          min: 0.5, max: 4, step: 0.1,
          get: () => p.tracing.stepSize,
          set: (v) => (p.tracing.stepSize = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Min length",
          description: "Curves shorter than this pixel threshold are discarded. Increase to remove stray short marks and keep only substantial lines.",
          min: 0, max: 200, step: 1,
          get: () => p.tracing.minLength,
          set: (v) => (p.tracing.minLength = v),
          format: (v) => v.toFixed(0),
        }, onChange),
        slider({
          label: "Max length",
          description: "Maximum curve length in pixels. Shorter limits create a fragmented rhythmic look; longer limits allow sweeping arcs across the canvas.",
          min: 50, max: 2000, step: 10,
          get: () => p.tracing.maxLength,
          set: (v) => (p.tracing.maxLength = v),
          format: (v) => v.toFixed(0),
        }, onChange),
        slider({
          label: "Seed attempts",
          description: "How many random starting points are tried. More attempts fill the canvas more completely; fewer leave deliberate gaps. Controls overall curve count.",
          min: 200, max: 20000, step: 100,
          get: () => p.tracing.numSeeds,
          set: (v) => (p.tracing.numSeeds = v),
          format: (v) => v.toFixed(0),
        }, onChange),
        slider({
          label: "Margin",
          description: "Blank border zone around the canvas edges where curves cannot start or travel. Useful for a clean compositional border.",
          min: 0, max: 200, step: 1,
          get: () => p.tracing.margin,
          set: (v) => (p.tracing.margin = v),
          format: (v) => v.toFixed(0),
        }, onChange),
      ),
      group(
        "Stroke",
        slider({
          label: "Stroke min",
          description: "Minimum line width in pixels. Each curve is assigned a random width between min and max, giving organic hand-drawn variation.",
          min: 0.2, max: 8, step: 0.1,
          get: () => p.style.strokeMin,
          set: (v) => (p.style.strokeMin = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Stroke max",
          description: "Maximum line width in pixels. A larger gap between min and max creates more dramatic width variation across curves.",
          min: 0.2, max: 12, step: 0.1,
          get: () => p.style.strokeMax,
          set: (v) => (p.style.strokeMax = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Opacity",
          description: "Transparency of each stroke. Lower values let curves layer over each other with a translucent painterly effect. Tyler Hobbs recommends experimenting with this for interesting overlapping results.",
          min: 0.05, max: 1, step: 0.05,
          get: () => p.style.strokeOpacity,
          set: (v) => (p.style.strokeOpacity = v),
          format: (v) => v.toFixed(2),
        }, onChange),
      ),
      group(
        "Canvas",
        slider({
          label: "Width",
          description: "Canvas width in pixels. Affects the live preview resolution and export dimensions.",
          min: 600, max: 3000, step: 50,
          get: () => p.canvas.width,
          set: (v) => (p.canvas.width = v),
          format: (v) => v.toFixed(0),
        }, onChange),
        slider({
          label: "Height",
          description: "Canvas height in pixels. Affects the live preview resolution and export dimensions.",
          min: 600, max: 3000, step: 50,
          get: () => p.canvas.height,
          set: (v) => (p.canvas.height = v),
          format: (v) => v.toFixed(0),
        }, onChange),
      ),
    );
  };

  store.subscribe(render);
  render();
}
