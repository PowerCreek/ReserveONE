// Patch constructors + a pure interpreter, so engine steps can see the effect of earlier steps (tick) without any store.
import type {Components, Entity, Id, Patch, World} from '../contracts/index.ts'
export const set = (id: Id, parts: Partial<Components>): Patch => ({op: 'set', id, parts})
export const add = (ent: Entity): Patch => ({op: 'add', ent})
export const del = (id: Id): Patch => ({op: 'del', id})
type Ents = World['ents']
type Op<K extends Patch['op']> = (e: Ents, p: Extract<Patch, {op: K}>) => Ents
const drop = (e: Ents, id: Id): Ents => Object.fromEntries(Object.entries(e).filter(([k]) => k !== id))
const ops: {[K in Patch['op']]: Op<K>} = {
  set: (e, p) => ({...e, [p.id]: {...e[p.id], id: p.id, ...p.parts}}),
  add: (e, p) => ({...e, [p.ent.id]: p.ent}),
  del: (e, p) => drop(e, p.id),
}
export const apply = (w: World, ps: Patch[]): World => ({...w, ents: ps.reduce((e, p) => (ops[p.op] as (e: Ents, p: Patch) => Ents)(e, p), w.ents)})
