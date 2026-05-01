import { createNoise3D, type NoiseFunction3D } from "simplex-noise";
import { makeRng } from "./rng";

export class Noise {
  private noise: NoiseFunction3D;
  constructor(seed: number) {
    this.noise = createNoise3D(makeRng(seed));
  }

  /** Fractal Brownian motion with `octaves`. Returns ~[-1, 1]. */
  fbm(x: number, y: number, z: number, octaves: number, persistence: number): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= persistence;
      freq *= 2;
    }
    return sum / Math.max(norm, 1e-6);
  }

  raw(x: number, y: number, z: number): number {
    return this.noise(x, y, z);
  }
}
