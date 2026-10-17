import test, {before} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import {JSDOM, VirtualConsole} from 'jsdom'
import {defaultPolicy, having} from '../contracts/index.ts'
import {seed} from '../main.ts'
import {settle} from './dom.ts'
const DIST = 'dist/v2.html'
before(() => void execFileSync('node', ['v2/build.mjs'], {stdio: 'pipe'})) // the test owns its artifact: boot what the build really emits
const avail = (doc: Document) => [...doc.querySelectorAll('[data-floor] svg title')].filter(t => / cap \d+ available/.test(t.textContent!)).length
test('the built page boots in jsdom without errors, shows the selected floor, then all 76 tables via the floor tabs, and a party waits at the door', async () => {
  const errs: unknown[] = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', e => errs.push(e)).on('error', e => errs.push(e))
  const win = new JSDOM(fs.readFileSync(DIST, 'utf8'), {runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole}).window
  await settle()
  await settle()
  win.addEventListener('error', e => errs.push(e.error))
  assert.deepEqual(errs, [])
  const doc = win.document
  const w = seed().world
  const per = having(w, 'floor').map(f => [f.id, having(w, 'table', 'pos').filter(t => t.pos.floor === f.id && t.table.status === 'available').length] as const)
  assert.ok(doc.querySelector('[data-floor] svg'), 'floor svg rendered')
  assert.equal(avail(doc), per[0][1], 'the first floor alone is on show')
  const shown = await per.reduce<Promise<number[]>>(async (acc, [id]) => {
    const seen = await acc
    doc.querySelector<HTMLElement>(`[data-floors] [data-act="floor"][data-id="${id}"]`)!.click()
    await settle()
    return [...seen, avail(doc)]
  }, Promise.resolve([]))
  assert.deepEqual(shown, per.map(([, n]) => n))
  assert.equal(shown.reduce((a, b) => a + b, 0), 75) // B22 (the managers' desk) is never offered
  assert.match(doc.querySelector('[data-stand]')!.textContent!, /At the door[\s\S]*Lease .+ to .+ party/)
  win.close()
})
test('seed: 4 floors, 76 held and featured tables inside the policy floor, a host, 4 servers, 2 bartender pairs and a busser, ids equal keys, plus the door and the service entity', () => {
  const w = seed().world
  const [fw, fh] = defaultPolicy.sim.floor
  assert.equal(having(w, 'floor').length, 4)
  assert.equal(having(w, "table", "pos").length, 76)
  assert.ok(Object.entries(w.ents).every(([k, e]) => e.id === k))
  assert.ok(having(w, 'table').every(t => (t.table.status === 'available' || t.id === 'rf_b22') && (w.ents[t.id].feat?.tags.length ?? 0) > 0))
  assert.ok(having(w, 'table').every(t => t.table.section !== null || w.ents[t.id].assign || ['bar', 'roof'].includes(w.ents[t.id].area?.id ?? '')), 'every table has a holder: section, dealt top, or area pair')
  assert.ok(having(w, 'table', 'pos').every(t => t.pos.x + t.pos.w <= fw && t.pos.y + t.pos.h <= fh))
  assert.deepEqual(having(w, 'section').map(s => s.id), ['sec_m1', 'sec_m2', 'sec_m3', 'sec_m4', 'sec_grotto'])
  assert.deepEqual(having(w, 'body').map(b => b.body.role).sort(), ['busser', 'host', ...Array(6).fill('server')])
  assert.ok(having(w, 'table').every(t => !t.table.section || w.ents[t.table.section]?.section), 'a table section is a declared section')
  assert.deepEqual(w.ents.service.service, {override: null, carve: {main: 'chunk', grotto: 'whole', patio: 'tops', bar: 'level', roof: 'level'}})
  assert.deepEqual([w.ents.door.pos!.x, w.ents.door.pos!.y], defaultPolicy.sim.door)
})
