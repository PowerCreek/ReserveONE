// SVG fragments for the floor (U2). Pure string builders over entities; classes come from tone.ts, data colours from entity data.
import {defaultPolicy, having} from '../contracts/index.ts'
import type {Components, Ent, Entity, Hold, World} from '../contracts/index.ts'
import {HRING} from './events.ts'
import {DOOR, locate} from './geo.ts'
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
const SHOWN = 3 // chips under a table; the rest fold into "+n" (the tooltip lists all)
const feats = defaultPolicy.host.feats
const cw = (s: string) => s.length * 4.2 + 6
/** Feature chips in a centred row under the table: a 4-letter tag per feature, coloured by its group. */
export const chips = (t: Ent<'table' | 'pos'> & {feat?: Components['feat']}) => {
  const tags = (t.feat?.tags ?? []).map(f => ({f, s: (feats[f]?.label ?? f).slice(0, 4), cls: CHIP[feats[f]?.group ?? 'air']}))
  const row = [...tags.slice(0, SHOWN), ...(tags.length > SHOWN ? [{f: '+', s: `+${tags.length - SHOWN}`, cls: CHIP.access}] : [])]
  const ws = row.map(c => cw(c.s)), total = ws.reduce((a, b) => a + b + 2, -2)
  const xs = ws.map((_, i) => t.pos.x + t.pos.w / 2 - total / 2 + ws.slice(0, i).reduce((a, b) => a + b + 2, 0))
  return row.map((c, i) => `<g data-feat="${esc(c.f)}"><rect x="${xs[i]}" y="${t.pos.y + t.pos.h + 3}" width="${ws[i]}" height="9" rx="4" stroke-width="1" class="${c.cls}"/>` +
    txt(xs[i] + ws[i] / 2, t.pos.y + t.pos.h + 10, 'fill-slate-700 text-[7px] dark:fill-slate-200', c.s) + '</g>').join('')
}
const tip = (t: Ent<'table' | 'pos'> & {feat?: Components['feat']}) => (t.feat?.tags.length ? ` | ${t.feat.tags.map(f => feats[f]?.label ?? f).join(', ')}` : '')
export const table = (t: Ent<'table' | 'pos'> & {feat?: Components['feat']}) =>
  `<g><title>${esc(t.table.label)} cap ${t.table.capacity} ${t.table.status}${esc(tip(t))}</title><rect x="${t.pos.x}" y="${t.pos.y}" width="${t.pos.w}" height="${t.pos.h}" rx="${t.table.shape === 'booth' ? 4 : 12}" stroke-width="2" class="${TABLE[t.table.status]}"/>` +
  txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 - 2, 'fill-slate-800 text-[13px] font-semibold dark:fill-slate-100', t.table.label) +
  txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 + 12, 'fill-slate-600 text-[10px] dark:fill-slate-300', `${t.table.capacity}p`) + chips(t) + '</g>'
/** `live` = the active mode has standing holds; otherwise the chunk tints fade (nobody holds them). */
export const section = (s: Ent<'section'>, ts: Ent<'table' | 'pos'>[], live = true) => {
  const xs = ts.flatMap(t => [t.pos.x, t.pos.x + t.pos.w]), ys = ts.flatMap(t => [t.pos.y, t.pos.y + t.pos.h])
  const [x, y] = [Math.min(...xs) - 16, Math.min(...ys) - 16]
  return ts.length ? `<rect x="${x}" y="${y}" width="${Math.max(...xs) + 16 - x}" height="${Math.max(...ys) + 16 - y}" rx="16" fill="${esc(s.section.color)}" fill-opacity="${live ? '.12' : '.04'}"/>` +
    txt(x + 30, y + 12, 'fill-slate-500 text-[10px] uppercase dark:fill-slate-400', s.section.name) : ''
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
const STAFF = ['fill-sky-600', 'fill-emerald-600', 'fill-amber-600', 'fill-rose-600', 'fill-violet-600', 'fill-teal-600', 'fill-orange-600', 'fill-pink-600']
/** A coloured initial on the table corner for whoever holds it now (colour = the holder's place in the crew). */
export const badge = (w: World, hs: Hold[]) => (t: Ent<'table' | 'pos'>) => {
  const h = hs.find(x => x.table === t.id && x.staff)
  const s = w.ents[h?.staff ?? '']
  const i = having(w, 'staff').findIndex(x => x.id === s?.id)
  return h && s?.staff ? `<g data-hold="${esc(t.id)}"><title>${esc(`${s.staff.crew?.join(' + ') ?? s.staff.name} (${h.by})`)}</title><circle cx="${t.pos.x + 4}" cy="${t.pos.y + 4}" r="7" class="${STAFF[i % STAFF.length]}"/>${txt(t.pos.x + 4, t.pos.y + 7.5, 'fill-white text-[9px] font-bold', s.staff.name[0])}</g>` : ''
}
