// Path + data helpers shared by the store, patches and history (C3: tiny pure tables of behaviour).
export const join = (base: string, k: string | symbol) => (base ? `${base}.${String(k)}` : String(k))
export const near = (a: string, b: string) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.')
export const read = (o: any, path: string): any => path.split('.').reduce((v, k) => v?.[k], o)
/** Deep copy that shares nothing with the source; works through store Proxies (no structuredClone). */
export const clone = <T>(v: T): T => {
  const copy = (x: any): any => (Array.isArray(x) ? x.map(clone) : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, clone(y)])))
  return v && typeof v === 'object' ? copy(v) : v
}
