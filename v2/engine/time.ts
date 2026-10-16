export const MIN = 60000 // unit conversion only; every tunable lives in policy / knobs
export const midnight = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
