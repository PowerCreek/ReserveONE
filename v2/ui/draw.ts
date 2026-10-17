// SVG fragments for the floor (U2). Pure string builders over entities; classes come from tone.ts, data colours from entity data.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {Components, Ent, Entity, Hold, Id, Insight, Side, World} from '../contracts/index.ts'
import {HRING} from './events.ts'
import {DOOR, hull, levelOf, levels, lineNo, locate, rays} from './geo.ts'
import type {Box} from './geo.ts'
import type {Fx} from './state.ts'
import {esc} from './render.ts'
import {RING, ROLE, TABLE} from './tone.ts'
declare module './state.ts' {
  interface Fx {floor?: string} // set by host narration; a ping without one shows on every floor
}
const txt = (x: number, y: number, cls: string, s: unknown) => `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${esc(s)}</text>`
const CHIP: Record<string, string> = {
  seat: 'fill-sky-100 stroke-sky-500 dark:fill-sky-950 dark:stroke-sky-400', zone: 'fill-emerald-100 stroke-emerald-500 dark:fill-emerald-950 dark:stroke-emerald-400',
  air: 'fill-amber-100 stroke-amber-500 dark:fill-amber-950 dark:stroke-amber-400', access: 'fill-violet-100 stroke-violet-500 dark:fill-violet-950 dark:stroke-violet-400',
}
const SHORT: Record<string, string> = {banquette: 'bnq', hightop: 'high', window: 'view', sunny: 'sun', accessible: 'ada'}
const IMPLIED = ['chairs'] // the table's shape already says it
const ON_FLOOR = ['seat'] // chip groups drawn on the layout: how it seats; the rest (zone, air, access) stay in the tooltip and the host's intake
const SMALL = 25 // tables shorter than this (stools) show only their label; the tooltip has the rest
const SHOWN = 3 // chips under a table; the rest fold into "+n" (the tooltip lists all)
const feats = defaultPolicy.host.feats
const cw = (s: string) => s.length * 5.4 + 10
/** Feature chips in a centred row under the table: a 4-letter tag per feature, coloured by its group. */
type FT = Ent<'table' | 'pos'> & {feat?: Components['feat']}
/** The feature tags a table shows as chips under it. */
const onFloor = (t: FT) => (t.feat?.tags ?? []).filter(f => !IMPLIED.includes(f) && ON_FLOOR.includes(feats[f]?.group ?? ''))
export const chips = (t: FT) => {
  const tags = onFloor(t).map(f => ({f, tip: feats[f]?.label ?? f, s: SHORT[f] ?? (feats[f]?.label ?? f).slice(0, 5), cls: CHIP[feats[f]?.group ?? 'air']}))
  const row = [...tags.slice(0, SHOWN), ...(tags.length > SHOWN ? [{f: '+', tip: tags.slice(SHOWN).map(x => x.tip).join(', '), s: `+${tags.length - SHOWN}`, cls: CHIP.access}] : [])]
  const ws = row.map(c => cw(c.s)), total = ws.reduce((a, b) => a + b + 2, -2)
  const xs = ws.map((_, i) => t.pos.x + t.pos.w / 2 - total / 2 + ws.slice(0, i).reduce((a, b) => a + b + 2, 0))
  return row.map((c, i) => `<g data-feat="${esc(c.f)}"><title>${esc(c.tip)}</title><rect x="${xs[i]}" y="${t.pos.y + t.pos.h + 4}" width="${ws[i]}" height="13" rx="5" stroke-width="1" class="${c.cls}"/>` +
    txt(xs[i] + ws[i] / 2, t.pos.y + t.pos.h + 13.5, 'fill-slate-700 text-[9px] font-medium dark:fill-slate-200', c.s) + '</g>').join('')
}
const tip = (t: Ent<'table' | 'pos'> & {feat?: Components['feat']}) => (t.feat?.tags.length ? ` | ${t.feat.tags.map(f => feats[f]?.label ?? f).join(', ')}` : '')
/** Who serves a table now: its standing holder, else the waiter recorded at seating. */
export const serverOf = (w: World, hs: Hold[]) => (t: Ent<'table'>) => w.ents[hs.find(h => h.table === t.id && h.staff)?.staff ?? t.table.waiter ?? '']
/** The hover line every view shows for a table: label, capacity, status, server, features. */
export const titleOf = (w: World, hs: Hold[]) => (t: Ent<'table' | 'pos'> & {feat?: Components['feat']}) =>
  esc(`${t.table.label} cap ${t.table.capacity} ${t.table.status}, server ${serverOf(w, hs)(t)?.staff?.name ?? '-'}${tip(t)}`)
// ---- seating marks: chairs and benches in the one-cell bands just outside a table's body (shared with the isometric view)
type Seats = {chairs: Box[]; benches: Box[]}
const BAND: Record<Side, (p: Box, c: number) => Box> = {
  t: (p, c) => ({x: p.x, y: p.y - c, w: p.w, h: c}), b: (p, c) => ({x: p.x, y: p.y + p.h, w: p.w, h: c}),
  l: (p, c) => ({x: p.x - c, y: p.y, w: c, h: p.h}), r: (p, c) => ({x: p.x + p.w, y: p.y, w: c, h: p.h}),
}
const SIDES = Object.keys(BAND) as Side[]
const FLAT: Side[] = ['t', 'b']
/** A bench side runs the whole side; where a perpendicular side is a bench too, it reaches out to meet it (an L). */
const bench = (p: Box, c: number, on: Side[]) => (s: Side): Box => {
  const [band, lo, hi] = [BAND[s](p, c), on.includes('l') ? c : 0, on.includes('r') ? c : 0]
  return FLAT.includes(s) ? {...band, x: band.x - lo, w: band.w + lo + hi} : band
}
/** `n` chairs centred at L*(i+1)/(n+1) along the side, each ~70% of a cell, in the middle of the band. */
const chairs = (p: Box, c: number) => ([s, n]: [Side, number]) => Array.from({length: n}, (_, i): Box => {
  const [band, k, d] = [BAND[s](p, c), (i + 1) / (n + 1), c * 0.7]
  const [cx, cy] = FLAT.includes(s) ? [p.x + p.w * k, band.y + c / 2] : [band.x + c / 2, p.y + p.h * k]
  return {x: cx - d / 2, y: cy - d / 2, w: d, h: d}
})
export const seatsOf = (t: Ent<'pos'> & {seating?: Components['seating']}, cell = defaultPolicy.sim.grid): Seats => ({
  chairs: Object.entries(t.seating?.chairs ?? {}).flatMap(([s, n]) => chairs(t.pos, cell)([s as Side, n ?? 0])),
  benches: (t.seating?.bench ?? []).filter(s => SIDES.includes(s)).map(bench(t.pos, cell, t.seating?.bench ?? [])),
})
/** The fill family of a table's status, a shade deeper than its body (no stroke: marks stay quiet). */
const TONE: Record<keyof typeof TABLE, string> = {
  available: 'fill-emerald-300/70 dark:fill-emerald-700/70', leased: 'fill-sky-300/70 dark:fill-sky-700/70', occupied: 'fill-rose-300/70 dark:fill-rose-700/70',
  lapsed: 'fill-amber-300/70 dark:fill-amber-700/70', blocked_private: 'fill-slate-300/70 dark:fill-slate-600/70',
}
export const seatTone = (st: keyof typeof TABLE) => TONE[st]
const mark = (r: Box, rx: number, cls: string) => `<rect x="${f2(r.x)}" y="${f2(r.y)}" width="${f2(r.w)}" height="${f2(r.h)}" rx="${rx}" class="${cls}"/>`
export const seats = (t: Ent<'table' | 'pos'> & {seating?: Components['seating']}) => ((s = seatsOf(t), c = seatTone(t.table.status)) =>
  t.seating ? `<g data-seats class="pointer-events-none">${s.benches.map(b => mark(b, 3, c)).join('')}${s.chairs.map(r => mark(r, 3, c)).join('')}</g>` : '')()

export const table = (w: World, hs: Hold[]) => (t: Ent<'table' | 'pos'> & {feat?: Components['feat']}) =>
  `<g data-act="tcard" data-tid="${esc(t.id)}" class="cursor-pointer"><title>${titleOf(w, hs)(t)}</title>${seats(t)}<rect x="${t.pos.x}" y="${t.pos.y}" width="${t.pos.w}" height="${t.pos.h}" rx="${{booth: 4, stool: 20, rect: 12}[t.table.shape]}" stroke-width="2" ${t.table.shape === 'stool' ? 'stroke-dasharray="3 2" ' : ''}class="${TABLE[t.table.status]}"/>` +
    (t.pos.h < SMALL ? txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 + 3.5, 'fill-slate-800 text-[10px] font-semibold dark:fill-slate-100', t.table.label) :
      txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 - 2, 'fill-slate-800 text-[13px] font-semibold dark:fill-slate-100', t.table.label) +
      txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 + 12, 'fill-slate-600 text-[10px] dark:fill-slate-300', `${t.table.capacity}p`)) + '</g>'
/** `live` = the active mode has standing holds; otherwise the chunk tints fade (nobody holds them). */
export const section = (s: Ent<'section'>, ts: Ent<'table' | 'pos'>[], live = true) => {
  const lead = [...ts].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)[0]
  const tint = ts.map(t => `<rect x="${t.pos.x - 10}" y="${t.pos.y - 10}" width="${t.pos.w + 20}" height="${t.pos.h + 20}" rx="14" fill="${esc(s.section.color)}" fill-opacity="${live ? '.14' : '.05'}"/>`)
  return lead ? tint.join('') + txt(lead.pos.x + lead.pos.w / 2, lead.pos.y - 14, 'fill-slate-500 text-[10px] uppercase dark:fill-slate-400', s.section.name) : ''
}
export const link = (w: World) => (k: Ent<'link'>) => {
  const [a, ...rest] = k.link.members.map(m => locate(w, m))
  return rest.map(b => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="3" stroke-dasharray="6 4" class="stroke-violet-500"/>`).join('')
}
const target = (w: World, e: Ent<'body'>) => {
  const t = e.body.task
  const at = t && ('table' in t ? locate(w, t.table) : 'x' in t ? t : undefined)
  return at && `<line x1="${e.body.x}" y1="${e.body.y}" x2="${at.x}" y2="${at.y}" stroke-width="1.5" stroke-dasharray="3 4" class="stroke-slate-400"/>`
}
const tag = (e: Entity) => e.party?.size ?? e.staff?.name?.[0] ?? (e.body?.role ?? '?')[0].toUpperCase()
export const unit = (w: World) => (e: Ent<'body'>) =>
  `<g><title>${esc(e.id)} ${e.body.role} ${esc(e.body.task?.do ?? 'idle')}</title>${target(w, e) ?? ''}<circle cx="${e.body.x}" cy="${e.body.y}" r="${e.body.role === 'guest' ? 8 : 10}" class="${ROLE[e.body.role]}"/>` +
  txt(e.body.x, e.body.y + 4, 'fill-white text-[10px] font-bold', tag(e)) + txt(e.body.x, e.body.y - 14, 'fill-slate-500 text-[9px] dark:fill-slate-400', e.body.task?.do ?? '') + '</g>'
export const ping = (f: Fx) =>
  `<g><circle cx="${f.x}" cy="${f.y}" r="16" fill="none" stroke-width="3" class="${RING[f.kind] ?? HRING[f.kind] ?? RING.left} origin-center animate-ping [transform-box:fill-box]"/>` +
  txt(f.x, f.y - 22, 'fill-slate-700 text-[10px] font-semibold dark:fill-slate-200', f.kind) + '</g>'
export const door = `<g><rect x="${DOOR.x - 14}" y="${DOOR.y - 24}" width="8" height="48" class="fill-slate-500"/>${txt(DOOR.x - 2, DOOR.y + 40, 'fill-slate-500 text-[10px]', 'DOOR')}</g>`
export const STAFF = ['fill-sky-600', 'fill-emerald-600', 'fill-amber-600', 'fill-rose-600', 'fill-violet-600', 'fill-teal-600', 'fill-orange-600', 'fill-pink-600']
/** A coloured initial on the table corner for whoever holds it now (colour = the holder's place in the crew). */
export const badge = (w: World, hs: Hold[]) => (t: Ent<'table' | 'pos'>) => {
  const h = hs.find(x => x.table === t.id && x.staff)
  const s = w.ents[h?.staff ?? '']
  const i = having(w, 'staff').findIndex(x => x.id === s?.id)
  return h && s?.staff ? `<g data-hold="${esc(t.id)}"><title>${esc(`${s.staff.crew?.join(' + ') ?? s.staff.name} (${h.by})`)}</title><circle cx="${t.pos.x + 4}" cy="${t.pos.y + 4}" r="7" class="${STAFF[i % STAFF.length]}"/>${txt(t.pos.x + 4, t.pos.y + 7.5, 'fill-white text-[9px] font-bold', s.staff.name[0])}</g>` : ''
}

// ---- grid: full-length rays across the visible box only, offset by the camera (cheap: O(visible span / cell) lines, no cell loops)
const GRID = ['stroke-slate-300/60 dark:stroke-slate-700/60', 'stroke-slate-400/60 dark:stroke-slate-600/80'] // every 4th line a shade stronger
const f2 = (n: number) => +n.toFixed(2)
const ray = (x1: number, y1: number, x2: number, y2: number, n: number) =>
  `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" vector-effect="non-scaling-stroke" stroke-width="1" class="${GRID[Number(n % 4 === 0)]}"/>`
/** The grid's lines for visible box `v`: verticals at v.x + rays(v.x), horizontals at v.y + rays(v.y), each spanning the box. */
export const gridLines = (v: Box, cell = defaultPolicy.sim.grid) =>
  rays(v.x, v.w, cell).map(r => ray(v.x + r, v.y, v.x + r, v.y + v.h, lineNo(v.x, r, cell))).join('') +
  rays(v.y, v.h, cell).map(r => ray(v.x, v.y + r, v.x + v.w, v.y + r, lineNo(v.y, r, cell))).join('')
export const grid = (v: Box, cell = defaultPolicy.sim.grid) => `<g data-grid aria-hidden="true" class="pointer-events-none">${gridLines(v, cell)}</g>`

// ---- zones: dashed demarcations with their labels, quiet, under the tables; the door points out, the stairs show their flight
type Z = Ent<'zone' | 'pos'>
const ZONE: Record<Components['zone']['kind'], string> = {
  area: 'fill-none stroke-slate-400 dark:stroke-slate-500', walkway: 'fill-slate-200/40 stroke-slate-300 dark:fill-slate-800/40 dark:stroke-slate-600',
  aisle: 'fill-slate-200/30 stroke-slate-300 dark:fill-slate-800/30 dark:stroke-slate-600', lobby: 'fill-sky-100/50 stroke-sky-400 dark:fill-sky-950/40 dark:stroke-sky-600',
  door: 'fill-emerald-100 stroke-emerald-600 dark:fill-emerald-950 dark:stroke-emerald-400', stairs: 'fill-violet-100/60 stroke-violet-400 dark:fill-violet-950/40 dark:stroke-violet-500',
  wall: 'fill-slate-300/50 stroke-slate-400 dark:fill-slate-700/50 dark:stroke-slate-500',
  stand: 'fill-indigo-100/80 stroke-indigo-500 dark:fill-indigo-950/70 dark:stroke-indigo-400', room: 'fill-teal-100/50 stroke-teal-400 dark:fill-teal-950/40 dark:stroke-teal-600',
  prop: 'fill-slate-200/60 stroke-slate-400 dark:fill-slate-700/50 dark:stroke-slate-500', divider: 'stroke-slate-500 dark:stroke-slate-400',
}
const ZINK: Record<Components['zone']['kind'], string> = {
  area: 'fill-slate-500 dark:fill-slate-400', walkway: 'fill-slate-400 dark:fill-slate-500', aisle: 'fill-slate-400 dark:fill-slate-500', lobby: 'fill-sky-700 dark:fill-sky-300',
  door: 'fill-emerald-700 dark:fill-emerald-300', stairs: 'fill-violet-700 dark:fill-violet-300', wall: 'fill-slate-500 dark:fill-slate-400',
  stand: 'fill-indigo-700 dark:fill-indigo-300', room: 'fill-teal-700 dark:fill-teal-300', prop: 'fill-slate-400 dark:fill-slate-500', divider: 'fill-slate-500 dark:fill-slate-400',
}
const HALO = 'stroke-slate-100 stroke-[3px] [paint-order:stroke] dark:stroke-slate-900'
const LABEL = `text-[9px] font-semibold uppercase tracking-wider ${HALO}`
type Pt2 = {x: number; y: number}
const mid2 = (b: Box): Pt2 => ({x: b.x + b.w / 2, y: b.y + b.h / 2})
/** The middle of the tables on the zone's level: stairs point away from it. */
const heart = (w: World, z: Z) => mid2(hull(having(w, 'table', 'pos').filter(t => levelOf(w, t.pos.floor) === levelOf(w, z.pos.floor)).map(t => t.pos)) ?? z.pos)
/** The way out: across the door's wall (its short side), away from the lobby it opens from (else the tables). */
const outward = (w: World, z: Z): Pt2 => {
  const lobby = having(w, 'zone', 'pos').find(o => o.zone.kind === 'lobby' && o.pos.floor === z.pos.floor)?.pos
  const from = lobby ? mid2(lobby) : heart(w, z)
  const [c, across] = [mid2(z.pos), z.pos.w >= z.pos.h ? 'y' : 'x'] as const
  return across === 'y' ? {x: 0, y: Math.sign(c.y - from.y) || 1} : {x: Math.sign(c.x - from.x) || 1, y: 0}
}
/** An arrow from `a` along unit `d` for `n` px, head included. */
const arrow = (a: Pt2, d: Pt2, n: number, cls: string) => {
  const [b, s] = [{x: a.x + d.x * n, y: a.y + d.y * n}, {x: -d.y * 4, y: d.x * 4}]
  const head = [b, {x: b.x - d.x * 7 + s.x, y: b.y - d.y * 7 + s.y}, {x: b.x - d.x * 7 - s.x, y: b.y - d.y * 7 - s.y}].map(p => `${f2(p.x)},${f2(p.y)}`).join(' ')
  return `<line x1="${f2(a.x)}" y1="${f2(a.y)}" x2="${f2(b.x - d.x * 6)}" y2="${f2(b.y - d.y * 6)}" stroke-width="2" class="${cls}"/><polygon points="${head}" class="${cls.replace(/stroke-/g, 'fill-')}"/>`
}
const DOOR_INK = 'stroke-emerald-600 dark:stroke-emerald-400', FLIGHT_INK = 'stroke-violet-500 dark:stroke-violet-400'
/** Stairs: treads across the long side, and the flight arrow along it, pointing away from the room (up on the ground, down at the top). */
const flight = (w: World, z: Z) => {
  const [c, h, long] = [mid2(z.pos), heart(w, z), z.pos.w >= z.pos.h ? 'x' : 'y'] as const
  const d = long === 'x' ? {x: Math.sign(c.x - h.x) || -1, y: 0} : {x: 0, y: Math.sign(c.y - h.y) || -1}
  const n = Math.floor((long === 'x' ? z.pos.w : z.pos.h) / 8)
  const treads = Array.from({length: Math.max(0, n - 1)}, (_, i) => (long === 'x' ? [z.pos.x + 8 * (i + 1), z.pos.y + 2, z.pos.x + 8 * (i + 1), z.pos.y + z.pos.h - 2] : [z.pos.x + 2, z.pos.y + 8 * (i + 1), z.pos.x + z.pos.w - 2, z.pos.y + 8 * (i + 1)]))
  const len = (long === 'x' ? z.pos.w : z.pos.h) * 0.6
  const up = levelOf(w, z.pos.floor) < Math.max(...levels(w))
  return treads.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="1" class="stroke-violet-300 dark:stroke-violet-700"/>`).join('') +
    arrow({x: c.x - d.x * len / 2, y: c.y - d.y * len / 2 + 6}, d, len, FLIGHT_INK) + txt(c.x, c.y - 4, `${ZINK.stairs} text-[8px] font-bold ${HALO}`, up ? 'UP' : 'DOWN')
}
// Zone names: a tall band reads sideways down its middle, the door's name sits beside its arrow; any other name takes the first corner
// (inside top-left, top-right, bottom-left, bottom-right, along the top, bottom, left or right dash, then just above) whose text box clears the tables and the names already placed.
type Lab = {x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: Box; turn?: boolean}
const TW = 6.6, TH = 9 // px per character and cap height of a 9px uppercase tracked label
const lab = (x: number, y: number, anchor: Lab['anchor'], n: number): Lab => ({x, y, anchor, box: {x: anchor === 'start' ? x : anchor === 'end' ? x - n * TW : x - (n * TW) / 2, y: y - TH, w: n * TW, h: TH + 2}})
const CORNERS: ((p: Box, n: number) => Lab)[] = [
  (p, n) => lab(p.x + 4, p.y + 11, 'start', n), (p, n) => lab(p.x + p.w - 4, p.y + 11, 'end', n),
  (p, n) => lab(p.x + 4, p.y + p.h - 4, 'start', n), (p, n) => lab(p.x + p.w - 4, p.y + p.h - 4, 'end', n), (p, n) => lab(p.x + 4, p.y - 3, 'start', n),
]
const hit = (a: Box) => (b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
/** Then along the top dash, then the bottom dash, a cell at a time (the name sits on the line, haloed). */
const sweep = (p: Box, n: number, y: number) => Array.from({length: Math.max(1, Math.floor((p.w - 8 - n * TW) / 16) + 1)}, (_, i) => lab(p.x + 4 + i * 16, y, 'start', n))
/** Then down the left dash, then the right one, reading sideways. */
const vsweep = (p: Box, n: number, x: number) => Array.from({length: Math.max(1, Math.floor((p.h - 8 - n * TW) / 16) + 1)}, (_, i) =>
  ((y = p.y + 4 + (n * TW) / 2 + i * 16): Lab => ({x, y, anchor: 'middle', turn: true, box: {x: x - 6, y: y - (n * TW) / 2, w: 11, h: n * TW}}))())
const spots = (p: Box, n: number) => [...CORNERS.slice(0, 4).map(f => f(p, n)), ...sweep(p, n, p.y + 3), ...sweep(p, n, p.y + p.h + 3), ...vsweep(p, n, p.x), ...vsweep(p, n, p.x + p.w), CORNERS[4]!(p, n)]
const free = (p: Box, n: number, blocks: Box[]) => spots(p, n).find(l => !blocks.some(hit(l.box))) ?? CORNERS[0]!(p, n)
const doorLab = (w: World, z: Z, n: number): Lab => ((c = mid2(z.pos), o = outward(w, z)) => (o.y ? lab(c.x + 8, c.y + o.y * 18 + 3, 'start', n) : lab(c.x + o.x * 30, c.y - 8, 'middle', n)))()
const PLACE: Partial<Record<Components['zone']['kind'], (w: World, z: Z, n: number) => Lab>> = {door: doorLab}
const labOf = (w: World, z: Z, blocks: Box[]): Lab => {
  const [p, n] = [z.pos, z.zone.label.length]
  const side = p.h > 2.5 * p.w && {...lab(p.x + p.w / 2, p.y + p.h / 2, 'middle', 0), turn: true}
  return side || (PLACE[z.zone.kind]?.(w, z, n) ?? free(p, n, blocks))
}
const nameAt = (z: Z, l: Lab) => `<text x="${f2(l.x)}" y="${f2(l.y)}" text-anchor="${l.anchor}"${l.turn ? ` dy="3" transform="rotate(-90 ${f2(l.x)} ${f2(l.y)})"` : ''} class="${ZINK[z.zone.kind]} ${LABEL}">${esc(z.zone.label)}</text>`
const EXTRA: Partial<Record<Components['zone']['kind'], (w: World, z: Z) => string>> = {
  door: (w, z) => arrow(mid2(z.pos), outward(w, z), 26, DOOR_INK),
  stairs: flight,
}
/** A partition between tables: one solid thin line along the rect's long axis (the rect may have no width or no height); no fill, no name. */
const divider = (z: Z) => ((p = z.pos, h = z.pos.w >= z.pos.h) =>
  `<g data-zone="divider" data-zid="${esc(z.id)}"><title>${esc(z.zone.label)}</title><line x1="${p.x}" y1="${p.y}" x2="${h ? p.x + p.w : p.x}" y2="${h ? p.y : p.y + p.h}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" class="${ZONE.divider}"/></g>`)()
/** One zone's outline (dashed), its extra marks, its name (`l`; none = unnamed here). */
const zoneOf = (w: World, z: Z, l?: Lab) => (z.zone.kind === 'divider' ? divider(z) :
  `<g data-zone="${esc(z.zone.kind)}" data-zid="${esc(z.id)}"><title>${esc(z.zone.label)}</title><rect x="${z.pos.x}" y="${z.pos.y}" width="${z.pos.w}" height="${z.pos.h}" rx="3" stroke-width="1" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" class="${ZONE[z.zone.kind]}"/>` +
  (EXTRA[z.zone.kind]?.(w, z) ?? '') + (l ? nameAt(z, l) : '') + '</g>')
/** Outlines draw areas first (largest), then the rest; names are placed fixed ones first (door, stairs, lobby), areas last, each against the tables
 * (with their section names above) and the names before it. `skip` = names a section already shows. */
const ORDER: Components['zone']['kind'][] = ['area', 'walkway', 'aisle', 'wall', 'room', 'lobby', 'stand', 'prop', 'stairs', 'door', 'divider']
/** What a table keeps clear of names: its section name above, its chips below (when it has any). */
const pad = (t: FT): Box => ({x: t.pos.x - 8, y: t.pos.y - 18, w: t.pos.w + 16, h: t.pos.h + (onFloor(t).length ? 38 : 20)})
const by = (ks: Components['zone']['kind'][]) => (a: Z, b: Z) => ks.indexOf(a.zone.kind) - ks.indexOf(b.zone.kind)
const QUIET: Components['zone']['kind'][] = ['divider', 'prop'] // never named on the plan (the hover line says what they are)
const labels = (w: World, zs: Z[], ts: FT[], skip: string[]) => [...zs].filter(z => !QUIET.includes(z.zone.kind)).sort(by([...ORDER].reverse())).reduce<{at: Map<Id, Lab>; blocks: Box[]}>((acc, z) =>
  ((l = skip.includes(z.zone.label.toLowerCase()) ? undefined : labOf(w, z, acc.blocks)) => (l ? {at: acc.at.set(z.id, l), blocks: [...acc.blocks, l.box]} : acc))(), {at: new Map(), blocks: ts.map(pad)}).at
export const zonesOf = (w: World, zs: Z[], ts: FT[] = [], skip: string[] = []) => ((at = labels(w, zs, ts, skip)) => [...zs].sort(by(ORDER)).map(z => zoneOf(w, z, at.get(z.id))).join(''))()

// ---- insight outlines: tables a board insight names (warn / crit), and the table whose card is open
export const ALERT: Record<string, string> = {warn: 'stroke-amber-500 dark:stroke-amber-400', crit: 'stroke-rose-600 dark:stroke-rose-400'}
export type Alerts = Record<Id, {level: Insight['level']; msg: string}>
/** Worst level per table over the board's insights (info is not outlined). */
export const alertsOf = (is: Insight[] = []): Alerts => is.filter(i => i.level !== 'info').reduce<Alerts>((m, i) => ({...m, ...Object.fromEntries(i.tables.filter(t => m[t]?.level !== 'crit').map(t => [t, {level: i.level, msg: i.msg}]))}), {})
export const outline = (a: Alerts) => (t: Ent<'table' | 'pos'>) => ((x = a[t.id]) => (x ? `<g data-insight="${x.level}" data-tid-alert="${esc(t.id)}"><title>${esc(x.msg)}</title><rect x="${t.pos.x - 4}" y="${t.pos.y - 4}" width="${t.pos.w + 8}" height="${t.pos.h + 8}" rx="8" fill="none" stroke-width="3" class="${ALERT[x.level]}${x.level === 'crit' ? ' animate-pulse' : ''}"/></g>` : ''))()
export const picked = (t?: Ent<'table' | 'pos'>) => (t ? `<rect data-picked x="${t.pos.x - 6}" y="${t.pos.y - 6}" width="${t.pos.w + 12}" height="${t.pos.h + 12}" rx="10" fill="none" stroke-width="2" stroke-dasharray="4 3" class="pointer-events-none stroke-sky-500"/>` : '')
