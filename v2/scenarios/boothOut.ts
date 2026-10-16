// Two parties want a booth; one booth is free. The bench-side need goes first; the other party is offered the ladder.
import type {Scenario} from '../contracts/index.ts'
export const boothOut: Scenario = {
  id: 'booth-out', title: 'The last booth', learn: 'Ask why a party wants a booth, give it to the functional reason, and offer the other party a warm alternative.',
  brief: 'Friday 6 pm. Three booths, two already seated. Okafor and Chen both ask for a booth.',
  seed: {
    tables: [
      {id: 'b1', label: 'B1', capacity: 4, x: 100, y: 60, w: 110, h: 64, feats: ['booth', 'banquette', 'quiet']},
      {id: 'b2', label: 'B2', capacity: 4, x: 100, y: 160, w: 110, h: 64, feats: ['booth', 'banquette', 'quiet']},
      {id: 'b3', label: 'B3', capacity: 4, x: 100, y: 260, w: 110, h: 64, feats: ['booth', 'banquette']},
      {id: 'w1', label: 'W1', capacity: 4, x: 300, y: 60, w: 72, h: 72, feats: ['chairs', 'window']},
      {id: 'c1', label: 'C1', capacity: 4, x: 300, y: 180, w: 72, h: 72, feats: ['chairs', 'quiet']},
    ],
    servers: [{id: 'sv1', name: 'Ana', sections: []}],
    busy: [{table: 'b1', size: 4, minAgo: 30}, {table: 'b2', size: 3, minAgo: 55}],
  },
  steps: [
    {at: 0, do: 'arrive', key: 'okafor', name: 'Okafor', size: 4, kind: 'W', wants: [{feat: 'booth', level: 'strong', why: 'bench', accord: 'all'}]},
    {at: 1, do: 'arrive', key: 'chen', name: 'Chen', size: 4, kind: 'W', wants: [{feat: 'booth', level: 'soft', why: 'nice', accord: 'one', said: true}]},
  ],
  expect: [
    {id: 'bench-first', key: 'okafor', spot: ['b3'], why: 'A functional, shared reason outranks taste: ask why before you pick.'},
    {id: 'chen-offered', key: 'chen', feats: ['banquette', 'window'], waitMaxMin: 15, why: 'A soft want is met by the nearest stand-in or a short wait, offered in the host\'s words.'},
    {id: 'chen-happy', key: 'chen', moodMin: 0, why: 'Naming what is gained and what is missing keeps the party warm.'},
  ],
}
