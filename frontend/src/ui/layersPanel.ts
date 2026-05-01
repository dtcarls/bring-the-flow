import { store } from "../state";

export function mountLayersPanel(host: HTMLElement, onChange: () => void): void {
  const render = () => {
    host.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = "Layers";
    h.style.fontSize = "11px";
    h.style.textTransform = "uppercase";
    h.style.letterSpacing = "0.15em";
    h.style.color = "var(--muted)";
    h.style.margin = "12px 0 6px";
    host.append(h);

    const colors = store.params.layers;

    const mkToggle = (label: string, key: "showFlowField" | "showColors") => {
      const row = document.createElement("div");
      row.className = "toggle-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = colors[key];
      cb.addEventListener("change", () => {
        colors[key] = cb.checked;
        onChange();
      });
      const l = document.createElement("label");
      l.append(cb, document.createTextNode(" " + label));
      row.append(l);
      return row;
    };

    host.append(mkToggle("Show colors", "showColors"));
    host.append(mkToggle("Show flow field", "showFlowField"));

    const opacityRow = document.createElement("div");
    opacityRow.className = "control-row";
    const lbl = document.createElement("label");
    lbl.textContent = "Field opacity";
    const val = document.createElement("span");
    val.className = "value";
    val.textContent = colors.flowFieldOpacity.toFixed(2);
    const r = document.createElement("input");
    r.type = "range";
    r.min = "0";
    r.max = "1";
    r.step = "0.05";
    r.value = String(colors.flowFieldOpacity);
    r.addEventListener("input", () => {
      colors.flowFieldOpacity = parseFloat(r.value);
      val.textContent = colors.flowFieldOpacity.toFixed(2);
      onChange();
    });
    opacityRow.append(lbl, val, r);
    host.append(opacityRow);
  };

  store.subscribe(render);
  render();
}
