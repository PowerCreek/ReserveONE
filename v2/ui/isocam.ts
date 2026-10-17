// Isometric camera (U2): a fit that no turn, hide or layer move changes; pan and zoom over it; which world axis a screen drag follows; and the pointer handler
// (drag empty space = orbit, drag a level's empty floor = move that level along x, y or z, middle/right or modifier drag = pan, wheel = zoom about the cursor; a press under 4 px stays a click).
import {CAM, seen, zoomAt} from './geo.ts'
import {gesture} from './gesture.ts'
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
// ---- pointer (gesture.ts does the events; this maps them onto the iso view)
export interface Hooks {view(): View; turn(): Turn; fit(): Box | undefined; put(v: Partial<View>, done: boolean): void; close(): void; grid: number}
const SVG = 'svg[data-iso]'
const PAN = (ev: PointerEvent) => ev.button === 1 || ev.button === 2 || ev.shiftKey || ev.altKey || ev.ctrlKey || ev.metaKey
const modeOf = (ev: PointerEvent) => ((t = ev.target as Element) => (PAN(ev) ? 'pan' : t.closest('[data-level]') && !t.closest('[data-tid],[data-unit]') ? 'move' : 'orbit'))()
const ORBIT = 0.4 // degrees per client px
const mod = (a: number) => ((a % 360) + 360) % 360
/** Drag empty space = orbit, a level's empty floor = move that level along the axis the drag follows, modifier / middle / right drag or two fingers = pan, wheel / pinch = zoom about the cursor. Frames arrive eased (inputs.ts); `put(v, true)` is the settled view. */
export const isoDrag = (el: Element, h: Hooks) => {
  const mv = {lv: '', axis: 0, on: false}
  const apply = (d: Record<string, number>, g: {anchor: V2; k: number}, settled: boolean) => {
    const v = h.view(), fit = h.fit(), p: Partial<View> = {}
    d.rot && (p.rot = mod(v.rot + d.rot))
    ;(d.lz || d.px || d.py) && fit && (p.cam = ((z = d.lz ? zoomAt(fit, v.cam, v.cam.z * Math.exp(d.lz), g.anchor[0], g.anchor[1]) : v.cam) => ({...z, x: z.x - (d.px ?? 0) * g.k, y: z.y - (d.py ?? 0) * g.k}))())
    ;(d.mx || d.my) && mv.on && (p.shift = ((s = v.shift[mv.lv] ?? [0, 0, 0], m = [...s] as P3) => ((m[mv.axis] = s[mv.axis]! + along(h.turn(), mv.axis, [(d.mx ?? 0) * g.k, (d.my ?? 0) * g.k])), {...v.shift, [mv.lv]: m}))())
    Object.keys(p).length && h.put(p, false)
    settled && (mv.on && h.view().shift[mv.lv] && h.put({shift: {...h.view().shift, [mv.lv]: snapped(h.view().shift[mv.lv]!, h.grid)}}, false), (mv.on = false), h.put({}, true))
  }
  gesture({
    root: el, sel: SVG, fling: ['orbit', 'pan'],
    mode: ev => ((m = modeOf(ev)) => (m === 'move' && ((mv.lv = (ev.target as Element).closest('[data-level]')?.getAttribute('data-level') ?? ''), (mv.on = false)), m))(),
    push: {orbit: dx => ({rot: dx * ORBIT}), pan: (dx, dy) => ({px: dx, py: dy}), move: (dx, dy) => ({mx: dx, my: dy})},
    wheel: () => true,
    begin: (m, dx, dy) => (h.close(), m === 'move' && Object.assign(mv, {axis: axisOf(h.turn(), [dx, dy]), on: true})),
    apply,
  })
  el.addEventListener('contextmenu', ev => (ev.target as Element).closest?.(SVG) && ev.preventDefault())
  ;['mousedown', 'pointerdown', 'auxclick'].forEach(k => el.addEventListener(k, ev => (ev as MouseEvent).button === 1 && (ev.target as Element).closest?.(SVG) && ev.preventDefault())) // no autoscroll, no page scroll from the middle button
}
export const NO_VIEW: View = {rot: 0, cam: CAM, shift: {}}
