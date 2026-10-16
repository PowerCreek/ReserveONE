// Declarative Rule {when, require, apply} interpreter (C6): GraphQL-style selection of components and fields.
import type {Entity, Rule, Sel, Verdict} from '../contracts/index.ts'
type Cmp = (a: any, b: any) => boolean
const cmp: Record<string, Cmp> = {
  eq: (a, b) => a === b, ne: (a, b) => a !== b, gt: (a, b) => a > b, gte: (a, b) => a >= b,
  lt: (a, b) => a < b, lte: (a, b) => a <= b, in: (a, b) => b.includes(a),
}
const isOps = (m: any) => !!m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length > 0 && Object.keys(m).every(k => k in cmp)
const test = (v: unknown, m: any) => (isOps(m) ? Object.entries(m).every(([op, arg]) => cmp[op](v, arg)) : v === m)
export const matches = (sel: Sel, ent: Entity) =>
  Object.entries(sel).every(([k, fields]) => (ent as any)[k] !== undefined && Object.entries(fields as object).every(([f, m]) => test((ent as any)[k][f], m)))
export const run = (rules: Rule[], ent: Entity): Verdict => {
  const hit = rules.filter(r => matches(r.when, ent))
  const bad = hit.filter(r => r.require && !matches(r.require, ent))
  const good = hit.filter(r => !bad.includes(r))
  return {ok: !bad.length, msgs: bad.map(r => r.msg ?? `${r.id}: unmet`), applied: good.flatMap(r => (r.apply ? [r.apply] : []))}
}
