// Host-service registries (C3, C5): every qualifier, feature, reason, response, ladder step is a row of data.
// Extend by spreading new rows into `policy.host.<registry>`; engine functions look rows up by id and never branch on them.
import type {Level, PType} from './model.ts'
export type Stage = 'arrived' | 'seated' // after the host led the party: at the table, not yet / already seated
export type Reg<T> = Record<string, T>
/** Feature a spot can carry. `near` = acceptable stand-ins, best first (the substitution rung of the ladder). */
export interface FeatDef {label: string; group: 'seat' | 'zone' | 'air' | 'access'; near: string[]}
/** Why a party wants a feature: `mult` scales the want's score; `flavour` tells the host how negotiable it is. */
export interface WhyDef {label: string; flavour: 'function' | 'taste' | 'occasion'; mult: number}
/** Fallback ladder step. `kind` selects an engine rung builder (exact|wait|near|relax|elsewhere); the row is its parameters. Say-templates use {party} {spot} {gives} {lacks} {min}. */
export interface StepDef {kind: 'exact' | 'wait' | 'near' | 'relax' | 'elsewhere'; say: string; maxWaitMin?: Partial<Record<Level, number>>; drops?: Level[]}
/** Temporal thresholds, minutes. Late and lapse stay in `policy.seat` (lateGraceMin, lapsedClearMin). */
export interface Clock {quoteTolMin: number; holdMin: number; aheadMin: number; patienceMin: Record<PType, number>; escortMin: number; answerMin: number; reseatWindowMin: number}
/** Re-seat reason: what the party seeks or avoids once it asks for another table; `urgency` scales the sentiment at stake. */
export interface ReasonDef {label: string; seek: string[]; avoid: string[]; level: Level; urgency: number; stages: Stage[]; says: string}
/** One consequence of a host response. `mood` is the base sentiment delta; engine scales it by reason urgency and stage. */
export interface Out {move: 'swap' | 'offer' | 'stay'; mood: number; says: string}
/** Host response: `then.spot` applies when a spot satisfying the reason is free, `then.none` otherwise. */
export interface ResponseDef {label: string; host: string; then: {spot: Out; none: Out}}
export interface Host {
  feats: Reg<FeatDef>
  whys: Reg<WhyDef>
  score: {level: Record<Level, number>; avoid: number; accord: Record<'all' | 'most' | 'one', number>; slack: number} // slack = penalty per spare cover
  ladder: StepDef[]
  clock: Clock
  reasons: Reg<ReasonDef>
  responses: Reg<ResponseDef>
  options: Reg<string[]> // reason id (or '*') -> response ids offered to the host
  reply: {stage: Record<Stage, number>} // sentiment multiplier per stage
}
const keep: Out = {move: 'stay', mood: -2, says: 'I understand, thanks for explaining.'}
const swap: Out = {move: 'swap', mood: 3, says: 'Wonderful, thank you for moving us.'}
const offer: Out = {move: 'offer', mood: 1, says: 'That could work, we will take a look.'}
export const defaultHost: Host = {
  feats: {
    booth: {label: 'booth', group: 'seat', near: ['banquette']}, banquette: {label: 'banquette', group: 'seat', near: ['booth']}, chairs: {label: 'chairs', group: 'seat', near: []},
    bar: {label: 'bar', group: 'seat', near: ['hightop']}, hightop: {label: 'high-top', group: 'seat', near: ['bar']}, roomy: {label: 'extra room', group: 'seat', near: []},
    patio: {label: 'patio', group: 'zone', near: ['window']}, window: {label: 'window', group: 'zone', near: ['patio']}, quiet: {label: 'quiet', group: 'air', near: []},
    loud: {label: 'loud', group: 'air', near: []}, door: {label: 'by the door', group: 'air', near: []}, sunny: {label: 'sun glare', group: 'air', near: []}, accessible: {label: 'accessible', group: 'access', near: []},
  },
  whys: {
    bench: {label: 'the bench side suits us', flavour: 'function', mult: 1.5}, mobility: {label: 'mobility', flavour: 'function', mult: 3}, comfort: {label: 'comfort', flavour: 'function', mult: 1},
    occasion: {label: 'a celebration', flavour: 'occasion', mult: 1.2}, habit: {label: 'we always sit there', flavour: 'taste', mult: 0.75}, nice: {label: 'they are just nice', flavour: 'taste', mult: 0.5},
  },
  score: {level: {need: 1000, strong: 10, soft: 3}, avoid: -1, accord: {all: 1, most: 0.75, one: 0.5}, slack: 0.5},
  ladder: [
    {kind: 'exact', say: '{spot} is ready for {party}.'},
    {kind: 'wait', maxWaitMin: {strong: 15, soft: 10}, say: 'A {gives} table opens in {min} min: would {party} like to wait?'},
    {kind: 'near', say: '{spot} has {gives}, though not {lacks}: would that suit {party}?'},
    {kind: 'relax', drops: ['soft'], say: '{spot} is ready now, without {lacks}: would that suit {party}?'},
    {kind: 'elsewhere', say: 'We can seat {party} at {spot} on another floor: shall we?'},
  ],
  clock: {quoteTolMin: 5, holdMin: 10, aheadMin: 30, patienceMin: {W: 25, P: 15, R: 10, V: 10}, escortMin: 2, answerMin: 3, reseatWindowMin: 10},
  reasons: {
    draft: {label: 'draft', seek: [], avoid: ['door'], level: 'strong', urgency: 0.5, stages: ['arrived', 'seated'], says: 'It is drafty here.'},
    noise: {label: 'noise', seek: ['quiet'], avoid: ['loud'], level: 'strong', urgency: 0.5, stages: ['arrived', 'seated'], says: 'It is too loud for us to talk.'},
    view: {label: 'view', seek: ['window'], avoid: [], level: 'soft', urgency: 0.25, stages: ['arrived'], says: 'Could we sit by the window?'},
    sun: {label: 'sun', seek: [], avoid: ['sunny'], level: 'strong', urgency: 0.5, stages: ['arrived', 'seated'], says: 'The sun is in our eyes.'},
    size: {label: 'size', seek: ['roomy'], avoid: [], level: 'strong', urgency: 0.5, stages: ['arrived', 'seated'], says: 'We need more room.'},
    accessibility: {label: 'accessibility', seek: ['accessible'], avoid: [], level: 'need', urgency: 1, stages: ['arrived', 'seated'], says: 'This table is hard for us to reach.'},
    mood: {label: 'mood', seek: [], avoid: [], level: 'soft', urgency: 0.25, stages: ['arrived', 'seated'], says: 'It just does not feel right.'},
    section: {label: 'wrong section', seek: [], avoid: [], level: 'soft', urgency: 0.25, stages: ['arrived'], says: 'We asked for a different section.'},
  },
  responses: {
    swap: {label: 'Move them', host: 'Let me move you to {spot}.', then: {spot: swap, none: {move: 'stay', mood: -3, says: 'You offered a move that was not there.'}}},
    offer: {label: 'Offer the next best', host: 'The closest I have is {spot}: shall we try it?', then: {spot: offer, none: keep}},
    hold: {label: 'Offer to wait', host: 'I can move you to {spot} when it frees up.', then: {spot: {move: 'offer', mood: 0, says: 'Fine, we will wait for it.'}, none: keep}},
    explain: {label: 'Explain and care', host: 'I hear you; here is what I can do for this table.', then: {spot: keep, none: {move: 'stay', mood: 0, says: 'Thank you for being honest.'}}},
    refuse: {label: 'Say no', host: 'I am afraid that is not possible.', then: {spot: {move: 'stay', mood: -4, says: 'There was a table, and you said no.'}, none: {move: 'stay', mood: -3, says: 'That is disappointing.'}}},
  },
  options: {'*': ['swap', 'offer', 'hold', 'explain', 'refuse'], accessibility: ['swap', 'offer', 'refuse']},
  reply: {stage: {arrived: 1, seated: 1.5}},
}
