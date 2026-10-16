// Party entity factories (C5): plain data, one patch each. `nextParty` is the world's only counter.
import type {App, Entity, Patch, PType} from '../contracts/index.ts'
const PREFIX: Record<PType, string> = {W: 'W', P: 'P', R: 'R', V: 'V'}
export const party = (num: number, kind: PType, size: number, name: string, extra: Partial<Entity>): Entity =>
  ({id: `p${num}`, party: {num, label: `${PREFIX[kind]}${num}`, prefix: PREFIX[kind], kind, name, size}, ...extra})
export const enroll = (app: App, kind: PType, size: number, name: string, extra: (now: number) => Partial<Entity>): Patch[] => {
  const w = app.store.state.world
  const num = w.nextParty++
  return [{op: 'add', ent: party(num, kind, size, name, extra(app.store.state.now))}]
}
