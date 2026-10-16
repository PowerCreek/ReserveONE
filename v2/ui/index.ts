import {defaultPolicy} from '../contracts/index.ts'
import type {App, Plugin, SeqItem} from '../contracts/index.ts'
declare module '../contracts/kernel.ts' {
  interface UiState {size: number; pick: string; tone: string}
}
const TONE: Record<SeqItem['code'], string> = {HOT_GREEN: 'bg-emerald-600', CAUTION_WAIT: 'bg-amber-500', WARM_AMBER: 'bg-amber-600', NO_TABLE: 'bg-rose-600'}
const html = `<main class="p-4 text-slate-100"><button data-act="more" class="rounded bg-sky-600 px-3 py-1">+</button>
<span data-text="ui.size" class="mx-2"></span><b data-text="ui.pick" data-class="ui.tone" class="rounded px-2 py-1"></b></main>`
const refit = (app: App) => {
  const {state} = app.store
  const [it] = app.services.engine.fit(defaultPolicy, state.world, state.now, [state.ui.size])
  state.ui.pick = it.label
  state.ui.tone = TONE[it.code]
}
export const ui: Plugin = app => {
  app.act('more', a => a.store.state.ui.size++).view(el => (el.innerHTML = html))
  app.store.watch('ui.size', () => refit(app), true)
}
