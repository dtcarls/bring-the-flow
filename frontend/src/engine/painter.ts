import type { Polyline, CanvasSize } from "./tracer";
import { makeRng, pickWeighted } from "./rng";
import type { Palette } from "../palettes/types";

// Standard brush size numbers (flat/wash brushes). The slider index (0–12)
// maps to these real brush sizes; physical widths in inches at 25 px/in baseline.
export const BRUSH_SIZES = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24] as const;
// Physical width in inches for each brush index.
const BRUSH_IN = [0.02, 0.06, 0.12, 0.24, 0.36, 0.48, 0.60, 0.72, 0.84, 0.96, 1.08, 1.20, 1.44];

function brushSizeToPx(idx: number, ppi: number): number {
  const i = Math.max(0, Math.min(12, Math.round(idx)));
  return BRUSH_IN[i] * ppi;
}

export interface StyleParams {
  strokeMin: number;
  strokeMax: number;
  strokeOpacity: number;
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
  /** Pixels per inch — used to scale brush widths to physical dimensions. */
  ppi: number;
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
    const size = style.strokeMin + rng() * (style.strokeMax - style.strokeMin);
    const width = brushSizeToPx(size, input.ppi);
    return { color, width, points: ln.points };
  });
}

export function paintCanvas(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { size, layers, palette, style } = input;
  const bg = style.background ?? palette.background ?? "#f1ece0";
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size.width, size.height);

  if (layers.showFlowField) {
    drawGuideLines(ctx, input.lines, layers.flowFieldOpacity);
  }

  if (layers.showColors) {
    const styled = styleLines(input);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = style.strokeOpacity ?? 1;
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
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function paintSvg(input: RenderInput): string {
  const { size, ppi, layers, palette, style } = input;
  const bg = style.background ?? palette.background ?? "#f1ece0";
  const widthIn = (size.width / ppi).toFixed(4);
  const heightIn = (size.height / ppi).toFixed(4);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" width="${widthIn}in" height="${heightIn}in">`,
  );
  parts.push(`<rect width="${size.width}" height="${size.height}" fill="${bg}"/>`);

  if (layers.showFlowField) {
    parts.push(svgGuideLines(input.lines, layers.flowFieldOpacity));
  }

  if (layers.showColors) {
    const styled = styleLines(input);
    const opacity = style.strokeOpacity ?? 1;
    const opacityAttr = opacity < 1 ? ` opacity="${opacity.toFixed(2)}"` : "";
    parts.push(
      `<g fill="none" stroke-linecap="round" stroke-linejoin="round"${opacityAttr}>`,
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

function drawGuideLines(
  ctx: CanvasRenderingContext2D,
  lines: Polyline[],
  opacity: number,
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 0.75;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const ln of lines) {
    ctx.beginPath();
    ctx.moveTo(ln.points[0], ln.points[1]);
    for (let i = 2; i < ln.points.length; i += 2) {
      ctx.lineTo(ln.points[i], ln.points[i + 1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function svgGuideLines(lines: Polyline[], opacity: number): string {
  const parts: string[] = [
    `<g stroke="#888888" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}">`,
  ];
  for (const ln of lines) {
    parts.push(`<path d="${pointsToPathD(ln.points)}"/>`);
  }
  parts.push("</g>");
  return parts.join("");
}
