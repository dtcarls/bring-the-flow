import { api } from "../api";
import type { Palette } from "../palettes/types";
import { store } from "../state";

function hexInput(
  initial: string,
  onCommit: (hex: string) => void,
): HTMLInputElement {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "hex-input";
  inp.value = initial;
  inp.placeholder = "#rrggbb";
  inp.maxLength = 7;
  inp.spellcheck = false;
  inp.addEventListener("change", () => {
    const hex = inp.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onCommit(hex.toLowerCase());
    } else {
      inp.value = initial; // revert invalid
    }
  });
  return inp;
}

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

    // Palette selector
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
    const isPreset = !current.id.startsWith("user-");

    if (current.inspiredBy) {
      const note = document.createElement("div");
      note.textContent = `Inspired by: ${current.inspiredBy}`;
      note.style.fontSize = "11px";
      note.style.color = "var(--muted)";
      note.style.marginBottom = "6px";
      host.append(note);
    }

    // Color rows: swatch + color picker + hex input + weight input
    const colorList = document.createElement("div");
    colorList.className = "palette-color-list";

    current.colors.forEach((c) => {
      const row = document.createElement("div");
      row.className = "palette-color-row";

      const sw = document.createElement("div");
      sw.className = "palette-swatch";
      sw.style.background = c.hex;

      const colorPick = document.createElement("input");
      colorPick.type = "color";
      colorPick.value = c.hex;
      sw.append(colorPick);

      const hx = hexInput(c.hex, (hex) => {
        c.hex = hex;
        colorPick.value = hex;
        sw.style.background = hex;
        onChange();
      });

      colorPick.addEventListener("input", () => {
        c.hex = colorPick.value;
        hx.value = colorPick.value;
        sw.style.background = colorPick.value;
        onChange();
      });

      const weightInp = document.createElement("input");
      weightInp.type = "number";
      weightInp.className = "weight-input";
      weightInp.value = String(c.weight ?? 1);
      weightInp.min = "0.1";
      weightInp.max = "10";
      weightInp.step = "0.1";
      weightInp.title = "Color weight — higher value = appears more often";
      weightInp.addEventListener("change", () => {
        const w = parseFloat(weightInp.value);
        if (!isNaN(w) && w > 0) {
          c.weight = w;
          onChange();
        } else {
          weightInp.value = String(c.weight ?? 1);
        }
      });

      row.append(sw, hx, weightInp);
      colorList.append(row);
    });
    host.append(colorList);

    // Background row
    const bgVal = current.background ?? "#ffffff";
    const bgRow = document.createElement("div");
    bgRow.className = "palette-color-row";
    bgRow.style.marginTop = "4px";

    const bgSwatch = document.createElement("div");
    bgSwatch.className = "palette-swatch";
    bgSwatch.style.background = bgVal;
    const bgPick = document.createElement("input");
    bgPick.type = "color";
    bgPick.value = bgVal;
    bgSwatch.append(bgPick);

    const bgHex = hexInput(bgVal, (hex) => {
      current.background = hex;
      bgPick.value = hex;
      bgSwatch.style.background = hex;
      onChange();
    });

    bgPick.addEventListener("input", () => {
      current.background = bgPick.value;
      bgHex.value = bgPick.value;
      bgSwatch.style.background = bgPick.value;
      onChange();
    });

    const bgLabel = document.createElement("span");
    bgLabel.textContent = "Background";
    bgLabel.style.fontSize = "11px";
    bgLabel.style.color = "var(--muted)";

    bgRow.append(bgSwatch, bgHex, bgLabel);
    host.append(bgRow);

    // Color assignment
    const assignRow = document.createElement("div");
    assignRow.className = "control-row";
    assignRow.style.marginTop = "8px";
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

    // Action buttons for user palettes
    if (!isPreset) {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";
      actions.style.marginTop = "10px";
      actions.style.flexWrap = "wrap";

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
      host.append(actions);
    }

    // Extract palette from image
    const extractSection = document.createElement("div");
    extractSection.className = "new-preset-section";
    extractSection.style.marginTop = "10px";

    const extractLabel = document.createElement("span");
    extractLabel.textContent = "Extract from image";
    extractLabel.style.fontSize = "11px";
    extractLabel.style.color = "var(--muted)";
    extractLabel.style.display = "block";
    extractLabel.style.marginBottom = "4px";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";

    const extractBtn = document.createElement("button");
    extractBtn.textContent = "Upload image…";
    extractBtn.style.width = "100%";

    extractBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      extractBtn.textContent = "Extracting…";
      extractBtn.disabled = true;
      try {
        const result = await api.extractPaletteFromImage(file);
        const created = await api.createPalette({
          name: file.name.replace(/\.[^.]+$/, "") + " palette",
          colors: result.colors,
          background: result.background,
          inspiredBy: null,
        });
        store.palettes.push(created);
        store.params.style.paletteId = created.id;
        onChange();
        render();
      } catch (err) {
        alert(`Could not extract palette: ${err}`);
      } finally {
        extractBtn.textContent = "Upload image…";
        extractBtn.disabled = false;
        fileInput.value = "";
      }
    });

    extractSection.append(extractLabel, extractBtn, fileInput);
    host.append(extractSection);

    // Save as new preset (always available)
    const newSection = document.createElement("div");
    newSection.className = "new-preset-section";

    const nameInp = document.createElement("input");
    nameInp.type = "text";
    nameInp.placeholder = isPreset ? "New preset name…" : "Save as new preset…";
    nameInp.style.flex = "1";
    nameInp.style.minWidth = "0";

    const saveAsBtn = document.createElement("button");
    saveAsBtn.textContent = "Save as preset";
    saveAsBtn.addEventListener("click", async () => {
      const name = nameInp.value.trim() || (current.name + " (copy)");
      const created = await api.createPalette({
        name,
        colors: current.colors.map((c) => ({ ...c })),
        background: current.background,
        inspiredBy: current.inspiredBy,
      });
      store.palettes.push(created);
      store.params.style.paletteId = created.id;
      nameInp.value = "";
      onChange();
      render();
    });

    newSection.append(nameInp, saveAsBtn);
    host.append(newSection);
  };

  store.subscribe(render);
  render();
}
