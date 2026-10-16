// Patch application (set|add|del). Patch data is cloned on the way in: the store never shares structure with engine output.
import type {Entity, Patch} from '../contracts/index.ts'
import {clone} from './path.ts'
type Ents = Record<string, Entity>
type Op<K extends Patch['op']> = (ents: Ents, p: Extract<Patch, {op: K}>) => unknown
const touch = (ents: Ents, id: string) => (ents[id] ?? (ents[id] = {id}), ents[id]) // set on an unknown id upserts
const ops: {[K in Patch['op']]: Op<K>} = {
  set: (ents, p) => Object.assign(touch(ents, p.id), clone(p.parts)),
  add: (ents, p) => (ents[p.ent.id] = clone(p.ent)),
  del: (ents, p) => delete ents[p.id],
}
export const patch = (ents: Ents, ps: Patch[]) => ps.forEach(p => (ops[p.op] as (e: Ents, p: Patch) => unknown)(ents, p))
