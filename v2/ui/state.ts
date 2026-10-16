// UI state (C8): extends the kernel's UiState by augmentation. New fields are optional so seeds from other lanes still type-check;
// `init` fills them once and `ui(app)` returns the filled view.
import type {App, UiState} from '../contracts/index.ts'
export interface LogLine {t: number; kind: string; msg: string}
export interface Fx {x: number; y: number; kind: string; msg: string; ttl: number}
declare module '../contracts/kernel.ts' {
  interface UiState {tab?: string; running?: boolean; speed?: number; rev?: number; seed?: number; rate?: number; acc?: number; scenario?: string; log?: LogLine[]; fx?: Fx[]}
}
export type Ui = Required<UiState>
export const defaults = () => ({tab: 'sim', running: false, speed: 5, rev: 0, seed: 1, rate: 0, acc: 0, scenario: '', log: [] as LogLine[], fx: [] as Fx[]})
export const ui = (app: App) => app.store.state.ui as Ui
export const init = (app: App) => Object.assign(app.store.state.ui, {...defaults(), ...app.store.state.ui})
