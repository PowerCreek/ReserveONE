import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import type {Entity} from '../contracts/index.ts'
import {partition} from './partition.ts'
const tb = (id: string, x: number, y: number, cap: number): Entity => ({id, pos: {floor: 'f', x, y, w: 40, h: 40}, table: {label: id, capacity: cap, min: 1, shape: 'rect', status: 'available', waiter: null, section: null}})
const grid = (cols: number, rows: number, cap = 4): Entity[] => Array.from({length: cols * rows}, (_, i) => tb(`t${i}`, (i % cols) * 80, Math.floor(i / cols) * 80, cap))
const covers = (es: Entity[], g: string[]) => g.reduce((a, id) => a + es.find(e => e.id === id)!.table!.capacity, 0)

const box = (es: Entity[], g: string[]) => {
  const ts = g.map(id => es.find(e => e.id === id)!.pos!)
  return {x0: Math.min(...ts.map(t => t.x)), x1: Math.max(...ts.map(t => t.x + t.w)), y0: Math.min(...ts.map(t => t.y)), y1: Math.max(...ts.map(t => t.y + t.h))}
}
/** Tables of other clusters that sit inside a cluster's bounding box. */
const intruders = (es: Entity[], gs: string[][]) => gs.flatMap((g, i) => {
  const b = box(es, g)
  return gs.flatMap((h, j) => (i === j ? [] : h.filter(id => { const t = es.find(e => e.id === id)!.pos!; return t.x >= b.x0 && t.x + t.w <= b.x1 && t.y >= b.y0 && t.y + t.h <= b.y1 })))
})
test('every table lands in exactly one cluster; a uniform grid splits into rectangles of equal covers that never interleave', () => {
  const es = grid(4, 4)
  const gs = partition(defaultPolicy, es, 4)
  assert.deepEqual(gs.flat().sort(), es.map(e => e.id).sort())
  assert.deepEqual(gs.map(g => covers(es, g)), [16, 16, 16, 16])
  assert.deepEqual(intruders(es, gs), [])
  assert.deepEqual(gs.map(g => { const b = box(es, g); return [b.x1 - b.x0, b.y1 - b.y0] }), Array(4).fill([120, 120])) // 2x2 quadrants
})
test('covers (capacity) balance, not table counts: one 6-top weighs as much as three 2-tops', () => {
  const es = [tb('a', 0, 0, 6), tb('b', 80, 0, 2), tb('c', 160, 0, 2), tb('d', 240, 0, 2), tb('e', 0, 200, 6), tb('f', 80, 200, 2), tb('g', 160, 200, 2), tb('h', 240, 200, 2)]
  const gs = partition(defaultPolicy, es, 2)
  assert.deepEqual(gs.map(g => covers(es, g)), [12, 12])
})
test('the same input always gives the same clusters', () => {
  const es = grid(5, 4, 2)
  assert.deepEqual(partition(defaultPolicy, es, 4), partition(defaultPolicy, [...es].reverse(), 4))
})
test('no cluster takes every table of a spread shape (booths)', () => {
  const booths = Array.from({length: 4}, (_, i): Entity => ({...tb(`b${i}`, i * 80, 0, 6), table: {...tb('x', 0, 0, 6).table!, label: `b${i}`, shape: 'booth'}}))
  const es = [...booths, ...grid(4, 1, 2).map(e => ({...e, id: `s${e.id}`, pos: {...e.pos!, y: 200}}))]
  const gs = partition(defaultPolicy, es, 2)
  assert.ok(gs.every(g => g.filter(id => id.startsWith('b')).length <= 2), JSON.stringify(gs))
})
