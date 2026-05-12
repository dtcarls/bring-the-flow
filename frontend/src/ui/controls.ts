import { store } from "../state";
import { BRUSH_SIZES } from "../engine/painter";

interface SliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  format?: (v: number) => string;
  description?: string;
  /** When true the value display is a read-only label (for non-numeric formats like "#4"). */
  displayLabel?: boolean;
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

  const rangeInput = document.createElement("input");
  rangeInput.type = "range";
  rangeInput.min = String(spec.min);
  rangeInput.max = String(spec.max);
  rangeInput.step = String(spec.step);
  rangeInput.value = String(spec.get());

  if (spec.displayLabel) {
    const display = document.createElement("span");
    display.className = "slider-num";
    display.style.textAlign = "right";
    display.style.fontVariantNumeric = "tabular-nums";
    display.textContent = fmt(spec.get());
    rangeInput.addEventListener("input", () => {
      const v = parseFloat(rangeInput.value);
      spec.set(v);
      display.textContent = fmt(v);
      onChange();
    });
    row.append(labelWrap, display, rangeInput);
  } else {
    const numInput = document.createElement("input");
    numInput.type = "number";
    numInput.className = "slider-num";
    numInput.min = String(spec.min);
    numInput.max = String(spec.max);
    numInput.step = String(spec.step);
    numInput.value = fmt(spec.get());
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
  }

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
  // --- Preset helpers ---
  const PRESET_KEY = "btf-presets";
  function loadPresets(): Record<string, any> {
    try {
      return JSON.parse(localStorage.getItem(PRESET_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function savePresets(presets: Record<string, any>) {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
  }

  function saveCurrentPreset(name: string) {
    if (!name) return;
    const presets = loadPresets();
    presets[name] = JSON.parse(JSON.stringify(store.params));
    savePresets(presets);
  }
  function loadPresetToStore(name: string) {
    const presets = loadPresets();
    if (presets[name]) {
      Object.assign(store.params, JSON.parse(JSON.stringify(presets[name])));
      store.emit();
    }
  }

  const render = () => {
    host.innerHTML = "";
    const p = store.params;

    // --- Preset UI ---
    const presetRow = document.createElement("div");
    presetRow.className = "control-row";
    presetRow.style.display = "flex";
    presetRow.style.gap = "6px";
    presetRow.style.alignItems = "center";

    // Dropdown
    const presetSelect = document.createElement("select");
    presetSelect.style.flex = "1";
    const presets = loadPresets();
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Select preset...";
    presetSelect.append(defaultOpt);
    for (const name of Object.keys(presets)) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      presetSelect.append(opt);
    }
    presetSelect.addEventListener("change", () => {
      if (presetSelect.value) {
        loadPresetToStore(presetSelect.value);
        onChange();
      }
    });

    // Textbox
    const presetInput = document.createElement("input");
    presetInput.type = "text";
    presetInput.placeholder = "Preset name";
    presetInput.style.flex = "1";


    // Save button (now below the input)
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save preset";
    saveBtn.style.marginTop = "4px";
    saveBtn.addEventListener("click", () => {
      const name = presetInput.value.trim();
      if (name) {
        saveCurrentPreset(name);
        presetInput.value = "";
        render(); // refresh dropdown
      }
    });

    // Layout: dropdown on top, then input, then button below
    const presetCol = document.createElement("div");
    presetCol.style.display = "flex";
    presetCol.style.flexDirection = "column";
    presetCol.style.flex = "1";
    presetCol.style.gap = "2px";
    presetCol.append(presetInput, saveBtn);

    presetRow.append(presetSelect, presetCol);
    host.append(presetRow);

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
          label: "Line spacing (in)",
          description: "Minimum separation between adjacent curves in inches. Smaller values pack curves tightly; larger values leave breathing room. Tyler Hobbs identifies this as one of the most impactful parameters.",
          min: 0.05, max: 2, step: 0.05,
          get: () => p.tracing.lineSpacing,
          set: (v) => (p.tracing.lineSpacing = v),
          format: (v) => v.toFixed(2),
        }, onChange),
        slider({
          label: "Step size (in)",
          description: "Distance moved per integration step along the field, in inches. Smaller steps produce smoother curves; larger steps are faster but may look jagged.",
          min: 0.02, max: 0.2, step: 0.01,
          get: () => p.tracing.stepSize,
          set: (v) => (p.tracing.stepSize = v),
          format: (v) => v.toFixed(2),
        }, onChange),
        slider({
          label: "Min length (in)",
          description: "Curves shorter than this threshold (in inches) are discarded. Increase to remove stray short marks and keep only substantial lines.",
          min: 0, max: 8, step: 0.1,
          get: () => p.tracing.minLength,
          set: (v) => (p.tracing.minLength = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Max length (in)",
          description: "Maximum curve length in inches. Shorter limits create a fragmented rhythmic look; longer limits allow sweeping arcs across the canvas.",
          min: 1, max: 80, step: 0.5,
          get: () => p.tracing.maxLength,
          set: (v) => (p.tracing.maxLength = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Seed attempts",
          description: "How many random starting points are tried. More attempts fill the canvas more completely; fewer leave deliberate gaps. Controls overall curve count.",
          min: 200, max: 20000, step: 100,
          get: () => p.tracing.numSeeds,
          set: (v) => (p.tracing.numSeeds = v),
          format: (v) => v.toFixed(0),
        }, onChange),
        // Margin slider removed; margin is now fixed at 0
      ),
      group(
        "Brush",
        slider({
          label: "Min brush size",
          description: "Smallest brush in the mix. Sizes follow the standard brush numbering: 0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24. Each stroke is randomly assigned a size between min and max.",
          min: 0, max: 12, step: 1,
          get: () => p.style.strokeMin,
          set: (v) => (p.style.strokeMin = v),
          format: (v) => `#${BRUSH_SIZES[Math.max(0, Math.min(12, Math.round(v)))]}`,
          displayLabel: true,
        }, onChange),
        slider({
          label: "Max brush size",
          description: "Largest brush in the mix. A wider gap between min and max creates more dramatic width variation across strokes.",
          min: 0, max: 12, step: 1,
          get: () => p.style.strokeMax,
          set: (v) => (p.style.strokeMax = v),
          format: (v) => `#${BRUSH_SIZES[Math.max(0, Math.min(12, Math.round(v)))]}`,
          displayLabel: true,
        }, onChange),
        slider({
          label: "Opacity",
          description: "Transparency of each stroke. Lower values let strokes layer translucently for a painterly effect.",
          min: 0.05, max: 1, step: 0.05,
          get: () => p.style.strokeOpacity,
          set: (v) => (p.style.strokeOpacity = v),
          format: (v) => v.toFixed(2),
        }, onChange),
      ),
      group(
        "Canvas",
        slider({
          label: "Width (in)",
          description: "Canvas width in inches. Rendered at 25 px/in for preview; SVG export carries the physical dimensions for print.",
          min: 4, max: 120, step: 0.5,
          get: () => p.canvas.widthIn,
          set: (v) => (p.canvas.widthIn = v),
          format: (v) => v.toFixed(1),
        }, onChange),
        slider({
          label: "Height (in)",
          description: "Canvas height in inches. Default 60\" pairs with 48\" width for a 4:5 large-format print.",
          min: 4, max: 120, step: 0.5,
          get: () => p.canvas.heightIn,
          set: (v) => (p.canvas.heightIn = v),
          format: (v) => v.toFixed(1),
        }, onChange),
      ),
    );
  };

  store.subscribe(render);
  render();
}
