# Container ergonomics — how the layout actually flows

Why this doc exists: the host-stand screen has ~15 containers (Canvas/Gantt, Inspector, Queue, Reservations, Staff, Sections, Bus, Ledger, Turnover, Events, Simulation, …) competing for one desktop viewport. Left unmanaged, that becomes a layout where a host has to hop around the screen mid-task — check one panel, act in another, confirm in a third. This doc records the placement rules already in force after the layout/ergonomics pass, so new containers get slotted in consistently instead of each one inventing its own home.

## The layout, as it actually works today

`src/App.tsx`'s `.main` is **one flat, order-matters list**, not a fixed left/right split:

- The active view (Canvas/Gantt/Reserve/Audit, plus the tab bar and receipt bar) is a `.primary` block that spans full width at the top (`column-span:all` in CSS multi-column).
- Every other container is a flat `.panel` sibling, in the order given by `SIDE` in `src/components/widgets.tsx`. The browser free-flows them into as many balanced columns as the viewport allows (`column-width:300px` on `.main`) — nothing pins a panel to "the right sidebar."

**Consequence: where a panel sits is controlled by its position in the `SIDE` array, not by manual placement.** To change layout, reorder `SIDE` — don't add new grid tracks or wrapper divs.

## Where does a new container's controls belong?

1. **Spatial / selection-bound** (acts on whatever is selected on the canvas, e.g. rotate, resize) → a canvas-anchored tool palette (see `CanvasTools.tsx`), not a sidebar panel. These controls only make sense next to what they're acting on; burying them in a scrolled sidebar is exactly the "hopping around" this doc exists to avoid. Same reasoning applies to a control that picks WHICH canvas content you're looking at, not just what acts on a selection — `FloorNav` (floor tabs, ＋ Level, ＋ Add Table) used to be a permanent global bar above everything; it only makes sense alongside the Canvas it controls, so it moved into Canvas's own toolbar (M21) and is gone from views where it did nothing (Gantt-only/Reserve/Audit).
2. **Frequently glanced status** (queue length, who's expecting arrivals, bus priority) → earlier in `SIDE`, so it's visible without scrolling past less-urgent panels.
3. **Occasional / setup-only** (Sections, Events, Simulation) → later in `SIDE`, or the drawer (`components/widgets.tsx`'s `kind:'tool'` entries, opened via the ＋ menu) if it's not needed during normal service at all.
4. **Can reasonably live in two places** (e.g. grouping actions — useful both from the canvas, spatially, and from the sidebar Inspector, as a record of what's selected) → duplication is fine *if* both surfaces call the same one implementation (e.g. `groupTouch` in `src/geometry.ts`). Never duplicate the *logic*, only the *entry point*.

## Minimizing hopping

- **Keep a workflow's panels adjacent in `SIDE`.** A host working the door touches Queue → Reservations → Expecting in one motion; they should be near each other in the flow, not split across the layout. Same for the staffing cluster (Staff/Sections/Bus) and the numbers cluster (Ledger/Turnover).
- **One action, one home (U2).** If an outcome has two places to do it, a host has to remember which one they used last. Link/open from elsewhere instead of duplicating the control.
- **Receipts exist so you don't have to go verify (U4).** `ctx.receipt(title, refs)` names what an action touched right where the action happened — that's cheaper than hopping to a different panel to confirm it worked.
- **Cross-references stay visible in place.** The Ledger highlights every chip referencing the same table/party when you click one of them, instead of making you scan the whole panel by eye — see `Ledger.tsx`'s `pick` state. Prefer this pattern (local highlight on click) over sending the user elsewhere to confirm a relationship, when the relationship is between things already on screen together.

## When you change the layout

Update this doc's "where does a new container belong" guidance if the decision tree stops matching reality, and bump `docs/HANDOFF.md`'s U10 pointer line if the mechanism (not just the content) changes.

## Dashboard design policy (USWDS-adapted)

v2 panels (`v2/ui/`) follow USWDS principles, tightened for a dense, high-intensity service dashboard read at a glance under pressure. Class literals live in `v2/ui/tone.ts`.

- **Spacing:** an 8px scale (`gap-2`, `p-2`, `space-y-3` between cards); 4px half-steps (`gap-1`, `py-0.5`) only inside dense rows (chips, ledger, timeline labels). No arbitrary pixel gaps.
- **Type:** compact scale: `text-xs` (12px) is the floor for any HTML text (SVG timeline labels may go to 10px, with the full value in a `<title>`); `text-sm` body; `text-lg` KPI values. Times, counts, covers and scores use `tabular-nums`; the task readout is monospace.
- **Plain language:** labels say what the host does or sees ("Seat Patel x3 from the door", "Take off duty", "Skip a turn", "bogged down"), never internal ids. Every card has a heading and a one-line purpose (`help` class) under it.
- **Status never by colour alone:** every tone pairs an icon or word with its colour (KPI `!`/`▲` marks, insight levels "Act now / Watch / Note", preference states ○ set ✓ met ● enforced ! overridden, ⚠ bogged down, ⇢ Fast seat takes them).
- **Contrast:** text meets 4.5:1: `text-slate-600` on light (`dark:text-slate-300` on dark) for secondary text; no `slate-400` text on white; coloured chips use 900/950 text on 100 fills.
- **Focus:** every control shows a visible focus ring (`focus-visible:outline-sky-500`, plus the base rule in `app.css` for buttons, links, inputs, selects); controls are at least 32px tall (`min-h-8`), dense chips 24px (`min-h-6`).
- **Button roles:** `primary` (= `ctaSm`; `cta` for the one full-width next step) = the action the card exists for; `secondary` (= `btn`, pressed state `on`) = routine controls and toggles; `outline` (= `ghost`) = alternatives, unset presets, Close/No. One primary per card region.
- **No clipped operational values:** KPI labels and hints wrap (`break-words`) instead of truncating; timeline bar labels shorten only inside the SVG, with the full value as the bar's title.
- **One implementation, many entry points:** a concept shown in several panels renders from one component (server preferences: `v2/ui/prefs.ts` chip + editor in Staff, Dashboard Servers and stand offers; tables: one `tref` trace chip; the readout: one `readout`).
