// Policy = data every engine function is parameterised by (E1). Defaults are the v1 constants (SPEC §3).
import type {Heat, PType} from './model.ts'
import {defaultHost} from './host.ts'
import type {Host} from './host.ts'
export interface Policy {
  seat: {resetMin: number; quantumMin: number; cadenceMin: number; fitSlackMin: number; turnMin: [number, number]; turnDefault: number; lapsedClearMin: number; lateGraceMin: number}
  queue: {tier: Record<PType, number>} // lower = served first
  rotation: {idleCapMin: number; idleWeight: number} // score = -tally + idle*idleWeight - skip
  alerts: {prepMin: number; warnMin: number; busBase: number; busDemand: number; busRank: number}
  sim: {walkPxPerSec: number; dwellSec: {seat: number; serve: number; clear: number}; door: [x: number, y: number]; floor: [w: number, h: number]} // door = spawn point (the `door` entity is seeded from it); floor = canvas size
  look: {probes: number; tight: number; sizes: number[]; msg: Record<Heat, string>} // lookahead: probe count, tight-runway depth, default sizes, heat messages
  rows: {past: number; future: number} // turnover rows around the current one
  section: {minOcc: number; share: number; horizonMin: number} // underflow: min occupancy, share of tables needing a turn, turn horizon
  spawn: {names: string[]; sizes: [size: number, weight: number][]} // sim walk-in arrivals
  host: Host // host-service registries: features, reasons, responses, ladder, clock, rubric (contracts/host.ts)
}
export const defaultPolicy: Policy = {
  seat: {resetMin: 5, quantumMin: 5, cadenceMin: 3, fitSlackMin: 5, turnMin: [45, 90], turnDefault: 60, lapsedClearMin: 5, lateGraceMin: 15},
  queue: {tier: {P: 0, V: 1, W: 2, R: 2}},
  rotation: {idleCapMin: 600, idleWeight: 0.001},
  alerts: {prepMin: 30, warnMin: 15, busBase: 30.5, busDemand: 10, busRank: 5},
  sim: {walkPxPerSec: 80, dwellSec: {seat: 2, serve: 4, clear: 4}, door: [24, 260], floor: [800, 520]},
  look: {probes: 40, tight: 3, sizes: [1, 2, 3, 4, 5, 6], msg: {NO_TABLE: 'No table fits', CAUTION_WAIT: 'EXHAUSTED NOW', WARM_AMBER: 'Tight Runway', HOT_GREEN: 'Clear'}},
  rows: {past: 3, future: 5},
  section: {minOcc: 0.2, share: 0.25, horizonMin: 30},
  spawn: {
    names: ['Garcia', 'Chen', 'Okafor', 'Smith', 'Kim', 'Patel', 'Nguyen', 'Silva', 'Cohen', 'Rossi', 'Tanaka', 'Moreau'],
    sizes: [[1, 6], [2, 40], [3, 12], [4, 25], [5, 6], [6, 6], [8, 3], [10, 2]],
  },
  host: defaultHost,
}
