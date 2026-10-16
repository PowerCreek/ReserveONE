# host service domain (mind-map)
Purpose: a host-stand training tool. Each guest party is input to the seating state; host decisions route it under policy and time thresholds; the 2D sim is a free-play sandbox where the player practises everything a host does and guests react naturally.
Leaf notation: `leaf` -> home. Homes: `comp:` component (contracts/model.ts) | `policy:` field (policy.host.* in contracts/host.ts, else policy.*) | `fn:` engine function | `ev:` sim event (contracts/sim.ts).
Extension rule: a new feature, why, reason, response, step or starter is one row of data; engine functions look rows up by id.

host service
- greet
  - host walks to the door, speaks first -> ev: greeted; task: HostTask `greet`
  - party identity (num, label, kind W/P/R/V, size) -> comp: party
- intake (party facts, qualifiers)
  - facts: size, kind, reservation or queue -> comp: party, reservation, queue
  - qualifier = feature + level (need | strong | soft) + why + accord (all | most | one) -> comp: wants.list (type Want)
    - level weights, avoid sign, accord weights -> policy: host.score
    - why (bench = function, nice = taste, occasion, mobility) with multiplier -> policy: host.whys
    - volunteered (`said`) vs asked: the host asks, then records -> fn: intake; comp: wants.heard; ev: heard
  - spot features: booth, banquette, chairs, bar, hightop, quiet, window, patio, accessible, door, sunny, loud, roomy -> comp: feat.tags (spot unions members in spot.feats); policy: host.feats
  - stand-ins for a feature (booth ~ banquette) -> policy: host.feats[].near
- route
  - match: score every spot for the party; needs are hard filters -> fn: match -> Fit[] (met, missed, waitMin)
    - capacity and tightest-fit baseline -> fn: fit, spots (existing); policy: seat
    - queue order and tiers -> fn: queueOrder (existing); policy: queue.tier
  - fallback ladder when the preferred feature has run out -> fn: ladder -> Rung[]; policy: host.ladder
    - exact: the ready match -> ladder step kind exact
    - wait: a matching spot frees within the tolerance for the level -> kind wait; policy: host.ladder[].maxWaitMin
    - near: a stand-in feature now -> kind near; policy: host.feats[].near
    - relax: drop soft wants, never need -> kind relax; policy: host.ladder[].drops
    - elsewhere: another floor or section -> kind elsewhere
    - host proposes, party answers yes or no -> comp: offer; ev: offered, answered
  - thresholds (minutes)
    - quote / ETA to a walk-in -> fn: eta; ev: quoted; policy: host.clock.quoteTolMin
    - hold window on a spot offered to a party -> comp: offer.at; policy: host.clock.holdMin
    - lookahead: how far ahead the host plans -> fn: lookahead; policy: host.clock.aheadMin, look
    - wait tolerance per kind -> policy: host.clock.patienceMin
    - answer deadline for an offer -> policy: host.clock.answerMin; comp: offer.status = lapsed
    - late and lapse for reservations and slots -> fn: reconcile; policy: seat.lateGraceMin, seat.lapsedClearMin
  - server pick and covers -> fn: serverFor, rotate; policy: rotation
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
  - comp or care when no table fits -> policy: host.responses.explain
  - guest sentiment trend per party -> comp: mood.score; ev: mood
- free play (no rubric, grades or expected outcomes)
  - scenario = starter setup: seed (room, crew, busy tables) + timed arrivals, placements and requests -> type Scenario (contracts/scenario.ts); data in v2/scenarios/*.ts; registry v2/scenarios/index.ts
  - the player acts as host and may do anything: greet, ask, quote, offer, seat, reply, ignore -> ui lane (runner plays the starter's steps at their minute, then the sandbox runs on)
  - guests react naturally; their reactions are the feedback -> comp: mood; ev: mood, answered, replied, left
    - mood moves with each host action (replies scaled by reason urgency and stage) -> policy: host.reply
    - patience runs down while a party waits -> policy: host.clock.patienceMin; a party past it leaves -> ev: left
    - an offer is accepted or declined by the party's wants; a decline can end in leaving the list -> ev: answered, left
  - the event log narrates what happened, host and guest alike, e.g. "Chen party declined the banquette and left the list" -> ui: eventlog describers for SimEvent | HostEvent
