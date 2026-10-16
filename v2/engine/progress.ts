import type {Components, Task, World} from '../contracts/index.ts'
import {set} from './patch.ts'
import {bodyOf, emit} from './simctx.ts'
import type {Ctx, Stage} from './simctx.ts'
import {phase} from './ents.ts'
type Body = Components['body']
type Res = {b: Body; done: Task | null}
type Prog = (c: Ctx, w: World, b: Body) => Res
type Of<K extends Task['do']> = Extract<Task, {do: K}>
const finish = (b: Body): Body => ({...b, task: b.backlog[0] ?? null, backlog: b.backlog.slice(1)})
const walk: Prog = (c, _w, b) => {
  const t = b.task as Of<'move'>
  const d = Math.hypot(t.x - b.x, t.y - b.y)
  const k = d <= b.speed * c.dt ? 1 : (b.speed * c.dt) / d
  const at = {...b, x: b.x + (t.x - b.x) * k, y: b.y + (t.y - b.y) * k}
  return k >= 1 ? {b: finish(at), done: t} : {b: at, done: null}
}
const pause: Prog = (c, _w, b) => {
  const t = b.task as Of<'wait'>
  return t.sec - c.dt <= 0 ? {b: finish(b), done: t} : {b: {...b, task: {do: 'wait', sec: t.sec - c.dt}}, done: null}
}
const act: Prog = (_c, _w, b) => ({b: finish(b), done: b.task}) // staff actions complete the moment they come up
const hold: Prog = (_c, _w, b) => ({b, done: null}) // a guest's passive task: someone else completes it
const awaiting: Prog = (_c, w, b) => ({b: phase(w, b.party) === 'seated' ? b : finish(b), done: null}) // unserved guest whose turn ran out just gives up waiting
const idle: Prog = (_c, _w, b) => ({b, done: null})
const staff = {move: walk, wait: pause, seat: act, serve: act, clear: act}
const prog: Record<Body['role'], Record<Task['do'], Prog>> = {host: staff, server: staff, busser: staff, guest: {move: walk, wait: pause, seat: hold, serve: awaiting, clear: hold}}
/** Advance the unit's current task by dt: bodies walk, waits count down, staff actions fire, guests hold. */
export const progress: Stage = (c, id, a) => {
  const b = bodyOf(a, id)
  const r = b && (b.task ? prog[b.role][b.task.do] : idle)(c, a.w, b)
  return r ? {...(r.b === b ? a : emit(a, [set(id, {body: r.b})])), done: r.done} : a
}
