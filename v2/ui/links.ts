// Entity links (U12): any panel names a table, party or server through `ref`; a click is the `ent` act, which ui/card.ts routes to that entity's panel
// (table -> its card, party -> the card of the table it sits at or the stand with it in focus, server -> the Staff tab with its form open).
import {esc} from './render.ts'
import type {Id} from '../contracts/index.ts'
export const LINK = 'rounded font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500 dark:text-sky-300 dark:hover:text-sky-100'
/** A link to entity `id` reading `label` (`cls` = extra literal classes). */
export const ref = (id: Id, label: string, cls = '') => `<button type="button" data-act="ent" data-eid="${esc(id)}" class="${LINK}${cls ? ` ${cls}` : ''}">${esc(label)}</button>`
