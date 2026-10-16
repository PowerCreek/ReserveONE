export const MIN = 60000 // unit conversion only; every tunable lives in policy
export const midnight = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
/** Local minute of day (0-1439): the key of `policy.service.schedule`. */
export const minuteOfDay = (ms: number) => new Date(ms).getHours() * 60 + new Date(ms).getMinutes()
