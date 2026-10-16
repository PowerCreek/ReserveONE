import test from 'node:test'
import assert from 'node:assert/strict'
import {defaultPolicy} from '../contracts/index.ts'
import {scenarios} from './index.ts'
const host = defaultPolicy.host
test('every starter id, feat, why, reason, key and table resolves', () => {
  for (const [id, s] of Object.entries(scenarios)) {
    const tables = new Set(s.seed.tables.map(t => t.id))
    const keys = new Set(s.steps.filter(x => x.do === 'arrive').map(x => x.key))
    assert.equal(s.id, id)
    for (const t of s.seed.tables) t.feats.forEach(f => assert.ok(host.feats[f], `${id}: feat ${f}`))
    for (const b of s.seed.busy ?? []) assert.ok(tables.has(b.table), `${id}: busy ${b.table}`)
    for (const x of s.steps) {
      assert.ok(x.do === 'arrive' || keys.has(x.key), `${id}: key ${x.key}`)
      if (x.do === 'place') assert.ok(tables.has(x.table), `${id}: table ${x.table}`)
      if (x.do === 'ask') assert.ok(host.reasons[x.reason], `${id}: reason ${x.reason}`)
      if (x.do === 'arrive') x.wants.forEach(w => assert.ok(host.feats[w.feat] && host.whys[w.why], `${id}: want ${w.feat}/${w.why}`))
    }
  }
})
const sorted = (id: string) => scenarios[id].steps.map((x, i) => ({x, i})).sort((a, b) => a.x.at - b.x.at || a.i - b.i).map(r => r.x)
test('steps are free-play data: known verbs, arrival before place before ask, stages agree, parties fit their table', () => {
  for (const [id, s] of Object.entries(scenarios)) {
    const size = new Map(s.steps.flatMap(x => (x.do === 'arrive' ? [[x.key, x.size] as const] : [])))
    const placed = new Map<string, string>()
    const seen = new Set<string>()
    const cap = new Map(s.seed.tables.map(t => [t.id, t.capacity]))
    for (const x of sorted(id)) {
      assert.ok(['arrive', 'place', 'ask'].includes(x.do), `${id}: verb ${x.do}`)
      assert.deepEqual(Object.keys(x).filter(k => !['at', 'do', 'key', 'name', 'size', 'kind', 'wants', 'table', 'stage', 'reason'].includes(k)), [], `${id}: no expectation fields`)
      x.do === 'arrive' ? seen.add(x.key) : assert.ok(seen.has(x.key), `${id}: ${x.key} acts before arriving`)
      x.do === 'place' && (placed.set(x.key, x.stage), assert.ok(cap.get(x.table)! >= size.get(x.key)!, `${id}: ${x.key} fits ${x.table}`))
      x.do === 'ask' && assert.ok(host.reasons[x.reason].stages.includes(x.stage), `${id}: ${x.reason} at ${x.stage}`)
      x.do === 'ask' && placed.has(x.key) && assert.equal(placed.get(x.key), x.stage, `${id}: ${x.key} stage`)
    }
    const spots = s.steps.flatMap(x => (x.do === 'place' ? [x.table] : []))
    assert.equal(new Set(spots).size, spots.length, `${id}: one party per placed table`)
    assert.ok(spots.every(t => !(s.seed.busy ?? []).some(b => b.table === t)), `${id}: placed table is not also busy`)
  }
})
test('the preference starters ask for several features and levels', () => {
  const wants = (id: string) => scenarios[id].steps.flatMap(x => (x.do === 'arrive' ? x.wants : []))
  assert.ok(Object.keys(scenarios).length >= 5)
  assert.ok(['booth', 'bar'].every(f => wants('lunch-rush').some(w => w.feat === f)))
  assert.ok(['patio', 'sunny'].every(f => wants('patio-swing').some(w => w.feat === f)))
  assert.ok(scenarios['patio-swing'].steps.some(x => x.do === 'ask' && x.reason === 'sun'))
  assert.ok(scenarios['patio-swing'].steps.some(x => x.do === 'ask' && x.reason === 'draft'))
})
