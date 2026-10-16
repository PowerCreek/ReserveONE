// Party entity factory (C5) for scenario and preset setup: plain data. Live parties are minted by the engine (`act` join/reserve).
import type {Entity, PType} from '../contracts/index.ts'
const PREFIX: Record<PType, string> = {W: 'W', P: 'P', R: 'R', V: 'V'}
export const party = (num: number, kind: PType, size: number, name: string, extra: Partial<Entity>): Entity =>
  ({id: `p${num}`, party: {num, label: `${PREFIX[kind]}${num}`, prefix: PREFIX[kind], kind, name, size}, ...extra})
