// Deterministic hashing helpers. Every modelled number in the demo dataset is a
// pure function of (entity, day), so values are stable across restarts.

export function hash(...parts: (string | number)[]): number {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform in [0, 1). */
export const rand = (...p: (string | number)[]) => hash(...p) / 4294967296;

export const between = (lo: number, hi: number, ...p: (string | number)[]) =>
  lo + (hi - lo) * rand(...p);

export const pick = <T>(arr: readonly T[], ...p: (string | number)[]): T =>
  arr[Math.floor(rand(...p) * arr.length)];

/** Standard normal. */
export function gauss(...p: (string | number)[]): number {
  const u = Math.max(rand(...p, 'u'), 1e-9);
  const v = rand(...p, 'v');
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Normalise weights so they sum to 1. */
export function normalize(w: number[]): number[] {
  const t = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / t);
}
