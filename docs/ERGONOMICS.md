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
