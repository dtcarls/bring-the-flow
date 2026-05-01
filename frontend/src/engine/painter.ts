import type { FlowField } from "./field";
import type { Polyline, CanvasSize } from "./tracer";
import { makeRng, pickWeighted } from "./rng";
import type { Palette } from "../palettes/types";

export interface StyleParams {
  strokeMin: number;
  strokeMax: number;
  colorAssignment: "random" | "banded" | "by-length" | "by-angle";
  background: string | null;
}

export interface LayerParams {
  showFlowField: boolean;
  showColors: boolean;
  flowFieldOpacity: number;
}

export interface RenderInput {
  size: CanvasSize;
  field: FlowField;
  lines: Polyline[];
  palette: Palette;
  style: StyleParams;
  layers: LayerParams;
  seed: number;
}

interface StyledLine {
  color: string;
  width: number;
  points: Float32Array;
}

function styleLines(input: RenderInput): StyledLine[] {
  const { lines, palette, style, seed } = input;
  const rng = makeRng(seed ^ 0xa5a5a5);
  const colors = palette.colors.map((c) => c.hex);
  const weights = palette.colors.map((c) => c.weight ?? 1);

  // Banding: divide the canvas into N horizontal bands, one color per band.
  const bandH = input.size.height / Math.max(1, colors.length);

  return lines.map((ln) => {
    let color: string;
    switch (style.colorAssignment) {
      case "random":
        color = pickWeighted(rng, colors, weights);
        break;
      case "banded": {
        const y = ln.points[1];
        color = colors[Math.min(colors.length - 1, Math.floor(y / bandH))];
        break;
      }
      case "by-length": {
        const t = Math.min(1, ln.length / 600);
        color = colors[Math.min(colors.length - 1, Math.floor(t * colors.length))];
        break;
      }
      case "by-angle": {
        const a = ((ln.meanAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const t = a / (Math.PI * 2);
        color = colors[Math.min(colors.length - 1, Math.floor(t * colors.length))];
        break;
      }
    }
    const width =
      style.strokeMin + rng() * (style.strokeMax - style.strokeMin);
    return { color, width, points: ln.points };
  });
}

export function paintCanvas(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { size, field, layers, palette, style } = input;
  const bg = style.background ?? palette.background ?? "#f1ece0";
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size.width, size.height);

  if (layers.showFlowField) {
    drawFieldStreaks(ctx, field, size, layers.flowFieldOpacity);
  }

  if (layers.showColors) {
    const styled = styleLines(input);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of styled) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.points[0], s.points[1]);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i], s.points[i + 1]);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function paintSvg(input: RenderInput): string {
  const { size, field, layers, palette, style } = input;
  const bg = style.background ?? palette.background ?? "#f1ece0";
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" width="${size.width}" height="${size.height}">`,
  );
  parts.push(`<rect width="${size.width}" height="${size.height}" fill="${bg}"/>`);

  if (layers.showFlowField) {
    parts.push(svgFieldStreaks(field, size, layers.flowFieldOpacity));
  }

  if (layers.showColors) {
    const styled = styleLines(input);
    parts.push(
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">',
    );
    for (const s of styled) {
      const d = pointsToPathD(s.points);
      parts.push(
        `<path d="${d}" stroke="${s.color}" stroke-width="${s.width.toFixed(2)}"/>`,
      );
    }
    parts.push("</g>");
  }
  parts.push("</svg>");
  return parts.join("");
}

function pointsToPathD(p: Float32Array): string {
  if (p.length < 2) return "";
  let s = `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  for (let i = 2; i < p.length; i += 2) {
    s += `L${p[i].toFixed(2)} ${p[i + 1].toFixed(2)}`;
  }
  return s;
}

function drawFieldStreaks(
  ctx: CanvasRenderingContext2D,
  field: FlowField,
  size: CanvasSize,
  opacity: number,
): void {
  const step = 24;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = "#2c3e57";
  ctx.lineWidth = 1;
  for (let y = step / 2; y < size.height; y += step) {
    for (let x = step / 2; x < size.width; x += step) {
      const a = field.angleAt(x, y);
      const len = step * 0.4;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function svgFieldStreaks(field: FlowField, size: CanvasSize, opacity: number): string {
  const step = 24;
  const parts: string[] = [
    `<g stroke="#2c3e57" stroke-width="1" opacity="${opacity}">`,
  ];
  for (let y = step / 2; y < size.height; y += step) {
    for (let x = step / 2; x < size.width; x += step) {
      const a = field.angleAt(x, y);
      const len = step * 0.4;
      const x0 = (x - Math.cos(a) * len).toFixed(1);
      const y0 = (y - Math.sin(a) * len).toFixed(1);
      const x1 = (x + Math.cos(a) * len).toFixed(1);
      const y1 = (y + Math.sin(a) * len).toFixed(1);
      parts.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`);
    }
  }
  parts.push("</g>");
  return parts.join("");
}
