// Strategy assumption bar: the next-party guess (radio), the party at the door (stepper), the known parties behind it (the second host's info),
// and the ranked suggestions for the covered sizes (StratView.moves) plus the joint placement (StratView.joint), each with a Use button.
import type {App} from '../contracts/index.ts'
import type {Move, StratView} from '../contracts/strategy.ts'
import {esc} from './render.ts'
import {stratOf} from './strategykit.ts'
import {btn, choice, ghost, help, primary} from './tone.ts'
const GUESS: [string, string, string][] = [
  ['none', 'No assumption', 'only reservations count'], ['2top', '2-top', 'a couple next'], ['3-4top', '3-4 top', 'a four-top next'],
  ['5-6top', '5-6 top', 'link or a 6-top next'], ['large', 'Large (>5)', 'no booths: elbow room'],
]
const radio = (app: App) => ([id, label, say]: [string, string, string]) => ((p = stratOf(app).guess === id) =>
  `<button type="button" role="radio" aria-checked="${p}" data-act="strat-guess" data-g="${id}" class="${choice(p)}"><b>${label}</b><span class="text-slate-600 dark:text-slate-300">${say}</span></button>`)()
const guess = (app: App) => `<div role="radiogroup" aria-label="Next unknown party" class="flex flex-wrap gap-2">${GUESS.map(radio(app)).join('')}</div>`
const door = (app: App) => ((n = stratOf(app).at) => `<div data-door class="flex flex-wrap items-center gap-2 text-sm"><span>Party at the door</span><button type="button" data-act="strat-at-less" aria-label="One fewer guest at the door" class="${btn}">−</button>` +
  `<b class="w-16 text-center tabular-nums" aria-live="polite">${n ? `x${n}` : 'unknown'}</b><button type="button" data-act="strat-at-more" aria-label="One more guest at the door" class="${btn}">+</button>${n ? `<button type="button" data-act="strat-at-clear" class="${ghost}">Unknown</button>` : ''}</div>`)()
const chip = (n: number, i: number) => `<li><button type="button" data-act="strat-unbehind" data-i="${i}" aria-label="Remove the party of ${n} behind" class="${ghost}">x${n} <span aria-hidden="true">×</span></button></li>`
const adds = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button type="button" data-act="strat-behind" data-n="${n}" aria-label="Add a party of ${n} behind" class="${btn}">+${n}</button>`).join('')
const behind = (app: App) => `<div data-behind class="text-sm"><span>Known behind it</span> <ul class="inline-flex flex-wrap gap-1">${stratOf(app).behind.map(chip).join('') || `<li class="${help}">none known</li>`}</ul>` +
  `<div class="mt-1 flex flex-wrap items-center gap-1"><span class="${help}">Add a party of</span>${adds}</div></div>`
const tables = (m: Move, v: StratView) => m.tables.map(t => `<span data-tid="${esc(t)}" class="rounded bg-slate-200 px-1 dark:bg-slate-700">${esc(v.lanes.find(l => l.table === t)?.label ?? t)}</span>`).join(m.merge ? '+' : ' ')
const cost = (m: Move) => (m.cost ? `<span class="text-amber-700 dark:text-amber-300">squeezes ${m.cost}</span>` : '<span class="text-emerald-700 dark:text-emerald-300">free of consequence</span>')
const move = (v: StratView, tag: string) => (m: Move, i: number) =>
  `<li data-move="${m.size}" data-kind="${tag}" class="py-1 text-xs"><div class="flex flex-wrap items-center gap-2"><b class="tabular-nums">${i + 1}.</b><b>Party of ${m.size}</b>${tables(m, v)}${m.merge ? '<span class="rounded bg-violet-100 px-1 text-violet-950 dark:bg-violet-900 dark:text-violet-50">link</span>' : ''}` +
  `${cost(m)}<span class="text-slate-600 dark:text-slate-300">frees again in ${m.turn}m</span><button type="button" data-act="strat-use" data-n="${m.size}" class="${primary} ml-auto">Use: fast seat x${m.size}</button></div>` +
  `<ul class="list-disc pl-8 text-slate-600 dark:text-slate-300">${m.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></li>`
const rank = (a: Move, b: Move) => a.cost - b.cost || a.turn - b.turn
const picked = (app: App, v: StratView) => [...new Set([...(stratOf(app).at ? [stratOf(app).at!] : []), ...v.sizes])].map(s => v.moves[s]).filter((m): m is Move => !!m).sort(rank)
const list = (ms: Move[], v: StratView, tag: string, empty: string) => (ms.length ? `<ol class="divide-y divide-slate-200 dark:divide-slate-700">${ms.map(move(v, tag)).join('')}</ol>` : `<p class="${help}">${empty}</p>`)
export const assume = (app: App) => `<div class="space-y-2">${guess(app)}${door(app)}${behind(app)}</div>`
export const moves = (app: App, v: StratView) =>
  `<h3 class="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">Suggestions (best first)</h3>${list(picked(app, v), v, 'size', 'No sizes assumed: pick a guess or set the party at the door.')}` +
  (v.joint ? `<h3 class="mt-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">Door party + the ones behind (together)</h3>${list(v.joint, v, 'joint', 'No joint placement fits now.')}` : '')
