import { Noise } from "./noise";

export interface FieldParams {
  seed: number;
  noiseScale: number;
  octaves: number;
  persistence: number;
  rotationOffset: number; // radians
  curl: boolean;
}

/**
 * A flow field: every (x, y) returns an angle (radians).
 * In curl mode we approximate a divergence-free field by
 * taking the gradient of fbm and rotating 90°.
 */
export class FlowField {
  private noise: Noise;
  constructor(public params: FieldParams) {
    this.noise = new Noise(params.seed);
  }

  angleAt(x: number, y: number): number {
    const { noiseScale, octaves, persistence, rotationOffset, curl } = this.params;
    if (!curl) {
      const n = this.noise.fbm(x * noiseScale, y * noiseScale, 0, octaves, persistence);
      // Map [-1, 1] noise to [0, 2π].
      return n * Math.PI + rotationOffset;
    }
    const eps = 1.0;
    const nx1 = this.noise.fbm((x + eps) * noiseScale, y * noiseScale, 0, octaves, persistence);
    const nx0 = this.noise.fbm((x - eps) * noiseScale, y * noiseScale, 0, octaves, persistence);
    const ny1 = this.noise.fbm(x * noiseScale, (y + eps) * noiseScale, 0, octaves, persistence);
    const ny0 = this.noise.fbm(x * noiseScale, (y - eps) * noiseScale, 0, octaves, persistence);
    const dnx = (nx1 - nx0) / (2 * eps);
    const dny = (ny1 - ny0) / (2 * eps);
    // perpendicular gradient -> divergence-free flow
    return Math.atan2(-dnx, dny) + rotationOffset;
  }
}
