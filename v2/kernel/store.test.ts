import test from 'node:test'
import assert from 'node:assert/strict'
import {createStore} from './store.ts'
import {patch} from './patch.ts'
const tbl = (status: 'available' | 'occupied') => ({table: {label: 'T', capacity: 2, min: 1, shape: 'rect' as const, status, waiter: null, section: null}})
test('watch fires at, under and above the written path; unsubscribe stops it', () => {
  const st = createStore({a: {b: {c: 1}}, list: [1] as number[]})
  const seen: string[] = []
  const off = st.watch('a.b', v => seen.push(JSON.stringify(v)))
  st.watch('a.b.c', v => seen.push(`c=${v}`), true)
  st.state.a.b.c = 2
  st.state.a = {b: {c: 3}}
  st.state.list.push(2)
  off()
  st.state.a.b.c = 4
  assert.deepEqual(seen, ['c=1', '{"c":2}', 'c=2', '{"c":3}', 'c=3', 'c=4'])
  assert.deepEqual(st.state.list.length, 2)
})
test('same-value writes are silent, delete notifies, proxies never nest', () => {
  const st = createStore<any>({x: {y: 1}, z: 1})
  let n = 0
  st.watch('x', () => n++)
  st.state.x.y = 1
  delete st.state.x.y
  st.state.z = st.state.x
  assert.equal(n, 1)
  assert.equal(st.state.z.y, undefined)
  assert.doesNotThrow(() => structuredClone(JSON.parse(JSON.stringify(st.state))))
})
test('patches set/add/del write into the store without sharing structure', () => {
  const st = createStore<any>({ents: {t1: {id: 't1', ...tbl('available')}}})
  const ent: any = {id: 't2', ...tbl('available')}
  const seen: unknown[] = []
  st.watch('ents.t1.table.status', v => seen.push(v))
  patch(st.state.ents, [{op: 'add', ent}, {op: 'set', id: 't1', parts: tbl('occupied')}, {op: 'set', id: 'nu', parts: {} }])
  ent.table.status = 'lapsed'
  assert.equal(st.state.ents.t2.table.status, 'available')
  assert.equal(st.state.ents.t1.table.status, 'occupied')
  assert.deepEqual(seen, ['occupied'])
  patch(st.state.ents, [{op: 'del', id: 't1'}])
  assert.deepEqual(Object.keys(st.state.ents), ['t2', 'nu'])
})
