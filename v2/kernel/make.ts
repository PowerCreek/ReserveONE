// Entity/component factories (C5): plain data out, defaults cloned so instances never alias.
import type {Factories} from '../contracts/index.ts'
import {clone} from './path.ts'
export const make: Factories = {
  entity: (id, parts) => ({id, ...clone(parts)}),
  component: (_k, defaults) => over => ({...clone(defaults), ...over}),
}
