// Strategy tab (lane U17): a planning surface for shaping the turns ahead. Four panels share one engine.strategy read (strategykit.ts `viewOf`);
// they repaint on `ui.sv` and draw only while the tab shows. Procedures behind it: docs/v2/PROCEDURES.md.
import type {App} from '../contracts/index.ts'
import {panel} from './render.ts'
import {assume, moves} from './strategybar.ts'
import {holdActs, levers} from './strategyhold.ts'
import {askActs, shown, stratOf} from './strategykit.ts'
import {timeline} from './strategyline.ts'
import {risks, share} from './strategyrisk.ts'
import {card, help} from './tone.ts'
const head = (h: string, say: string) => `<h2 class="text-sm font-semibold">${h}</h2><p class="mb-2 ${help}">${say}</p>`
const box = (attr: string, h: string, say: string) => `<div class="${card}" title="${say}">${head(h, say)}<div ${attr}="ui.sv"></div></div>`
const HELP = {
  bar: 'What you know about who comes next: a guess, the party at the door, and parties a second host saw behind it. Suggestions follow; Use sets the fast-seat size, it never seats.',
  line: 'The next 2.5 hours per table: seated until it frees, planned reservations, holds and their gates, and neighbours that free together and can link. Click a table to open its card.',
  hold: 'Keep tables clear for a party you expect: pick tables, size, how long, and an optional gate (when a table frees, or at a time). Holds shape the plan only.',
  risk: 'Cautions on the plan: reservations about to be squeezed, sizes locked out, overloaded sections, late parties.',
  share: 'Covers now and planned per server, so earnings stay level across the rotation.',
}
export const strategyPane = `<div class="space-y-3"><div class="${card}" title="${HELP.bar}">${head('Assumptions', HELP.bar)}<div data-stbar="ui.sv"></div><div data-stmoves="ui.sv" class="mt-3"></div></div>
<div class="grid gap-3 lg:grid-cols-[1fr_26rem]">${box('data-stline', 'Turn timeline', HELP.line)}<div class="space-y-3">${box('data-sthold', 'Levers: holds', HELP.hold)}${box('data-strisk', 'Risks', HELP.risk)}${box('data-stshare', 'Server share', HELP.share)}</div></div></div>`
/** `ui.sv` bumps on any write to the levers, the world/clock (`ui.rev`) or the tab: the panels bind to it alone. */
const sv = (app: App) => ['ui.strat', 'ui.rev', 'ui.tab'].forEach(p => app.store.watch(p, () => (app.store.state.ui.sv = (app.store.state.ui.sv ?? 0) + 1)))
const PANELS: [string, Parameters<typeof shown>[1]][] = [['data-stbar', assume], ['data-stmoves', moves], ['data-stline', timeline], ['data-sthold', levers], ['data-strisk', risks], ['data-stshare', share]]
export const strategy = (app: App) => {
  stratOf(app)
  sv(app)
  Object.entries({...askActs, ...holdActs}).forEach(([n, f]) => app.act(n, f))
  PANELS.forEach(([attr, f]) => app.binder(panel(app, attr, shown(app, f))))
}
