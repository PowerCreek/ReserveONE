// Scenario format (C3): a scenario is data. Seed = the room; steps = a timeline of arrivals, scripted placements and requests; expect = what a good run looks like.
import type {Id, PType, Want} from './model.ts'
import type {Grade, Stage} from './host.ts'
import type {HostEvent, SimEvent} from './sim.ts'
export interface TableSeed {id: Id; label: string; capacity: number; x: number; y: number; w: number; h: number; feats: string[]; floor?: Id; section?: Id}
export interface Seed {tables: TableSeed[]; sections?: {id: Id; name: string}[]; servers: {id: Id; name: string; sections: Id[]}[]; busy?: {table: Id; size: number; minAgo: number}[]}
/** Minutes after scenario start. `key` is the scenario-local party name that later steps and expectations reuse. */
export type Step =
  | {at: number; do: 'arrive'; key: string; name: string; size: number; kind: PType; wants: Want[]}
  | {at: number; do: 'place'; key: string; table: Id; stage: Stage} // scripted start state: the party was already led to `table`
  | {at: number; do: 'ask'; key: string; reason: string; stage: Stage}
/** One expected-good outcome; `why` is the teaching sentence shown when it is met or missed. */
export interface Expect {id: string; key: string; spot?: Id[]; feats?: string[]; waitMaxMin?: number; reply?: string[]; moodMin?: number; why: string}
export interface Scenario {id: string; title: string; brief: string; learn: string; seed: Seed; steps: Step[]; expect: Expect[]; weights?: Record<string, number>}
/** What the sim saw, stamped; the sole input of `assess` besides the world. */
export type Trace = {at: number; e: SimEvent | HostEvent}[]
export interface Score {metric: string; value: number; grade: Grade; weight: number; line: string; refs: Id[]}
export interface Check {expect: string; ok: boolean; line: string}
export interface Assessment {scenario: string | null; total: number; grade: Grade; scores: Score[]; checks: Check[]}
