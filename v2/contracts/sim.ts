// Sim command protocol. Units (entities with a `body`) take tasks; completing a task emits an event; engine.tick turns events into patches.
// Host: seat head of queue. Server: serve occupied tables in their section. Busser: clear lapsed tables in bus order. Guest: door -> queue -> seat -> dwell -> leave.
import type {Id, Level, Patch} from './model.ts'
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
/** Host-service tasks and events: separate unions so existing exhaustive tables over Task/SimEvent stay valid; the sim layer handles `Task | HostTask`. */
export type HostTask = {do: 'greet'; party: Id} | {do: 'lead'; party: Id; table: Id} | {do: 'reply'; party: Id; response: string}
export type HostEvent =
  | {ev: 'greeted'; party: Id; by: Id}
  | {ev: 'heard'; party: Id; feat: string; level: Level}
  | {ev: 'quoted'; party: Id; min: number}
  | {ev: 'offered'; party: Id; spot: Id; step: string}
  | {ev: 'answered'; party: Id; spot: Id; yes: boolean}
  | {ev: 'led'; party: Id; table: Id; by: Id} // arrived at the table, not yet seated
  | {ev: 'asked'; party: Id; reason: string; stage: 'arrived' | 'seated'}
  | {ev: 'replied'; party: Id; reason: string; response: string; move: 'swap' | 'offer' | 'stay'; mood: number}
  | {ev: 'moved'; party: Id; from: Id; to: Id}
  | {ev: 'mood'; party: Id; delta: number; why: string}
