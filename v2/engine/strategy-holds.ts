// Host levers (lane E-S): a hold keeps tables clear for a size until a time, once its gate opens (a table frees, or a clock minute). Pure reads over `StratCtl.holds`.
import type {Id} from '../contracts/index.ts'
import type {Gate, StratHold} from '../contracts/strategy.ts'
import type {SCtx} from './strategy-ctx.ts'
const GATE: Record<Gate['kind'], (c: SCtx, g: Gate) => number> = {free: (c, g) => c.free((g as Extract<Gate, {kind: 'free'}>).table), at: (_c, g) => (g as Extract<Gate, {kind: 'at'}>).at}
/** When the hold starts keeping its tables: its gate's time, else now. */
export const opens = (c: SCtx, h: StratHold) => (h.gate ? GATE[h.gate.kind](c, h.gate) : c.now)
/** A party of `size` seated from `from` for a stay overlaps the hold's window and is not what the hold is for. */
const hit = (c: SCtx, size: number, from: number) => (h: StratHold) => size < h.size && from < h.until && from + c.stay > opens(c, h)
/** Tables a party of `size` seated now must leave alone. */
export const heldFor = (c: SCtx, size: number): Id[] => c.ctl.holds.filter(hit(c, size, c.now)).flatMap(h => h.tables)
/** Holds a seating of `size` on `tables` from `from` would squeeze. */
export const squeezes = (c: SCtx, size: number, tables: Id[], from: number): Id[] => c.ctl.holds.filter(h => hit(c, size, from)(h) && h.tables.some(t => tables.includes(t))).map(h => h.id)
const on = (c: SCtx) => c.ctl.holds.filter(h => h.until > c.now)
/** Holds whose gate has opened (live) and those still waiting on theirs; expired holds are neither. */
export const gates = (c: SCtx) => ({live: on(c).filter(h => opens(c, h) <= c.now).map(h => h.id), waiting: on(c).filter(h => opens(c, h) > c.now).map(h => h.id)})
