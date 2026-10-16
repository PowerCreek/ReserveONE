import test from 'node:test'
import assert from 'node:assert/strict'
import {matches, run} from './rules.ts'
import {make} from './make.ts'
import type {Rule} from '../contracts/index.ts'
const table = make.component('table', {label: 'T', capacity: 2, min: 1, shape: 'rect', status: 'available', waiter: null, section: null})
const big = make.entity('t9', {table: table({capacity: 8})})
test('selection ops: presence, equality, comparators, in', () => {
  assert.ok(matches({table: {}}, big))
  assert.ok(!matches({party: {}}, big))
  assert.ok(matches({table: {status: 'available', capacity: {gte: 8, lt: 9}}}, big))
  assert.ok(!matches({table: {capacity: {gt: 8}}}, big))
  assert.ok(matches({table: {shape: {in: ['rect', 'booth']}, waiter: null}}, big))
})
test('run: when gates, require yields msgs, apply decorates', () => {
  const rules: Rule[] = [
    {id: 'big', when: {table: {capacity: {gte: 6}}}, require: {table: {status: 'occupied'}}, msg: 'big table idle'},
    {id: 'tone', when: {table: {status: 'available'}}, apply: {tone: 'bg-emerald-600'}},
    {id: 'skip', when: {party: {}}, require: {party: {size: 99}}},
  ]
  assert.deepEqual(run(rules, big), {ok: false, msgs: ['big table idle'], applied: [{tone: 'bg-emerald-600'}]})
  assert.deepEqual(run(rules, make.entity('t1', {table: table()})), {ok: true, msgs: [], applied: [{tone: 'bg-emerald-600'}]})
})
test('make: factories clone defaults', () => {
  const link = make.component('link', {members: ['a']})
  const a = link(), b = link()
  a.members.push('z')
  assert.deepEqual(b.members, ['a'])
  assert.deepEqual(Object.keys(make.entity('e', {link: a})), ['id', 'link'])
})
