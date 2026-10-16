import test from 'node:test'
import assert from 'node:assert/strict'
import type {Cmd, Entity, Outcome, World} from '../contracts/index.ts'
import {act, apply, stand} from './index.ts'
import {N, P, demo, mins, party, staff, table, world} from './testkit.ts'
import {busy, guest, room, tbl, want} from './mkit.ts'
import {asking, room as led} from './askkit.ts'
const host: Entity = {id: 'host', body: {role: 'host', x: 0, y: 0, speed: 80, task: null, backlog: [], party: null}}
const queued = (e: Entity): Entity => ({...e, queue: {since: N - mins(5), quotedMin: 10, status: 'WAITING', from: null}})
const run = (w: World, cmd: Cmd) => act(P, w, N, cmd)
const ok = (o: Outcome) => { assert.ok(o.ok, o.ok ? '' : o.err); return o as Extract<Outcome, {ok: true}> }
const after = (w: World, cmd: Cmd) => apply(w, ok(run(w, cmd)).patches)
const err = (w: World, cmd: Cmd) => { const o = run(w, cmd); return o.ok ? 'ok' : o.err }
const booth = () => room(queued(guest([want('booth')])), tbl('a', 2, ['booth']), tbl('b', 2), host, staff('w1', 0, 5))
test('act seat: one step seats the party, records the offer accepted with the rung gives/lacks, occupies its tables', () => {
  const w = booth()
  const o = ok(run(w, {do: 'seat', party: 'pty1', spot: 'a', step: 'exact'}))
  assert.deepEqual(o.events, [{ev: 'seated', party: 'pty1', table: 'a', by: 'host'}])
  const w1 = apply(w, o.patches)
  assert.deepEqual(w1.ents.pty1.offer, {spot: 'a', step: 'exact', gives: ['booth'], lacks: [], at: N, status: 'accepted'})
  assert.deepEqual([w1.ents.a.table?.status, w1.ents.pty1.queue?.status], ['occupied', 'SEATED'])
  assert.ok(Object.values(w1.ents).some(e => e.slot?.party === 'pty1' && e.slot.table === 'a' && e.slot.status === 'ACTIVE'))
  assert.deepEqual(stand(P, w1, N).door, [])
})
test('act seat: no spot = the best ready spot; a step alone aims at its rung; no party = a fresh walk-in', () => {
  assert.deepEqual(ok(run(booth(), {do: 'seat', party: 'pty1'})).events.map(e => 'table' in e && e.table), ['a'])
  assert.equal(apply(booth(), ok(run(booth(), {do: 'seat', party: 'pty1', step: 'exact'})).patches).ents.pty1.offer?.spot, 'a')
  const o = ok(run(booth(), {do: 'seat', size: 2}))
  const e = o.events[0] as {party: string}
  assert.notEqual(e.party, 'pty1')
  assert.equal(apply(booth(), o.patches).ents[e.party].party?.kind, 'W')
})
test('act seat: a sim host already walking the party drops the trip (seated is narrated once)', () => {
  const w = {...booth(), ents: {...booth().ents, host: {...host, body: {...host.body!, task: {do: 'move' as const, x: 1, y: 1}, backlog: [{do: 'seat' as const, party: 'pty1', table: 'b'}]}}}}
  assert.deepEqual(after(w, {do: 'seat', party: 'pty1', spot: 'a'}).ents.host.body?.backlog, [])
})
test('act seat: refuses an unknown party, a missing size, an unknown spot and an occupied table', () => {
  assert.equal(err(booth(), {do: 'seat', party: 'nope'}), 'No party nope')
  assert.match(err(booth(), {do: 'seat'}), /needs a size/)
  assert.equal(err(booth(), {do: 'seat', party: 'pty1', spot: 'zz'}), 'No spot zz')
  assert.match(err(room(queued(guest([])), busy(tbl('a', 2), 30)), {do: 'seat', party: 'pty1', spot: 'a'}), /occupied/)
})
// ---- lease: the stand places a party by leasing it a spot (one click); Seat now confirms, Release hands it back
const walker = (e: Entity): Entity => ({...e, body: {role: 'guest', x: 0, y: 0, speed: 80, task: null, backlog: [], party: e.id}})
const lease = (w: World, spot = 'a', step = 'exact') => after(w, {do: 'lease', party: 'pty1', spot, step})
test('act lease: the spot is leased to the party (server recorded), the offer accepted from the rung, the guest walks there; the door drops it', () => {
  const w = {...booth(), ents: {...booth().ents, pty1: walker(booth().ents.pty1)}}
  const o = ok(run(w, {do: 'lease', party: 'pty1', spot: 'a', step: 'exact'}))
  assert.deepEqual([o.events, o.msg], [[{ev: 'leased', party: 'pty1', spot: 'a', by: 'host'}], 'HS-W-1 leased A'])
  const w1 = apply(w, o.patches)
  assert.deepEqual(w1.ents.pty1.lease, {spot: 'a', tables: ['a'], at: N, until: N + mins(P.host.clock.leaseMin), step: 'exact'})
  assert.deepEqual([w1.ents.a.table?.status, w1.ents.a.table?.waiter, w1.ents.pty1.queue?.status], ['leased', 'w1', 'WAITING'])
  assert.deepEqual(w1.ents.pty1.offer, {spot: 'a', step: 'exact', gives: ['booth'], lacks: [], at: N, status: 'accepted'})
  assert.deepEqual([w1.ents.pty1.body?.task, w1.ents.pty1.body?.backlog], [{do: 'move', x: 40, y: 40}, []])
  assert.ok(!Object.values(w1.ents).some(e => e.slot))
  assert.deepEqual([stand(P, w1, N).door, stand(P, w1, N).leased], [[], [{party: 'pty1', spot: 'a', tables: ['a'], at: N, until: N + mins(2), concern: false}]])
})
test('act lease: refuses an unknown party, a party already led, an unknown spot and a spot leased to another party', () => {
  assert.equal(err(booth(), {do: 'lease', party: 'nope', spot: 'a', step: 'exact'}), 'No party nope')
  assert.match(err(lease(booth()), {do: 'lease', party: 'pty1', spot: 'b', step: 'exact'}), /already led/)
  assert.equal(err(booth(), {do: 'lease', party: 'pty1', spot: 'zz', step: 'exact'}), 'No spot zz')
  const two = apply(lease(booth()), [{op: 'add', ent: queued(party(2, 'W', 2, 'Ortiz'))}])
  assert.equal(err(two, {do: 'lease', party: 'pty2', spot: 'a', step: 'exact'}), 'A is leased to another party')
})
test('act release: the tables free, the lease goes, the spot joins offer.declined, released narrated; the party is back at the door with the next offer', () => {
  const w1 = lease(booth())
  const o = ok(run(w1, {do: 'release', party: 'pty1'}))
  assert.deepEqual(o.events, [{ev: 'released', party: 'pty1', spot: 'a', by: 'host'}])
  const w2 = apply(w1, o.patches)
  assert.deepEqual(['lease' in w2.ents.pty1, w2.ents.a.table?.status, w2.ents.a.table?.waiter], [false, 'available', null])
  assert.deepEqual([w2.ents.pty1.offer?.status, w2.ents.pty1.offer?.declined], ['declined', ['a']])
  assert.deepEqual([stand(P, w2, N).door.map(r => r.party), stand(P, w2, N).offers.some(o => o.spot === 'a')], [['pty1'], false])
  assert.match(err(w2, {do: 'release', party: 'pty1'}), /holds no lease/)
})
test('act seat on a leased party: Seat now confirms the lease on its own tables with the recorded server; the lease is gone', () => {
  const w1 = lease(booth())
  const o = ok(run(w1, {do: 'seat', party: 'pty1', spot: 'b'}))
  assert.deepEqual(o.events, [{ev: 'seated', party: 'pty1', table: 'a', by: 'host'}])
  const w2 = apply(w1, o.patches)
  assert.deepEqual(['lease' in w2.ents.pty1, w2.ents.a.table?.status, w2.ents.a.table?.waiter, w2.ents.b.table?.status, w2.ents.pty1.queue?.status], [false, 'occupied', 'w1', 'available', 'SEATED'])
  assert.ok(Object.values(w2.ents).some(e => e.slot?.party === 'pty1' && e.slot.table === 'a' && e.slot.status === 'ACTIVE'))
  assert.deepEqual(stand(P, w2, N).leased, [])
})
test('act decline: records the offer declined, answers no, and drops that spot from the stand offers', () => {
  const w = room(queued(guest([want('booth')])), busy(tbl('b1', 2, ['booth']), 8), tbl('q1', 2, ['banquette']), tbl('p', 2, [], 'f2'))
  assert.ok(stand(P, w, N).offers.some(r => r.spot === 'q1'))
  const o = ok(run(w, {do: 'decline', party: 'pty1', spot: 'q1', step: 'near'}))
  assert.deepEqual(o.events, [{ev: 'answered', party: 'pty1', spot: 'q1', yes: false}])
  const w1 = apply(w, o.patches)
  assert.deepEqual([w1.ents.pty1.offer?.status, w1.ents.pty1.offer?.gives], ['declined', ['banquette']])
  assert.deepEqual(stand(P, w1, N).offers.map(r => r.spot), ['b1', 'p'])
})
test('act decline: every declined spot stays out; the next best ready table takes the exact rung', () => {
  const w = room(queued(guest([])), tbl('a', 2), tbl('b', 2), tbl('c', 2))
  const first = stand(P, w, N).offers[0]!.spot!
  const w1 = after(w, {do: 'decline', party: 'pty1', spot: first, step: 'exact'})
  const second = stand(P, w1, N).offers[0]!.spot!
  const w2 = after(w1, {do: 'decline', party: 'pty1', spot: second, step: 'exact'})
  assert.deepEqual(w2.ents.pty1.offer?.declined, [first, second])
  assert.ok(![first, second].includes(stand(P, w2, N).offers[0]!.spot!))
})
test('act hear: records the asked feat and narrates each want newly heard', () => {
  const w = room(queued(guest([want('quiet', 'soft', {said: false})])), tbl('a', 2))
  const o = ok(run(w, {do: 'hear', party: 'pty1', feat: 'quiet'}))
  assert.deepEqual(o.events, [{ev: 'heard', party: 'pty1', feat: 'quiet', level: 'soft'}])
  assert.deepEqual(ok(run(apply(w, o.patches), {do: 'hear', party: 'pty1', feat: 'quiet'})).events, [])
  assert.match(err(w, {do: 'hear', party: 'pty1', feat: 'moat'}), /Unknown feature/)
})
test('act tell: sets slot.told and narrates told {party, table, server: the waiter, by: the host}', () => {
  const w = world([host, {...table('p1', 4, 'occupied', null, 'srv'), area: {id: 'patio'}}, staff('srv', 0, 5), {id: 's1', slot: {table: 'p1', party: 'pty1', seatedAt: N, turnAt: N + mins(60), status: 'ACTIVE'}}])
  assert.deepEqual(ok(run(w, {do: 'tell', table: 'p1'})).events, [{ev: 'told', party: 'pty1', table: 'p1', server: 'srv', by: 'host'}])
  assert.match(err(w, {do: 'tell', table: 'zz'}), /nothing to tell/)
})
test('act reply: applies the response, carries its events and the guest words', () => {
  const w = asking(led(), 'draft')
  const o = ok(run(w, {do: 'reply', party: 'pty1', response: 'swap'}))
  assert.deepEqual([o.events[0].ev, o.says], ['replied', 'Wonderful, thank you for moving us.'])
  assert.match(err(w, {do: 'reply', party: 'pty1', response: 'shrug'}), /No open request/)
})
test('act join / reserve: ids and numbers come from the engine and never collide with existing parties', () => {
  const w = demo()
  const ids = new Set(Object.keys(w.ents))
  const w1 = after(w, {do: 'join', size: 3, name: 'Kim'})
  const w2 = after(w1, {do: 'join', size: 2})
  const w3 = after(w2, {do: 'reserve', size: 4, name: 'Rossi', inMin: 45, phone: '555'})
  const fresh = Object.keys(w3.ents).filter(id => !ids.has(id))
  assert.equal(new Set(fresh.map(id => w3.ents[id].party?.num)).size, 3)
  assert.equal(w.nextParty, 9)
  const [kim, res] = [Object.values(w3.ents).find(e => e.party?.name === 'Kim')!, Object.values(w3.ents).find(e => e.party?.name === 'Rossi')!]
  assert.deepEqual([kim.queue?.status, kim.queue?.since, kim.party?.kind], ['WAITING', N, 'W'])
  assert.deepEqual([res.party?.kind, res.reservation], ['R', {at: N + mins(45), durationMin: P.seat.turnDefault, table: null, status: 'BOOKED', phone: '555', notes: ''}])
  assert.match(err(w, {do: 'join', size: 0}), /at least 1/)
})
test('act mark: a reservation arrives (and joins the door) or no-shows', () => {
  const w = world([party(1, 'R', 2, 'Ana', {reservation: {at: N, durationMin: 60, table: null, status: 'BOOKED', phone: '', notes: ''}})])
  const w1 = after(w, {do: 'mark', party: 'pty1', status: 'ARRIVED'})
  assert.deepEqual(stand(P, w1, N).door.map(r => r.party), ['pty1'])
  assert.equal(after(w, {do: 'mark', party: 'pty1', status: 'NO_SHOW'}).ents.pty1.reservation?.status, 'NO_SHOW')
  assert.match(err(world([party(1, 'W', 2)]), {do: 'mark', party: 'pty1', status: 'ARRIVED'}), /No reservation/)
})
test('act mode / carve / top / deal: service entity patches and the deal', () => {
  const w = world([table('g1', 4), staff('w1', 0, 5)].map(e => (e.id === 'g1' ? {...e, area: {id: 'grotto'}} : e)))
  assert.deepEqual(after(w, {do: 'mode', to: 'rotation'}).ents.service.service, {override: 'rotation', carve: {}})
  assert.equal(after(after(w, {do: 'mode', to: 'rotation'}), {do: 'mode', to: null}).ents.service.service?.override, null)
  assert.deepEqual(after(w, {do: 'carve', area: 'grotto', to: 'tops'}).ents.service.service?.carve, {grotto: 'tops'})
  assert.match(err(w, {do: 'carve', area: 'grotto', to: 'chunk'}), /cannot be carved chunk/)
  assert.match(err(w, {do: 'mode', to: 'brunch'}), /No service mode/)
  assert.deepEqual(after(w, {do: 'top', table: 'g1', staff: 'w1'}).ents.g1.assign, {staff: 'w1'})
  const tops = after(w, {do: 'carve', area: 'grotto', to: 'tops'})
  assert.deepEqual(after(tops, {do: 'deal'}).ents.g1.assign, {staff: 'w1'})
  assert.equal(ok(run(after(tops, {do: 'deal'}), {do: 'deal'})).msg, 'Already dealt')
})
test('act: an unknown command is refused with a plain reason', () => {
  assert.equal(err(world([]), {do: 'dance'} as unknown as Cmd), 'Unknown command dance')
})

// ---- extend / clear / reassign: camper, force clear, server transfer (plain log lines, no events)
const sat = (): World => world([table('a', 2, 'occupied', null, 'w1'), table('b', 2, 'occupied', null, 'w1'), {id: 'lk', link: {members: ['a', 'b'], merged: true}}, party(1, 'W', 4),
  {id: 's1', slot: {table: 'a', party: 'pty1', seatedAt: N - mins(30), turnAt: N + mins(30), status: 'ACTIVE'}}, table('c', 2), staff('w1', 10, 5, {name: 'Ana'}), staff('w2', 3, 5, {name: 'Ben'}), staff('w3', 0, 5, {name: 'Cy', active: false})])
test('act extend: the seated party\'s turn time moves out by min (any table of its group); refuses nobody seated, unknown table, a bad min', () => {
  const o = ok(run(sat(), {do: 'extend', table: 'b', min: 15}))
  assert.deepEqual([o.events, o.msg, apply(sat(), o.patches).ents.s1.slot?.turnAt], [[], 'B extended 15m', N + mins(45)])
  assert.equal(err(sat(), {do: 'extend', table: 'c', min: 15}), 'Nobody is seated at C')
  assert.equal(err(sat(), {do: 'extend', table: 'zz', min: 15}), 'No table zz')
  assert.match(err(sat(), {do: 'extend', table: 'a', min: 0}), /positive number/)
})
test('act clear: force clear completes the slot now, frees every table of the group, dissolves the merge; refuses an empty or leased table', () => {
  const o = ok(run(sat(), {do: 'clear', table: 'a'}))
  const w1 = apply(sat(), o.patches)
  assert.deepEqual([o.events, o.msg, w1.ents.s1.slot?.status, w1.ents.s1.slot?.endedAt], [[], 'A force cleared', 'COMPLETED', N])
  assert.deepEqual([w1.ents.a.table?.status, w1.ents.b.table?.status, w1.ents.a.table?.waiter, w1.ents.lk], ['available', 'available', null, undefined])
  assert.equal(err(sat(), {do: 'clear', table: 'c'}), 'Nothing to clear at C')
  assert.equal(err(world([table('d', 2, 'leased')]), {do: 'clear', table: 'd'}), 'D is leased: release it instead')
})
test('act reassign: the group\'s waiter and the covers move to the new server; refuses unknown or off-duty staff, the same server, nobody seated', () => {
  const o = ok(run(sat(), {do: 'reassign', table: 'a', staff: 'w2'}))
  const w1 = apply(sat(), o.patches)
  assert.deepEqual([o.events, o.msg], [[], 'A moved to Ben'])
  assert.deepEqual([w1.ents.a.table?.waiter, w1.ents.b.table?.waiter, w1.ents.w1.staff?.tally, w1.ents.w2.staff?.tally], ['w2', 'w2', 6, 7])
  assert.equal(err(sat(), {do: 'reassign', table: 'a', staff: 'zz'}), 'No staff zz')
  assert.equal(err(sat(), {do: 'reassign', table: 'a', staff: 'w3'}), 'Cy is off duty')
  assert.equal(err(sat(), {do: 'reassign', table: 'a', staff: 'w1'}), 'Ana already serves A')
  assert.equal(err(sat(), {do: 'reassign', table: 'c', staff: 'w2'}), 'Nobody is seated at C')
})
