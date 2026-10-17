// Class tables (U1): every Tailwind class is a literal here so the build scanner sees it. Light + dark in one string.
import type {Heat, TStatus} from '../contracts/index.ts'
export const HEAT: Record<Heat, string> = {HOT_GREEN: 'bg-emerald-600', CAUTION_WAIT: 'bg-amber-500', WARM_AMBER: 'bg-amber-600', NO_TABLE: 'bg-rose-600'}
export const TABLE: Record<TStatus, string> = {
  available: 'fill-emerald-100 stroke-emerald-600 dark:fill-emerald-950 dark:stroke-emerald-400',
  leased: 'fill-sky-100 stroke-sky-600 dark:fill-sky-950 dark:stroke-sky-400',
  occupied: 'fill-rose-100 stroke-rose-600 dark:fill-rose-950 dark:stroke-rose-400',
  lapsed: 'fill-amber-100 stroke-amber-600 dark:fill-amber-950 dark:stroke-amber-400',
  blocked_private: 'fill-slate-200 stroke-slate-500 dark:fill-slate-700 dark:stroke-slate-400',
}
export const ROLE: Record<string, string> = {guest: 'fill-slate-500', host: 'fill-sky-500', server: 'fill-violet-500', busser: 'fill-amber-500'}
export const KIND: Record<string, string> = {
  arrived: 'bg-sky-600', seated: 'bg-emerald-600', served: 'bg-violet-600', cleared: 'bg-amber-600', left: 'bg-slate-500',
  stuck: 'bg-rose-600', info: 'bg-slate-500', ok: 'bg-emerald-600', warn: 'bg-amber-600', action: 'bg-indigo-600',
  greeted: 'bg-sky-600', heard: 'bg-indigo-600', quoted: 'bg-slate-600', offered: 'bg-violet-600', answered: 'bg-emerald-600',
  leased: 'bg-teal-600', released: 'bg-slate-500', asked: 'bg-orange-600', replied: 'bg-fuchsia-600', moved: 'bg-cyan-600', mood: 'bg-pink-600', told: 'bg-lime-600',
}
export const RING: Record<string, string> = {
  arrived: 'stroke-sky-500', seated: 'stroke-emerald-500', served: 'stroke-violet-500', cleared: 'stroke-amber-500', left: 'stroke-slate-400', stuck: 'stroke-rose-500',
}
export const LEVEL: Record<string, string> = {info: 'border-sky-500', warn: 'border-amber-500', crit: 'border-rose-600'}
export const card = 'rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800'
/** Calls to action, one weight each: `cta` = the one next step (full width), `ctaSm` = a primary in a row, `ok` = confirm/seat, `ghost` = the alternative. All have a 32px+ target, hover/active/disabled and a visible keyboard focus ring. */
const press = 'inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50'
export const cta = `${press} min-h-10 w-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 active:bg-sky-800`
export const ctaSm = `${press} min-h-8 bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 active:bg-sky-800`
export const ok = `${press} min-h-8 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800`
export const ghost = `${press} min-h-8 border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`
/** Button roles (USWDS-adapted, docs/ERGONOMICS.md): primary = the action this card exists for, secondary = a routine control, outline = an alternative or an unset toggle. `btn` / `on` = a secondary control and its pressed state. */
export const primary = ctaSm
export const outline = ghost
export const secondary = `${press} min-h-8 bg-slate-200 px-2 text-sm text-slate-900 hover:bg-slate-300 active:bg-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600`
export const btn = secondary
export const on = `${press} min-h-8 bg-sky-700 px-2 text-sm text-white hover:bg-sky-800`
export const field = 'min-h-8 rounded border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100'
/** Plain-language help under a card heading (one line of purpose). */
export const help = 'text-xs text-slate-600 dark:text-slate-300'
/** A status pill always pairs an icon or word with its colour (never colour alone). */
export const LEVELS: Record<'info' | 'warn' | 'crit', {icon: string; say: string; cls: string}> = {
  crit: {icon: '▲', say: 'Act now', cls: 'border-l-rose-600 bg-rose-50 text-rose-950 dark:bg-rose-950 dark:text-rose-50'},
  warn: {icon: '!', say: 'Watch', cls: 'border-l-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50'},
  info: {icon: 'i', say: 'Note', cls: 'border-l-sky-600 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-50'},
}
/** A choice among several (radio): the selected one is outlined and filled, the rest quiet. */
export const choice = (picked: boolean) => `${press} min-h-10 flex-col items-start rounded-lg border px-3 py-1 text-left text-xs ${picked ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600 dark:bg-sky-950' : 'border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'}`
