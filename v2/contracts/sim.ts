// Sim command protocol. Units (entities with a `body`) take tasks; completing a task emits an event; engine.tick turns events into patches.
// Host: seat head of queue. Server: serve occupied tables in their section. Busser: clear lapsed tables in bus order. Guest: door -> queue -> seat -> dwell -> leave.
import type {Id, Patch} from './model.ts'
export type Task =
  | {do: 'move'; x: number; y: number}
  | {do: 'seat'; party: Id; table: Id}
  | {do: 'serve'; table: Id}
  | {do: 'clear'; table: Id}
  | {do: 'wait'; sec: number}
export type SimEvent =
  | {ev: 'arrived'; party: Id}
  | {ev: 'seated'; party: Id; table: Id; by: Id}
  | {ev: 'served'; table: Id; by: Id}
  | {ev: 'cleared'; table: Id; by: Id}
  | {ev: 'left'; party: Id}
  | {ev: 'stuck'; unit: Id; task: Task; why: string}
export interface SimOut {patches: Patch[]; events: SimEvent[]}
