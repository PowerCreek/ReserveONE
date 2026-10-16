// Seat a listed party (queue or booking row): one Cmd through the desk; the engine picks the best ready spot.
import type {App} from '../contracts/index.ts'
import {run} from './act.ts'
import {arg} from './render.ts'
export const seat = (app: App) => app.act('seat', (a, ev) => run(a, {do: 'seat', party: arg(ev, 'id')}))
