import {having} from '../contracts/index.ts'
import type {Engine, Ent, Entity, Id, TStatus, World} from '../contracts/index.ts'
import {isTable} from './ents.ts'
const prec: TStatus[] = ['blocked_private', 'occupied', 'lapsed', 'available']
const status = (ts: Ent<'table'>[]) => prec.find(s => ts.some(t => t.table.status === s)) ?? 'available'
interface Group {id: Id; ts: Ent<'table'>[]}
const spot = (g: Group): Ent<'spot'> => ({id: g.id, spot: {tables: g.ts.map(t => t.id), label: g.ts.map(t => t.table.label).join('+'), capacity: g.ts.reduce((n, t) => n + t.table.capacity, 0), status: status(g.ts), floor: (g.ts[0] as Entity).pos?.floor ?? '', section: g.ts[0].table.section}})
const linked = (w: World): Group[] => having(w, 'link').map(l => ({id: l.id, ts: l.link.members.map(m => w.ents[m]).filter(isTable)})).filter(g => g.ts.length > 1)
/** Seatable spots: each link group once, plus every table that is not in a group (v1 "units"). */
export const spots: Engine['spots'] = w => {
  const gs = linked(w)
  const used = gs.flatMap(g => g.ts.map(t => t.id))
  const solo = having(w, 'table').filter(t => !used.includes(t.id)).map(t => ({id: t.id, ts: [t]}))
  return [...gs, ...solo].map(spot)
}
/** Ids plus every member of any link group they touch. */
export const expand = (w: World, ids: Id[]): Id[] => [...new Set([...ids, ...having(w, 'link').filter(l => l.link.members.some(m => ids.includes(m))).flatMap(l => l.link.members)])]
