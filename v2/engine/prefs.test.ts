import test from 'node:test'
import assert from 'node:assert/strict'
import type {Cmd, Entity, Pref, PrefOn, World} from '../contracts/index.ts'
import {act, apply, board, match, serverFor, stand} from './index.ts'
import {serverOf} from './rotate.ts'
import {bogged, matches} from './prefs.ts'
import {N, P, mins, party, staff, table, world} from './testkit.ts'
import {guest, tbl, want} from './mkit.ts'
const rot: Entity = {id: 'service', service: {override: 'rotation', carve: {}}}
const pf = (id: string, kind: Pref['kind'], on: PrefOn, give: Pref['give'] = 'firm'): Pref => ({id, kind, on, give, note: id, at: 0})
const grotto = (id: string, cap = 4): Entity => ({...table(id, cap), area: {id: 'grotto'}})
const booth = (id: string, cap = 4): Entity => ({...table(id, cap), table: {...table(id, cap).table!, shape: 'booth'}})
const noGrotto = (give: Pref['give'] = 'firm') => staff('a', 0, 5, {prefs: [pf('g', 'avoid', {area: ['grotto']}, give)]})
/** b has 12 covers seated now: bogged down against a floor mean of 6. */
const swamped = (): Entity[] => [table('bt', 12, 'occupied', null, 'b'), party(50, 'W', 12), {id: 's50', slot: {table: 'bt', party: 'pty50', seatedAt: N - mins(10), turnAt: N + mins(50), status: 'ACTIVE'}}]
const q = (since: number) => ({queue: {since: N - mins(since), quotedMin: 10, status: 'WAITING' as const, from: null}})
const ok = (w: World, cmd: Cmd, now = N) => { const o = act(P, w, now, cmd); assert.ok(o.ok, o.ok ? '' : o.err); return apply(w, o.ok ? o.patches : []) }
const err = (w: World, cmd: Cmd) => { const o = act(P, w, N, cmd); return o.ok ? '' : o.err }
const slotOf = (w: World, pty: string) => Object.values(w.ents).find(e => e.slot?.party === pty)?.slot

test('prefs matches: every given key holds (area, feats, shape, size and cap ranges); unknown size never matches a size range', () => {
  const [m, g, b] = [[table('m', 4)], [grotto('g')], [{...booth('b'), feat: {tags: ['quiet']}}]]
  assert.deepEqual([matches({area: ['grotto']}, g, 2), matches({area: ['grotto', 'patio']}, m, 2), matches({feats: ['quiet']}, b, 2), matches({shape: ['booth']}, b, 2)], [true, false, true, true])
  assert.deepEqual([2, 3, NaN].map(n => matches({size: [1, 2], cap: [3, 99]}, m, n)), [true, false, false])
  assert.equal(matches({size: [1, 2], cap: [3, 99]}, [table('x', 2)], 2), false)
})
test('prefs firm avoid: skipped while another unit is free and not bogged; the mark says it was held and who took it', () => {
  const w = world([rot, grotto('g1'), table('m1', 4), noGrotto(), staff('b', 4, 5)])
  const k = serverFor(P, w, N, ['g1'])
  assert.deepEqual([k.staff, k.by, k.prefs?.map(x => [x.staff, x.pref, x.state])], ['b', 'rotation', [['a', 'g', 'enforced']]])
  assert.match(k.prefs![0].why, /a's avoid "g" held: b takes it/)
  assert.deepEqual(serverFor(P, w, N, ['m1']), {staff: 'a', fallback: false, by: 'rotation'}) // not covered: no marks, rotation as is
})
test('prefs firm avoid: honoured overridden when every other unit is bogged down (balance wins), and says so', () => {
  const w = world([rot, grotto('g1'), noGrotto(), staff('b', 4, 5), ...swamped()])
  assert.deepEqual(bogged(P, w, N), {a: false, b: true})
  const k = serverFor(P, w, N, ['g1'])
  assert.deepEqual([k.staff, k.prefs?.[0].state], ['a', 'overridden'])
  assert.match(k.prefs![0].why, /every other server is bogged down too, so the rotation obliges/)
})
test('prefs yield avoid: gives way even to a bogged unit; taken only when nobody else can', () => {
  const w = world([rot, grotto('g1'), noGrotto('yield'), staff('b', 4, 5), ...swamped()])
  assert.deepEqual([serverFor(P, w, N, ['g1']).staff, serverFor(P, w, N, ['g1']).prefs?.[0].state], ['b', 'enforced'])
  const alone = world([rot, grotto('g1'), noGrotto('yield'), staff('b', 4, 5, {active: false})])
  const k = serverFor(P, alone, N, ['g1'])
  assert.deepEqual([k.staff, k.prefs?.[0].state], ['a', 'overridden'])
  assert.match(k.prefs![0].why, /nobody else can take it/)
})
test('prefs: nobody else eligible (the only section holder) -> obligated by the section, marked overridden', () => {
  const w = world([table('m1', 4, 'available', 'sA'), staff('a', 0, 5, {sections: ['sA'], prefs: [pf('big', 'avoid', {cap: [3, 99]})]}), staff('b', 0, 5, {sections: ['sB']})])
  const k = serverFor(P, w, N, ['m1']) // 18:00 = sectioned
  assert.deepEqual([k.staff, k.by, k.prefs?.map(x => x.state)], ['a', 'chunk', ['overridden']])
  assert.match(k.prefs![0].why, /nobody else can take it/)
})
test('prefs prefer: moves a tie and at most one seating of this party, never more', () => {
  const w = (ta: number) => world([rot, booth('bb'), staff('a', ta, 5, {prefs: [pf('bth', 'prefer', {shape: ['booth']})]}), staff('b', 4, 60)])
  const pick = (ta: number, size = 2) => ((k = serverOf(P, w(ta), N, ['bb'], undefined, size)) => [k.staff, k.prefs?.[0].state])()
  assert.deepEqual(pick(4), ['a', 'enforced']) // a tie (b idle longer) goes to the preferrer
  assert.deepEqual(pick(5), ['a', 'enforced']) // within one seating of 2
  assert.deepEqual(pick(6), ['b', 'overridden']) // a full seating behind: idle breaks the tie, rotation wins
  assert.deepEqual(pick(7), ['b', 'overridden'])
  assert.deepEqual(pick(5, 1), ['b', 'overridden']) // a party of 1 is worth only 1
  assert.deepEqual(pick(0), ['a', 'met'])
  assert.match(serverOf(P, w(4), N, ['bb'], undefined, 2).prefs![0].why, /steered it here ahead of b/)
})
test('prefs table choice: a 2-top steers off a 4-top whose would-be server avoids it when another fit exists; needs and strong wants still win', () => {
  const ents = (wa: string, prefs: Pref[]) => world([rot, guest([want('booth', wa as 'soft')], 2), tbl('big', 4, ['booth']), tbl('two', 2), staff('a', 0, 5, {prefs}), staff('b', 4, 5)])
  const ids = (w: World) => match(P, w, N, 'pty1').map(f => f.spot)
  const no2 = [pf('n2', 'avoid', {size: [1, 2], cap: [3, 99]})]
  assert.deepEqual([ids(ents('soft', [])), ids(ents('soft', no2))], [['big', 'two'], ['two', 'big']])
  assert.deepEqual(ids(ents('strong', no2)), ['big', 'two'])
})
test('prefs marks land on the slot: direct seat, and a lease carries them into its seating; offers show them', () => {
  const w = world([rot, grotto('g1'), noGrotto(), staff('b', 4, 5), party(1, 'W', 2, 'Chen', q(5))])
  assert.deepEqual(stand(P, w, N, 'pty1').offers.map(o => [o.spot, o.server, o.prefs.map(x => x.state)]), [['g1', 'b', ['enforced']]])
  const d = ok(w, {do: 'seat', party: 'pty1', spot: 'g1'})
  assert.deepEqual([d.ents.g1.table?.waiter, slotOf(d, 'pty1')?.prefs?.map(x => [x.staff, x.pref, x.state])], ['b', [['a', 'g', 'enforced']]])
  const l = ok(w, {do: 'lease', party: 'pty1', spot: 'g1', step: 'exact'})
  const s = ok(l, {do: 'seat', party: 'pty1'})
  assert.deepEqual([s.ents.g1.table?.waiter, slotOf(s, 'pty1')?.prefs?.map(x => x.state)], ['b', ['enforced']])
  assert.equal(slotOf(ok(world([rot, table('m1', 4), staff('b', 0, 5), party(1, 'W', 2, 'C', q(1))]), {do: 'seat', party: 'pty1', spot: 'm1'}), 'pty1')?.prefs, undefined)
})
test('act pref / unpref: add, replace by id (stamped now), drop; refusals name the bad field', () => {
  const w = world([staff('a', 0, 5)])
  const x = pf('g', 'avoid', {area: ['grotto', 'patio']})
  const w1 = ok(w, {do: 'pref', staff: 'a', pref: x})
  const w2 = ok(ok(w1, {do: 'pref', staff: 'a', pref: {...x, note: 'not now', give: 'yield'}}), {do: 'pref', staff: 'a', pref: pf('b', 'prefer', {shape: ['booth']})})
  assert.deepEqual(w2.ents.a.staff?.prefs?.map(p => [p.id, p.give, p.note, p.at]), [['g', 'yield', 'not now', N], ['b', 'firm', 'b', N]])
  assert.deepEqual(ok(w2, {do: 'unpref', staff: 'a', id: 'g'}).ents.a.staff?.prefs?.map(p => p.id), ['b'])
  const bad = (pref: Partial<Pref>, staffId = 'a') => err(w, {do: 'pref', staff: staffId, pref: {...x, ...pref} as Pref})
  assert.deepEqual([bad({}, 'zz'), bad({kind: 'hate' as never}), bad({give: 'maybe' as never}), bad({on: {}}), bad({on: {area: ['moon']}}), bad({on: {feats: ['xyz']}}), bad({on: {size: [3, 1]}}), bad({on: {zone: 1} as never}), bad({id: ''})],
    ['No staff zz', 'Unknown preference kind hate', 'Unknown give maybe (firm or yield)', 'A preference needs at least one of area, feats, shape, size, cap', 'Unknown area moon', 'Unknown feature xyz', 'size needs [min, max]', 'Unknown preference key zone', 'A preference needs an id'])
  assert.deepEqual([err(w, {do: 'unpref', staff: 'a', id: 'g'}), err(w, {do: 'unpref', staff: 'zz', id: 'g'})], ['a has no preference g', 'No staff zz'])
})
test('seat from the door: a size-only fast seat takes bySize\'s party (it leaves the door); no party of that size = a fresh walk-in', () => {
  const w = world([staff('a', 0, 5), tbl('t2', 2), tbl('t3', 3), tbl('t4', 4), party(1, 'W', 2, 'A', q(10)), party(2, 'W', 2, 'B', q(5)), party(3, 'W', 4, 'C', q(3))])
  assert.deepEqual(stand(P, w, N).bySize, {2: 'pty1', 4: 'pty3'})
  const w1 = ok(w, {do: 'seat', size: 2, from: 'door'})
  assert.deepEqual([slotOf(w1, 'pty1')?.status, w1.ents.pty1.queue?.status, stand(P, w1, N).door.map(r => r.party), stand(P, w1, N).bySize], ['ACTIVE', 'SEATED', ['pty2', 'pty3'], {2: 'pty2', 4: 'pty3'}])
  const w2 = ok(w, {do: 'seat', size: 3, from: 'door'})
  assert.deepEqual(stand(P, w2, N).door.map(r => r.party), ['pty1', 'pty2', 'pty3'])
  assert.equal(Object.values(w2.ents).filter(e => e.slot).length, 1)
})
test('board servers: PrefRow = latest slot mark per pref since it was set, else set; bogged per unit', () => {
  const base = world([rot, grotto('g1'), noGrotto(), staff('b', 4, 5), party(1, 'W', 2, 'Chen', q(5))])
  const w = ok(ok(base, {do: 'pref', staff: 'a', pref: pf('bth', 'prefer', {shape: ['booth']})}), {do: 'seat', party: 'pty1', spot: 'g1'})
  const row = (v: World, id: string) => board(P, v, N).servers.find(s => s.staff === id)!
  assert.deepEqual(row(w, 'a').prefs.map(r => [r.pref.id, r.state, r.at]), [['g', 'enforced', N], ['bth', 'set', null]])
  assert.match(row(w, 'a').prefs[0].why, /held: b takes it/)
  assert.equal(row(ok(w, {do: 'pref', staff: 'a', pref: pf('g', 'avoid', {area: ['grotto']})}, N + mins(1)), 'a').prefs[0].state, 'set') // set again later: older marks no longer count
  const bw = world([rot, staff('a', 0, 5), staff('b', 0, 5), table('bt', 12, 'occupied', null, 'b'), party(50, 'W', 12), {id: 's50', slot: {table: 'bt', party: 'pty50', seatedAt: N, turnAt: N + mins(50), status: 'ACTIVE'}}])
  assert.deepEqual(board(P, bw, N).servers.map(s => [s.staff, s.bogged]), [['a', false], ['b', true]])
})
