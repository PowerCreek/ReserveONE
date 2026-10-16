import type {Engine, Heat, Look, Policy, SeqItem} from '../contracts/index.ts'
import {plan} from './fit.ts'
const tiers = (p: Policy): [number, Heat][] => [[1, 'CAUTION_WAIT'], [p.look.tight, 'WARM_AMBER']]
const depth = (xs: SeqItem[]) => [xs.findIndex(x => !x.ready), xs.length].find(i => i >= 0) as number // first waiting item, else all
const heat = (p: Policy, xs: SeqItem[], d: number): Heat => (xs[0].code === 'NO_TABLE' ? 'NO_TABLE' : tiers(p).find(([max]) => d < max)?.[1] ?? 'HOT_GREEN')
const look = (p: Policy, xs: SeqItem[]): Look => {
  const d = depth(xs)
  const code = heat(p, xs, d)
  return {depth: d, code, msg: p.look.msg[code], at: xs[d]?.at ?? null}
}
/** Safe runway per N-top: how many N-tops seat in a row after the given sequence before one has to wait. */
export const lookahead: Engine['lookahead'] = (p, w, now, sizes, probes = p.look.sizes) =>
  Object.fromEntries(probes.map(n => [n, look(p, plan(p, w, now, [...sizes, ...Array(p.look.probes).fill(n)]).slice(sizes.length))]))
