// Reservations: a static booking form (never repainted, so typing survives ticks) and a status-driven list of bookings.
import {having} from '../contracts/index.ts'
import type {App, Ent} from '../contracts/index.ts'
import {run} from './act.ts'
import {hms} from './geo.ts'
import {arg, esc, panel} from './render.ts'
import {btn, card, field, on} from './tone.ts'
type Status = Ent<'reservation'>['reservation']['status']
const NEXT: Record<Status, [act: string, label: string][]> = {
  BOOKED: [['arrive', 'Arrived'], ['noshow', 'No-show']], ARRIVED: [['seat', 'Seat'], ['noshow', 'No-show']], QUEUED: [['seat', 'Seat']], SEATED: [], NO_SHOW: [],
}
const TO: Record<string, 'ARRIVED' | 'NO_SHOW'> = {arrive: 'ARRIVED', noshow: 'NO_SHOW'}
const val = (form: Element, n: string) => form.querySelector<HTMLInputElement>(`[name=${n}]`)!.value
const book = (app: App, ev: Event) => {
  const f = (ev.target as Element).closest('[data-form]')!
  run(app, {do: 'reserve', size: Number(val(f, 'size')), name: val(f, 'name'), inMin: Number(val(f, 'in')), phone: val(f, 'phone')})
}
const mark = (app: App, ev: Event) => run(app, {do: 'mark', party: arg(ev, 'id'), status: TO[arg(ev, 'to')]})
const rows = (app: App) => having(app.store.state.world, 'party', 'reservation').sort((a, b) => a.reservation.at - b.reservation.at).map(p =>
  `<li class="flex items-center gap-2 py-1 text-sm"><span class="w-16 font-mono">${hms(p.reservation.at).slice(0, 5)}</span><b class="w-10">${esc(p.party.label)}</b><span class="grow">${esc(p.party.name)} x${p.party.size}</span>` +
  `<span class="text-xs text-slate-500">${p.reservation.status}</span>${NEXT[p.reservation.status].map(([a, l]) => `<button data-act="${TO[a] ? 'mark' : a}" data-id="${p.id}" data-to="${a}" class="${TO[a] ? btn : on}">${l}</button>`).join('')}</li>`).join('')
const inp = (n: string, ph: string, v = '') => `<input name="${n}" placeholder="${ph}" value="${v}" class="${field} w-full" />`
export const bookPane = `<div class="grid gap-3 md:grid-cols-2"><div data-form="book" class="${card} space-y-2"><h2 class="text-sm font-semibold">Book</h2>
${inp('name', 'Name')}<div class="flex gap-2">${inp('size', 'Size', '2')}${inp('in', 'In (min)', '30')}</div>${inp('phone', 'Phone')}<button data-act="book" class="${on}">Book</button></div>
<div class="${card}"><h2 class="mb-2 text-sm font-semibold">Reservations</h2><ul data-book="ui.rev" class="divide-y divide-slate-200 dark:divide-slate-700"></ul></div></div>`
export const reserve = (app: App) => (app.act('book', book).act('mark', mark).binder(panel(app, 'data-book', rows)))
