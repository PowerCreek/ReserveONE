// Stateless seeded randomness (mulberry32 finalizer): rand(seed, k) is the k-th draw of a seed, so no closure or counter is needed.
const mix = (a: number) => {
  const t = Math.imul(a ^ (a >>> 15), 1 | a)
  const u = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((u ^ (u >>> 14)) >>> 0) / 4294967296
}
export const rand = (seed: number, k: number) => mix((Math.imul(seed | 0, 0x9e3779b1) + Math.imul(k + 1, 0x6d2b79f5)) | 0)
/** Weighted pick from [value, weight] rows with a uniform draw r in [0,1). */
export const weighted = (rows: [number, number][], r: number) => {
  const total = rows.reduce((n, [, wt]) => n + wt, 0)
  const cum = rows.reduce<[number, number][]>((a, [v, wt]) => [...a, [v, (a.at(-1)?.[1] ?? 0) + wt]], [])
  return (cum.find(([, c]) => r * total < c) ?? cum[cum.length - 1])[0]
}
