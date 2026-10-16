// Policy = data every engine function is parameterised by (E1). Defaults are the v1 constants (SPEC §3).
import type {PType} from './model.ts'
export interface Policy {
  seat: {resetMin: number; quantumMin: number; cadenceMin: number; fitSlackMin: number; turnMin: [number, number]; turnDefault: number; lapsedClearMin: number; lateGraceMin: number}
  queue: {tier: Record<PType, number>} // lower = served first
  rotation: {idleCapMin: number; idleWeight: number} // score = -tally + idle*idleWeight - skip
  alerts: {prepMin: number; warnMin: number; busBase: number; busDemand: number; busRank: number}
  sim: {walkPxPerSec: number; dwellSec: {seat: number; serve: number; clear: number}}
}
export const defaultPolicy: Policy = {
  seat: {resetMin: 5, quantumMin: 5, cadenceMin: 3, fitSlackMin: 5, turnMin: [45, 90], turnDefault: 60, lapsedClearMin: 5, lateGraceMin: 15},
  queue: {tier: {P: 0, V: 1, W: 2, R: 2}},
  rotation: {idleCapMin: 600, idleWeight: 0.001},
  alerts: {prepMin: 30, warnMin: 15, busBase: 30.5, busDemand: 10, busRank: 5},
  sim: {walkPxPerSec: 80, dwellSec: {seat: 2, serve: 4, clear: 4}},
}
