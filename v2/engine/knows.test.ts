import test from 'node:test'
import assert from 'node:assert/strict'
import type {Entity} from '../contracts/index.ts'
import {Engine} from './index.ts'
import {N, P, mins, table, world} from './testkit.ts'
const t = (id: string, area?: string): Entity => ({...table(id, 4, 'occupied', null, 'srv'), ...(area ? {area: {id: area}} : {})})
const seating = (tbl: string, told?: {by: string; at: number}, status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE'): Entity =>
  ({id: `slot-${tbl}`, slot: {table: tbl, party: 'pty1', seatedAt: N - mins(5), turnAt: N + mins(50), status, ...(told && {told})}})
const knows = (w: ReturnType<typeof world>, id: string) => Engine.knows(P, w, N, id)
test('knows: a main-floor server sees every seating, told or not, and even an empty table', () => {
  const w = world([t('m1'), seating('m1')])
  assert.deepEqual([knows(w, 'm1'), knows(world([t('m2', 'main')]), 'm2')], [true, true])
})
test('knows: the bar sees its seatings like the main floor; grotto, patio and upstairs know only once the active slot is told', () => {
  assert.equal(knows(world([t('x', 'bar'), seating('x')]), 'x'), true)
  const areas = ['grotto', 'patio', 'upstairs']
  assert.deepEqual(areas.map(a => knows(world([t('x', a), seating('x')]), 'x')), [false, false, false])
  assert.deepEqual(areas.map(a => knows(world([t('x', a), seating('x', {by: 'host', at: N})]), 'x')), [true, true, true])
})
test('knows: an empty table or a finished (told) seating tells nothing; a link member finds the group slot', () => {
  const done = world([t('x', 'patio'), seating('x', {by: 'host', at: N}, 'COMPLETED')])
  assert.deepEqual([knows(world([t('x', 'patio')]), 'x'), knows(done, 'x')], [false, false])
  const pair = world([t('a', 'patio'), t('b', 'patio'), {id: 'k', link: {members: ['a', 'b']}}, seating('a', {by: 'host', at: N})])
  assert.deepEqual([knows(pair, 'a'), knows(pair, 'b')], [true, true])
})
test('knows: policy decides which areas are seen', () => {
  const open = {...P, service: {...P.service, areas: {...P.service.areas, patio: {...P.service.areas.patio, seen: true}}}}
  assert.equal(Engine.knows(open, world([t('x', 'patio'), seating('x')]), N, 'x'), true)
})
