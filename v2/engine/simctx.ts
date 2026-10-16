// Shared shapes for the sim tick: a unit's turn is a pipeline of stages over one accumulator (C3).
import type {Id, Patch, Policy, SimEvent, SimOut, Task, World} from '../contracts/index.ts'
import {apply} from './patch.ts'
export interface Ctx {p: Policy; now: number; dt: number} // dt in seconds
export interface Acc {w: World; out: SimOut; done: Task | null}
export type Stage = (c: Ctx, id: Id, a: Acc) => Acc
/** Record patches + events and let later steps see their effect. */
export const emit = (a: Acc, ps: Patch[], es: SimEvent[] = []): Acc =>
  ({...a, w: apply(a.w, ps), out: {patches: [...a.out.patches, ...ps], events: [...a.out.events, ...es]}})
export const bodyOf = (a: Acc, id: Id) => a.w.ents[id]?.body
export const skip: Stage = (_c, _id, a) => a
