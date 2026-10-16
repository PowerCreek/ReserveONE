// SVG fragments for the floor (U2). Pure string builders over entities; classes come from tone.ts, data colours from entity data.
import type {Ent, Entity, World} from '../contracts/index.ts'
import {DOOR, locate} from './geo.ts'
import type {Fx} from './state.ts'
import {esc} from './render.ts'
import {RING, ROLE, TABLE} from './tone.ts'
const txt = (x: number, y: number, cls: string, s: unknown) => `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${esc(s)}</text>`
export const table = (t: Ent<'table' | 'pos'>) =>
  `<g><title>${esc(t.table.label)} cap ${t.table.capacity} ${t.table.status}</title><rect x="${t.pos.x}" y="${t.pos.y}" width="${t.pos.w}" height="${t.pos.h}" rx="${t.table.shape === 'booth' ? 4 : 12}" stroke-width="2" class="${TABLE[t.table.status]}"/>` +
  txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 - 2, 'fill-slate-800 text-[13px] font-semibold dark:fill-slate-100', t.table.label) +
  txt(t.pos.x + t.pos.w / 2, t.pos.y + t.pos.h / 2 + 12, 'fill-slate-600 text-[10px] dark:fill-slate-300', `${t.table.capacity}p`) + '</g>'
export const section = (s: Ent<'section'>, ts: Ent<'table' | 'pos'>[]) => {
  const xs = ts.flatMap(t => [t.pos.x, t.pos.x + t.pos.w]), ys = ts.flatMap(t => [t.pos.y, t.pos.y + t.pos.h])
  const [x, y] = [Math.min(...xs) - 16, Math.min(...ys) - 16]
  return ts.length ? `<rect x="${x}" y="${y}" width="${Math.max(...xs) + 16 - x}" height="${Math.max(...ys) + 16 - y}" rx="16" fill="${esc(s.section.color)}" fill-opacity=".12"/>` +
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
  `<g><circle cx="${f.x}" cy="${f.y}" r="16" fill="none" stroke-width="3" class="${RING[f.kind] ?? RING.left} origin-center animate-ping [transform-box:fill-box]"/>` +
  txt(f.x, f.y - 22, 'fill-slate-700 text-[10px] font-semibold dark:fill-slate-200', f.kind) + '</g>'
export const door = `<g><rect x="${DOOR.x - 14}" y="${DOOR.y - 24}" width="8" height="48" class="fill-slate-500"/>${txt(DOOR.x - 2, DOOR.y + 40, 'fill-slate-500 text-[10px]', 'DOOR')}</g>`
