import test from 'node:test'
import assert from 'node:assert/strict'
import {dom, settle} from '../test/dom.ts'
import {panel} from './render.ts'
import type {App} from '../contracts/index.ts'
test('a repaint morphs: the pressed button keeps its node, only its changed text moves; paints wait for the release', async () => {
  const d = dom()
  let n = 0
  const p = panel({} as App, 'data-x', () => `<p>left ${n}m</p><button data-act="go">Seat now</button>${n > 1 ? '<i>late</i>' : ''}`)
  const el = d.createElement('div')
  d.body.appendChild(el)
  const paint = async () => (p.apply(el, ''), await settle())
  await paint()
  const btn = el.querySelector('button')!
  n = 1
  await paint()
  assert.equal(el.querySelector('button'), btn)
  assert.equal(el.querySelector('p')!.textContent, 'left 1m')
  btn.dispatchEvent(new (d.defaultView as any).Event('pointerdown', {bubbles: true}))
  n = 2
  await paint()
  assert.equal(el.querySelector('i'), null, 'held while pressed')
  d.dispatchEvent(new (d.defaultView as any).Event('pointerup'))
  await settle()
  await settle()
  assert.equal(el.querySelector('i')!.textContent, 'late')
  assert.equal(el.querySelector('button'), btn)
})
