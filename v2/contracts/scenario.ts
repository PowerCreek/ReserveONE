// Sandbox starter format (C3): a scenario is data. Seed = the room; steps = timed arrivals, placements and requests. No expectations: guests react on their own.
import type {Id, PType, Want} from './model.ts'
import type {Stage} from './host.ts'
export interface TableSeed {id: Id; label: string; capacity: number; x: number; y: number; w: number; h: number; feats: string[]; floor?: Id; section?: Id}
export interface Seed {tables: TableSeed[]; sections?: {id: Id; name: string}[]; servers: {id: Id; name: string; sections: Id[]}[]; busy?: {table: Id; size: number; minAgo: number}[]}
/** Minutes after start. `key` is the starter-local party name that later steps reuse. */
export type Step =
  | {at: number; do: 'arrive'; key: string; name: string; size: number; kind: PType; wants: Want[]}
  | {at: number; do: 'place'; key: string; table: Id; stage: Stage} // starter state: the party was already led to `table`
  | {at: number; do: 'ask'; key: string; reason: string; stage: Stage}
export interface Scenario {id: string; title: string; brief: string; seed: Seed; steps: Step[]}
