import {having} from '../contracts/index.ts'
import type {Ent, Engine, SeqItem, World} from '../contracts/index.ts'
const open = (w: World, size: number) => having(w, 'table').filter(t => t.table.status === 'available' && t.table.capacity >= size)
const tightest = (ts: Ent<'table'>[]) => ts.reduce<Ent<'table'> | undefined>((b, t) => (b && b.table.capacity <= t.table.capacity ? b : t), undefined)
const item = (size: number, now: number, t?: Ent<'table'>): SeqItem =>
  ({size, spot: t?.id ?? null, tables: t ? [t.id] : [], label: t?.table.label ?? '-', waitMin: 0, at: now, code: t ? 'HOT_GREEN' : 'NO_TABLE', ready: !!t})
export const fit: Engine['fit'] = (_p, w, now, sizes) => sizes.map(size => item(size, now, tightest(open(w, size))))
