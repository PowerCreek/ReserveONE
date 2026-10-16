import type {Engine, Heat, Look, SeqItem} from '../contracts/index.ts'
import {plan} from './fit.ts'
import {knobs} from './knobs.ts'
const tiers: [number, Heat][] = [[1, 'CAUTION_WAIT'], [knobs.look.tight, 'WARM_AMBER']]
const depth = (xs: SeqItem[]) => [xs.findIndex(x => !x.ready), xs.length].find(i => i >= 0) as number // first waiting item, else all
const heat = (xs: SeqItem[], d: number): Heat => (xs[0].code === 'NO_TABLE' ? 'NO_TABLE' : tiers.find(([max]) => d < max)?.[1] ?? 'HOT_GREEN')
const look = (xs: SeqItem[]): Look => {
  const d = depth(xs)
  const code = heat(xs, d)
  return {depth: d, code, msg: knobs.look.msg[code], at: xs[d]?.at ?? null}
}
/** Safe runway per N-top: how many N-tops seat in a row after the given sequence before one has to wait. */
export const lookahead: Engine['lookahead'] = (p, w, now, sizes, probes = knobs.look.sizes) =>
  Object.fromEntries(probes.map(n => [n, look(plan(p, w, now, [...sizes, ...Array(knobs.look.probes).fill(n)]).slice(sizes.length))]))
