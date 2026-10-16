# host service domain (mind-map)
Purpose: a host-stand training tool. Each guest party is input to the seating state; host decisions route it under policy and time thresholds; the 2D sim lets a player run a scenario and judge whether the flows read as good guest care.
Leaf notation: `leaf` -> home. Homes: `comp:` component (contracts/model.ts) | `policy:` field (policy.host.* in contracts/host.ts, else policy.*) | `fn:` engine function | `ev:` sim event (contracts/sim.ts) | `metric:` rubric id (policy.host.rubric).
Extension rule: a new feature, why, reason, response, step, metric or scenario is one row of data; engine functions look rows up by id.

host service
- greet
  - host walks to the door, speaks first -> ev: greeted; task: HostTask `greet`
  - party identity (num, label, kind W/P/R/V, size) -> comp: party
- intake (party facts, qualifiers)
  - facts: size, kind, reservation or queue -> comp: party, reservation, queue
  - qualifier = feature + level (need | strong | soft) + why + accord (all | most | one) -> comp: wants.list (type Want)
    - level weights, avoid sign, accord weights -> policy: host.score
    - why (bench = function, nice = taste, occasion, mobility) with multiplier -> policy: host.whys
    - volunteered (`said`) vs asked: the host asks, then records -> fn: intake; comp: wants.heard; ev: heard; metric: heard
  - spot features: booth, banquette, chairs, bar, hightop, quiet, window, patio, accessible, door, sunny, loud, roomy -> comp: feat.tags (spot unions members in spot.feats); policy: host.feats
  - stand-ins for a feature (booth ~ banquette) -> policy: host.feats[].near
- route
  - match: score every spot for the party; needs are hard filters -> fn: match -> Fit[] (met, missed, waitMin)
    - capacity and tightest-fit baseline -> fn: fit, spots (existing); policy: seat
    - queue order and tiers -> fn: queueOrder (existing); policy: queue.tier; metric: fair
  - fallback ladder when the preferred feature has run out -> fn: ladder -> Rung[]; policy: host.ladder
    - exact: the ready match -> ladder step kind exact
    - wait: a matching spot frees within the tolerance for the level -> kind wait; policy: host.ladder[].maxWaitMin
    - near: a stand-in feature now -> kind near; policy: host.feats[].near
    - relax: drop soft wants, never need -> kind relax; policy: host.ladder[].drops
    - elsewhere: another floor or section -> kind elsewhere
    - host proposes, party answers yes or no -> comp: offer; ev: offered, answered
  - thresholds (minutes)
    - quote / ETA to a walk-in -> fn: eta; ev: quoted; policy: host.clock.quoteTolMin; metric: quote
    - hold window on a spot offered to a party -> comp: offer.at; policy: host.clock.holdMin
    - lookahead: how far ahead the host plans -> fn: lookahead; policy: host.clock.aheadMin, look
    - wait tolerance per kind -> policy: host.clock.patienceMin; metric: wait
    - answer deadline for an offer -> policy: host.clock.answerMin; comp: offer.status = lapsed
    - late and lapse for reservations and slots -> fn: reconcile; policy: seat.lateGraceMin, seat.lapsedClearMin
  - server pick and covers -> fn: serverFor, rotate; policy: rotation; metric: load
- escort
  - lead the party to the table -> HostTask `lead`; ev: led (arrived, not yet seated)
  - seat the party -> fn: seat; ev: seated; comp: slot
  - escort walk time -> policy: host.clock.escortMin, sim.walkPxPerSec
- re-seat requests (after led: stage arrived | seated)
  - the party raises a reason: draft, noise, view, sun, size, accessibility, mood, wrong section -> fn: ask; comp: request; ev: asked; policy: host.reasons (seek, avoid, level, urgency, stages)
  - host response options per reason -> fn: options; policy: host.options
  - responses: swap, offer, hold, explain, refuse -> fn: respond; policy: host.responses (host script, then.spot / then.none outcomes)
  - outcome: move or stay, sentiment delta scaled by urgency and stage -> ev: replied, moved, mood; policy: host.reply.stage; comp: mood
- service recovery
  - acknowledge the reason before the fix; name what is gained and missed -> Rung.say, Option.say (templates in policy)
  - comp or care when no table fits -> policy: host.responses.explain; metric: recover
  - guest sentiment trend per party -> comp: mood.score; ev: mood; metric: mood
- scenario / assessment
  - scenario = seed (room, crew, busy tables) + steps (arrive, place, ask) + expect + weights -> type Scenario (contracts/scenario.ts); data in v2/scenarios/*.ts; registry v2/scenarios/index.ts
  - runner plays steps into the sim at their minute; the player acts as host -> ui lane (scenario runner)
  - trace = stamped SimEvent | HostEvent -> type Trace
  - assess grades the trace on the rubric and the scenario's expectations -> fn: assess -> Assessment {total, grade, scores[], checks[]}; policy: host.rubric, host.pass
  - expectations carry a teaching sentence (`why`) shown as the check line -> Expect.why

## assessment rubric (policy.host.rubric; value -> grade by good / ok thresholds -> one sentence)
| metric | value | feedback sentence template (good tier shown; ok and poor tiers live in policy) |
| --- | --- | --- |
| quote | mean abs minutes, quoted vs actual | "You quoted {quoted} min and seated {party} at {actual}: an honest quote." |
| wait | actual wait as % of patience | "{party} waited {actual} min, well inside their tolerance." |
| need | % of needs met | "Every need was met first, as {party} deserved." |
| pref | % of preference weight met | "{party} got {met}: a well-matched table." |
| fair | tier or arrival inversions | "Parties were routed in tier and arrival order, with needs first." |
| load | max-min covers across servers | "Covers stayed within {delta} between servers." |
| mood | mean mood delta | "Guests left happier than they arrived." |
| recover | mean mood delta over requests | "You met {party} request for {reason} with {response}: well recovered." |
| heard | % of wants recorded before routing | "You asked about every preference before routing." |
Total = weighted mean of grade points (good 1, ok 0.5, poor 0) x 100; `grade` = good at >= policy.host.pass. Each Score names the party or spot ids it came from (`refs`), so the panel can highlight them.
