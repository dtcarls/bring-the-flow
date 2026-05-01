import type { FlowField } from "./field";
import { makeRng, type RNG } from "./rng";

export interface TracingParams {
  lineSpacing: number;
  stepSize: number;
  minLength: number;
  maxLength: number;
  numSeeds: number;
  margin: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface Polyline {
  points: Float32Array; // [x0, y0, x1, y1, ...]
  length: number;       // arc length in px
  meanAngle: number;    // average angle (radians)
  index: number;        // creation order
}

/**
 * Hobbs-style space-filling tracer.
 * - Builds a uniform grid of cells sized `lineSpacing`.
 * - For each random seed, integrates forward then backward along the field.
 * - Stops when a step would land in a cell already occupied by another curve
 *   (or its own tail), enforcing the non-overlapping look from Fidenza.
 */
export class Tracer {
  private cellSize: number;
  private cols: number;
  private rows: number;
  private occupancy: Int32Array;

  constructor(
    private field: FlowField,
    private size: CanvasSize,
    private params: TracingParams,
  ) {
    this.cellSize = Math.max(1, params.lineSpacing);
    this.cols = Math.ceil(size.width / this.cellSize) + 2;
    this.rows = Math.ceil(size.height / this.cellSize) + 2;
    this.occupancy = new Int32Array(this.cols * this.rows).fill(-1);
  }

  trace(seed: number): Polyline[] {
    const rng = makeRng(seed ^ 0x9e3779b9);
    const lines: Polyline[] = [];
    const { numSeeds, stepSize, maxLength, minLength, margin } = this.params;
    const w = this.size.width;
    const h = this.size.height;
    const xMin = margin;
    const yMin = margin;
    const xMax = w - margin;
    const yMax = h - margin;

    for (let s = 0; s < numSeeds; s++) {
      const sx = xMin + rng() * (xMax - xMin);
      const sy = yMin + rng() * (yMax - yMin);
      if (this.occupiedAt(sx, sy, lines.length)) continue;

      const buf: number[] = [];
      let lengthAcc = 0;
      let angleSum = 0;
      let angleCount = 0;

      // Walk forward.
      const fwd = this.walk(sx, sy, +1, lines.length, maxLength / 2, stepSize, xMin, yMin, xMax, yMax);
      // Walk backward.
      const bwd = this.walk(sx, sy, -1, lines.length, maxLength / 2, stepSize, xMin, yMin, xMax, yMax);

      // Stitch: bwd reversed (excluding the seed point) + seed + fwd (excluding seed).
      const points = stitch(bwd.points, fwd.points);
      if (points.length < 4) continue; // need at least 2 vertices
      lengthAcc = polylineLength(points);
      if (lengthAcc < minLength) continue;
      angleSum = bwd.angleSum + fwd.angleSum;
      angleCount = bwd.angleCount + fwd.angleCount;

      const line: Polyline = {
        points,
        length: lengthAcc,
        meanAngle: angleCount > 0 ? angleSum / angleCount : 0,
        index: lines.length,
      };
      // Commit: stamp every cell along the path with the line's index.
      this.stampLine(line.points, lines.length);
      lines.push(line);
    }
    return lines;
  }

  private walk(
    x0: number, y0: number,
    direction: 1 | -1,
    lineId: number,
    maxLen: number,
    step: number,
    xMin: number, yMin: number, xMax: number, yMax: number,
  ): { points: Float32Array; angleSum: number; angleCount: number } {
    const buf: number[] = [x0, y0];
    let x = x0;
    let y = y0;
    let traveled = 0;
    let angleSum = 0;
    let angleCount = 0;
    const maxSteps = Math.ceil(maxLen / step);
    for (let i = 0; i < maxSteps; i++) {
      const a = this.field.angleAt(x, y);
      angleSum += a;
      angleCount++;
      const nx = x + Math.cos(a) * step * direction;
      const ny = y + Math.sin(a) * step * direction;
      if (nx < xMin || nx > xMax || ny < yMin || ny > yMax) break;
      if (this.occupiedAt(nx, ny, lineId)) break;
      x = nx; y = ny;
      buf.push(x, y);
      traveled += step;
      if (traveled >= maxLen) break;
    }
    return { points: Float32Array.from(buf), angleSum, angleCount };
  }

  private cellIndex(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize) + 1;
    const cy = Math.floor(y / this.cellSize) + 1;
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }

  private occupiedAt(x: number, y: number, ownId: number): boolean {
    // Check the 3x3 neighborhood — anything within ~lineSpacing counts as collision.
    const cx = Math.floor(x / this.cellSize) + 1;
    const cy = Math.floor(y / this.cellSize) + 1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const v = this.occupancy[ny * this.cols + nx];
        if (v !== -1 && v !== ownId) return true;
      }
    }
    return false;
  }

  private stampLine(points: Float32Array, id: number): void {
    for (let i = 0; i < points.length; i += 2) {
      const idx = this.cellIndex(points[i], points[i + 1]);
      if (idx >= 0) this.occupancy[idx] = id;
    }
  }
}

function stitch(bwd: Float32Array, fwd: Float32Array): Float32Array {
  // bwd[0..1] is the seed; bwd[2..3], bwd[4..5], ... walk backward from it.
  // We want the polyline ordered from the far-back point through the seed to the far-forward point.
  const halfBwd = (bwd.length - 2) / 2;
  const totalLen = halfBwd * 2 + fwd.length; // include all of fwd (which begins at the seed)
  const out = new Float32Array(totalLen);
  let o = 0;
  // bwd in reverse, skipping the seed pair (positions 0,1) — write from far end inward.
  for (let i = bwd.length - 2; i >= 2; i -= 2) {
    out[o++] = bwd[i];
    out[o++] = bwd[i + 1];
  }
  // fwd in order, including the seed pair at its start.
  for (let i = 0; i < fwd.length; i += 2) {
    out[o++] = fwd[i];
    out[o++] = fwd[i + 1];
  }
  return out;
}

function polylineLength(p: Float32Array): number {
  let len = 0;
  for (let i = 2; i < p.length; i += 2) {
    const dx = p[i] - p[i - 2];
    const dy = p[i + 1] - p[i - 1];
    len += Math.hypot(dx, dy);
  }
  return len;
}
