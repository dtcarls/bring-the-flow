import seedrandom from "seedrandom";

export type RNG = () => number;

export function makeRng(seed: number | string): RNG {
  return seedrandom(String(seed)) as RNG;
}

export function pickWeighted<T>(rng: RNG, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
