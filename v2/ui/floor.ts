// Floor view (U2, U3): one world, two views. 2D = top-down SVG of one floor or one whole stitched level (tabs pick it, the viewBox fits it, a camera pans and zooms it),
// with the grid, zones, sections, tables and their feature chips, insight outlines, link groups, door, units, task lines and pings. Iso = every level stacked in 3D (iso.ts).
import {having} from '../contracts/index.ts'
import type {App, Hold, Id, Policy, World} from '../contracts/index.ts'
import {policyOf} from './ask.ts'
import {boardOf} from './board.ts'
import {alertsOf, badge, braces, door, grid, gridLines, link, outline, picked, ping, section, table, tableSig, unit, zonesOf} from './draw.ts'
import type {Alerts} from './draw.ts'
import {CAM, DOOR, H, LV, W, boxStr, doorFloor, fitBox, floorOf, floorsOf, hull, levelName, levelOf, levels, seen, zoomAt} from './geo.ts'
import type {Box, Cam} from './geo.ts'
import {cardHtml, closeCard, tableCard} from './card.ts'
import type {Ctx} from './iso.ts'
import {ISO, isoBox, isoControls, isoFit, isoShell, layoutKey, turnOf, tweak} from './iso.ts'
import {isoDrag} from './isocam.ts'
import {gesture} from './gesture.ts'
import {fill, reconcile, reconcileSig, group} from './layers.ts'
import {liftIso, resetIso, syncIso} from './layersiso.ts'
import type {View} from './isocam.ts'
import type {Iso} from './iso.ts'
import {holdsOf, live} from './assign.ts'
import {presets} from './presets.ts'
import {arg, esc, own, panel} from './render.ts'
import {btn, card, ctaSm, ghost, on} from './tone.ts'
import {uiOf} from './state.ts'
import {raw} from '../kernel/store.ts'
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
const SVG = 'block h-[72vh] w-full cursor-grab touch-none select-none rounded bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:cursor-grabbing dark:bg-slate-900'
const HINT = 'restaurant floor: drag or arrow keys to pan, ctrl + wheel or + and - to zoom, 0 to fit'
const PLAN = ['grid', 'zones', 'secs', 'links', 'tables', 'over', 'door', 'units', 'pings'] as const
type Plan = ReturnType<typeof scope>
/** The 2D plan's layers, each a thunk: zones (static), sections / links / tables / over (state), door, units + pings (movers). */
const planLayers = (w: World, s: Plan, held: Holding, look: Look, v: Box): Record<typeof PLAN[number], () => string> => ({
  grid: () => (look.grid === false ? '' : grid(v)), zones: () => zonesOf(w, s.zs, s.ts, named(w, s.ts)),
  secs: () => having(w, 'section').map(x => section(x, s.ts.filter(t => t.table.section === x.id), held.live)).join(''), links: () => s.links.map(link(w)).join(''),
  tables: () => s.ts.map(table(w, held.holds)).join(''),
  over: () => s.ts.map(outline(look.alerts ?? {})).join('') + picked(s.ts.find(t => t.id === look.pick)) + s.ts.map(badge(w, held.holds)).join('') + braces(w, held.holds, s.ts),
  door: () => (s.door && !s.zs.some(z => z.zone.kind === 'door') ? door : ''), units: () => s.units.map(unit(w)).join(''), pings: () => s.fx.map(ping).join(''),
})
const planShell = (fit: Box, v: Box, inner = '') => `<svg data-plan data-fit="${boxStr(fit)}" viewBox="${boxStr(v)}" tabindex="0" data-on="keydown:floorKey" class="${SVG}" role="group" aria-label="${HINT}">${inner}</svg>`
const planView = (w: World, fx: Fx[], fid: Id | undefined, look: Look) => ((s = scope(w, fx, fid)) => ({s, fit: fitOf(s), v: seen(fitOf(s), look.cam ?? CAM)}))()
export const floorSvg = (w: World, fx: Fx[], fid?: Id, held: Holding = {holds: [], live: true}, look: Look = {}) => {
  const {s, fit, v} = planView(w, fx, fid, look), ls = planLayers(w, s, held, look, v)
  return planShell(fit, v, PLAN.map(k => k === 'grid' || k === 'door' ? ls[k]() : `<g data-layer="${k}">${ls[k]()}</g>`).join(''))
}
/** Keep the live plan svg in step: zones only when the layout changed, tables one by one when their state key moved, units and pings in place; the grid follows the viewBox. */
const plans = new WeakMap<Element, Record<string, Element>>()
const syncPlan = (svg: Element, w: World, fx: Fx[], fid: Id | undefined, held: Holding, look: Look) => {
  const {s} = planView(w, fx, fid, look), vb = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(' ').map(Number)
  const v = {x: vb[0]!, y: vb[1]!, w: vb[2]!, h: vb[3]!}, ls = planLayers(w, s, held, look, v)
  const at = plans.get(svg) ?? (plans.set(svg, Object.fromEntries(PLAN.filter(k => k !== 'grid' && k !== 'door').map(k => [k, group(svg.ownerDocument, {'data-layer': k})]))), plans.get(svg)!)
  const gridG = svg.querySelector(':scope > [data-grid]')
  look.grid === false ? gridG?.remove() : gridG ? undefined : svg.insertAdjacentHTML('afterbegin', grid(v))
  look.grid === false || fill(svg.querySelector(':scope > [data-grid]')!, boxStr(v), () => gridLines(v))
  fill(at.zones!, `${layoutKey(w)}|${fid}`, ls.zones)
  ;(['secs', 'links', 'over'] as const).forEach(k => ((h = ls[k]()) => fill(at[k]!, h, () => h))())
  reconcileSig(at.tables!, s.ts.map(t => [t.id, tableSig(w, held.holds)(t), () => table(w, held.holds)(t)]))
  reconcile(at.units!, s.units.map(b => [b.id, unit(w)(b)]))
  reconcile(at.pings!, s.fx.map((f, i) => [`${i}:${f.kind}:${f.x}:${f.y}`, ping(f)]))
  const doorH = ls.door(), dEl = svg.querySelector(':scope > [data-door]')
  doorH ? dEl || svg.insertAdjacentHTML('beforeend', door) : dEl?.remove()
  const want = [...(svg.querySelector(':scope > [data-grid]') ? [svg.querySelector(':scope > [data-grid]')!] : []), at.zones!, at.secs!, at.links!, at.tables!, at.over!, ...(svg.querySelector(':scope > [data-door]') ? [svg.querySelector(':scope > [data-door]')!] : []), at.units!, at.pings!]
  want.length === svg.children.length && want.every((n, i) => n === svg.children[i]) || svg.replaceChildren(...want)
}
const tab = (w: World, p: Policy, fid?: Id) => (t: Tab) => {
  const ts = having(w, 'table', 'pos').filter(x => t.ids.includes(x.pos.floor) && !p.seat.selfSeat.includes(x.table.shape)) // stools are first come, first served: not the host's to count
  const free = ts.filter(x => x.table.status === 'available').length
  return `<button role="radio" aria-checked="${t.id === fid}" data-act="floor" data-id="${esc(t.id)}" class="${t.id === fid ? on : btn}">${esc(t.name)} <span class="text-xs opacity-75">${free}/${ts.length}</span></button>`
}
/** Tabs only when there is a choice to make. */
export const tabsOf = (w: World, p: Policy, fid?: Id) =>
  having(w, 'floor').length > 1 ? `<nav data-floors role="radiogroup" aria-label="floor" class="mb-2 flex flex-wrap gap-1">${tabList(w).map(tab(w, p, fid)).join('')}</nav>` : ''
/** Read-only drawing reads the unproxied world (every Proxy hop costs; the layers never write). */
const fxOf = (app: App) => raw(uiOf(app).fx)
const worldOf = (app: App) => raw(app.store.state.world)
/** The camera mid-gesture lives here, not in the store: ui writes repaint every panel bound to `ui`, so the settled view is committed once at the end. */
const glide = new WeakMap<App, {iso?: Partial<Iso>; cam?: Cam}>()
const isoOf = (app: App): Iso => ({...ISO, ...uiOf(app).iso, ...glide.get(app)?.iso})
const held = (app: App): Holding => ({holds: holdsOf(app), live: live(app)})
/** Board insights as outlines, from the one shared board read per repaint (ui/board.ts `boardOf`; read only). */
const alertsNow = (app: App) => alertsOf(boardOf(app)?.insights)
const ctx = (app: App, alerts: Alerts) => ({w: worldOf(app), holds: holdsOf(app), areas: policyOf(app).service.areas, alerts, pick: uiOf(app).card?.table})
const camOf = (app: App) => ({...CAM, ...uiOf(app).cam, ...glide.get(app)?.cam})
const flat = (app: App, alerts: Alerts) => {
  const [w, fid] = [worldOf(app), shown(worldOf(app), uiOf(app).floorId)]
  const {fit, v} = planView(w, fxOf(app), fid, {cam: camOf(app)})
  return tabsOf(w, policyOf(app), fid) + planShell(fit, v)
}
const VIEWS: Record<string, (app: App, alerts: Alerts) => string> = {
  '2d': flat,
  iso: (app, alerts) => isoControls(ctx(app, alerts), isoOf(app)) + isoShell(ctx(app, alerts), isoOf(app)),
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
/** A resize only records the size; one frame later the viewBox and grid follow (resizes of a burst coalesce). */
const watched = new WeakMap<Element, ResizeObserver | null>()
const sized = new WeakSet<App>()
const watch = (app: App, svg: Element) => watched.has(svg) || watched.set(svg, typeof ResizeObserver === 'undefined' ? null : ((o = new ResizeObserver(es => {
  sizes.set(svg, [es.at(-1)!.contentRect.width, es.at(-1)!.contentRect.height])
  sized.has(app) || (sized.add(app), requestAnimationFrame(() => (sized.delete(app), repan(app))))
})) => (o.observe(svg), o))())
const MODE = new WeakMap<Element, string>()
/** After each panel paint: the svg is the layers' own; sync them with the world (skipped layers cost nothing). */
const sync = (app: App, el: Element) => ((svg = el.querySelector('svg[data-plan], svg[data-iso]'), w = worldOf(app)) => {
  if (!svg) return
  own(svg)
  const mode = svg.hasAttribute('data-iso') ? 'iso' : 'plan'
  MODE.get(svg) !== mode && (svg.replaceChildren(), resetIso(svg), plans.delete(svg), MODE.set(svg, mode))
  mode === 'plan' && (watch(app, svg), repan(app))
  mode === 'iso' ? turning.has(app) || syncIso(svg, (last.set(app, ctx(app, alertsNow(app))), last.get(app)!), isoOf(app), fxOf(app)) : syncPlan(svg, w, fxOf(app), shown(w, uiOf(app).floorId), held(app), {cam: camOf(app), grid: uiOf(app).grid ?? true, alerts: alertsNow(app), pick: uiOf(app).card?.table})
})()
const draw = (app: App) => (having(worldOf(app), 'table', 'pos').length ? bar(app) + VIEWS[viewOf(app)]!(app, alertsNow(app)) + cardHtml(app) : empty)
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
// ---- the real visible box: the element's own size decides how much of the plane it shows, so graphics and grid cover every pixel (no letterbox bands)
const sizes = new WeakMap<Element, [number, number]>()
const sizeOf = (svg: Element): [number, number] | undefined => ((r = svg.getBoundingClientRect?.(), z = sizes.get(svg) ?? (r ? [r.width, r.height] as [number, number] : undefined)) => (z && z[0] > 0 && z[1] > 0 ? z : undefined))()
/** The camera's box widened (or heightened) to an element of `size`, about the same centre; without a size, the box itself. */
export const frame = (v: Box, size?: [number, number]): Box =>
  size ? ((a = size[0] / size[1], w = Math.max(v.w, v.h * a), h = Math.max(v.h, v.w / a)) => ({x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 - h / 2, w, h}))() : v
const planEl = (): SVGSVGElement | null => globalThis.document?.querySelector('[data-floor] svg[data-plan]') ?? null
const fitNow = (_a: App): Box | undefined => ((f = planEl()?.getAttribute('data-fit')?.split(' ').map(Number)) => f && {x: f[0]!, y: f[1]!, w: f[2]!, h: f[3]!})()
/** Move the live svg to the camera without a repaint. */
const repan = (app: App) => ((svg = planEl(), fit = fitNow(app)) => svg && fit && ((v = frame(seen(fit, camOf(app)), sizeOf(svg))) => (svg.setAttribute('viewBox', boxStr(v)), svg.querySelector('[data-grid]')?.replaceChildren(), svg.querySelector('[data-grid]')?.insertAdjacentHTML('beforeend', gridLines(v))))())()
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
// ---- gestures (gesture.ts): drag, wheel and pinch only pile deltas up; each animation frame applies them once, eased. Pan and zoom move the viewBox of the cached layers, a turn re-projects once per frame, the release repaints in full.
/** The gesture's anchor is a fraction of the real visible box; the camera math wants it as a fraction of the camera's own box. */
const inSeen = (fit: Box, cam: Cam, g: {svg: SVGSVGElement; anchor: [number, number]}): [number, number] => ((v = seen(fit, cam), e = frame(v, sizeOf(g.svg))) =>
  [(e.x + g.anchor[0] * e.w - v.x) / v.w, (e.y + g.anchor[1] * e.h - v.y) / v.h] as [number, number])()
const planGesture = (app: App, el: Element) => gesture({
  root: el, sel: '[data-floor] svg[data-plan]', fling: ['pan'], tau: 60,
  mode: ev => (ev.button === 0 ? 'pan' : undefined), push: {pan: (dx, dy) => ({px: dx, py: dy})},
  wheel: ev => ev.ctrlKey || ev.metaKey, begin: () => closeCard(app),
  apply: (d, g, settled) => {
    const fit = fitNow(app) ?? {x: 0, y: 0, w: W, h: H}
    const z = d.lz ? zoomAt(fit, camOf(app), camOf(app).z * Math.exp(d.lz), ...inSeen(fit, camOf(app), g)) : camOf(app)
    glide.set(app, {...glide.get(app), cam: {...z, x: z.x - (d.px ?? 0) * g.k, y: z.y - (d.py ?? 0) * g.k}})
    repan(app)
    settled && (Object.assign(uiOf(app), {cam: camOf(app)}), glide.delete(app), uiOf(app).rev++)
  },
})
// ---- iso camera: the sampler's frames call `put`; a turn redraws the live layers once per frame, a level move sets translates, pan and zoom only the viewBox; `done` repaints in full
const isoEl = (): SVGSVGElement | null => globalThis.document?.querySelector('[data-floor] svg[data-iso]') ?? null
/** A drag-turn is under way: the panel's own syncs wait, the release repaints in full. */
const turning = new WeakSet<App>()
const last = new WeakMap<App, Ctx>()
const redraw = (app: App, p: Partial<View>) => ((svg = isoEl()) => {
  if (!svg) return
  const c = last.get(app) ?? ctx(app, alertsNow(app))
  svg.setAttribute('viewBox', isoBox(c, isoOf(app)))
  p.rot !== undefined && (turning.add(app), syncIso(svg, c, isoOf(app), fxOf(app), true), svg.ownerDocument.querySelector('[data-floor] [data-rot]')?.replaceChildren(`${Math.round(isoOf(app).rot)}°`))
  p.shift && liftIso(svg, c, isoOf(app))
})()
const isoHooks = (app: App) => ({
  view: () => isoOf(app), turn: () => turnOf(worldOf(app), isoOf(app)), fit: () => isoFit(worldOf(app), isoOf(app)), close: () => closeCard(app), grid: policyOf(app).sim.grid,
  put: (v: Partial<View>, done: boolean) => (glide.set(app, {...glide.get(app), iso: {...glide.get(app)?.iso, ...v}}), done ? (turning.delete(app), (uiOf(app).iso = isoOf(app)), glide.delete(app), uiOf(app).rev++) : redraw(app, v)),
})
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
  app.binder(panel(app, 'data-floor', draw, el => sync(app, el))).view(el => (planGesture(app, el), isoDrag(el, isoHooks(app))))
}
