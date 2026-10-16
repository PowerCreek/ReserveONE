import type {Heat} from '../contracts/index.ts'
/** Read-only tunables the frozen Policy has no field for yet (gap note: promote into contracts/policy.ts). No state. */
export const knobs = {
  look: {probes: 40, tight: 3, sizes: [1, 2, 3, 4, 5, 6], msg: {NO_TABLE: 'No table fits', CAUTION_WAIT: 'EXHAUSTED NOW', WARM_AMBER: 'Tight Runway', HOT_GREEN: 'Clear'} as Record<Heat, string>},
  rows: {past: 3, future: 5},
  section: {minOcc: 0.2, share: 0.25, horizonMin: 30},
  spawn: {
    names: ['Garcia', 'Chen', 'Okafor', 'Smith', 'Kim', 'Patel', 'Nguyen', 'Silva', 'Cohen', 'Rossi', 'Tanaka', 'Moreau'],
    sizes: [[1, 6], [2, 40], [3, 12], [4, 25], [5, 6], [6, 6], [8, 3], [10, 2]] as [number, number][],
  },
}
