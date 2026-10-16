// One builder per ladder kind (policy.host.ladder[].kind). A builder finds the best fit for its step among spots earlier steps have not claimed.
import type {Fit, Id, Level, Miss, Rung, StepDef} from '../contracts/index.ts'
import type {Env} from './match.ts'
interface Arg {e: Env; d: StepDef; pool: Fit[]}
type Found = Pick<Rung, 'spot' | 'gives' | 'lacks' | 'waitMin' | 'squeezes'>
type Build = (a: Arg) => Found | undefined
const rank: Record<Level, number> = {need: 0, strong: 1, soft: 2}
const found = (f: Fit, gives: string[] = f.met): Found => ({spot: f.spot, gives, lacks: f.missed, waitMin: f.waitMin, squeezes: f.squeezes})
const feats = (e: Env, id: Id) => e.by[id].spot.feats ?? []
const standin = (e: Env, f: Fit, m: Miss) => (e.wants.find(x => x.feat === m.feat)?.avoid ? undefined : e.p.host.feats[m.feat]?.near.find(n => feats(e, f.spot).includes(n)))
const apart = (e: Env, f: Fit) => (['floor', 'section'] as const).some(k => e.by[e.fits[0]?.spot ?? f.spot].spot[k] !== e.by[f.spot].spot[k])
/** Patience caps every wait; the step's own tolerance applies at the strongest level the best ready spot gives up. */
const tol = ({e, d, pool}: Arg) => {
  const gone: {level: Level}[] = pool.find(f => f.ready)?.missed ?? e.wants
  const lv = gone.map(x => x.level).sort((a, b) => rank[a] - rank[b])[0] ?? 'need'
  return Math.min(d.maxWaitMin?.[lv] ?? Infinity, e.p.host.clock.patienceMin[e.party.party.kind])
}
const exact: Build = ({pool}) => { const f = pool.find(x => x.ready && !x.missed.length); return f && found(f) }
/** Worth waiting for only when it beats the best spot ready now. */
const wait: Build = a => { const now = a.pool.find(x => x.ready)?.score ?? -Infinity; const f = a.pool.filter(x => !x.ready && x.score > now && x.waitMin <= tol(a)).sort((p, q) => p.waitMin - q.waitMin)[0]; return f && found(f) }
const near: Build = ({e, pool}) => { const f = pool.find(x => x.ready && x.missed.length > 0 && x.missed.every(m => standin(e, x, m))); return f && found(f, f.missed.map(m => standin(e, f, m) as string)) }
const relax: Build = ({d, pool}) => { const f = pool.find(x => x.ready && x.missed.length > 0 && x.missed.every(m => m.level !== 'need' && d.drops?.includes(m.level))); return f && found(f) }
const elsewhere: Build = ({e, pool}) => { const f = pool.find(x => x.ready && apart(e, x)); return f && found(f) }
/** The smallest-fitting free adjacent pair, offered only when no single spot is ready (env.merges is empty otherwise). */
const merge: Build = ({e}) => { const f = e.merges[0]; return f && found(f) }
const table: Record<StepDef['kind'], Build> = {exact, wait, near, relax, elsewhere, merge}
const label = (e: Env, id: string) => e.p.host.feats[id]?.label ?? id
const lack = (e: Env, m: Miss) => `${e.wants.find(x => x.feat === m.feat)?.avoid ? 'no ' : ''}${label(e, m.feat)}`
const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '')
const tname = (l: string) => (/^\d+$/.test(l) ? `T${l}` : l)
const joined = (e: Env, id: Id) => ((ts: string[]) => [ts.slice(0, -1).join(', '), ts.at(-1)].filter(Boolean).join(' and '))(e.by[id].spot.label.split('+').map(tname))
const say = (e: Env, d: StepDef, f: Found) =>
  fill(d.say, {party: `${e.party.party.name} party`, spot: e.by[f.spot ?? ''].spot.label, tables: joined(e, f.spot ?? ''), cap: String(e.by[f.spot ?? ''].spot.capacity), gives: f.gives.map(g => label(e, g)).join(' and '), lacks: f.lacks.map(m => lack(e, m)).join(' and '), min: String(Math.ceil(f.waitMin))})
/** The rung for one ladder row, or nothing when the row has no spot to offer. `taken` = spots earlier rungs already claimed. */
const caution = (e: Env, f: Found) => (f.squeezes?.length ? ` ${fill(e.p.host.squeezeSay, {parties: f.squeezes.map(i => `${e.w.ents[i]?.party?.name ?? i} party`).join(' and ')})}` : '')
export const build = (e: Env, taken: Id[], d: StepDef): Rung | undefined => {
  const f = table[d.kind]({e, d, pool: e.fits.filter(x => !taken.includes(x.spot))})
  return f && {step: d.kind, ...f, say: say(e, d, f) + caution(e, f)}
}
