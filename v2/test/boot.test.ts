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
test('the built page boots in jsdom without errors and renders the floor with all 66 tables', async () => {
  const errs: unknown[] = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', e => errs.push(e)).on('error', e => errs.push(e))
  const win = new JSDOM(fs.readFileSync(DIST, 'utf8'), {runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole}).window
  await settle()
  await settle()
  win.addEventListener('error', e => errs.push(e.error))
  assert.deepEqual(errs, [])
  const svg = win.document.querySelector('[data-floor] svg')!
  assert.ok(svg, 'floor svg rendered')
  assert.equal([...svg.querySelectorAll('title')].filter(t => / cap \d+ available$/.test(t.textContent!)).length, 66)
  win.close()
})
test('seed: 4 floors, 66 unsectioned tables inside the policy floor, ids equal keys, plus the door', () => {
  const w = seed().world
  const [fw, fh] = defaultPolicy.sim.floor
  assert.equal(having(w, 'floor').length, 4)
  assert.equal(having(w, 'table', 'pos').length, 66)
  assert.ok(Object.entries(w.ents).every(([k, e]) => e.id === k))
  assert.ok(having(w, 'table').every(t => t.table.section === null && t.table.status === 'available'))
  assert.ok(having(w, 'table', 'pos').every(t => t.pos.x + t.pos.w <= fw && t.pos.y + t.pos.h <= fh))
  assert.equal(having(w, 'section').length, 0)
  assert.deepEqual([w.ents.door.pos!.x, w.ents.door.pos!.y], defaultPolicy.sim.door)
})
