import { api } from "../api";
import type { Palette, PaletteColor } from "../palettes/types";
import { store } from "../state";

export function mountPaletteEditor(host: HTMLElement, onChange: () => void): void {
  const render = () => {
    host.innerHTML = "";

    const h = document.createElement("h3");
    h.textContent = "Palette";
    h.style.fontSize = "11px";
    h.style.textTransform = "uppercase";
    h.style.letterSpacing = "0.15em";
    h.style.color = "var(--muted)";
    h.style.margin = "0 0 6px";
    host.append(h);

    // Picker
    const select = document.createElement("select");
    select.style.width = "100%";
    select.style.marginBottom = "8px";
    for (const p of store.palettes) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === store.params.style.paletteId) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener("change", () => {
      store.params.style.paletteId = select.value;
      onChange();
      render();
    });
    host.append(select);

    const current = store.currentPalette();
    const inspired = current.inspiredBy
      ? `Inspired by: ${current.inspiredBy}`
      : null;
    if (inspired) {
      const note = document.createElement("div");
      note.textContent = inspired;
      note.style.fontSize = "11px";
      note.style.color = "var(--muted)";
      note.style.marginBottom = "6px";
      host.append(note);
    }

    // Swatches
    const swatchRow = document.createElement("div");
    swatchRow.className = "palette-swatches";
    const isPreset = !current.id.startsWith("user-");

    current.colors.forEach((c, idx) => {
      const sw = document.createElement("div");
      sw.className = "palette-swatch";
      sw.style.background = c.hex;
      const inp = document.createElement("input");
      inp.type = "color";
      inp.value = c.hex;
      inp.disabled = isPreset;
      inp.addEventListener("input", () => {
        c.hex = inp.value;
        sw.style.background = inp.value;
        onChange();
      });
      sw.append(inp);
      const w = document.createElement("span");
      w.className = "weight";
      w.textContent = String(c.weight ?? 1);
      sw.append(w);
      sw.title = `${c.hex} (weight ${c.weight ?? 1})`;
      swatchRow.append(sw);
    });
    host.append(swatchRow);

    // Background
    if (current.background) {
      const bgRow = document.createElement("div");
      bgRow.className = "control-row";
      const lbl = document.createElement("label");
      lbl.textContent = "Background";
      const swatch = document.createElement("div");
      swatch.className = "palette-swatch";
      swatch.style.background = current.background;
      const inp = document.createElement("input");
      inp.type = "color";
      inp.value = current.background;
      inp.disabled = isPreset;
      inp.addEventListener("input", () => {
        current.background = inp.value;
        swatch.style.background = inp.value;
        onChange();
      });
      swatch.append(inp);
      bgRow.append(lbl, swatch);
      host.append(bgRow);
    }

    // Color assignment
    const assignRow = document.createElement("div");
    assignRow.className = "control-row";
    const aLbl = document.createElement("label");
    aLbl.textContent = "Assignment";
    const aSel = document.createElement("select");
    for (const v of ["random", "banded", "by-length", "by-angle"] as const) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      if (store.params.style.colorAssignment === v) o.selected = true;
      aSel.append(o);
    }
    aSel.addEventListener("change", () => {
      store.params.style.colorAssignment =
        aSel.value as typeof store.params.style.colorAssignment;
      onChange();
    });
    assignRow.append(aLbl, aSel);
    host.append(assignRow);

    // Action buttons
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.marginTop = "10px";
    actions.style.flexWrap = "wrap";

    const dup = document.createElement("button");
    dup.textContent = "Duplicate";
    dup.addEventListener("click", async () => {
      const created = await api.createPalette({
        name: current.name + " (copy)",
        colors: current.colors.map((c) => ({ ...c })),
        background: current.background,
        inspiredBy: current.inspiredBy,
      });
      store.palettes.push(created);
      store.params.style.paletteId = created.id;
      onChange();
      render();
    });
    actions.append(dup);

    if (!isPreset) {
      const save = document.createElement("button");
      save.textContent = "Save edits";
      save.className = "primary";
      save.addEventListener("click", async () => {
        await api.updatePalette(current.id, {
          name: current.name,
          colors: current.colors,
          background: current.background,
          inspiredBy: current.inspiredBy,
        });
      });
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.className = "danger";
      del.addEventListener("click", async () => {
        if (!confirm(`Delete palette "${current.name}"?`)) return;
        await api.deletePalette(current.id);
        store.palettes = store.palettes.filter((p) => p.id !== current.id);
        store.params.style.paletteId = store.palettes[0]?.id ?? "";
        onChange();
        render();
      });
      actions.append(save, del);
    }

    host.append(actions);
  };

  store.subscribe(render);
  render();
}
