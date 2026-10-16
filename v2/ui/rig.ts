// Test rig: a mounted app with a small fake sim engine (contract-typed) plus the real desk (`act`, `stand`), so every write goes through the one seam.
import {having} from '../contracts/index.ts'
import type {App as AppT, Engine, HostEngine, SimOut, State} from '../contracts/index.ts'
import {App} from '../kernel/index.ts'
import {act, stand} from '../engine/index.ts'
import {dom} from '../test/dom.ts'
import {ui} from './index.ts'
import {party} from './party.ts'
const free = (w: Parameters<Engine['fit']>[1], size: number) => having(w, 'table').find(t => t.table.status === 'available' && t.table.capacity >= size)
export const fake = (script: SimOut[] = []): Partial<HostEngine> => ({
  fit: (_p, w, now, sizes) => sizes.map(size => {
    const t = free(w, size)
    return {size, spot: t?.id ?? null, tables: t ? [t.id] : [], label: t?.table.label ?? '-', waitMin: 0, at: now, code: t ? 'HOT_GREEN' : 'NO_TABLE', ready: !!t}
  }),
  tick: () => script.shift() ?? {patches: [], events: []},
  spawn: (_p, _w, _n, seed) => [
    {op: 'add', ent: party(200 + seed, 'W', 2, `g${seed}`, {queue: {since: 0, quotedMin: 5, status: 'WAITING', from: null}})},
    {op: 'add', ent: {id: `g${seed}`, body: {role: 'guest', x: 24, y: 260, speed: 80, task: null, backlog: [], party: `p${200 + seed}`}}},
  ],
  seat: (_p, w, _n, req) => {
    const t = free(w, req.size)
    return t ? {ok: true, msg: `Seated ${req.size} at ${t.table.label}`, tone: 'ok', patches: [{op: 'set', id: t.id, parts: {table: {...t.table, status: 'occupied'}}}]} : {ok: false, err: 'no table'}
  },
  eta: (_p, _w, _n, size) => ({size, ahead: 0, ready: false, none: false, waitMin: 12, lo: 10, hi: 15, label: '12m', at: null}),
  rotate: (_p, w) => having(w, 'staff').map(s => ({staff: s.id, score: -s.staff.tally})),
  alerts: () => [{kind: 'late', ref: 'p1', level: 'warn', msg: 'Party late'}],
  bus: () => [], reconcile: () => [],
  act, stand,
})
export const seed = (): State => ({now: 0, ui: {size: 2, pick: '', tone: ''}, world: {nextParty: 1, ents: {}}})
export const rig = (script: SimOut[] = []) => {
  const el = dom().getElementById('app')!
  const app: AppT = App.create(seed()).use(a => a.provide('engine', fake(script) as Engine)).use(ui)
  app.mount(el)
  return {el, app}
}
export const click = (el: Element, sel: string) => el.querySelector<HTMLElement>(sel)!.click()
