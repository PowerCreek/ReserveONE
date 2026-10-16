import test from 'node:test'
import assert from 'node:assert/strict'
import {asking, room, tagged} from './askkit.ts'
import {options} from './options.ts'
import {N, P, party} from './testkit.ts'
test('options: nothing without an open request', () => assert.deepEqual(options(P, room(), N, 'pty1'), []))
test('options: per reason, falling back to "*"; each carries label, filled host script and spot', () => {
  const os = options(P, asking(room(), 'draft'), N, 'pty1')
  assert.deepEqual(os.map(o => o.response), ['swap', 'offer', 'hold', 'explain', 'refuse'])
  const swap = os[0]
  assert.equal(swap.label, 'Move them')
  assert.deepEqual([swap.spot, swap.say], ['a1', 'Let me move you to A1.']) // tightest fit, ties by id
})
test('options: accessibility only swap and offer, and only an accessible spot qualifies', () => {
  const os = options(P, asking(room(), 'accessibility'), N, 'pty1')
  assert.deepEqual(os.map(o => [o.response, o.spot]), [['swap', 'a1'], ['offer', 'a1'], ['refuse', null]])
})
test('options: explain names no spot; hold targets the busy spot that frees first; no spot reads "another table"', () => {
  const w = room()
  const busy = {...w, ents: {...w.ents, a1: tagged('a1', 2, ['accessible'], 'occupied')}}
  const os = options(P, asking(busy, 'accessibility'), N, 'pty1')
  assert.deepEqual(os.map(o => [o.response, o.spot, o.say]), [['swap', null, 'Let me move you to another table.'], ['offer', null, 'The closest I have is another table: shall we try it?'], ['refuse', null, 'I am afraid that is not possible.']])
  const draft = options(P, asking(busy, 'draft'), N, 'pty1')
  assert.equal(draft.find(o => o.response === 'explain')?.spot, null)
  assert.equal(draft.find(o => o.response === 'hold')?.spot, 'a1')
})
test('options: too-small and claimed spots are skipped', () => {
  const w = room()
  const big = {...w, ents: {...w.ents, pty1: {...w.ents.pty1, party: {...w.ents.pty1.party!, size: 4}}}}
  assert.equal(options(P, asking(big, 'draft'), N, 'pty1')[0].spot, 'l1')
  const taken = {...w, ents: {...w.ents, pty2: party(2, 'W', 2, 'Chen', {offer: {spot: 'q1', step: 'exact', gives: [], lacks: [], at: N, status: 'open'}})}}
  assert.equal(options(P, asking(taken, 'noise'), N, 'pty1')[0].spot, null)
})
