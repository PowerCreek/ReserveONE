import test from 'node:test'
import assert from 'node:assert/strict'
import type {Board, Desk, HostEngine} from '../contracts/index.ts'
import {real} from '../test/real.ts'
import {settle} from '../test/dom.ts'
import {run} from './act.ts'
import {TONE} from './board.ts'
import {load, step, uiOf} from './index.ts'
import {click} from './rig.ts'
/** Real engine, Friday rush: four walk-ins seated, 40 sim minutes pass, two more seated; every board call is counted. */
const busy = () => {
  const {el, app} = real()
  const calls: Board[] = []
  const board = (app.services.engine as HostEngine).board!
  app.provide('engine', {board: (...a: Parameters<Desk['board']>) => (calls.push(board(...a)), calls.at(-1)!)} as never)
  load(app, 'rush')
  uiOf(app).rate = 0 // the preset's arrivals off: a long queue only slows the steps
  ;[2, 4, 2, 3].forEach(size => run(app, {do: 'seat', size}))
  Array.from({length: 40}, () => step(app, 60000))
  ;[2, 2].forEach(size => run(app, {do: 'seat', size}))
  return {el, app, calls}
}
const open = async (el: Element) => (await settle(), click(el, '[data-act="tab"][data-id="board"]'), await settle())
const tap = (el: Element, sel: string) => el.querySelector(sel)!.dispatchEvent(new (el.ownerDocument.defaultView!.MouseEvent)('click', {bubbles: true}))
const rows = (el: Element) => [...el.querySelectorAll('[data-turnover] tbody tr')].map(r => r.textContent)
const picked = (el: Element) => [...el.querySelectorAll('[data-picked]')]
test('the Dashboard tab renders every section from one board call per repaint', async () => {
  const {el, app, calls} = busy()
  await settle()
  calls.length = 0
  uiOf(app).rev++
  await open(el)
  assert.equal(calls.length, 1)
  const b = calls[0]
  assert.equal(el.querySelectorAll('[data-bkpis] [data-kpi]').length, b.kpis.length)
  assert.equal(el.querySelectorAll('[data-glabels] [data-tid]').length, b.gantt.lanes.length)
  assert.ok(el.querySelector('[data-gtrack] svg g[data-tid="t1"] rect'), 'a bar for the seated T1')
  assert.equal(rows(el).length, b.turnover.length)
  assert.equal(el.querySelectorAll('[data-quotes] [data-quote]').length, b.quotes.length)
  assert.equal(el.querySelectorAll('[data-ledger] [data-tid]').length, Object.values(b.ledger).flat().length)
  assert.match(el.querySelector('[data-activity]')!.textContent!, /T1\+2/)
  assert.equal(el.querySelectorAll('[data-servers] [data-server]').length, b.servers.length)
  assert.ok(el.querySelector('[data-buslist]'))
})
test('the Sim tab carries the KPI strip compactly; KPI tones map to classes', async () => {
  const {el, calls} = busy()
  await settle()
  const sim = [...el.querySelectorAll<HTMLElement>('[data-kpis] [data-kpi]')]
  assert.equal(sim.length, calls.at(-1)!.kpis.length)
  await open(el)
  const tones = calls.at(-1)!.kpis
  tones.forEach(k => {
    const card = el.querySelector(`[data-bkpis] [data-kpi="${k.id}"]`)!
    assert.equal(card.getAttribute('data-tone'), k.tone)
    TONE[k.tone].split(' ').forEach(c => assert.ok(card.classList.contains(c), `${k.id} ${k.tone} has ${c}`))
  })
  assert.ok(tones.some(k => k.tone === 'warn'), 'the rush has a warning kpi')
})
test('interval chips change the turnover rows and the window presets widen the timeline', async () => {
  const {el} = busy()
  await open(el)
  const before = rows(el)
  const ticks = () => el.querySelectorAll('[data-gtrack] svg > g:not([data-act])').length
  click(el, '[data-act="biv"][data-v="30"]')
  await settle()
  assert.notDeepEqual(rows(el), before)
  assert.match(rows(el)[0]!, /^\d\d:(00|30)–\d\d:(00|30)/)
  assert.equal(el.querySelector('[data-act="biv"][data-v="30"]')!.getAttribute('aria-pressed'), 'true')
  const at3h = ticks()
  click(el, '[data-act="bwin"][data-v="360"]')
  await settle()
  assert.ok(ticks() > at3h, `6h ahead holds more 30m ticks than 3h (${ticks()} vs ${at3h})`)
})
test('a table pick highlights its chip, bar and server everywhere; a second click or Escape clears it', async () => {
  const {el, app} = busy()
  await open(el)
  tap(el, '[data-gtrack] g[data-tid="t1"]')
  await settle()
  assert.equal(uiOf(app).board.pick, 't1')
  const tids = picked(el).map(e => e.getAttribute('data-tid') ?? e.getAttribute('data-server'))
  assert.ok(el.querySelector('[data-ledger] [data-tid="t1"][data-picked]'), 'ledger chip')
  assert.ok(el.querySelector('[data-gtrack] g[data-tid="t1"][data-picked]'), 'gantt bar')
  assert.ok(el.querySelector('[data-glabels] [data-tid="t1"][data-picked]'), 'lane label')
  assert.ok(el.querySelector(`[data-server="${app.store.state.world.ents.t1.table!.waiter}"][data-picked]`), 'its server')
  assert.ok(tids.every(t => t === 't1' || t === app.store.state.world.ents.t1.table!.waiter), tids.join())
  click(el, '[data-ledger] [data-tid="t1"]')
  await settle()
  assert.equal(picked(el).length, 0)
  click(el, '[data-ledger] [data-tid="t3"]')
  el.ownerDocument.dispatchEvent(new (el.ownerDocument.defaultView!.KeyboardEvent)('keydown', {key: 'Escape'}))
  await settle()
  assert.equal(uiOf(app).board.pick, '')
})
