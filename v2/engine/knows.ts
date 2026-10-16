// Awareness (service modes): does the server know of a seating? Main-floor servers see it; elsewhere the host must tell them (`slot.told`).
import {having} from '../contracts/index.ts'
import type {Ent, Id, Service, World} from '../contracts/index.ts'
import {areaOf} from './section.ts'
import {expand} from './spots.ts'
/** The live seating at a table (a link group's slot sits on its primary, so any member finds it). */
export const activeAt = (w: World, table: Id): Ent<'slot'> | undefined => {
  const ids = expand(w, [table])
  return having(w, 'slot').find(s => s.slot.status === 'ACTIVE' && ids.includes(s.slot.table))
}
/** The table's server knows of its seating: the area is `seen`, or the active slot is `told`. */
export const knows: Service['knows'] = (p, w, _now, table) => !!(p.service.areas[areaOf(w.ents[table])]?.seen || activeAt(w, table)?.slot.told)
