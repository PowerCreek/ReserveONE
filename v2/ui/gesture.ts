// Camera gestures for an svg view (iso and 2D plan): pointer drag (with capture, jitter filter, coalesced samples, a little release inertia), wheel (magnitude based, about the cursor)
// and two-pointer pinch + pan. Events only pile deltas into the input sampler (inputs.ts); a frame driver applies them at most once per animation frame, eased, until the view settles.
import {driver, pinchOf, sampler, tracker, wheelPx, wheelZoom} from './inputs.ts'
import type {Env, Vec} from './inputs.ts'
export interface Ctx {svg: SVGSVGElement; anchor: [number, number]; k: number}
export interface Cfg {
  root: Element; sel: string
  mode(ev: PointerEvent, svg: SVGSVGElement): string | undefined // the press's mode (undefined = not ours)
  push: Record<string, (dx: number, dy: number) => Vec> // client-px drag delta -> channel pushes, per mode
  fling: string[] // modes that carry a little inertia after release
  wheel(ev: WheelEvent): boolean // does this wheel event zoom (else it is left to the page)
  begin?(mode: string, dx: number, dy: number, ev: PointerEvent): void // a press moved past the click threshold
  apply(delta: Vec, g: Ctx, settled: boolean): void // once per frame; `settled` = the last call of a burst (do the full redraw)
  tau?: number; env?: Env
}
const JITTER = 0.5, THRESH = 4
const real: Env = {raf: f => (globalThis.requestAnimationFrame ?? ((g: () => void) => setTimeout(g, 16)))(f), now: () => (globalThis.performance ?? Date).now()}
/** svg px per client px. */
export const per = (svg: SVGSVGElement) => ((r = svg.getBoundingClientRect(), m = svg.getScreenCTM?.()) => (m?.a ? 1 / m.a : r.width ? svg.viewBox.baseVal.width / r.width : 1))()
/** The point of the visible box (as fractions) under client (x, y); the middle when the browser cannot say. */
export const anchorOf = (svg: SVGSVGElement, x: number, y: number): [number, number] => {
  const [m, b] = [svg.getScreenCTM?.()?.inverse(), svg.viewBox.baseVal]
  return m && b.width ? [(m.a * x + m.c * y + m.e - b.x) / b.width, (m.b * x + m.d * y + m.f - b.y) / b.height] : [0.5, 0.5]
}
type Drag = {mode: string; x: number; y: number; lx: number; ly: number; id: number; moved: boolean}
export const gesture = (cfg: Cfg) => {
  const [el, doc, env] = [cfg.root, cfg.root.ownerDocument, cfg.env ?? real]
  const s = sampler(cfg.tau ?? 70, 0.01, {lz: 1.4})
  const st: {d?: Drag; live: boolean; anchor: [number, number]; pin?: [number, number, number, number]} = {live: false, anchor: [0.5, 0.5]}
  const pts = new Map<number, [number, number]>()
  const vel = tracker()
  const svgOf = (t: EventTarget | null) => ((x = (t as Element | null)?.closest?.(cfg.sel) as SVGSVGElement | null) => (x && el.contains(x) ? x : null))()
  const cur = () => el.querySelector<SVGSVGElement>(cfg.sel)
  const drv = driver(s, (delta, settled) => ((svg = cur()) => {
    svg && cfg.apply(delta, {svg, anchor: st.anchor, k: per(svg)}, settled)
    settled && (st.live = false)
  })(), env)
  const push = (v: Vec) => (s.push(v), (st.live = true), drv.kick())
  /** A new press during a glide ends it where it stands (full redraw), so the press starts from a still view. */
  const finish = () => { if (st.live) { s.halt(); const svg = cur(); svg && cfg.apply({}, {svg, anchor: st.anchor, k: per(svg)}, true); st.live = false } }
  const two = () => [...pts.values()].slice(0, 2).flat() as [number, number, number, number]
  const down = (ev: PointerEvent) => {
    const svg = svgOf(ev.target)
    if (!svg) return
    finish(); vel.reset()
    pts.set(ev.pointerId, [ev.clientX, ev.clientY])
    if (pts.size >= 2) return void ((st.pin = two()), (st.d = {mode: 'done', x: 0, y: 0, lx: 0, ly: 0, id: -1, moved: true}))
    const mode = cfg.mode(ev, svg)
    st.d = mode ? {mode, x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, id: ev.pointerId, moved: false} : undefined
  }
  const pinch = (svg: SVGSVGElement) => {
    const [a, b] = [st.pin!, two()], p = pinchOf(a, b)
    st.pin = b; st.anchor = anchorOf(svg, p.mid[0], p.mid[1])
    push({lz: p.lz, px: p.dx, py: p.dy})
  }
  const slide = (d: Drag, evs: PointerEvent[]) => {
    const last = evs[evs.length - 1]!
    evs.forEach((e, i) => vel.add(e.timeStamp, e.clientX - (evs[i - 1]?.clientX ?? d.lx), e.clientY - (evs[i - 1]?.clientY ?? d.ly)))
    const [dx, dy] = [last.clientX - d.lx, last.clientY - d.ly]
    if (d.moved && Math.hypot(dx, dy) < JITTER) return // sub-pixel jitter: keep accumulating from the last accepted point
    ;[d.lx, d.ly] = [last.clientX, last.clientY]
    push(cfg.push[d.mode]!(dx, dy))
  }
  const move = (ev: PointerEvent) => {
    pts.has(ev.pointerId) && pts.set(ev.pointerId, [ev.clientX, ev.clientY])
    const svg = cur(), d = st.d
    if (st.pin && pts.size >= 2) return void (svg && pinch(svg))
    if (!d || d.id !== ev.pointerId || d.mode === 'done') return
    if (!d.moved) {
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < THRESH) return
      d.moved = true; vel.reset()
      cfg.begin?.(d.mode, ev.clientX - d.x, ev.clientY - d.y, ev)
      try { svgOf(ev.target)?.setPointerCapture?.(ev.pointerId) } catch { /* synthetic or released pointer */ } // capture only once it is a drag: a click keeps its own target
    }
    slide(d, ev.getCoalescedEvents?.().length ? ev.getCoalescedEvents() : [ev])
  }
  const up = (ev: PointerEvent) => {
    pts.delete(ev.pointerId)
    pts.size < 2 && (st.pin = undefined)
    const d = st.d
    if (!d || (d.id !== ev.pointerId && d.mode !== 'done')) return
    if (d.mode === 'done') return void (pts.size === 0 && (st.d = {...d, mode: 'done'}))
    d.moved && cfg.fling.includes(d.mode) && ((f = vel.fling(ev.timeStamp)) => (f[0] || f[1]) && push(cfg.push[d.mode]!(f[0], f[1])))()
    st.d = d.moved ? {...d, mode: 'done'} : undefined
  }
  const swallow = (ev: Event) => st.d?.mode === 'done' && (ev.stopPropagation(), ev.preventDefault(), (st.d = undefined))
  const wheel = (ev: WheelEvent) => {
    const svg = svgOf(ev.target)
    if (!svg || !cfg.wheel(ev)) return
    ev.preventDefault()
    st.anchor = anchorOf(svg, ev.clientX, ev.clientY)
    push({lz: wheelZoom(wheelPx(ev.deltaY, ev.deltaMode), ev.ctrlKey)})
  }
  const on: [string, (ev: PointerEvent) => unknown][] = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]]
  on.forEach(([t, f]) => doc.addEventListener(t, f as unknown as EventListener))
  el.addEventListener('click', swallow, true)
  el.addEventListener('wheel', wheel as EventListener, {passive: false})
  return {sampler: s, busy: () => s.busy()}
}
