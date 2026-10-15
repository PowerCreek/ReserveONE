# Token-Frugality Protocols + Efficiency Log
Living file. Update the log whenever we catch waste; promote repeated lessons to protocols.

## Protocols (apply every turn)
- **T1 Read once, by need.** Read a file once, whole, in one call. Afterwards use `grep -n`/`sed -n` ranges, never re-`cat`. Spec lives at docs/SPEC.md; cite §numbers instead of re-reading.
- **T2 Plan before tools.** Decide the full set of edits first, then batch them into ONE bash call (heredocs) rather than many small create/str_replace calls.
- **T3 Silent success.** Commands print only failures/summary (`| tail -n 5`, `--silent`). Never dump whole files or logs.
- **T4 Typecheck, don't eyeball.** Verify with `tsc --noEmit` + build, not by viewing files back.
- **T5 Targeted edits.** Small changes via Artifact `edits` or sed/python replace; no full rewrites, no re-viewing a file just written.
- **T6 Small modules.** Files <= ~400 lines (spec §8) so any edit touches little context.
- **T7 Publish only at milestones** (each publish = user-visible checkpoint), not after every tweak.
- **T8 Trust the handoff.** Next agent reads docs/HANDOFF.md first (+ SPEC.md sections on demand), not the source tree.
- **T9 No narration of tool mechanics**; short status lines only.
- **T10 Resolve ambiguity with a sensible default**; record it in HANDOFF "Decisions" instead of asking.
- **T11 Shell portability.** /bin/sh here: no brace expansion. Use `bash -c` or explicit mkdir.

## Efficiency log (retrospective)
| # | Turn | What was inefficient | Cost | Protocol change |
|---|------|----------------------|------|-----------------|
| 1 | M0 | Spec (18.7KB) read in full once. Justified (sole source of truth); later turns use section refs. | ~5k tok | T1, T8 |
| 2 | M0 | Spec §8 says Vite; publishing needs one self-contained HTML. Chose esbuild single-file build up front instead of Vite-then-switch. | saved a rework | T2 |
| 3 | M0 | Used `{a,b}` brace expansion in /bin/sh; mkdir silently failed, so a whole batched call partly failed and had to be redone. | ~1 wasted call | T11 |
| 4 | M1 | Smoke script lacked `process.exit` (app timers kept Node alive) -> 300s hang, lost output. | 1 wasted call + wait | T12 |
| 5 | M1 | Bundled install + cleanup + build + test into ONE call: batching is good (T2) but unbounded commands must never share a call with the work that matters. | risk | T12 |

| 6 | M2 | Edit script had a leftover conditional on the first replacement; assertion aborted the whole batch (new files written, edits not applied) and cost a repair call. | 1 call | T14 |
| 7 | M2 | Smoke selector `startsWith('＋ Add')` matched the wrong button (floor nav). Test bug, not app bug, but cost a run. | 1 call | T15 |
| 8 | M2 | Good: wrote Gantt+Staff+Reserve+layout in 2 batched calls with zero re-reads; tsc caught 2 unused vars cheaply. | saved | T2,T4 |

| 9 | M4 | Pasted algo doc: sections 1-6 duplicated the already-built spec. Diffed against HANDOFF first, built only the deltas (zones, private-event state machine, chime, LAPSED_CLEAR). Did NOT re-copy the doc into the repo; mapped it in HANDOFF instead. | saved ~a full re-implementation + ~1.2k tok | T16 |
| 10 | M4 | Put time/state logic (eventState, reconcile, auto-lapse, ray casting, ellipse rotation) in pure fns and tested via esbuild+node (21 asserts, 1 call) instead of driving it through jsdom UI. | cheaper, sharper failures | T17 |
| 11 | M4 | Critique: edge-triggered alerts depend on a 30s tick; coarse but unverified in a live browser. Accepted for now, flagged in HANDOFF. | risk only | - |

| 12 | M5 | Edit batch aborted again on a wrong match string (`'BOOKED'},` vs `'BOOKED'}],`); because edits apply per-file all-or-nothing, a half-applied state cost a repair call. | 1 call | T18 |
| 13 | M5 | Rewrote store/Gantt/Reserve/Predictor wholesale instead of patching (>40% of each changed). More output tokens up front, zero edit failures, no re-reads. | net saved | T19 |
| 14 | M5 | Diff-based audit (one `diffAudit` in the reducer) replaced what would have been ~40 per-call-site log edits. Generic mechanism beats per-site instrumentation. | big saving | T20 |
| 15 | M5 | Smoke + unit written once from the known DOM contract; all 36+25 checks passed first run. | saved | T13,T17 |

| 16 | M6 | `.entry{overflow-wrap:anywhere}` was added in M1 as a 'safe default' and silently caused mid-word breaks in ETA/time/label data. Global CSS defaults propagate everywhere; root-caused instead of patching the ETA badge. | recurring UI bug | T21 |
| 17 | M6 | Consolidation audit: listed every duplicate path (reservation create/edit x2, queue add x2, undo/redo x2, section assign x2, double-tap vs button delete x2) and reduced each to ONE. Done in the same batch as the new feature. | prevents UX confusion | T22 |
| 18 | M6 | Smoke selector `.pbtn[1]` broke when a new button shifted indexes. Select by title/aria/text, never index. | 1 call | T23 |

| 19 | M7 | Needed preview + receipt for every quick action. Reused the pure `seatParty` as a dry run (`previewSeat`) instead of refactoring/re-reading it: preview and real action share one code path, so they cannot disagree. | saved a refactor + a class of bugs | T24 |

| 20 | M7 | Rule removal done as: edit + `grep` for leftover references + test the new invariant, all in one call (no file re-reads). Dead helper (`components`) deleted rather than left unused. | 1 call | T3,T4 |

| 21 | M8 | One edit-script anchor mismatched (`=A;` vs `=A,`). Two-phase edits (T18) meant nothing was half-applied, but I had to resend the whole script. Save long edit scripts to a file first so a retry is a one-line sed. | ~1 resend | T25 |
| 22 | M8 | Extracted pinch math + ledger bucketing + table states into pure modules (`pinch.ts`, `ledger.ts`) so touch/ledger logic is unit-tested without a device. Not testable here (listed in HANDOFF 'Needs real-device check'): pinch wiring, Gantt page-scroll chaining, locator popup layout on phones. | tests + honesty | T17 |

| 23 | M9 | Saved the edit script to /tmp/edits.py before running (T25): all anchors matched first try; edits + leftover-grep + typecheck + build + unit + smoke in one call. | 1 call | T25 |

| 24 | M10 | New feature reused existing pure engines (evaluateSequence, holdsFrom, ledger events) and consolidated the duplicated queue sort into one `queueOrder` (U2) instead of copying it. All 77 smoke + new unit checks passed first run. | 0 repairs | T17,T22 |

| 25 | M11 | Predictor was rewritten wholesale (>40% changed, T19) and the prediction is a pure function unit-tested against the real `seatParty` result, so the preview can't drift from behaviour. One smoke failure was my own regex (fixed, rerun smoke only). | 1 small rerun | T17,T19 |

| 26 | M12 | Appended unit-test blocks twice collided with earlier `const` names (r1, pl, lk…) → 2 wasted reruns. Wrap each appended block in `{ }` or prefix names. | 2 reruns | T27 |
| 27 | M12 | Whole-app time travel done at ONE chokepoint (a Date Proxy) instead of threading a clock through ~30 call sites; same idea as the diff-based audit. | big saving | T20 |

| 28 | M13 | Adding a chip labelled 'Seated' broke a test that matched buttons by `startsWith('Seat')`, and a 'no old buttons' test matched the new chips. Selectors must exclude look-alike controls (`:not(.chip)`) — T23 again. Also found and fixed a latent gap (promoted reservations stayed QUEUED after being seated from the queue) while tracing state flows. | 2 smoke reruns | T23 |

| 29 | M14 | Large turn: wrote all new modules first, then ONE saved edit script wired them (T25) and a second test script covered them; tests passed except one that depended on leftover UI selection (state the test relied on, now cleared explicitly). Numeric-input bug fixed at the root with one shared component + pure helpers rather than per-field patches (T20). | 1 rerun | T20,T25 |
| 30 | M15 | Container reset lost the whole M15 batch (written + typechecked, never mirrored or tested): rebuilt from the last published mirror, ~1 full re-implementation. Root cause: tests and mirroring were deferred behind an unfinished batch (T26 was honoured — it was listed — but nothing persisted it). Fixes: T29 (mirror after every typechecked batch), T30 (idempotent edit scripts, learned when the rebuild script failed on an anchor containing a real `−` instead of `-`). Positive: re-reading only the files being edited (not whole tree) and one asserted script kept the rebuild to ~6 tool calls; all tests were added in the same pass this time, so nothing is deferred. |

- **T12 Bound every command.** Prefix anything that could block (tests, servers, installs) with `timeout N`; node scripts that load app code end with `process.exit(0)`.
- **T13 Headless smoke before publish.** `node smoke.mjs` (jsdom) catches white-screen crashes for ~1 call, cheaper than a user round-trip. It does NOT test pointer/touch/layout; those need the user's browser.
- **T14 Edit scripts: one assert-guarded `sub()` per file, no conditionals;** copy match strings from HANDOFF/known source, run the script BEFORE writing dependent files.
- **T15 Scope test selectors to a panel** (`.panel` + h3 text), never global text prefixes.
- **T16 Diff before building.** When new docs arrive, list what is already implemented (HANDOFF/SPEC refs) and implement only deltas. Store a mapping + decisions, not a verbatim copy.
- **T17 Pure-first logic.** Time-based/state-machine behavior lives in pure functions with `tests/unit.mjs` (run: `timeout 60 node tests/unit.mjs`); use jsdom smoke only for wiring.
- **T18 Two-phase edits.** In edit scripts, assert ALL patterns across ALL files before writing anything, so a bad match never leaves a half-applied tree.
- **T19 Rewrite vs patch.** Patch when <~40% of a file changes; rewrite the file when more, and never view it first.
- **T20 Cross-cutting concerns go in one chokepoint** (reducer/context), not at each call site (audit, alerts, persistence).
- **T21 No line-breaking of operational data** (see HANDOFF 'UI guidelines'). Containers wrap between items; items never break. Prose only may wrap.
- **T22 One way per action.** Before adding a feature, grep for existing paths to the same outcome; redirect or remove duplicates in the same change. Record the single home in HANDOFF.
- **T23 Test selectors by title/aria/text, not index.**
- **T24 Quick actions show their references** (HANDOFF U4). Any auto/one-tap action previews its target before the click (where computable) and emits a receipt after; implement previews as dry-runs of the same pure function.
- **T25 Save long edit scripts to a file** (`/tmp/edits.py`) before running, so a failed anchor is fixed with a one-line sed, not a full resend.
- **T26 Deferred or untestable checks are listed, never implied.** Anything the headless run cannot exercise goes in HANDOFF 'Needs real-device check' with what to look for.
- **T27 Isolate appended test blocks** in `{ ... }` (or unique prefixes); shared top-level names in tests/unit.mjs collide silently until runtime.
- **T28 Numeric fields use `NumInput`** (HANDOFF U7); smoke tests clear any state they depend on (selection, filters) before acting.
- **T29 Persist work, not just context.** A container reset wiped an entire unpublished batch (new modules + edit script). After each coherent batch that typechecks, copy `src/` to the outputs mirror (`/mnt/user-data/outputs/hsp`) or commit to git — before running long tests, not after. Never leave a typechecked-but-unsaved batch overnight.
- **T30 Make edit scripts idempotent** (`rep()` skips when the new text is already present). A script that dies mid-way after partially applying is otherwise un-rerunnable.
