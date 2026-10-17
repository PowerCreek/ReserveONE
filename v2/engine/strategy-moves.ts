// Moves (lane E-S): the best table per size under the host's assumption, and the joint placement of the party at the door plus the ones known behind it. Seating choice is `fit.plan` (one way); this file only
// decides which tables to keep out of it (holds, booths for a large party) and what each move costs (reservations the keeper says it strands, holds it squeezes).
import type {Id, SeqItem} from '../contracts/index.ts'
import type {Guess, Move, StratCtl} from '../contracts/strategy.ts'
import {plan} from './fit.ts'
import {MIN} from './time.ts'
import {heldFor, squeezes} from './strategy-holds.ts'
import {W, labelOf} from './strategy-ctx.ts'
import type {SCtx} from './strategy-ctx.ts'
const GUESS: Record<Guess, number[]> = {none: [], '2top': [2], '3-4top': [3, 4], '5-6top': [5, 6], large: [6, 7, 8]}
export const SIZES = [1, 2, 3, 4, 5, 6, 7, 8]
/** The sizes the host cares about: the party being addressed, then the assumption's range. */
export const sizesOf = (ctl: StratCtl) => [...new Set([...(ctl.at ? [ctl.at] : []), ...GUESS[ctl.guess]])]
/** A large party (more than 5) under the `large` assumption gets no booth. */
const booths = (c: SCtx, size: number): Id[] => (c.ctl.guess === 'large' && size > 5 ? c.ts.filter(t => t.table.shape === 'booth').map(t => t.id) : [])
const best = (c: SCtx, sizes: number[], busy: Id[]) => plan(c.p, c.w, c.now, sizes, {busy})
const lock = (c: SCtx) => c.p.board.insight.droughtMin
const name = (c: SCtx) => (id: Id) => (c.w.ents[id] ? labelOf(c, id) : `hold ${id}`)
const whys = (c: SCtx, it: SeqItem, hit: Id[]) =>
  [it.ready ? 'free now' : `free in ${Math.round(it.waitMin)}m`, ...(it.tables.length > 1 ? [`push ${it.label} together`] : []), hit.length ? `squeezes ${hit.map(name(c)).join(', ')}` : 'squeezes nothing']
export const moveOf = (c: SCtx, size: number, it: SeqItem, lead: string[] = []): Move => {
  const hit = it.spot ? [...c.keep(it.tables), ...squeezes(c, size, it.tables, it.at)] : []
  const why = it.spot ? whys(c, it, hit) : ['nothing fits in the horizon']
  return {size, tables: it.tables, label: it.label, merge: it.tables.length > 1, cost: hit.length, turn: Math.round(it.waitMin) + Math.round(c.stay / MIN), why: [...lead, ...why]}
}
/** Honour the holds unless that leaves no table, or a long wait while a held table is free now (too cautious costs turns). */
const pick = (c: SCtx, size: number): SeqItem | undefined => {
  const [base, held] = [booths(c, size), heldFor(c, size)]
  const kept = best(c, [size], [...base, ...held])[0]
  const any = held.length ? best(c, [size], base)[0] : kept
  return [kept.spot && !(kept.waitMin > lock(c) && any.ready) ? kept : any].find(x => x.spot)
}
export const movesOf = (c: SCtx): Record<number, Move | null> => Object.fromEntries(SIZES.map(s => [s, ((it?: SeqItem) => (it ? moveOf(c, s, it) : null))(pick(c, s))]))
// ---- joint placement (X + N): try the door party at each position of the claim order, keep the order that waits least overall (the door party counts twice), strands nothing, leaves nobody out.
const orders = (n: number) => Array.from({length: n}, (_, k) => ((rest: number[]) => [...rest.slice(0, k), 0, ...rest.slice(k)])(Array.from({length: n - 1}, (_, i) => i + 1)))
const run = (c: SCtx, sizes: number[], busy: Id[]) => (order: number[]) =>
  ((out: SeqItem[]) => sizes.map((_, i) => out[order.indexOf(i)]!))(best(c, order.map(i => sizes[i]!), busy))
const score = (c: SCtx) => (its: SeqItem[]) => its.reduce((n, it, i) => n + (it.spot ? it.waitMin : W.miss) * (i ? 1 : 2), 0) + c.keep(its.flatMap(it => it.tables)).length * W.squeeze
const lead = (i: number) => [i ? `behind #${i}` : 'at the door']
export const jointOf = (c: SCtx): Move[] | null => {
  const sizes = c.ctl.at && c.ctl.behind.length ? [c.ctl.at, ...c.ctl.behind] : []
  const busy = sizes.length ? [...booths(c, Math.min(...sizes)), ...heldFor(c, Math.max(...sizes))] : []
  const tries = orders(sizes.length).map(run(c, sizes, busy)).map(its => ({its, n: score(c)(its)}))
  const top = tries.reduce<(typeof tries)[number] | undefined>((b, x) => (b && b.n <= x.n ? b : x), undefined)
  return top ? top.its.map((it, i) => moveOf(c, sizes[i]!, it, lead(i))) : null
}
