// Input sampler (pure): pointer, wheel and pinch deltas pile up as a pending camera target; a frame driver drains it at most once per animation frame,
// easing the camera toward the target (exponential approach, frame-rate independent via dt) and stops asking for frames once it has settled.
export type Vec = Record<string, number>
export interface Sampler {push(d: Vec): void; halt(): void; busy(): boolean; left(): Vec; step(dtMs: number): {delta: Vec; settled: boolean}}
const add = (a: Vec, b: Vec) => Object.keys(b).forEach(k => (a[k] = (a[k] ?? 0) + b[k]!))
/** `tau` = ms for the remaining distance to fall to 1/e; `eps` = distance under which a channel snaps to its target; `cap` limits how far a channel's pending target may run ahead. */
export const sampler = (tau = 70, eps = 0.01, cap: Vec = {}): Sampler => {
  let rest: Vec = {}
  const clip = (k: string) => (cap[k] === undefined ? rest[k]! : Math.max(-cap[k]!, Math.min(cap[k]!, rest[k]!)))
  const busy = () => Object.values(rest).some(v => Math.abs(v) > 0)
  return {
    push: d => (add(rest, d), Object.keys(d).forEach(k => (rest[k] = clip(k)))),
    halt: () => (rest = {}),
    busy,
    left: () => ({...rest}),
    step: dt => {
      const f = 1 - Math.exp(-Math.max(0, dt) / tau)
      const done = Object.values(rest).every(v => Math.abs(v) < eps)
      const delta = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, done ? v : v * f]))
      rest = done ? {} : Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v - delta[k]!]))
      return {delta, settled: done}
    },
  }
}
export interface Env {raf: (f: () => void) => unknown; now: () => number}
/** Drains the sampler once per frame into `apply(delta, settled)`; asks for a frame only while the sampler is busy (no idle loop). `settled` is true on the last call of a burst. */
export const driver = (s: Sampler, apply: (delta: Vec, settled: boolean) => void, env: Env, maxDt = 64) => {
  let on = false, last = 0
  const frame = () => {
    on = false
    const t = env.now(), r = s.step(Math.min(maxDt, Math.max(1, t - last)))
    last = r.settled ? 0 : t
    apply(r.delta, r.settled)
    r.settled || kick()
  }
  const kick = () => on || ((on = true), (last = last || env.now() - 16), env.raf(frame))
  return {kick, idle: () => !on, halt: () => s.halt()}
}
const LINE = 16, PAGE = 800
/** A wheel's deltaY in px whatever its deltaMode (0 px, 1 lines, 2 pages). */
export const wheelPx = (dy: number, mode = 0) => dy * (mode === 1 ? LINE : mode === 2 ? PAGE : 1)
/** The log-zoom a wheel event asks for: proportional to its size (mouse notch ~ 100 px, trackpad pinch = ctrl + small deltas), clamped per event. Up (negative) = zoom in = positive. */
export const wheelZoom = (dyPx: number, ctrl = false) => -Math.max(-0.35, Math.min(0.35, dyPx * (ctrl ? 0.01 : 0.0012)))
/** Two-pointer gesture: log scale ratio and midpoint motion between two readings. */
export const pinchOf = (a: [number, number, number, number], b: [number, number, number, number]) => {
  const [da, db] = [Math.hypot(a[2] - a[0], a[3] - a[1]), Math.hypot(b[2] - b[0], b[3] - b[1])]
  const [ma, mb] = [[(a[0] + a[2]) / 2, (a[1] + a[3]) / 2], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]]
  return {lz: da > 0 && db > 0 ? Math.log(db / da) : 0, dx: mb[0]! - ma[0]!, dy: mb[1]! - ma[1]!, mid: mb as [number, number]}
}
/** Release velocity (px per ms) from recent moves: none unless the last 100 ms span at least 16 ms (a single jump is not a throw). */
export const tracker = () => {
  let ms: {t: number; dx: number; dy: number}[] = []
  return {
    add: (t: number, dx: number, dy: number) => (ms = [...ms.filter(m => t - m.t <= 100), {t, dx, dy}]),
    reset: () => (ms = []),
    fling: (t: number, ms_ = 160, min = 0.12): [number, number] => {
      const m = ms.filter(x => t - x.t <= 100), span = m.length ? m[m.length - 1]!.t - m[0]!.t : 0
      const [vx, vy] = span >= 16 ? [m.slice(1).reduce((s, x) => s + x.dx, 0) / span, m.slice(1).reduce((s, x) => s + x.dy, 0) / span] : [0, 0]
      return Math.hypot(vx, vy) >= min ? [vx * ms_, vy * ms_] : [0, 0]
    },
  }
}
