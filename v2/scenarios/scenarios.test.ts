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
