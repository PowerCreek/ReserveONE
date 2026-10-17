# Host procedures (v2)

Hands-on procedures for the host stand at this venue, written so practice drills can be built from them. The Strategy tab (`v2/ui/strategy*.ts`, read `engine.strategy`, contract `v2/contracts/strategy.ts`) is the planning surface these procedures use; the Queue tab is where a party is actually seated. Everything on the Strategy tab is advisory: it ranks and warns, it never seats.

Table names follow `v2/venue.ts` and `docs/v2/DOMAIN.md`.

## 0. The floor at a glance

| Area | Tables | Seats | Links (runs) | Notes |
|---|---|---|---|---|
| Main: booths | T1, T2, T3, T4 (top wall) | 6 each | none | D-shaped booths. Not for "large, no booths" parties. |
| Main: left quads | T5, T6, T7, T8 | 2 each | none | Quads are split by dividers; they do not merge. |
| Main: centre lane | T9, T10, T11, T12 | 4 each | T9-T10-T11-T12 | Last-resort merge (centre lane). T9, T10 accessible. |
| Main: right quads | T13, T14, T15, T16 | 2 each | none | |
| Main: banquettes | T17 (4, corner, by the door), T18 (4), T19 (2), T20 (4), T21 (2), T22 (4), T23 (4, corner) | 24 | T17-T18-T19-T20-T21-T22-T23 | The workhorse run: bench on the wall side, chairs on the aisle. |
| Main: T24 | T24 | 6 | none | Roomy booth on the bottom wall. Does not merge with T23. |
| Grotto | G1, G2, G3 / G4, G5, G6 | 4 each | G1-G2-G3, G4-G5-G6 | All chairs. Servers cannot see seatings: tell them. |
| Bar | B13 (2), B14 (3), B15 (4), B16 (3), B20 (3), B21 (4) | | B16-B15-B14, B20-B21 | B1-B12 stools are self-seat (never offered). B22 is the managers' desk (blocked). |
| Patio | P1, P2, P3 (2) / P4, P5, P6, P7 (6, round) | | none | Tops are dealt piecemeal across the crew. |
| Roof | RT1 (4 high), RT2 (2 high), RT3 (6 high), RT4-RT6, RT7-RT10 (4 each), Roof bar (10 stools) | | RT6-RT5-RT4, RT7-RT8-RT9-RT10, across RT6-RT7, RT5-RT8, RT4-RT9 | Roof bar is self-seat. Tell the servers up there. |

Rules of thumb that follow from the layout:
- Fours that link: the banquette run, the centre lane (last), the grotto lanes, the roof snake.
- Sixes that need no link: T1-T4, T24 (booths), P4-P7 (round), RT3 (high).
- Large (more than 5) with no booths: P4-P7, RT3, or a link (T18+T19+T20 = 10, G1+G2 = 8, RT7+RT8 = 8, RT4+RT9 across = 8, T9+T10 = 8 as a last resort).

## 1. Priority tiers

1. **Reservations.** A reservation inside the look-ahead window owns its table (or link). Every other decision is checked against it first: the Strategy tab's Risks panel names any seating that would squeeze one (`squeeze`).
2. **Priority wait list.** Call-aheads, then walk-ins raised by flags (VIP, accessibility, elderly, small children) and time waited. The Queue tab's priority queue shows the order and the reason for each row.
3. **Walk-ins are opportunistic filler.** A walk-in takes a table only when it fits inside the gap before that table's next commitment, or when the table has no commitment in the horizon. Filling gaps is how turns are won; a walk-in that blocks a reservation is how turns are lost twice (the walk-in sits, the reservation waits, the next turn slides).

Procedure when a party reaches the stand:
1. Is it a reservation or call-ahead? Seat it at its planned table (timeline shows it as the indigo bar). If its table is still turning, offer the wait or the next-best spot that strands nobody.
2. Otherwise check the priority queue: is anyone of the same size ahead of this party? Seat them first.
3. Only then place the walk-in, using the gap rule (section 3).

## 2. Reading the turn timeline

The Strategy tab's **Turn timeline** shows the next ~2.5 hours, one row per table, grouped by section (else by area), with the tables of one run kept next to each other.

- **Red bar (seated):** the table is occupied until it frees. Its end is the expected free time; the label shows guests seated.
- **Indigo bar (planned):** a reservation planned at this table, drawn as one turn from its time.
- **Amber bar (hold):** a hold you created keeps the table clear from when its gate opens until its end.
- **Dashed amber (gate):** the hold is waiting for its gate (a table to free, or a clock time).
- **Green tick (parity):** this table and a neighbour free at about the same time, so they can be linked for a bigger party at that minute.
- **⇔ after a label:** the table links with the named neighbours (its run).

Reading drill:
1. Scan each run left to right. Where two neighbours end their red bars within a few minutes of each other, that is a link opportunity (green tick).
2. Find every indigo bar. Look left of it: the gap between "now" (or the red bar's end) and the indigo bar is the walk-in window for that table. A two-top needs about 45-60 min, a four-top 60-75, a six 75-90.
3. Look for rows with no bars at all in the horizon: they are your free filler.
4. Click a table label to open its card (Sim tab) when you need its party, server or status.

## 3. Interleaving walk-ins with reservations and call-aheads

Goal: no lockout (a reservation arriving to no table) without being so careful that tables sit empty and turns are lost.

The gap rule:
- Gap = minutes from when the table frees (now, or its red bar's end) to its next commitment (indigo bar or hold).
- Seat a walk-in there if the gap is at least an average turn for that size plus a 10-minute buffer.
- If the gap is shorter, seat the walk-in only where its turn ends before the commitment, or at a table with no commitment.
- Never seat a walk-in on the last table of a size that a reservation within the next hour needs (the Risks panel calls this a squeeze). Exception: a second table of that size will be free in time (the timeline shows it).

Do not over-protect:
- A table held "just in case" with nothing on the timeline is a lost turn. Holds need a reason and an end time.
- A reservation 2 hours out does not justify an empty table now: a walk-in of 60-75 minutes fits.
- If two tables could take the reservation, fill one of them now.

Call-aheads sit between: treat their ETA as a soft reservation. Plan their table, but release it to the queue if they are more than the grace period late (`policy.seat.lateGraceMin`).

## 4. Parity: A and D seated, then B; link C for a 5-top

Take a run of four tables A-B-C-D. On the banquettes that is **T19 (A, 2) - T20 (B, 4) - T21 (C, 2) - T22 (D, 4)**.

1. A (T19) and D (T22) are seated.
2. Seat the next four-top at **B (T20)** soon after A, not at a table elsewhere. A and B now turn at about the same time: **parity**. When they both free, T19+T20 links into a six.
3. **C (T21)** stays open between B and D. It is a two-top on its own, but it is also the link piece: when either neighbour frees, C+B (T21+T20) or C+D (T21+T22) seats a **5-top** (6 seats).
4. Watch the green ticks on the timeline: they mark the minute a pair frees together.

Why: parity turns a row of small tables into a row of potential larger tables at predictable times, without holding anything empty. Seating B at random elsewhere scatters the free times and no link ever forms.

The same pattern works on the grotto lanes (G1-G2-G3: seat G1 and G3, then G2 when either frees early enough), the roof snake (RT4-RT5-RT6, and across to RT7-RT9) and the bar (B16-B15-B14).

## 5. Planning C to merge with B or D near a reservation

A reservation for 5 is due at 20:00 and the banquettes are busy.

1. Find the neighbours of the link piece C (T21): B (T20) and D (T22).
2. Read their red bars. Whichever frees closest before 20:00 (and at least 10 minutes before) is the partner.
3. Create a hold on **C (T21)** for 5, until 20:15, gated **when that partner frees** (Levers panel: pick T21, size 5, gate "When a table frees" = T20). Reason: "20:00 Rossi x5 on T20+T21".
4. Keep C free of walk-ins whose turn would run past the gate. A two-top that will be done by then is fine.
5. If the partner runs long (red bar slides past 20:00), switch the gate to the other neighbour (D, T22). If both run long, look for another six (T24, a booth, P4-P7, RT3) before the party arrives, not after.

## 6. Information tiers

How much you know about the next party changes how much you protect. Set it in the **Assumptions** bar; the suggestions follow.

| Tier | What you know | What to do |
|---|---|---|
| None | Nothing beyond reservations. | Plan only for reservations. Fill everything else greedily with the tightest fit. |
| Assume a 2-top | The usual next walk-in is a couple. | Keep one two-top (quads T5-T8, T13-T16, T19, T21, P1-P3) or a C link piece free at all times. |
| Assume a 3-4 top | A four-top is next. | Do not burn the last free four on a two (T9-T12, T17-T23 fours, grotto, roof). |
| Assume a 5-6 top | A six or a link is next. | Keep a booth (T1-T4, T24) or a parity pair ready; do not split the pair with a two. |
| Assume large (more than 5, no booths) | A big party that needs elbow room. | No booths. Keep P4-P7, RT3, or a run (T18+T19+T20, G lane, RT snake) ready. |
| X + N (second host) | You are addressing a party of X and a second host has seen parties of N behind them. | Set "Party at the door" to X and add each N under "Known behind it". Place them together: the joint suggestion seats X without taking the only table N needs. |
| Asked constraints | You asked the party (booth? patio? accessible? quiet?). | Record the wants at the stand; needs are hard filters, the ladder offers near matches first. |

Rule: the more you know, the less you protect blindly. With no info, protect only reservations. With X + N, protect exactly what N needs and nothing more.

## 7. Server balance: covers, party score and the rotation

- The rotation picks who gets the next table (Staff tab). It is primary; preferences only nudge within it.
- Balance by **covers**, not tables: a six is three times a two. The Strategy tab's **Server share** shows covers now plus planned (reservations already assigned count ahead of time).
- Party score: when two seatings are otherwise equal, give the larger party to the server with the fewest covers now + planned, so tip-earning stays level over the shift.
- "Most minus fewest" on the share panel should stay under one average party (about 3-4 covers). Above that, steer the next walk-ins to the low server's section (sectioned mode) or let the rotation catch up (rotation mode).
- A bogged-down server (covers well above the mean) is skipped until they recover, even if it is their turn.
- Bar pairs serve their own area and take no floor turn.

## 8. Hold and gate recipes

A hold keeps tables clear in the plan; it never blocks the floor by itself.

| Recipe | Tables | Size | Gate | Until | Reason example |
|---|---|---|---|---|---|
| Link for a reservation | the link piece (T21) | 5 | when the partner frees (T20) | reservation + 15 min | "20:00 Rossi x5 on T20+T21" |
| Late-evening large party | T18, T19, T20 | 9 | at 21:00 | 22:00 | "21:00 birthday x9, no booths" |
| Protect the last four | G4 | 4 | none | +45 min | "Second host: 4-top behind the couple" |
| Accessible arrival | T9 or T10 | 2-4 | at call-ahead ETA | ETA + 20 | "Call-ahead wheelchair, ETA 19:30" |
| Patio six after rain | P5 | 6 | at time | +60 | "Patio six requested for 19:45" |
| Roof link across the aisle | RT5, RT8 | 8 | when RT5 frees | +30 | "Corporate x8 on the roof" |

Rules:
1. Every hold has an end and a reason. Remove it as soon as the reason is gone.
2. Prefer a gate over an open hold: "when T20 frees" keeps T21 working until then.
3. Re-read a gated hold whenever its gate table's red bar moves.
4. A hold that keeps a table empty for more than one average turn of the size it protects is probably too cautious.

## 9. Decision checklist (at the stand)

1. Who is this? Reservation / call-ahead / priority wait / walk-in. Size? Wants (asked)?
2. Anyone of this size ahead in the priority queue? Seat them first.
3. Reservation due within the hour that needs a table of this size? Do not take its last table.
4. Gap rule: does this party's turn fit before the table's next commitment?
5. Can this seating create parity (next to a table that frees at the same time)?
6. Does it break a link piece or a gated hold? Pick another table if one fits.
7. Assumption: what is the next party likely to be? Leave that table free if you can.
8. Server share: is the server this gives the table to already the high one?
9. Tell the server where they cannot see (grotto, patio, roof).
10. Re-read the timeline after you seat.

## 10. Scenario cards (drills)

Each card: setup, options, best move, why. Times are clock times; turns are about 45-60 min for a two, 60-75 for a four, 75-90 for a six.

### Card 1: The 19:00 four and the walk-in pair
- **Setup:** 18:05. T20 is free; reservation Patel x4 at 19:00 is planned on T20. A walk-in couple arrives. T19 is free too.
- **Options:** (a) the couple at T20; (b) the couple at T19; (c) the couple at a quad (T13).
- **Best move:** (b) T19, or (c) if you want T19 for the parity later.
- **Why:** T20 has a 55-minute gap, too tight for a couple plus buffer; T19 has no commitment and sits beside T20 (parity once Patel is seated).

### Card 2: A and D seated, then B
- **Setup:** 18:30. T19 (2) seated at 18:20, T22 (4) seated at 18:25. T20 and T21 free. A walk-in four arrives; T11 is also free.
- **Options:** (a) T11; (b) T20; (c) T21+T20.
- **Best move:** (b) T20.
- **Why:** T19 and T20 now free together around 19:30 (link for six), and T21 stays the link piece for a 5-top with T20 or T22. T11 is centre lane and scatters the free times.

### Card 3: A 5-top reservation with no free six
- **Setup:** 19:15. Reservation Rossi x5 at 20:00. Booths T1-T4 and T24 seated until 20:30+. T20 (4) frees about 19:45, T22 (4) about 20:10. T21 (2) is free.
- **Options:** (a) seat a walk-in couple at T21 now; (b) hold T21 gated on T20; (c) wait for a booth.
- **Best move:** (b) hold T21 for 5 until 20:15, gate "when T20 frees", reason "Rossi x5 on T20+T21". A couple at T21 is fine only if they would leave by 19:45 (they will not).
- **Why:** T20 frees before 20:00, T22 after; the gated hold keeps the plan honest and the timeline shows the gate.

### Card 4: No info vs assume a four
- **Setup:** 18:00, quiet. Free: T9, T12, G4, T13, T15. A walk-in couple arrives. No reservations before 19:30.
- **Options:** (a) T12; (b) T13.
- **Best move:** with **no assumption**, either fits; take the tightest (T13). With **assume a 3-4 top**, definitely T13: do not burn a four on a two.
- **Why:** the tightest fit is the default; the assumption only sharpens it. A couple on a four is lost capacity for the next four.

### Card 5: X + N from the second host
- **Setup:** 19:00. You are greeting a party of 2. The second host says a 4 and a 6 are behind them. Free: T21 (2), T20 (4), P5 (6), T13 (2).
- **Options:** (a) the couple at T20; (b) couple at T13, plan the 4 at T20 and the 6 at P5.
- **Best move:** (b). Set "Party at the door" = 2, add 4 and 6 under "Known behind it"; the joint suggestion places all three.
- **Why:** putting the couple on T20 would leave the four with T21 alone (too small). The joint placement uses every table at its size.

### Card 6: Large party, no booths
- **Setup:** 20:30. Walk-in party of 8, they ask for space ("no booths"). Free: T1 (booth 6), RT7, RT8 (4 each, adjacent), G1 (4), T10 (4).
- **Options:** (a) T1 plus a chair; (b) RT7+RT8; (c) G1 plus something; (d) T9+T10.
- **Best move:** (b) RT7+RT8.
- **Why:** booths are out by the guest's constraint; RT7-RT8 is a run on the roof (8 seats). T9+T10 is the centre lane, last resort. Tell the roof server.

### Card 7: Too cautious
- **Setup:** 17:45. You held T18, T19, T20 "for a big party later" without a time. Three walk-in fours have waited 20 minutes; the next reservation on those tables is 21:00.
- **Options:** (a) keep the hold; (b) remove it and seat two of the fours; (c) convert to a gated hold at 21:00.
- **Best move:** (c), then seat the fours at T18 and T20 now.
- **Why:** a 3-hour gap holds two full turns. The gated hold protects 21:00 without losing them.

### Card 8: Balancing the share
- **Setup:** Rotation mode. Server share: Ana 14 now + 6 planned, Bo 6 + 0, Cy 9 + 4. A walk-in six arrives; the rotation has Cy next, but Bo is far behind.
- **Options:** (a) give the six to Cy; (b) to Bo; (c) to Ana.
- **Best move:** follow the rotation (Cy) unless the spread (Ana 20 vs Bo 6 = 14) says the rotation is not catching up; here, skip to Bo by giving Cy the next two-top instead.
- **Why:** covers, not tables, drive earnings. Most minus fewest above one average party means steer the next big party to the low server.

### Card 9: The late call-ahead
- **Setup:** 19:40. Call-ahead Nguyen x4, ETA 19:30, has not arrived; G2 has been held for them. A walk-in four is waiting.
- **Options:** (a) keep holding G2; (b) seat the walk-in at G2 and plan Nguyen on G5 (frees 19:55).
- **Best move:** (b) once the call-ahead is past the grace period.
- **Why:** a call-ahead is a soft reservation. Past grace, the table goes back to the queue; the timeline shows a next four in time.

### Card 10: Accessibility first
- **Setup:** 18:50. Reservation Moreau x3 at 19:00, wheelchair. T9 and T10 (accessible) are both seated; T10 frees at 18:55. A walk-in couple asks for T10.
- **Options:** (a) the couple at T10; (b) hold T10 for Moreau, gate "when T10 frees", couple at a quad.
- **Best move:** (b).
- **Why:** the accessible table is a need, not a taste; the couple has many equal options.
