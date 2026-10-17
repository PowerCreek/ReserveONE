// Floor view (U2, U3): one world, two views. 2D = top-down SVG of one floor or one whole stitched level (tabs pick it, the viewBox fits it, a camera pans and zooms it),
// with the grid, zones, sections, tables and their feature chips, insight outlines, link groups, door, units, task lines and pings. Iso = every level stacked in 3D (iso.ts).
import {having} from '../contracts/index.ts'
import type {App, Hold, Id, Policy, World} from '../contracts/index.ts'
import {policyOf} from './ask.ts'
import {boardOf} from './board.ts'
import {alertsOf, badge, chips, door, grid, gridLines, link, outline, picked, ping, section, table, unit, zonesOf} from './draw.ts'
import type {Alerts} from './draw.ts'
import {CAM, DOOR, H, LV, W, boxStr, doorFloor, fitBox, floorOf, floorsOf, hull, levelName, levelOf, levels, seen, zoomAt} from './geo.ts'
import type {Box, Cam} from './geo.ts'
import {cardHtml, closeCard, tableCard} from './card.ts'
import {ISO, isoBox, isoControls, isoFit, isoInner, isoSvg, lift, turnOf, tweak} from './iso.ts'
import {isoDrag} from './isocam.ts'
import type {View} from './isocam.ts'
import type {Iso} from './iso.ts'
import {holdsOf, live} from './assign.ts'
import {presets} from './presets.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card, ctaSm, ghost, on} from './tone.ts'
import {uiOf} from './state.ts'
import type {Fx} from './state.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {floorId?: string; floorView?: '2d' | 'iso'; iso?: Iso; cam?: Cam; grid?: boolean}
}
export const floorPane = `<div data-floor="ui.rev" class="${card} relative"></div>`
const pick = (id: string) => `<button data-act="scenario" data-id="${id}" class="${btn}">${esc(presets[id].label)}</button>`
const empty = `<div class="flex flex-col items-center gap-3 p-10 text-slate-500"><p>No floor yet. Load a scenario to start the sim.</p><div class="flex flex-wrap gap-2">${Object.keys(presets).map(pick).join('')}</div></div>`
/** Tabs: per storey, a whole-level tab (when the level stitches several floors) and then each floor. */
export interface Tab {id: Id; name: string; ids: Id[]}
export const tabList = (w: World): Tab[] => levels(w).flatMap(lv => {
  const fs = having(w, 'floor').filter(f => levelOf(w, f.id) === lv)
  return [...(fs.length > 1 ? [{id: `${LV}${lv}`, name: `${levelName(lv)}: all`, ids: fs.map(f => f.id)}] : []), ...fs.map(f => ({id: f.id, name: f.floor.name, ids: [f.id]}))]
})
/** The tab on show: the chosen one if it exists, else the first floor (undefined when the world declares none, which shows everything). */
export const shown = (w: World, chosen?: Id) => (tabList(w).some(t => t.id === chosen) ? chosen : having(w, 'floor')[0]?.id)
/** What the active service mode paints on the floor: who holds each table, and whether section tints are in force. */
export interface Holding {holds: Hold[]; live: boolean}
const MARGIN = 44 // room for section names above and chips below the outer tables
export const ZOOM = 1.5 // the most a small floor is magnified
/** Everything the 2D view draws for `fid` (a floor, a level tab, or undefined = all): tables, link groups, units, pings, and whether the door shows. */
const scope = (w: World, fx: Fx[], fid?: Id) => {
  const fs = floorsOf(w, fid)
  const here = (f?: Id) => fs === undefined || fs.includes(f ?? '')
  const at = doorFloor(w)
  return {ts: having(w, 'table', 'pos').filter(t => here(t.pos.floor)), links: having(w, 'link').filter(k => here(floorOf(w, k.link.members[0]!))), door: fs === undefined || at === undefined || here(at),
    zs: having(w, 'zone', 'pos').filter(z => here(z.pos.floor)), units: having(w, 'body').filter(b => here(floorOf(w, b.id))), fx: fx.filter(f => !f.floor || here(f.floor))}
}
/** The fitted box: the scope's tables, zones, units, pings and door, plus a margin, at the frame's aspect (a small floor zooms at most ZOOM). */
export const fitOf = (s: ReturnType<typeof scope>): Box => {
  const pts = [...s.units.map(b => ({x: b.body.x, y: b.body.y})), ...s.fx, ...(s.door ? [DOOR] : [])].map(p => ({x: p.x, y: p.y, w: 0, h: 0}))
  return fitBox(hull([...s.ts.map(t => t.pos), ...s.zs.map(z => z.pos), ...pts]) ?? {x: 0, y: 0, w: W, h: H}, MARGIN, W / H, W / ZOOM)
}
/** Section names on show (a zone named the same stays unlabelled: the section already says it). */
const named = (w: World, ts: {table: {section: Id | null}}[]) => having(w, 'section').filter(x => ts.some(t => t.table.section === x.id)).map(x => x.section.name.toLowerCase())
/** How the 2D view is looked at: the camera, the grid toggle, insight outlines, the table whose card is open. */
export interface Look {cam?: Cam; grid?: boolean; alerts?: Alerts; pick?: Id}
const SVG = 'block mx-auto aspect-[4/3] w-full max-w-[104vh] cursor-grab touch-none select-none rounded bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:cursor-grabbing dark:bg-slate-900'
const HINT = 'restaurant floor: drag or arrow keys to pan, ctrl + wheel or + and - to zoom, 0 to fit'
export const floorSvg = (w: World, fx: Fx[], fid?: Id, held: Holding = {holds: [], live: true}, look: Look = {}) => {
  const s = scope(w, fx, fid)
  const [fit, secs] = [fitOf(s), having(w, 'section').map(x => section(x, s.ts.filter(t => t.table.section === x.id), held.live))]
  const v = seen(fit, look.cam ?? CAM)
  const doorMark = s.door && !s.zs.some(z => z.zone.kind === 'door')
  return `<svg data-plan data-fit="${boxStr(fit)}" viewBox="${boxStr(v)}" tabindex="0" data-on="keydown:floorKey" class="${SVG}" role="group" aria-label="${HINT}">` + [
    ...(look.grid === false ? [] : [grid(v)]), zonesOf(w, s.zs, s.ts, named(w, s.ts)), ...secs, ...s.links.map(link(w)), ...s.ts.map(table(w, held.holds)), ...s.ts.map(outline(look.alerts ?? {})), picked(s.ts.find(t => t.id === look.pick)),
    ...s.ts.map(badge(w, held.holds)), ...s.ts.map(chips), ...(doorMark ? [door] : []), ...s.units.map(unit(w)), ...s.fx.map(ping),
  ].join('') + '</svg>'
}
const tab = (w: World, p: Policy, fid?: Id) => (t: Tab) => {
  const ts = having(w, 'table', 'pos').filter(x => t.ids.includes(x.pos.floor) && !p.seat.selfSeat.includes(x.table.shape)) // stools are first come, first served: not the host's to count
  const free = ts.filter(x => x.table.status === 'available').length
  return `<button role="radio" aria-checked="${t.id === fid}" data-act="floor" data-id="${esc(t.id)}" class="${t.id === fid ? on : btn}">${esc(t.name)} <span class="text-xs opacity-75">${free}/${ts.length}</span></button>`
}
/** Tabs only when there is a choice to make. */
export const tabsOf = (w: World, p: Policy, fid?: Id) =>
  having(w, 'floor').length > 1 ? `<nav data-floors role="radiogroup" aria-label="floor" class="mb-2 flex flex-wrap gap-1">${tabList(w).map(tab(w, p, fid)).join('')}</nav>` : ''
const isoOf = (app: App) => ({...ISO, ...uiOf(app).iso})
const held = (app: App): Holding => ({holds: holdsOf(app), live: live(app)})
/** Board insights as outlines, from the one shared board read per repaint (ui/board.ts `boardOf`; read only). */
const alertsNow = (app: App) => alertsOf(boardOf(app)?.insights)
const ctx = (app: App, alerts: Alerts) => ({w: app.store.state.world, holds: holdsOf(app), areas: policyOf(app).service.areas, alerts, pick: uiOf(app).card?.table})
const camOf = (app: App) => ({...CAM, ...uiOf(app).cam})
const flat = (app: App, alerts: Alerts) => {
  const [w, fid] = [app.store.state.world, shown(app.store.state.world, uiOf(app).floorId)]
  return tabsOf(w, policyOf(app), fid) + floorSvg(w, uiOf(app).fx, fid, held(app), {cam: camOf(app), grid: uiOf(app).grid ?? true, alerts, pick: uiOf(app).card?.table})
}
const VIEWS: Record<string, (app: App, alerts: Alerts) => string> = {
  '2d': flat,
  iso: (app, alerts) => isoControls(ctx(app, alerts), isoOf(app)) + isoSvg(ctx(app, alerts), isoOf(app), uiOf(app).fx),
}
const viewOf = (app: App) => uiOf(app).floorView ?? '2d'
const toggle = (v: string) => `<div role="radiogroup" aria-label="floor view" class="inline-flex gap-1">${[['2d', '2D'], ['iso', 'Iso']].map(([k, l]) =>
  `<button type="button" role="radio" aria-checked="${v === k}" data-act="floorView" data-id="${k}" class="${v === k ? ctaSm : ghost}">${l}</button>`).join('')}</div>`
/** 2D toolbar: grid toggle, zoom out / level / in, fit. */
const camBtn = (k: string, label: string, aria: string) => `<button type="button" data-act="cam" data-k="${k}" aria-label="${aria}" class="${ghost}">${label}</button>`
const camBar = (app: App) => `<div role="group" aria-label="camera" class="inline-flex items-center gap-1"><button type="button" data-act="grid" aria-pressed="${uiOf(app).grid ?? true}" class="${(uiOf(app).grid ?? true) ? ctaSm : ghost}">Grid</button>` +
  camBtn('out', '−', 'zoom out') + `<span class="w-11 text-center text-xs tabular-nums text-slate-500">${Math.round(camOf(app).z * 100)}%</span>` + camBtn('in', '+', 'zoom in') + camBtn('fit', 'Fit', 'fit the floor') + '</div>'
const BARS: Record<string, (app: App) => string> = {'2d': camBar, iso: () => ''}
const bar = (app: App) => `<div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">${toggle(viewOf(app))}${BARS[viewOf(app)]!(app)}</div>`
const draw = (app: App) => (having(app.store.state.world, 'table', 'pos').length ? bar(app) + VIEWS[viewOf(app)]!(app, alertsNow(app)) + cardHtml(app) : empty)
/** Repaint replaces the panel's buttons: put keyboard focus back on the one just pressed. */
const refocus = (ev: Event) => {
  const b = (ev.target as Element).closest('[data-act]')
  const sel = b && ['data-act', 'data-id', 'data-k', 'data-v'].filter(a => b.hasAttribute(a)).map(a => `[${a}="${b.getAttribute(a)}"]`).join('')
  return sel && b.ownerDocument.activeElement === b && setTimeout(() => b.ownerDocument.querySelector<HTMLElement>(`[data-floor] ${sel}`)?.focus())
}
// ---- camera: buttons and keys step it (repaint); drag and arrow keys move it live (viewBox + grid only, so the svg and its focus stay)
const STEP = 1.25
const CAMS: Record<string, (app: App) => Cam> = {
  in: a => zoomAt(fitNow(a) ?? {x: 0, y: 0, w: W, h: H}, camOf(a), camOf(a).z * STEP),
  out: a => zoomAt(fitNow(a) ?? {x: 0, y: 0, w: W, h: H}, camOf(a), camOf(a).z / STEP),
  fit: () => CAM,
}
const planEl = (): SVGSVGElement | null => globalThis.document?.querySelector('[data-floor] svg[data-plan]') ?? null
const fitNow = (_a: App): Box | undefined => ((f = planEl()?.getAttribute('data-fit')?.split(' ').map(Number)) => f && {x: f[0]!, y: f[1]!, w: f[2]!, h: f[3]!})()
/** Move the live svg to the camera without a repaint. */
const repan = (app: App) => ((svg = planEl(), fit = fitNow(app)) => svg && fit && ((v = seen(fit, camOf(app))) => (svg.setAttribute('viewBox', boxStr(v)), svg.querySelector('[data-grid]')?.replaceChildren(), svg.querySelector('[data-grid]')?.insertAdjacentHTML('beforeend', gridLines(v))))())()
const pan = (app: App, dx: number, dy: number) => ((uiOf(app).cam = {...camOf(app), x: camOf(app).x + dx, y: camOf(app).y + dy}), repan(app))
const ARROWS: Record<string, [number, number]> = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}
const ZKEYS: Record<string, string> = {'+': 'in', '=': 'in', '-': 'out', _: 'out', '0': 'fit'}
const key = (app: App, ev: KeyboardEvent) => {
  const [d, z, n] = [ARROWS[ev.key], ZKEYS[ev.key], policyOf(app).sim.grid * (ev.shiftKey ? 4 : 1)]
  return d ? (ev.preventDefault(), pan(app, d[0] * n, d[1] * n)) : z && (ev.preventDefault(), (uiOf(app).cam = CAMS[z]!(app)), uiOf(app).rev++, setTimeout(() => planEl()?.focus()))
}
const ACTS: Record<string, (app: App, ev: Event) => void> = {
  floor: (a, ev) => Object.assign(uiOf(a), {floorId: arg(ev, 'id'), cam: CAM}),
  floorView: (a, ev) => (uiOf(a).floorView = arg(ev, 'id') === 'iso' ? 'iso' : '2d'),
  iso: (a, ev) => (uiOf(a).iso = tweak(isoOf(a), arg(ev, 'k'), arg(ev, 'v'))),
  grid: a => (uiOf(a).grid = !(uiOf(a).grid ?? true)),
  cam: (a, ev) => (uiOf(a).cam = (CAMS[arg(ev, 'k')] ?? camOf)(a)),
}
/** Drag pans (a press that moves under 4 px stays a click, so tables still open their card); ctrl/meta + wheel zooms about the cursor (a plain wheel scrolls the page). */
const drag = (app: App, el: Element) => {
  const d = {on: false, moved: false, x: 0, y: 0, k: 1}
  const per = (svg: SVGSVGElement) => ((r = svg.getBoundingClientRect(), f = svg.viewBox.baseVal) => (r.width ? f.width / r.width : 1))()
  const down = (ev: PointerEvent) => ((svg = (ev.target as Element).closest?.('[data-floor] svg[data-plan]') as SVGSVGElement | null) => svg && ev.button === 0 && Object.assign(d, {on: true, moved: false, x: ev.clientX, y: ev.clientY, k: per(svg)}))()
  const far = (ev: PointerEvent) => d.moved || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) >= 4
  const move = (ev: PointerEvent) => d.on && far(ev) && (!d.moved && closeCard(app), Object.assign(d, {moved: true}), pan(app, (d.x - ev.clientX) * d.k, (d.y - ev.clientY) * d.k), Object.assign(d, {x: ev.clientX, y: ev.clientY}))
  const up = () => Object.assign(d, {on: false})
  const swallow = (ev: Event) => d.moved && (ev.stopPropagation(), ev.preventDefault(), (d.moved = false))
  const wheel = (ev: WheelEvent) => ((svg = (ev.target as Element).closest?.('[data-floor] svg[data-plan]') as SVGSVGElement | null) => svg && (ev.ctrlKey || ev.metaKey) && zoomWheel(app, svg, ev))()
  const on: [keyof DocumentEventMap, (ev: PointerEvent) => unknown][] = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]]
  on.forEach(([t, f]) => el.ownerDocument.addEventListener(t, f as unknown as EventListener))
  el.addEventListener('click', swallow, true)
  el.addEventListener('wheel', wheel as EventListener, {passive: false})
}
const zoomWheel = (app: App, svg: SVGSVGElement, ev: WheelEvent) => {
  const [r, fit] = [svg.getBoundingClientRect(), fitNow(app)]
  ev.preventDefault()
  return fit && r.width && ((uiOf(app).cam = zoomAt(fit, camOf(app), camOf(app).z * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height)), uiOf(app).rev++)
}
// ---- iso camera: a drag or wheel writes the view to state and redraws the live svg in place (one frame at a time); the release repaints the panel
const isoEl = (): SVGSVGElement | null => globalThis.document?.querySelector('[data-floor] svg[data-iso]') ?? null
const frame = (f: () => void) => (globalThis.requestAnimationFrame ?? ((g: () => void) => setTimeout(g, 16)))(f)
/** What a live change redraws: pan/zoom only the viewBox, a level move its translate, a turn the insides (and the turn readout). */
const tr = (v: [number, number]) => `translate(${v[0].toFixed(1)} ${v[1].toFixed(1)})`
const LIVE: Record<string, (app: App, svg?: SVGSVGElement, live?: boolean) => void> = {
  box: () => undefined,
  lift: (app, svg) => svg?.querySelectorAll('[data-level]').forEach(g => g.setAttribute('transform', tr(lift(app.store.state.world, isoOf(app), Number(g.getAttribute('data-level')))))),
  all: (app, svg, live = true) => svg && ((svg.innerHTML = isoInner(ctx(app, alertsNow(app)), isoOf(app), uiOf(app).fx, live)), svg.ownerDocument.querySelector('[data-floor] [data-rot]')?.replaceChildren(`${Math.round(isoOf(app).rot)}°`)),
}
const redraw = (app: App, p: Partial<View>) => ((svg = isoEl()) => svg && (svg.setAttribute('viewBox', isoBox(ctx(app, {}), isoOf(app))), LIVE[p.rot !== undefined ? 'all' : p.shift ? 'lift' : 'box']!(app, svg)))()
const isoHooks = (app: App) => {
  const st = {due: false, p: {} as Partial<View>}
  const flush = () => ((st.due = false), redraw(app, st.p), (st.p = {}))
  return {
    view: () => isoOf(app), turn: () => turnOf(app.store.state.world, isoOf(app)), fit: () => isoFit(app.store.state.world, isoOf(app)), close: () => closeCard(app), grid: policyOf(app).sim.grid,
    put: (v: Partial<View>, done: boolean) => ((uiOf(app).iso = {...isoOf(app), ...v}), done ? ((st.p = {}), LIVE.all!(app, isoEl() ?? undefined, false), uiOf(app).rev++) : ((st.p = {...st.p, ...v}), st.due || ((st.due = true), frame(flush)))),
  }
}
/** Opacity slider: state plus the live level and readout, no repaint (the slider keeps its drag). */
const isoOp = (app: App, ev: Event) => ((el = ev.target as HTMLInputElement, lv = el.getAttribute('data-lv') ?? '') => {
  uiOf(app).iso = tweak(isoOf(app), 'op', `${lv}:${el.value}`)
  isoEl()?.querySelector(`[data-level="${lv}"]`)?.setAttribute('opacity', String((isoOf(app).op[lv] ?? 100) / 100))
  el.ownerDocument.querySelector(`[data-floor] output[data-op="${lv}"]`)?.replaceChildren(`${isoOf(app).op[lv]}%`)
})()
export const floor = (app: App) => {
  Object.entries(ACTS).forEach(([n, f]) => app.act(n, (a, ev) => (f(a, ev), uiOf(a).rev++, refocus(ev))))
  app.act('floorKey', (a, ev) => key(a, ev as KeyboardEvent))
  app.act('isoOp', isoOp)
  app.use(tableCard)
  app.binder(panel(app, 'data-floor', draw)).view(el => (drag(app, el), isoDrag(el, isoHooks(app))))
}
