import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import {standing} from './holds.ts'
import {P, staff, table, world} from './testkit.ts'
const at = (h: number) => new Date(2026, 5, 1, h).getTime()
const t = (id: string, area: string, extra: Partial<Entity> = {}, section: string | null = null, waiter: string | null = null): Entity => ({...table(id, 4, waiter ? 'occupied' : 'available', section, waiter), area: {id: area}, ...extra})
const w = world([
  t('m1', 'main', {}, 'sA'), t('g1', 'grotto', {}, 'sG'), t('p1', 'patio', {assign: {staff: 'b'}}), t('p2', 'patio'), t('r1', 'bar', {}, null, 'z'),
  staff('a', 0, 5, {sections: ['sA']}), staff('b', 0, 5, {sections: ['sG']}), staff('pair', 0, 5, {area: 'bar', weight: 2, crew: ['Kit', 'Lou']}),
])
const by = (h: number) => Object.fromEntries(standing(P, w, at(h)).map(x => [x.table, [x.staff, x.by]]))
test('holds: sectioned = section holder (main chunk, grotto whole), dealt top (patio), bartender pair (bar); undealt = nobody', () => {
  assert.deepEqual(by(10), {m1: ['a', 'chunk'], g1: ['b', 'whole'], p1: ['b', 'tops'], p2: [null, 'tops'], r1: ['pair', 'level']})
})
test('holds: rotation holds nothing in advance: an occupied table belongs to its waiter, the rest to nobody', () => {
  assert.deepEqual(by(12), {m1: [null, 'rotation'], g1: [null, 'rotation'], p1: [null, 'rotation'], p2: [null, 'rotation'], r1: ['z', 'rotation']})
})
test('holds: the service entity picks the grotto carve (tops) and the area ignores holders of the other carve', () => {
  const x = world([...Object.values(w.ents), {id: 'service', service: {override: null, carve: {grotto: 'tops'}}}])
  assert.deepEqual(standing(P, x, at(10)).find(h => h.table === 'g1'), {table: 'g1', area: 'grotto', staff: null, by: 'tops'})
})
