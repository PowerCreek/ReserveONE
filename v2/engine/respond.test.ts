import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity, World} from '../contracts/index.ts'
import {asking, room, tagged} from './askkit.ts'
import {apply} from './patch.ts'
import {respond, settle} from './respond.ts'
import {N, P, mins, party, world} from './testkit.ts'
const blunt = {...P, host: {...P.host, options: {'*': [...P.host.options['*'], 'refuse'], accessibility: ['refuse']}}} // the default rows never offer refuse
const say = (w: World, reason: string, response: string) => respond(blunt, asking(w, reason), N, 'pty1', response)
test('respond: draft at arrival, swap moves the party and lifts mood by base x urgency x stage', () => {
  const w = asking(room(), 'draft')
  const r = respond(P, w, N, 'pty1', 'swap')
  assert.deepEqual([r.move, r.mood, r.says], ['swap', 1.5, 'Wonderful, thank you for moving us.'])
  assert.deepEqual(r.events, [
    {ev: 'replied', party: 'pty1', reason: 'draft', response: 'swap', move: 'swap', mood: 1.5},
    {ev: 'moved', party: 'pty1', from: 'd1', to: 'a1'},
    {ev: 'mood', party: 'pty1', delta: 1.5, why: 'draft'},
  ])
  const after = apply(w, r.patches)
  assert.deepEqual([after.ents.pty1.request?.status, after.ents.pty1.request?.table, after.ents.pty1.offer?.spot, after.ents.pty1.mood], ['granted', 'a1', 'a1', {score: 1.5}])
  assert.deepEqual([after.ents.pty1.lease, after.ents.d1.table?.status, after.ents.a1.table?.status], [{...w.ents.pty1.lease, spot: 'a1', tables: ['a1']}, 'available', 'leased']) // the lease moves with the party
})
test('respond: seated swap moves the slot, frees the old table and occupies the new one with the same server', () => {
  const r = say(room('seated'), 'draft', 'swap')
  assert.equal(r.mood, 2.25) // 3 x 0.5 x 1.5
  const after = apply(asking(room('seated'), 'draft'), r.patches)
  assert.deepEqual([after.ents.s1.slot?.table, after.ents.d1.table?.status, after.ents.d1.table?.waiter, after.ents.a1.table?.status, after.ents.a1.table?.waiter], ['a1', 'available', null, 'occupied', 'w1'])
})
test('respond: refuse lowers mood by reason urgency and stage; accessibility is the most urgent', () => {
  const lose = (reason: string, stage: 'arrived' | 'seated') => say(room(stage), reason, 'refuse').mood
  assert.deepEqual([lose('draft', 'arrived'), lose('noise', 'arrived'), lose('mood', 'arrived')], [-2, -2, -1])
  assert.equal(lose('draft', 'seated'), -3)
  assert.equal(lose('accessibility', 'arrived'), -4)
  assert.equal(lose('accessibility', 'seated'), -6)
  const urg = Object.entries(P.host.reasons).sort((a, b) => b[1].urgency - a[1].urgency)[0][0]
  assert.equal(urg, 'accessibility')
})
test('respond: refuse closes the request declined and logs replied + mood (no move)', () => {
  const w = asking(room(), 'noise')
  const r = respond(P, w, N, 'pty1', 'explain')
  assert.deepEqual([r.move, r.mood], ['stay', -1]) // a quiet spot exists, explaining anyway costs -2 x 0.5
  assert.equal(apply(w, r.patches).ents.pty1.request?.status, 'declined')
  const none = {...w, ents: {...w.ents, q1: tagged('q1', 2, ['quiet'], 'occupied')}}
  const calm = respond(P, none, N, 'pty1', 'explain')
  assert.deepEqual([calm.mood, calm.events.map(e => e.ev)], [0, ['replied']])
})
test('respond: no spot -> then.none; swap with nothing free scolds, hold and offer record a pending spot', () => {
  const w = room()
  const busy = {...w, ents: {...w.ents, q1: tagged('q1', 2, ['quiet'], 'occupied')}}
  const sw = respond(P, asking(busy, 'noise'), N, 'pty1', 'swap')
  assert.deepEqual([sw.move, sw.mood], ['stay', -1.5])
  const hold = respond(P, asking(busy, 'noise'), N, 'pty1', 'hold')
  assert.deepEqual([hold.move, hold.mood], ['offer', 0])
  const w2 = apply(asking(busy, 'noise'), hold.patches)
  assert.deepEqual([w2.ents.pty1.request?.status, w2.ents.pty1.request?.spot], ['offered', 'q1'])
})
test('respond: a response not offered for the reason, or without a request, does nothing', () => {
  const w = asking(room(), 'accessibility')
  assert.deepEqual(respond(P, w, N, 'pty1', 'hold'), {patches: [], events: [], move: 'stay', mood: 0, says: ''})
  assert.deepEqual(respond(P, room(), N, 'pty1', 'swap').patches, [])
})
const queued = (num: number, kind: 'W' | 'R', ago: number, extra: Partial<Entity> = {}) =>
  party(num, kind, 2, `G${num}`, {queue: {since: N - mins(ago), quotedMin: 10, status: 'WAITING', from: null}, body: {role: 'guest', x: 0, y: 0, speed: 1, task: null, backlog: [], party: `pty${num}`}, ...extra})
test('settle: a party past patience leaves the list (left, body and queue stripped); the rest stay', () => {
  const w = world([queued(1, 'W', 26), queued(2, 'W', 24), queued(3, 'R', 11)])
  const r = settle(P, w, N)
  assert.deepEqual(r.events, [{ev: 'left', party: 'pty1'}, {ev: 'left', party: 'pty3'}])
  const after = apply(w, r.patches)
  assert.deepEqual([after.ents.pty1.body, after.ents.pty1.queue, after.ents.pty1.party?.name, after.ents.pty2.queue?.status], [undefined, undefined, 'G1', 'WAITING'])
})
test('settle: a lapsed ladder offer is answered no; a decline leaves the list when patience cannot outlast another answer window', () => {
  const offer = (at: number) => ({spot: 'q1', step: 'near', gives: [], lacks: [], at: N - mins(at), status: 'open' as const})
  const w = world([queued(1, 'W', 10, {offer: offer(2)}), queued(2, 'W', 10, {offer: offer(4)}), queued(3, 'W', 23, {offer: offer(4)})])
  const r = settle(P, w, N)
  assert.deepEqual(r.events, [{ev: 'answered', party: 'pty2', spot: 'q1', yes: false}, {ev: 'answered', party: 'pty3', spot: 'q1', yes: false}, {ev: 'left', party: 'pty3'}])
  assert.equal(apply(w, r.patches).ents.pty2.offer?.status, 'lapsed')
})
test('settle: an open offer whose party runs out of patience is declined on the way out', () => {
  const w = world([queued(1, 'W', 26, {offer: {spot: 'q1', step: 'near', gives: [], lacks: [], at: N - mins(1), status: 'open'}})])
  assert.deepEqual(settle(P, w, N).events, [{ev: 'answered', party: 'pty1', spot: 'q1', yes: false}, {ev: 'left', party: 'pty1'}])
})
test('settle: a request ignored past the reseat window is declined with a mood hit; an offered free spot is taken', () => {
  const w = asking(room(), 'draft')
  assert.deepEqual(settle(P, w, N + mins(9)).events, [])
  const late = settle(P, w, N + mins(10))
  assert.deepEqual(late.events, [{ev: 'mood', party: 'pty1', delta: -1.5, why: 'draft'}, {ev: 'seated', party: 'pty1', table: 'd1', by: 'host'}]) // the concern closed: the lease, past its time, settles
  assert.equal(apply(w, late.patches).ents.pty1.request?.status, 'declined')
  const off = apply(w, respond(P, w, N, 'pty1', 'offer').patches)
  const took = settle(P, off, N + mins(1))
  assert.deepEqual(took.events.map(e => e.ev), ['answered', 'moved'])
  assert.equal(apply(off, took.patches).ents.pty1.request?.status, 'granted')
})
test('settle: an offered spot that was taken is refused; a need-level reason refuses a partial fit', () => {
  const w = asking(room(), 'noise')
  const off = apply(w, respond(P, w, N, 'pty1', 'offer').patches)
  const gone = {...off, ents: {...off.ents, q1: tagged('q1', 2, ['quiet'], 'occupied')}}
  assert.deepEqual(settle(P, gone, N).events, []) // still inside the window: keep waiting
  assert.deepEqual(settle(P, gone, N + mins(10)).events, [{ev: 'answered', party: 'pty1', spot: 'q1', yes: false}, {ev: 'seated', party: 'pty1', table: 'd1', by: 'host'}])
})
