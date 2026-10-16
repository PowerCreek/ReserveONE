import {having} from '../contracts/index.ts'
import type {Id, Patch, World} from '../contracts/index.ts'
import {expand} from './spots.ts'
import {set} from './patch.ts'
/** Party left / table cleared (v1 markAvailable): live slots COMPLETED with endedAt, tables available and unassigned. Link groups clear together. */
export const freeUp = (w: World, tables: Id[], now: number): Patch[] => {
  const ids = expand(w, tables)
  const slots = having(w, 'slot').filter(s => ids.includes(s.slot.table) && s.slot.status !== 'COMPLETED')
  return [
    ...slots.map(s => set(s.id, {slot: {...s.slot, status: 'COMPLETED', endedAt: now}})),
    ...having(w, 'table').filter(t => ids.includes(t.id)).map(t => set(t.id, {table: {...t.table, status: 'available', waiter: null}})),
  ]
}
