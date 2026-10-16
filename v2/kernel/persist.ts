// Optional plugin: hydrate `state.world` from storage on use, save (coalesced per microtask) on every world write.
import type {Plugin} from '../contracts/index.ts'
type KV = Pick<Storage, 'getItem' | 'setItem'>
const safe = <T>(f: () => T): T | null => {
  try {
    return f()
  } catch {
    return null
  }
}
export const persist = (key = 'reserveONE.v2', kv: KV = (globalThis as any).localStorage): Plugin => app => {
  const {state, watch} = app.store
  const saved = safe(() => JSON.parse(kv.getItem(key)!))
  saved?.ents && (state.world = saved)
  let pend: Promise<void> | null = null
  const save = () => (pend ??= Promise.resolve().then(() => ((pend = null), safe(() => kv.setItem(key, JSON.stringify(state.world))), undefined)))
  watch('world', save)
}
