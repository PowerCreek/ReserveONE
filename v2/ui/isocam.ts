// Isometric camera (U2): a fit that no turn, hide or layer move changes; pan and zoom over it; which world axis a screen drag follows; and the pointer handler
// (drag empty space = orbit, drag a level's empty floor = move that level along x, y or z, middle/right or modifier drag = pan, wheel = zoom about the cursor; a press under 4 px stays a click).
import {CAM, seen, zoomAt} from './geo.ts'
import type {Box, Cam} from './geo.ts'
import {iso, spin} from './furniture.ts'
import type {P3, Turn, V2} from './furniture.ts'
/** What the camera keeps: turn (degrees), pan + zoom, and each level's move (frame px, x y z). */
export interface View {rot: number; cam: Cam; shift: Record<string, P3>}
const R2 = Math.SQRT2, C = Math.cos(Math.PI / 6)
/** The fitted box over a disc of radius r about frame point c (so a turn never changes it), from z0 to z1, plus margin m. */
export const fitOf = (c: V2, r: number, z0: number, z1: number, m: number): Box =>
  ((o = iso(c, 0)) => ({x: o[0] - r * R2 * C - m, y: o[1] - (r * R2) / 2 - z1 - m, w: 2 * (r * R2 * C + m), h: r * R2 + z1 - z0 + 2 * m}))()
export const viewBox = (fit: Box, cam: Cam) => ((v = seen(fit, cam)) => [v.x, v.y, v.w, v.h].map(n => +n.toFixed(1)).join(' '))()
/** Screen offset (svg px) of a level moved by `s` (and raised by `z`) under the turn: the projection is linear, so a level moves as one translate. */
export const offset = (t: Turn, [x, y, z]: P3, lift = 0): V2 => ((a = spin({...t, c: [0, 0]})([x, y])) => iso(a, z + lift))()
/** Screen direction (svg px per frame px) of world x, y and z under the turn. */
export const axes = (t: Turn): V2[] => [offset(t, [1, 0, 0]), offset(t, [0, 1, 0]), offset(t, [0, 0, 1])]
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1]
/** The axis a screen drag `d` matches best (by direction). */
export const axisOf = (t: Turn, d: V2) => ((es = axes(t), k = es.map(e => Math.abs(dot(d, e)) / Math.hypot(...e))) => k.indexOf(Math.max(...k)))()
/** How far along world axis `i` a screen drag `d` moves (frame px). */
export const along = (t: Turn, i: number, d: V2) => ((e = axes(t)[i]!) => dot(d, e) / dot(e, e))()
/** Zoom by `f` keeping the svg point `p` under the cursor. */
export const zoomTo = (fit: Box, cam: Cam, f: number, p: V2): Cam => ((v = seen(fit, cam)) => zoomAt(fit, cam, cam.z * f, (p[0] - v.x) / v.w, (p[1] - v.y) / v.h))()
const snap = (n: number, g: number) => Math.round(n / g) * g
export const snapped = (s: P3, g: number): P3 => [snap(s[0], g), snap(s[1], g), snap(s[2], g)]
// ---- pointer
export interface Hooks {view(): View; turn(): Turn; fit(): Box | undefined; put(v: Partial<View>, done: boolean): void; close(): void; grid: number}
type Drag = {mode: string; x: number; y: number; k: number; lv: string; axis: number; v: View; moved: boolean}
const SVG = 'svg[data-iso]'
const svgAt = (el: Element, ev: Event) => ((s = (ev.target as Element).closest?.(SVG) as SVGSVGElement | null) => (s && el.contains(s) ? s : null))()
/** svg px per client px. */
const per = (svg: SVGSVGElement) => ((r = svg.getBoundingClientRect(), m = svg.getScreenCTM?.()) => (m?.a ? 1 / m.a : r.width ? svg.viewBox.baseVal.width / r.width : 1))()
const PAN = (ev: PointerEvent) => ev.button === 1 || ev.button === 2 || ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey
const modeOf = (ev: PointerEvent) => ((t = ev.target as Element) => (PAN(ev) ? 'pan' : t.closest('[data-level]') && !t.closest('[data-tid],[data-unit]') ? 'move' : 'orbit'))()
const ORBIT = 0.4 // degrees per client px
const MODES: Record<string, (h: Hooks, d: Drag, dx: number, dy: number) => Partial<View>> = {
  orbit: (_h, d, dx) => ({rot: (((d.v.rot + dx * ORBIT) % 360) + 360) % 360}),
  pan: (_h, d, dx, dy) => ({cam: {...d.v.cam, x: d.v.cam.x - dx * d.k, y: d.v.cam.y - dy * d.k}}),
  move: (h, d, dx, dy) => ((s = d.v.shift[d.lv] ?? [0, 0, 0], n = along(h.turn(), d.axis, [dx * d.k, dy * d.k]), m = [...s] as P3) =>
    ((m[d.axis] = s[d.axis]! + n), {shift: {...d.v.shift, [d.lv]: m}}))(),
}
const settle = (h: Hooks, d: Drag, p: Partial<View>): Partial<View> => (d.mode === 'move' && p.shift ? {shift: {...p.shift, [d.lv]: snapped(p.shift[d.lv]!, h.grid)}} : p)
export const isoDrag = (el: Element, h: Hooks) => {
  const st: {d?: Drag; last?: Partial<View>} = {}
  const down = (ev: PointerEvent) => ((svg = svgAt(el, ev)) => svg && (st.d = {mode: modeOf(ev), x: ev.clientX, y: ev.clientY, k: per(svg), lv: (ev.target as Element).closest('[data-level]')?.getAttribute('data-level') ?? '', axis: -1, v: h.view(), moved: false}))()
  const far = (d: Drag, ev: PointerEvent) => d.moved || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) >= 4
  const start = (d: Drag, dx: number, dy: number) => d.moved || (h.close(), Object.assign(d, {moved: true, axis: axisOf(h.turn(), [dx, dy])}))
  const move = (ev: PointerEvent) => ((d = st.d, dx = ev.clientX - (d?.x ?? 0), dy = ev.clientY - (d?.y ?? 0)) =>
    d && far(d, ev) && (start(d, dx, dy), (st.last = MODES[d.mode]!(h, d, dx, dy)), h.put(st.last, false)))()
  const up = () => ((d = st.d) => (d?.moved && st.last && h.put(settle(h, d, st.last), true), (st.d = d?.moved ? {...d, mode: 'done'} : undefined), (st.last = undefined)))()
  const swallow = (ev: Event) => st.d?.mode === 'done' && (ev.stopPropagation(), ev.preventDefault(), (st.d = undefined))
  const wheel = (ev: WheelEvent) => ((svg = svgAt(el, ev), fit = h.fit()) => svg && fit && (ev.preventDefault(), h.put({cam: zoomTo(fit, h.view().cam, ev.deltaY < 0 ? 1.1 : 1 / 1.1, pointOf(svg, ev))}, false), h.put({}, true)))()
  const on: [string, (ev: PointerEvent) => unknown][] = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]]
  on.forEach(([t, f]) => el.ownerDocument.addEventListener(t, f as unknown as EventListener))
  el.addEventListener('click', swallow, true)
  el.addEventListener('contextmenu', ev => svgAt(el, ev) && ev.preventDefault())
  ;['mousedown', 'pointerdown', 'auxclick'].forEach(k => el.addEventListener(k, ev => (ev as MouseEvent).button === 1 && svgAt(el, ev) && ev.preventDefault())) // no autoscroll, no page scroll from the middle button
  el.addEventListener('wheel', wheel as EventListener, {passive: false})
}
/** The svg point under the cursor (the visible box's centre when the browser cannot say). */
const pointOf = (svg: SVGSVGElement, ev: MouseEvent): V2 => {
  const [m, b] = [svg.getScreenCTM?.()?.inverse(), svg.viewBox.baseVal]
  return m ? [m.a * ev.clientX + m.c * ev.clientY + m.e, m.b * ev.clientX + m.d * ev.clientY + m.f] : [b.x + b.width / 2, b.y + b.height / 2]
}
export const NO_VIEW: View = {rot: 0, cam: CAM, shift: {}}
