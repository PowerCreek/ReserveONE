import test from 'node:test'
import assert from 'node:assert/strict'
import {ask, askedEvent, where} from './ask.ts'
import {apply} from './patch.ts'
import {asking, room} from './askkit.ts'
import {N, P, party, world} from './testkit.ts'
test('ask: refused until the party was led, then writes an open request with the stage and table', () => {
  const w = room()
  const bare = world([party(1, 'W', 2)])
  assert.deepEqual(ask(P, bare, N, 'pty1', 'draft'), {ok: false, err: 'party has not been led to a table'})
  const r = ask(P, w, N, 'pty1', 'draft')
  assert.ok(r.ok)
  const w2 = apply(w, r.ok ? r.patches : [])
  assert.deepEqual(w2.ents.pty1.request, {reason: 'draft', stage: 'arrived', table: 'd1', at: N, status: 'open', spot: null})
  assert.deepEqual(askedEvent(w2, 'pty1'), [{ev: 'asked', party: 'pty1', reason: 'draft', stage: 'arrived'}])
})
test('ask: stage comes from the slot (seated) and reasons whose stages exclude it are refused', () => {
  const w = room('seated')
  assert.deepEqual(where(w, 'pty1'), {table: 'd1', stage: 'seated'})
  assert.equal(ask(P, w, N, 'pty1', 'view').ok, false)
  assert.equal(ask(P, w, N, 'pty1', 'noise').ok, true)
})
test('ask: unknown party or reason, and a second request while one is open, are refused', () => {
  const w = room()
  assert.equal(ask(P, w, N, 'nobody', 'draft').ok, false)
  assert.deepEqual(ask(P, w, N, 'pty1', 'tea'), {ok: false, err: 'unknown reason tea'})
  const open = asking(w, 'draft')
  assert.deepEqual(ask(P, open, N, 'pty1', 'noise'), {ok: false, err: 'party is already waiting for an answer'})
})
