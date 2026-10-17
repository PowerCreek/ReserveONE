// Policy = data every engine function is parameterised by (E1). Defaults are the v1 constants (SPEC §3).
import type {Heat, PType} from './model.ts'
import {defaultHost} from './host.ts'
import type {Host} from './host.ts'
import {defaultService} from './service.ts'
import type {ServiceCfg} from './service.ts'
export interface Policy {
  seat: {resetMin: number; quantumMin: number; cadenceMin: number; fitSlackMin: number; turnMin: [number, number]; turnDefault: number; lapsedClearMin: number; lateGraceMin: number; selfSeat: string[]} // selfSeat: table shapes guests take first come, first served (bar stools): the host never offers or seats them
  queue: {tier: Record<PType, number>} // lower = served first
  rotation: {idleCapMin: number; idleWeight: number}
  prefs: {bogged: number; prefer: number; slack: number} // bogged = covers above the floor's mean (per weight) that marks a unit bogged down; prefer = rotation score bonus for a unit that prefers the tables (never more than one seating's worth, so the rotation stays primary); slack = match penalty per spare seat on a table whose server avoids that fit // score = -tally + idle*idleWeight - skip
  alerts: {prepMin: number; warnMin: number; busBase: number; busDemand: number; busRank: number}
  sim: {walkPxPerSec: number; dwellSec: {seat: number; serve: number; clear: number}; door: [x: number, y: number]; floor: [w: number, h: number]; grid: number; autoSeat: boolean} // grid = floor cell size in policy px: table footprints and centres sit on whole cells // autoSeat: the sim host seats the queue head by itself (default off: the player seats); door = spawn point (the `door` entity is seeded from it); floor = canvas size
  plan: {horizonMin: number; slackMin: number; anticipate: number} // temporal plan: reservations due within horizonMin are placed ahead (tables free by then, merges included); slackMin = lateness tolerated; anticipate = how much of a server's planned covers counts against them in the rotation (0 = ignore)
  merge: {max: number} // most tables a merge (tables pushed together) may join; which tables touch is venue data (`adj`)
  board: {limits: Record<string, {warn: number; crit: number}>; insight: {horizonMin: number; imbalanceCovers: number; delugeTurns: number; droughtMin: number; peakQueue: number; peakGraceMin: number}} // dashboard: kpi tone limits by kpi id; insight thresholds (Gemini-era predictive overlays): horizon for projections, cover spread that flags an imbalance, turns per interval that is a deluge, minutes with no turn that is a drought, queue length that is peak load, the late grace used at peak
  look: {probes: number; tight: number; sizes: number[]; msg: Record<Heat, string>} // lookahead: probe count, tight-runway depth, default sizes, heat messages
  rows: {past: number; future: number} // turnover rows around the current one
  section: {minOcc: number; share: number; horizonMin: number; tol: number; spread: Record<string, number>} // underflow: min occupancy, share of tables needing a turn, turn horizon; tol: how far a carved cluster's covers may stray from an even share (fraction of the share); spread: per table shape, the most of them (fraction of all of that shape, rounded up) one cluster may hold, so no server gets every booth
  spawn: {names: string[]; sizes: [size: number, weight: number][]} // sim walk-in arrivals
  service: ServiceCfg // day mode schedule, areas (awareness, carve) and mode rows (contracts/service.ts)
  host: Host // host-service registries: features, reasons, responses, ladder, clock (contracts/host.ts)
}
export const defaultPolicy: Policy = {
  seat: {resetMin: 5, quantumMin: 5, cadenceMin: 3, fitSlackMin: 5, turnMin: [45, 90], turnDefault: 60, lapsedClearMin: 5, lateGraceMin: 15, selfSeat: ['stool']},
  queue: {tier: {P: 0, V: 1, W: 2, R: 2}},
  rotation: {idleCapMin: 600, idleWeight: 0.001},
  prefs: {bogged: 6, prefer: 2, slack: 1},
  alerts: {prepMin: 30, warnMin: 15, busBase: 30.5, busDemand: 10, busRank: 5},
  sim: {walkPxPerSec: 80, dwellSec: {seat: 2, serve: 4, clear: 4}, door: [48, 416], floor: [1296, 720], grid: 16, autoSeat: false},
  plan: {horizonMin: 150, slackMin: 5, anticipate: 1},
  merge: {max: 4},
  board: {
    limits: {seated: {warn: 0.9, crit: 1}, occ: {warn: 0.9, crit: 1}, wait: {warn: 20, crit: 40}, quote: {warn: 5, crit: 10}, turn: {warn: 1.15, crit: 1.3}, turning: {warn: 3, crit: 6}, bus: {warn: 1, crit: 3}, late: {warn: 1, crit: 3}, noshow: {warn: 1, crit: 3}},
    insight: {horizonMin: 30, imbalanceCovers: 8, delugeTurns: 3, droughtMin: 30, peakQueue: 6, peakGraceMin: 5},
  },
  look: {probes: 40, tight: 3, sizes: [1, 2, 3, 4, 5, 6], msg: {NO_TABLE: 'No table fits', CAUTION_WAIT: 'EXHAUSTED NOW', WARM_AMBER: 'Tight Runway', HOT_GREEN: 'Clear'}},
  rows: {past: 3, future: 5},
  section: {minOcc: 0.2, share: 0.25, horizonMin: 30, tol: 0.1, spread: {booth: 0.5}},
  spawn: {
    names: ['Garcia', 'Chen', 'Okafor', 'Smith', 'Kim', 'Patel', 'Nguyen', 'Silva', 'Cohen', 'Rossi', 'Tanaka', 'Moreau'],
    sizes: [[1, 6], [2, 40], [3, 12], [4, 25], [5, 6], [6, 6], [8, 3], [10, 2]],
  },
  service: defaultService,
  host: defaultHost,
}
