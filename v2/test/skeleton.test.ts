import test from 'node:test'
import assert from 'node:assert/strict'
import {dom, settle} from './dom.ts'
import {start} from '../main.ts'
test('click -> store -> engine.fit -> DOM text + tailwind class', async () => {
  const el = dom().getElementById('app')!
  const app = start(el)
  await settle()
  const pick = el.querySelector('[data-text="ui.pick"]')!
  assert.equal(pick.textContent, 'T2')
  el.querySelector<HTMLElement>('[data-act="more"]')!.click() // size 3 -> tightest fit is T4
  await settle()
  assert.equal(app.store.state.ui.pick, 'T4')
  assert.equal(pick.textContent, 'T4')
  assert.match(pick.className, /bg-emerald-600/)
})
