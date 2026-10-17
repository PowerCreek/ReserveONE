// Iso layers: the panel paints only the svg shell; this keeps its insides. Per level one group holds seven layers (iso.ts LAYERS).
// furn is retained: its fragments stay in the DOM and a turn only rewrites their geometry (shapes: points / line ends) and, when the painter's order moves, re-appends them.
// base / hits / over / names are small and rebuilt per turn; hits / furn / over are patched per table when that table's state key moves; units / pings are patched in place when something moved.
// A pure camera change (pan, zoom, level move, opacity) touches attributes only.

import {LAYERS, block, drawn, fhtml, wallsAt, layoutKey, levelParts, lift, pingsOf, ping, shownLevels, stateKey, slabsOf, statics, footprint, tablesAt, tabsAt, tr, turnOf, unit, unitsOf, wrapLayers} from './iso.ts'
import type {Ctx, Frag, Iso} from './iso.ts'
import {GEO, html, order} from './furniture.ts'
import type {Shape, Turn} from './furniture.ts'
import {group, reconcile, swap} from './layers.ts'
import type {Fx} from './state.ts'
type Ent = {by?: Map<string, Frag[]>; fs: ReturnType<typeof slabsOf>; hit?: Map<string, Element>; g: Element; lkey: string; tkeys: Map<string, string>; at: Record<string, Element>; fr: Frag[]; els: Element[]; rot: number; ordRot: number}
const rigs = new WeakMap<Element, Map<number, Ent>>()
const BULK = 10 // more changed tables than this and the three table layers are simply redrawn
const STEP = 4 // degrees: a drag frame within this of the last painter's order keeps that order (the release sorts exactly)
const attach = (g: Element) => Object.fromEntries(LAYERS.map((k, i) => [k, g.children[i]!])) as Record<string, Element>
// ---- retained fragments: the fragment's element, its piece container and the shapes drawn in it
type Rec = {box: Element; sh: Shape[]; els: Element[]}
const recs = new WeakMap<Element, Rec>()
const remember = (el: Element, sh: Shape[]) => ((box = el.querySelector('[data-p]') ?? el) => recs.set(el, {box, sh, els: [...box.children]}))()
const same = (a: Shape[], b: Shape[]) => a.length === b.length && a.every((s, i) => s.tag === b[i]!.tag && s.a === b[i]!.a)
const write = (el: Element, old: Shape, now: Shape) => GEO[now.tag].forEach((k, j) => old.g[j] !== now.g[j] && el.setAttribute(k, now.g[j]!))
/** Move a fragment to the shapes of a new turn: same elements get new geometry, a changed set of shapes (a side turned into or out of view) repaints that fragment's pieces. */
const retarget = (el: Element, sh: Shape[]) => {
  const r = recs.get(el)
  r && same(r.sh, sh) ? r.els.forEach((x, i) => write(x, r.sh[i]!, sh[i]!)) : r && ((r.box.innerHTML = sh.map(html).join('')), (r.els = [...r.box.children]))
  r && (r.sh = sh)
}
// ---- retained layers: a layer's markup is split into its geometry numbers and the rest; when the rest is as before, only the numbers are written to the live elements (no node is added or removed, so the binder observer stays quiet)
const GEOATTR = /\s(points|x|y|cx|cy|x1|y1|x2|y2)="([^"]*)"/g
const GEOSET = new Set(['points', 'x', 'y', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2'])
type Skin = {skel: string; vals: string[]; ats: [Element, string][]}
const skins = new WeakMap<Element, Skin>()
const split = (h: string) => ((vals: string[] = []) => ({vals, skel: h.replace(GEOATTR, (_, k: string, v: string) => (vals.push(v), ` ${k}=""`))}))()
const targets = (layer: Element): [Element, string][] => [...layer.querySelectorAll('*')].flatMap(el => [...el.attributes].filter(a => GEOSET.has(a.name)).map((a): [Element, string] => [el, a.name]))
/** Make `layer` show `h`: numbers only when its skeleton is the one drawn before, else its markup is replaced (and remembered). */
export const skin = (layer: Element, h: string) => {
  const {skel, vals} = split(h), old = skins.get(layer)
  if (old && old.skel === skel) return void (old.ats.forEach(([el, k], i) => old.vals[i] !== vals[i] && el.setAttribute(k, vals[i]!)), (old.vals = vals))
  layer.innerHTML = h
  const ats = targets(layer)
  ats.length === vals.length ? skins.set(layer, {skel, vals, ats}) : skins.delete(layer)
}
const forget = (...ls: Element[]) => ls.forEach(l => skins.delete(l))
const keep = (e: Ent, els: Element[], sh: Shape[][]) => (els.forEach((x, i) => remember(x, sh[i]!)), (e.els = els))
const fresh = (svg: Element, c: Ctx, o: Iso, lv: number, lkey: string): Ent => {
  const g = group(svg.ownerDocument, {'data-level': String(lv)}), p = levelParts(c, o, [], lv)
  g.innerHTML = wrapLayers({...p, units: '', pings: ''})
  const at = attach(g), e: Ent = {fs: slabsOf(c, lv), g, lkey, tkeys: new Map(), at, fr: p.fr, els: [], rot: o.rot, ordRot: o.rot}
  return (keep(e, [...at.furn!.children], p.sh), e)
}
const tables = (c: Ctx, o: Iso, lv: number) => ((key = stateKey(c, o)) => tablesAt(c.w, lv).map(t => [t, key(t)] as const))()
/** A table's fragment replaced in place (same position in the painter's order). */
const put = (e: Ent, tu: Turn) => (f: Frag) => ((i = e.fr.findIndex(x => x.key === f.key), sh = drawn(tu)(f)) =>
  i < 0 || (e.by = undefined, swap(e.els[i]!, fhtml(f, sh)), (e.fr[i] = f), (e.els[i] = e.at.furn!.children[i]!), remember(e.els[i]!, sh)))()
/** Redraw the changed tables' pieces in place (hit footprint, furniture fragments, ring and name), or the three table layers at once when many changed. */
const patch = (e: Ent, c: Ctx, o: Iso, lv: number) => {
  const now = tables(c, o, lv), changed = now.filter(([t, k]) => e.tkeys.get(t.id) !== k)
  const tu = turnOf(c.w, o)
  const first = e.tkeys.size === 0
  if (changed.length > BULK && !first) {
    const p = levelParts(c, o, [], lv)
    ;(['hits', 'furn', 'over'] as const).forEach(k => (e.at[k]!.innerHTML = p[k]))
    forget(e.at.hits!, e.at.over!)
    e.hit = undefined
    e.fr = p.fr
    e.by = undefined
    keep(e, [...e.at.furn!.children], p.sh)
  } else if (!first) changed.forEach(([t]) => {
    const b = block(c, o, tu)(t)
    swap(e.at.hits!.querySelector(`[data-tid="${t.id}"]`), b.hit)
    b.frags.forEach(put(e, tu))
    swap(e.at.over!.querySelector(`[data-tid="${t.id}"]`), b.over)
  })
  changed.length && (forget(e.at.hits!, e.at.over!), (e.hit = undefined))
  e.tkeys = new Map(now.map(([t, k]) => [t.id, k]))
  return changed.length
}
const gap = (a: number, b: number) => Math.abs((((a - b + 540) % 360) + 360) % 360 - 180)
const idOf = (f: Frag) => f.key.slice(0, f.key.lastIndexOf('/'))
const nOf = (f: Frag) => Number(f.key.slice(f.key.lastIndexOf('/') + 1))
const grouped = (fr: Frag[]) => fr.reduce((m, f) => m.set(idOf(f), [...(m.get(idOf(f)) ?? []), f].sort((a, b) => nOf(a) - nOf(b))), new Map<string, Frag[]>())
/** The painter's input list for this turn, from the fragments already drawn: tables far to near (their pieces in index order), then standing zones. */
const inputs = (e: Ent, c: Ctx, lv: number, tabs: ReturnType<typeof tabsAt>): Frag[] => ((by = (e.by ??= grouped(e.fr))) => [...tabs.flatMap(t => by.get(t.id) ?? []), ...wallsAt(c, lv)])()
/** The positions of `a` that can stay put (a longest increasing run, by patience sorting). */
const stay = (a: number[]) => {
  const tails: number[] = [], prev: number[] = []
  a.forEach((v, i) => ((k = tails.findIndex(t => a[t]! >= v), at = k < 0 ? tails.length : k) => ((prev[i] = at ? tails[at - 1]! : -1), (tails[at] = i)))())
  const chain = (i: number): number[] => (i < 0 ? [] : [i, ...chain(prev[i]!)])
  return new Set(chain(tails.at(-1) ?? -1))
}
/** Put `els` in order inside `layer` by moving only those out of line (every moved node costs the binder observer a scan). */
const place = (layer: Element, els: Element[], was: number[]) => ((keep = stay(was)) => els.reduceRight<Node | null>((ref, el, i) => (keep.has(i) || layer.insertBefore(el, ref), el), null))()
/** The painter's order for the new turn: fragments out of line are re-inserted, the rest stay. */
const reorder = (e: Ent, c: Ctx, o: Iso, lv: number, tu: Turn, tabs: ReturnType<typeof tabsAt>) => {
  const fr = inputs(e, c, lv, tabs), ix = order(tu, fr)
  const at = new Map(e.fr.map((f, i) => [f.key, i] as const)), next = ix.map(i => at.get(fr[i]!.key)!)
  const [els, frs] = [next.map(j => e.els[j]!), next.map(j => e.fr[j]!)]
  place(e.at.furn!, els, next)
  Object.assign(e, {els, fr: frs, ordRot: o.rot})
}
/** The hit layer follows a turn by its footprints' points (found by table id, remembered until a table's hit is swapped). */
const spots = (e: Ent, tu: Turn, tabs: ReturnType<typeof tabsAt>) => {
  e.hit ??= new Map([...e.at.hits!.children].map(g => [g.getAttribute('data-tid')!, g.querySelector('polygon')!]))
  tabs.forEach(t => e.hit!.get(t.id)?.setAttribute('points', footprint(tu, t)))
}
/** A new turn: the static layers and the units follow it, furniture is re-sorted (within STEP of the last order a drag frame skips that) and re-projected in place. */
const turn = (e: Ent, c: Ctx, o: Iso, lv: number, live: boolean) => {
  const tu = turnOf(c.w, o), tabs = tabsAt(c, tu, lv), s = statics(c, o, tu, lv, tabs, e.fs)
  ;(['base', 'over', 'names'] as const).forEach(k => skin(e.at[k]!, s[k]))
  spots(e, tu, tabs)
  live && gap(o.rot, e.ordRot) < STEP || reorder(e, c, o, lv, tu, tabs)
  e.els.forEach((x, i) => retarget(x, drawn(tu)(e.fr[i]!)))
  e.rot = o.rot
}
/** Units move in place (their numbers only, while the same units are drawn); pings are patched per node. */
const move = (e: Ent, c: Ctx, o: Iso, fx: Fx[], lv: number) => ((tu = turnOf(c.w, o)) => {
  skin(e.at.units!, unitsOf(c, o, lv).map(unit(tu)).join(''))
  reconcile(e.at.pings!, pingsOf(c, o, fx, lv).map((f, i) => [`${i}:${f.kind}:${f.x}:${f.y}`, ping(tu)(f)]))
})()
/** Bring `svg` up to date with the world, the iso settings and the effects; `live` (a drag-turn frame) lets the painter's order lag by up to STEP degrees, the release sorts exactly. */
export const syncIso = (svg: Element, c: Ctx, o: Iso, fx: Fx[], live = false) => {
  const rig = rigs.get(svg) ?? rigs.set(svg, new Map()).get(svg)!
  const lkey = live && rig.size ? '' : layoutKey(c.w)
  const gs = shownLevels(c.w, o).map(lv => {
    let e = rig.get(lv)
    e && (live || e.lkey === lkey) ? live || patch(e, c, o, lv) : (e = fresh(svg, c, o, lv, lkey), rig.set(lv, e), patch(e, c, o, lv))
    e.rot === o.rot && e.ordRot === o.rot || turn(e, c, o, lv, live)
    e.g.setAttribute('opacity', String((o.op[lv] ?? 100) / 100))
    e.g.setAttribute('transform', tr(lift(c.w, o, lv)))
    move(e, c, o, fx, lv)
    return e.g
  })
  const now = [...svg.children]
  gs.length === now.length && gs.every((g, i) => g === now[i]) || svg.replaceChildren(...gs)
}
/** A camera-only change: only the level groups' transforms and opacities move. */
export const liftIso = (svg: Element, c: Ctx, o: Iso) => svg.querySelectorAll(':scope > [data-level]').forEach(g => g.setAttribute('transform', tr(lift(c.w, o, Number(g.getAttribute('data-level'))))))
export const resetIso = (svg: Element) => rigs.delete(svg)
