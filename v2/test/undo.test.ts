import test from 'node:test'
import assert from 'node:assert/strict'
import {having} from '../contracts/index.ts'
import {dom, settle} from './dom.ts'
import {start} from '../main.ts'
const busy = (app: ReturnType<typeof start>) => having(app.store.state.world, 'table').filter(t => t.table.status !== 'available').length
test('a manual seat is one undoable step: undo restores the world, redo re-applies it', async () => {
  const el = dom().getElementById('app')!
  const app = start(el)
  await settle()
  const before = JSON.stringify(app.store.state.world)
  el.querySelector<HTMLElement>('[data-act="quick"]')!.click() // seat a 2-top now
  const after = JSON.stringify(app.store.state.world)
  assert.equal(busy(app), 1)
  assert.equal(having(app.store.state.world, 'slot').length, 1)
  el.querySelector<HTMLElement>('[data-act="undo"]')!.click()
  assert.equal(JSON.stringify(app.store.state.world), before)
  assert.equal(busy(app), 0)
  el.querySelector<HTMLElement>('[data-act="redo"]')!.click()
  assert.equal(JSON.stringify(app.store.state.world), after)
})
