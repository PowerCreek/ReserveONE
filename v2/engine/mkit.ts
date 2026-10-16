// Test-only fixtures for match/ladder: a small room with feature tags, occupancy and a party with wants.
import type {Entity, Level, Want} from '../contracts/index.ts'
import {N, mins, party, table, world} from './testkit.ts'
export const tbl = (id: string, cap: number, tags: string[] = [], floor = 'f1', sec: string | null = null): Entity => ({...table(id, cap, 'available', sec, null, floor), feat: {tags}})
/** Occupied until `left` minutes from now (freeAt = left + reset). */
export const busy = (e: Entity, left: number): Entity[] => [{...e, table: {...e.table!, status: 'occupied'}}, {id: `s_${e.id}`, slot: {table: e.id, party: 'old', seatedAt: N - mins(30), turnAt: N + mins(left), status: 'ACTIVE'}}]
export const want = (feat: string, level: Level = 'strong', over: Partial<Want> = {}): Want => ({feat, level, why: 'comfort', accord: 'all', said: true, ...over})
export const guest = (wants: Want[], size = 2, heard: string[] = [], kind: 'W' | 'P' | 'R' | 'V' = 'W'): Entity => party(1, kind, size, 'Chen', {wants: {list: wants, heard}})
export const room = (...ents: (Entity | Entity[])[]) => world(ents.flat())
