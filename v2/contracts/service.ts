// Service modes (wave 3): who holds which tables, when, and who must be told. Every mode, area and carve is a row of data (C3); engine looks rows up by id.
// A table's area is its `area` component (id of a row below); a table without one is in `main`. The day mode comes from `schedule` unless the `service` entity overrides it.
import type {Id} from './model.ts'
import type {Reg} from './host.ts'
/** How an area is carved among the crew: chunk = contiguous slice of its tables (`table.section`), whole = one server holds the area (`table.section`), tops = single tables dealt piecemeal (`assign`), level = held by its bartender pair (`staff.area`). */
export type Carve = 'chunk' | 'whole' | 'tops' | 'level'
/** `seen`: a server sees new seatings here and starts service unprompted; otherwise the host must tell them (`slot.told`). `carve`: allowed ways to split it, first = default (the `service` entity may choose another). */
export interface AreaDef {label: string; seen: boolean; carve: Carve[]}
/** `holds`: standing holds (sections, tops, levels) decide the server; else seatings rotate across the crew by cover tally / weight. */
export interface ModeDef {label: string; holds: boolean}
/** From minute-of-day `from` (local, 0-1439) the mode is `mode`; rows ascend, the last row at or before now wins. */
export interface Slice {from: number; mode: string}
export interface ServiceCfg {modes: Reg<ModeDef>; schedule: Slice[]; areas: Reg<AreaDef>}
export const defaultService: ServiceCfg = {
  modes: {sectioned: {label: 'Sectioned', holds: true}, rotation: {label: 'Rotation', holds: false}},
  schedule: [{from: 0, mode: 'sectioned'}, {from: 11 * 60, mode: 'rotation'}, {from: 15 * 60, mode: 'sectioned'}],
  areas: {
    main: {label: 'Main floor', seen: true, carve: ['chunk']},
    grotto: {label: 'Grotto', seen: false, carve: ['whole', 'tops']},
    patio: {label: 'Patio', seen: false, carve: ['tops']},
    bar: {label: 'Bar', seen: true, carve: ['level']},
    upstairs: {label: 'Upstairs', seen: false, carve: ['level']},
  },
}
/** A standing holder of one table in the active mode (`by` = the carve that decided it; `rotation` = nobody until seated, then the table's waiter). */
export interface Hold {table: Id; area: string; staff: Id | null; by: Carve | 'rotation'}
