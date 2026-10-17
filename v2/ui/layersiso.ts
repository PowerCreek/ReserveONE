// Iso layers: the panel paints only the svg shell; this keeps its insides. Per level one group holds seven layers (iso.ts LAYERS).
// base / names are static (rebuilt when the layout or the turn changes), hits / furn / over are redrawn per table when that table's state key moves,
// units / pings are patched in place when something moved. A pure camera change (pan, zoom, level move, opacity) touches attributes only.

import {LAYERS, block, layoutKey, levelParts, lift, pingsOf, ping, shownLevels, stateKey, tablesAt, tr, turnOf, unit, unitsOf, wrapLayers} from './iso.ts'
import type {Ctx, Iso} from './iso.ts'
import {group, reconcile, swap} from './layers.ts'
import type {Fx} from './state.ts'
type Ent = {g: Element; lkey: string; tkeys: Map<string, string>; at: Record<string, Element>}
const rigs = new WeakMap<Element, Map<number, Ent>>()
const BULK = 10 // more changed tables than this and the three table layers are simply redrawn
const attach = (g: Element) => Object.fromEntries(LAYERS.map((k, i) => [k, g.children[i]!])) as Record<string, Element>
const fresh = (svg: Element, c: Ctx, o: Iso, fx: Fx[], live: boolean, lv: number, lkey: string): Ent => {
  const g = group(svg.ownerDocument, {'data-level': String(lv)})
  g.innerHTML = wrapLayers({...levelParts(c, o, [], live, lv), units: '', pings: ''})
  return {g, lkey, tkeys: new Map(), at: attach(g)}
}
const tables = (c: Ctx, o: Iso, lv: number) => ((key = stateKey(c, o)) => tablesAt(c.w, lv).map(t => [t, key(t)] as const))()
/** Redraw the changed tables' pieces in place (hit footprint, furniture fragments, ring and name), or the three table layers at once when many changed. */
const patch = (e: Ent, c: Ctx, o: Iso, fx: Fx[], lv: number) => {
  const now = tables(c, o, lv), changed = now.filter(([t, k]) => e.tkeys.get(t.id) !== k)
  const tu = turnOf(c.w, o)
  const first = e.tkeys.size === 0
  if (changed.length > BULK && !first) {
    const p = levelParts(c, o, fx, false, lv)
    ;(['hits', 'furn', 'over'] as const).forEach(k => (e.at[k]!.innerHTML = p[k]))
  } else if (!first) changed.forEach(([t]) => {
    const b = block(c, o, tu)(t)
    swap(e.at.hits!.querySelector(`[data-tid="${t.id}"]`), b.hit)
    b.frags.forEach((f, i) => swap(e.at.furn!.querySelector(`[data-tid="${t.id}"][data-fi="${i}"]`), f.html))
    swap(e.at.over!.querySelector(`[data-tid="${t.id}"]`), b.over)
  })
  e.tkeys = new Map(now.map(([t, k]) => [t.id, k]))
  return changed.length
}
/** Units and pings of a level move in place (only the nodes whose markup changed). */
const move = (e: Ent, c: Ctx, o: Iso, fx: Fx[], lv: number) => ((tu = turnOf(c.w, o)) => {
  reconcile(e.at.units!, unitsOf(c, o, lv).map(b => [b.id, unit(tu)(b)]))
  reconcile(e.at.pings!, pingsOf(c, o, fx, lv).map((f, i) => [`${i}:${f.kind}:${f.x}:${f.y}`, ping(tu)(f)]))
})()
/** Bring `svg` up to date with the world, the iso settings and the effects; `live` draws a cheaper frame for a drag-turn (no grids, depth sort) that the release replaces. */
export const syncIso = (svg: Element, c: Ctx, o: Iso, fx: Fx[], live = false) => {
  const rig = rigs.get(svg) ?? rigs.set(svg, new Map()).get(svg)!
  const lkey = `${layoutKey(c.w)}|${o.rot}|${live ? 'L' : ''}`
  const gs = shownLevels(c.w, o).map(lv => {
    let e = rig.get(lv)
    e && e.lkey === lkey ? patch(e, c, o, fx, lv) : (e = fresh(svg, c, o, fx, live, lv, lkey), rig.set(lv, e), live || patch(e, c, o, fx, lv))
    e.g.setAttribute('opacity', String((o.op[lv] ?? 100) / 100))
    e.g.setAttribute('transform', tr(lift(c.w, o, lv)))
    live || move(e, c, o, fx, lv)
    return e.g
  })
  const now = [...svg.children]
  gs.length === now.length && gs.every((g, i) => g === now[i]) || svg.replaceChildren(...gs)
}
/** A camera-only change: only the level groups' transforms and opacities move. */
export const liftIso = (svg: Element, c: Ctx, o: Iso) => svg.querySelectorAll(':scope > [data-level]').forEach(g => g.setAttribute('transform', tr(lift(c.w, o, Number(g.getAttribute('data-level'))))))
export const resetIso = (svg: Element) => rigs.delete(svg)
