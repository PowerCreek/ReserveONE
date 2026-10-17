// Strategy risks and server share: cautions on the plan (StratView.risks) and covers now + planned per server (StratView.share), so earnings stay level.
import type {App} from '../contracts/index.ts'
import type {Risk, Share, StratView} from '../contracts/strategy.ts'
import {ref} from './links.ts'
import {esc} from './render.ts'
import {LEVELS, help} from './tone.ts'
const LEVEL: Record<Risk['kind'], 'info' | 'warn' | 'crit'> = {lockout: 'crit', squeeze: 'warn', section: 'warn', late: 'info'}
const KIND: Record<Risk['kind'], string> = {lockout: 'Lockout', squeeze: 'Squeeze', section: 'Section', late: 'Late'}
const who = (app: App, r: Risk) => (r.party && app.store.state.world.ents[r.party] ? ` ${ref(r.party, app.store.state.world.ents[r.party]!.party?.label ?? r.party)}` : '')
const risk = (app: App) => (r: Risk) => ((l = LEVELS[LEVEL[r.kind]]) =>
  `<li data-risk="${r.kind}" class="border-l-4 ${l.cls} px-2 py-1 text-xs"><b><span aria-hidden="true">${l.icon}</span> ${l.say}: ${KIND[r.kind]}</b> ${esc(r.text)}${who(app, r)}</li>`)()
export const risks = (app: App, v: StratView) => (v.risks.length ? `<ul class="space-y-1">${v.risks.map(risk(app)).join('')}</ul>` : `<p class="${help}">No risks on the plan.</p>`)
const total = (s: Share) => s.now + s.planned
const name = (app: App, s: Share) => (app.store.state.world.ents[s.staff] ? ref(s.staff, s.name) : esc(s.name))
const line = (app: App, top: number) => (s: Share) =>
  `<li data-share="${esc(s.staff)}" class="grid grid-cols-[7rem_1fr_6rem] items-center gap-2 py-0.5 text-xs"><span class="truncate">${name(app, s)}</span>` +
  `<span class="flex h-3 overflow-hidden rounded bg-slate-100 dark:bg-slate-900" role="img" aria-label="${s.now} now, ${s.planned} planned"><span class="bg-violet-600 dark:bg-violet-400" style="width:${(s.now / top * 100).toFixed(1)}%"></span><span class="bg-violet-300 dark:bg-violet-700" style="width:${(s.planned / top * 100).toFixed(1)}%"></span></span>` +
  `<span class="tabular-nums">${s.now} + ${s.planned} = ${total(s)}</span></li>`
const spread = (ss: Share[]) => ((ts = ss.map(total)) => Math.max(...ts) - Math.min(...ts))()
export const share = (app: App, v: StratView) => (v.share.length ? ((top = Math.max(1, ...v.share.map(total))) =>
  `<p class="mb-1 ${help}"><span aria-hidden="true" class="inline-block h-2 w-3 bg-violet-600"></span> covers now <span aria-hidden="true" class="ml-2 inline-block h-2 w-3 bg-violet-300"></span> planned. Most minus fewest: <b data-spread class="tabular-nums">${spread(v.share)}</b> covers.</p>` +
  `<ul>${[...v.share].sort((a, b) => total(a) - total(b)).map(line(app, top)).join('')}</ul>`)() : `<p class="${help}">No servers on the plan.</p>`)
