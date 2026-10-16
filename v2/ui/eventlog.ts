// Event log: the kernel's `data-each` stamps one row per ui.log line (newest first); every sim event and player action lands here.
import {card} from './tone.ts'
export const logPane = `<div class="${card}"><div class="mb-2 flex items-center justify-between"><h2 class="text-sm font-semibold">Event log</h2>
<button data-act="clearlog" class="text-xs text-slate-500 underline">clear</button></div>
<ul data-each="ui.log" class="max-h-[32rem] space-y-1 overflow-y-auto text-xs"><template><li class="flex items-start gap-2">
<span data-text="$.at" class="font-mono text-slate-500"></span><span data-text="$.kind" data-class="$.cls" class="w-16 shrink-0 rounded px-1 text-center text-white"></span>
<span data-text="$.msg"></span></li></template></ul></div>`
