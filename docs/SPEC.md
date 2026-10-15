# Host Seating Planner: Agent Handoff Spec (v1)

Goal: let any agent rebuild or extend the app from this doc alone. Terse by design; read only the sections you need.

**Stack:** React 18 + TypeScript (strict, `noUnusedLocals`), Vite, no other runtime deps. Dark theme. Currently one `App.tsx` (\~2.3k lines, typechecks, **not browser-tested**). Target: multi-file bundle (§8).

---

## 1. Domain model

| Entity | Fields |
| --- | --- |
| Floor | id, name, description, is_active |
| Section | id, name, color |
| Table | id, label, capacity, min_capacity, x, y, width, height, shape (`rect`\|`booth`), status (`available`\|`occupied`\|`lapsed`\|`blocked_private`), assigned_waiter_id, section_id, floor_id |
| Association (link group) | id, primary_table_id, associated_table_ids\[\], created_at |
| Waiter | id, name, active_cover_count, last_seated_at (ISO), section_ids\[\], is_active |
| Slot (seating) | id, table_id, party_id, party_label, party_size, seated_at, expected_turn_at, status (`ACTIVE`\|`LAPSED`\|`COMPLETED`) |
| Reservation | id, party_id, prefix, type, name, party_size, time (ISO), duration_min, phone, notes, table_id\|null, status (`BOOKED`\|`ARRIVED`\|`SEATED`\|`NO_SHOW`\|`QUEUED`) |
| QueueEntry | id, party_id, prefix, type, name, party_size, queued_at, quoted_wait_min, notes, origin_reservation_id\|null, status (`WAITING`\|`SEATED`) |
| SeatingUnit (derived) | a table, or a link group. capacity = sum of members; label = members joined by `+`; status precedence blocked > occupied > lapsed > available |

**Party ID:** `label = prefix + type + "-" + id`, e.g. `HSW-7`. Prefix is `[A-Z0-9]{0,4}` and configurable. Type is `W` walk-in, `P` priority (late reservation), `R` reservation, `V` VIP. `id` comes from one global counter (`nextPartyId`) that is never reused. Prefix changes affect only new parties, because entities store their own prefix. A late reservation promoted to the queue becomes type `P` and keeps its id.

**"N-top" is a qualifier, not a table.** It is matched against a unit's capacity (own or linked). The system never auto-combines tables; linking is a deliberate host action.

---

## 2. Geometry

- `TILE = 40`. Dimensions come from capacity:
  - cap ≤ 2 → 40×80
  - cap ≤ 4 → 80×80
  - cap ≥ 5 → ceil(cap/2)×40 by 80
  - booth → always 120×80, max capacity 6
- Rotate swaps w/h about the center, grid-snapped. Reject on overlap.
- Collision is AABB; edge contact is allowed. Link adjacency uses a 2px touch tolerance.
- Capacity edit (±) re-derives the dimensions and preserves orientation. Reject on overlap.
- **Link groups:**
  - Plan = selected tables ∪ every group they touch.
  - Allowed only if the merged set is connected by touching.
  - Actions: *Add to / Merge Group*, *Remove from Group* (selected only), *Dissolve Group*.
  - `normalizeAssociations` runs in an effect after any table change. It drops missing tables, splits groups that stopped touching, and dissolves groups under 2 tables. It is compared by member sets (not order) to avoid loops.
- Dragging a table moves its whole link group.

---

## 3. Engines (pure functions; keep unit-testable)

**evaluateProgressiveSequence(tables, slots, assocs, sizes\[\], now, holds\[\])**

- Constants: RESET 5m, LAPSED_CLEAR 5m, QUANTUM 5m, CADENCE 3m, FIT_SLACK 5m.
- `avgTurn` = mean duration of ACTIVE slots, clamped 45–90m, default 60. `need = avgTurn + RESET`.
- Unit `availableAt`:
  - available = now
  - lapsed = now + 5m
  - occupied = slot.turn + 5m (no slot: now + avgTurn/2)
  - blocked_private is excluded.
- Hold gate: while `at + need > hold.start && at < hold.end + RESET`, set `at = hold.end + RESET`.
- Pick:
  - If any fitting unit is free now: tightest fit among the free ones.
  - Otherwise: tightest fit among units within 5m of the earliest.
- Waits: seat time is quantized up to 5m and spaced ≥3m apart. The claimed unit becomes `seat + need`, so waits cascade.
- Output per item: READY_NOW | WAIT_QUALIFIED, assigned unit (first table id + label), wait minutes, clock string, code.
- Codes: HOT_GREEN | CAUTION_WAIT | NO_TABLE.

**calculateStackLookahead:** appends 40 probes of size N after the sequence. `safeDepth` = count of READY items before the first wait. Codes: NO_TABLE; depth 0 → CAUTION_WAIT ("EXHAUSTED NOW…"); depth \< 3 → WARM_AMBER ("Tight Runway"); otherwise green. The UI groups identical messages into ranges ("\[1–6 Top\]").

**Holds:** reservations with a `table_id`, status BOOKED/ARRIVED, and not more than 15m late (ARRIVED always holds). Window = time → time + duration.

**Server rotation S_w** = idle_min×1.2 − covers×2 − (upcoming res>0 ? 1 : 0)×2.5 − (idle\<8 ? 500 : 0) − (covers≥18 ? 1000 : 0). Inactive = −9999. Sort descending.

**pickServerFor(tableIds):** the best-scored waiter whose `section_ids` include any of the tables' sections, else the top overall.

**Bus priority:** stub. `demand×10 + 22.5 + 8` with a constant dirty time. See §6.

---

## 4. Frontend features and specs

**Header:** table/seated/to-bus/queued/late badges, and ↺ Reset data (confirm → clears storage → reload).

**Levels nav:** horizontally scrollable floor buttons with table counts, + Level (modal), + Add Table (modal: label, capacity, rect/booth, x, y; auto-finds a free spot). New tables get `section_id = null`.

**Server rotation cards:** ranked, show covers, S_w and section badges.

**Workspace views (segmented control):** Canvas | Gantt | Split | Reserve (shows a late-count suffix).

**Status slot:** fixed 28px beside the toggle. It shows idle shortcut hints, flash messages (3s; tones warn/info/ok), and the live "blocked: overlaps" message while dragging. It never changes layout. Replaces all `alert()`s.

**Canvas (SVG):**

- viewBox pan/zoom (zoom 0.4–2.5, wheel via native non-passive listener, re-attached on view switch). Grid snap 10/20/40. Canvas size presets. Fit/Reset.
- Pointer Events only (mouse/touch/pen). Gesture state lives in a ref (kinds: pan | marquee | drag).
- Coordinates via `getScreenCTM().inverse()`, which stays correct under letterboxing.
- Drag threshold 4px. The pressed (anchor) table snaps to the grid and the whole selection plus links moves by the same delta. On a collision it slides along one axis, else holds. Undo snapshot is pushed on drag end only if something moved.
- Marquee select (shift = additive). Pan via the Pan tool, Space or middle button.
- Keys (ignored while typing in inputs): R rotate, Ctrl/Cmd+Z undo, Ctrl+Y or Ctrl+Shift+Z redo, Ctrl+A select all on the floor, arrows move (Shift = 1px, linked tables move together), Del/Backspace delete, Esc clear selection and highlight.
- Visuals: fill by status (green/red/amber); 4px section-color strip; selection-order badge (#n); link groups drawn as a translucent overlay on top (one 0.35-opacity layer so overlaps don't double up) plus a "🔗 N Top" badge; pulsing amber dashed highlight ring (6s) for tables referenced from elsewhere; SVG-space toast (party label · detail, server) that follows the table while it moves.

**Gantt (`RollingGantt`, own 1s tick):**

- All floors, grouped by floor header rows, plus an "Unassigned" reservation row.
- One scroll container (both axes). The header (top) and labels (left) are sticky. Fixed row height 30, label width 112, header 40.
- Time range: hour-floored (mount − 6h) → +36h. px/min = 4/2/1 for zoom 15m/30m/1h, so a bucket is always 60px.
- Red NOW line, shaded past, bucket gridlines via a CSS background.
- **Live follow:** keeps NOW at \~20% of the visible track. A user scroll pauses it (programmatic scrolls are flagged for 80ms so they don't count). "Back to NOW" resumes. ◀1h / 1h▶ step the view.
- Header cells show turn counts per bucket. Colors: ≥3 = "deluge" (blue), 0 = "drought" (amber), past = dim.
- Bars: slots green (amber when past turn time); reservations dashed sky (red when late) with width = duration.
- Clicking a label selects the table and focuses it on the canvas (switching floor if needed).

**Reserve view:**

- Stats: booked covers, next arrival, late count, queue count/covers, longest wait.
- 30-minute load strip (16 cells, horizontally scrollable).
- Reservation list with filter chips active | late | done | all. Collapsible add form (name, size, datetime-local, duration, phone, table, notes). Preview ID shown.
- Queue list sorted by tier (P=0, V=1, W/R=2) then `queued_at`. Each entry shows a live ETA from the evaluator over all floors, with the predicted table as a chip. Collapsible add form (name, size, type chips).

**Entry interaction contract:**

- Single tap/click = select. For res/queue entries this toggles the *active party* (copies its size, focuses its assigned table).
- Double tap/click (same key within 380ms; custom detector, not `onDoubleClick`) = remove. This applies to sequence cards, reservations and queue entries. Buttons inside entries `stopPropagation`.
- Reservation buttons: Arrived (BOOKED only), Seat, Priority (late only), Assign/Unassign, No-show. Compact mode (sidebar) shows only Seat and Priority. Queue buttons: Seat, Remove.
- Assign puts the first selected table on the reservation (blocked if capacity \< party size). With nothing selected it unassigns.

**Seating flow (`seatParty(party, 'selected' | 'auto')`):**

- Target resolution: selected tables → reserved table → evaluator pick on the active floor (must be READY_NOW).
- Rejects if any target table is occupied/blocked, or capacity \< party size.
- Effects: tables → occupied + chosen server; slot created (60m, or the reservation's duration); waiter `last_seated_at = now` and covers += size; counter advanced if the party was new; res/queue status → SEATED; active party cleared.
- *Mark Available* (applies to linked groups): completes ACTIVE slots, covers −= size, clears server.
- *Mark Lapsed* is manual.

**Sidebar:**

- Inspector:
  - Single table: label (editable; snapshot once per focus; blank falls back to the id), capacity ±, section select, status buttons, rotate, link controls.
  - Multi: bulk section, bulk status, six alignments (reject if they'd overlap), rotate, link controls.
- Fast seating: shows active party or "new party → label"; prefix input; type chips W/P/R/V; size stepper (disabled while a party is active); Auto-allocate & seat; Seat at selected; Add to queue.
- Queue & reservations (compact; hidden in the Reserve view): top 4 each.
- Sections & servers: tap a section to select its tables; per-section chips toggle waiter coverage; add section. No rename/delete (§6).
- Bus priority list.

**Predictor footer:**

- Six N-top tiles (6→1) show `+safeDepth | time`. Tapping appends that size to the sequence.
- Sequence row: one horizontal scroll row of fixed cards, 164×92. A vertical rail on the left (`writing-mode: vertical-rl`) shows "N-TOP". The body shows wait text and a 📍 table button that highlights the table on the canvas (and pans or switches floor if it's out of view). Top-right shows `#n`.
- Host-script line: label, size, target, server, wait.
- Predictions refresh via a 30s clock.

**Colors and semantics (keep consistent):**

- Ready = green `#10b981`.
- Tight = solid amber `#f59e0b`.
- Waiting = amber caution stripes: `repeating-linear-gradient(135deg, rgba(120,53,15,.65) 0 9px, rgba(245,158,11,.28) 9px 18px)` with border `#f59e0b` and text `#fcd34d`.
- No table = slate.
- Selected/active = sky `#38bdf8`.
- Late = red.
- **No blue for waiting.**

---

## 5. Cross-cutting rules

**Layout/CSS (class-based; one `<style>` block):**

- `box-sizing: border-box` everywhere. Borders are always 2px; only the color changes on hover/select (plus filter/box-shadow, never padding/border-width).
- Shared base classes: `.panel`, `.entry`, `.btn`, `.chip`, `.badge`, `.tile`, `.inp`. All entries share one base style.
- Breakpoints: ≤1000px → single column; ≤820px → reserve grid stacks. Use `minmax(0,1fr)` on grid children. `overflow-wrap: anywhere` on text.
- Horizontal scrollers (`.scroll-x`, `.seq-row`, Gantt) for nav, view toggle, load strip and sequence.
- Touch targets ≥30–34px, `touch-action: manipulation` on interactive elements.
- `html/body/#root` use the dark background, `min-height: 100dvh`, `overflow-x: clip`. No white bleed.

**History:** 50 deep. Snapshot = tables + associations + slots + waiters + reservations + queue. Selection, sequence, active party, UI prefs and the counter are not in it. The Undo/Redo buttons live in the canvas toolbar only.

**Persistence:**

- Key `host-seating-planner:v1`.
- Saved: all entities, `nextPartyId`, prefix, type, size, and UI prefs (view, gantt zoom, grid, zoom, pan, canvas size, simulator expanded, reservation filter).
- Debounced 250ms; flushed on `pagehide` and `visibilitychange`.
- On load: validate version and required arrays, else fall back to the seed. Quota or private-mode errors fail silently.
- Seed data is built relative to first-load time, then stored as absolute ISO strings.

**Integrity effects:** link normalization; reservations drop `table_id` if the table was deleted; an active party is cleared if its entity disappears.

---

## 6. Concerns / gaps (priority order)

1. **Untested in a browser:** pointer/touch drag, sticky Gantt, live-follow, double-tap. Verify first.
2. **Wait staff are not editable** beyond coverage toggles. Spec in §7.
3. **Mobile can't delete tables** (Delete key only) and Undo is hidden outside the canvas toolbar. Add a Delete button and a global undo/redo.
4. **Bus priority is a stub** (constant dirty time; no per-table dirty timestamp or demand weighting).
5. **Slot lifecycle is thin:** the turn is fixed at 60m (or the reservation duration), with no extend/early-clear. `LAPSED` is only derived visually, and the table's `lapsed` status is manual. No auto-promote of late reservations, and no alerts or chime.
6. **Reservations can't be edited** (time/size/name/notes). Only add/remove/status/assign.
7. **No section rename/delete, no floor rename/delete, no private-party blocking UI.** `blocked_private` exists but nothing sets it.
8. **"Shift audit replay" scrubber was removed** (it was non-functional).
9. **Gantt:** the range is fixed at mount (−6h/+36h), so a very long session needs a reload. Bucket alignment assumes whole-hour timezones. It re-renders \~144 header cells × rows every second (virtualize if slow). A slot bar sits only on the primary table of a link group.
10. **Prediction scope mismatch:** the sequence/predictor uses the active floor; the queue ETAs use all floors.
11. **Persistence is local only:** one device, no multi-tab sync, no migrations beyond the `v:1` check.
12. **Touch:** the canvas uses `touch-action: none`, so the page can't scroll under the canvas (use the Pan tool); no pinch-zoom.
13. **Double-tap remove has no confirm** (relies on undo).
14. **A11y:** tappable `div`s have no keyboard or ARIA roles.
15. **Single-file size:** every edit costs a large context, hence §8.

---

## 7. Wait staff management (to build)

**Current:** waiters are seeded. Only `section_ids` toggles and automatic `last_seated_at`/`active_cover_count` updates exist.

**Add a Staff panel** (sidebar section or modal):

- **List:** name, active toggle (clock in/out), covers, sections, rank.
- **Add:** name; defaults `is_active = true`, `section_ids = []`, `max_covers = 18`, `active_cover_count = 0`, `last_seated_at = null`. ID is `w_${Date.now()}`.
- **Edit:** rename; `max_covers`; optional `shift_start`/`shift_end` (auto-deactivate outside the shift).
- **Remove:** blocked while the waiter has ACTIVE slots or occupied tables assigned. Offer "reassign to…" first, plus force-remove that clears `assigned_waiter_id` on those tables.
- **Engine change:** replace the hard-coded 18 lockout with `waiter.max_covers`.
- **Manual overrides:**
  - Assign a server to the selected tables (sets `assigned_waiter_id`).
  - "Send to end of rotation" (`last_seated_at = now`).
  - "Skip next" (temporary −penalty, cleared on the next seating).
- **Fallbacks:** if a section has no active covering server, `pickServerFor` falls back to the top server overall and shows a warn status.
- All of it goes in history and persistence (already generic over `waiters`; the new fields default on load).
- **Acceptance:**
  - Add a server → appears in rotation and in the section chips.
  - Deactivate → excluded from picks.
  - Rename persists across refresh.
  - Removal is blocked while the server has covers.
  - A changed `max_covers` changes the lockout.

---

## 8. Proposed bundle layout (next step)

```
src/
  types.ts            entities, enums, HeatCode
  geometry.ts         TILE, dims, AABB, components, normalizeAssociations, seating units
  engines.ts          evaluateProgressiveSequence, lookahead, rotation, bus priority
  party.ts            labels, prefix sanitize, late/hold helpers, formatters
  seed.ts             createSeed
  storage.ts          load/write/validate/reset
  styles.css          all CSS from §5
  state/store.tsx     context + reducer (all actions: seat, link, reserve, queue, staff, history)
  hooks/              useHistory, usePersistence, useGestures (canvas), useTap (single/double)
  components/
    Canvas.tsx  Gantt.tsx  ReserveView.tsx  Inspector.tsx  FastSeating.tsx
    QueuePanel.tsx  SectionsPanel.tsx  StaffPanel.tsx  Predictor.tsx  Modals.tsx
  App.tsx             layout only
```

Rules: keep each file ≤ \~400 lines; pure logic in `geometry`/`engines`/`party` (no React); components take props plus dispatch; one place defines CSS class names (§5).

---

## 9. Rebuild acceptance checklist

1. First load shows seed data; refresh keeps every change; Reset data restores the seed.
2. Drag a table: snaps, doesn't overlap, group moves together, one undo reverts it; touch works.
3. Rotate and capacity ± resize correctly or are rejected on overlap.
4. Link/add-to-group/remove/dissolve; a moved apart table splits its group.
5. Sequence of N-tops shows cascading waits; waiting cards are amber-striped; 📍 highlights the table on the canvas; double-tap removes a card.
6. A reservation with an assigned table blocks walk-in READY_NOW for that table inside its hold window.
7. Late reservation → ⏫ Priority → queue as `…P-id`, sorted first.
8. Seating from queue/reservation consumes the entry and creates a slot; Mark Available frees it and lowers covers.
9. Gantt shows all floors; scrolling sideways pauses Live; Back to NOW resumes; label click focuses the canvas.
10. Narrow viewport (\~360px): single column, no horizontal page scroll, no white background, no layout shift on hover/select/status messages.
11. New staff member can be added, deactivated, renamed and removed under the §7 rules.