// Starter: a noon rush with mixed seating tastes; booths and the bar both run short. Play it any way you like.
import type {Scenario} from '../contracts/index.ts'
export const lunchRush: Scenario = {
  id: 'lunch-rush', title: 'Noon rush',
  brief: 'Tuesday noon. Two booths, three bar stools, a few plain tables. Couples want booths, regulars want the bar, one pair needs quiet.',
  seed: {
    tables: [
      {id: 'k1', label: 'K1', capacity: 4, x: 100, y: 60, w: 110, h: 64, feats: ['booth', 'banquette']},
      {id: 'k2', label: 'K2', capacity: 4, x: 100, y: 160, w: 110, h: 64, feats: ['booth', 'banquette', 'quiet']},
      {id: 'r1', label: 'R1', capacity: 2, x: 320, y: 60, w: 56, h: 56, feats: ['bar', 'hightop', 'loud']},
      {id: 'r2', label: 'R2', capacity: 2, x: 400, y: 60, w: 56, h: 56, feats: ['bar', 'hightop', 'loud']},
      {id: 'r3', label: 'R3', capacity: 2, x: 480, y: 60, w: 56, h: 56, feats: ['bar', 'hightop']},
      {id: 'm1', label: 'M1', capacity: 2, x: 320, y: 220, w: 56, h: 56, feats: ['chairs', 'quiet']},
      {id: 'm2', label: 'M2', capacity: 4, x: 420, y: 220, w: 72, h: 72, feats: ['chairs', 'window']},
      {id: 'm3', label: 'M3', capacity: 4, x: 420, y: 340, w: 72, h: 72, feats: ['chairs', 'roomy']},
    ],
    servers: [{id: 'sv1', name: 'Ana', sections: []}, {id: 'sv2', name: 'Ben', sections: []}],
    busy: [{table: 'k1', size: 3, minAgo: 25}, {table: 'r2', size: 1, minAgo: 15}, {table: 'm2', size: 4, minAgo: 40}],
  },
  steps: [
    {at: 0, do: 'arrive', key: 'hale', name: 'Hale', size: 2, kind: 'W', wants: [{feat: 'booth', level: 'strong', why: 'occasion', accord: 'all', said: true}]},
    {at: 1, do: 'arrive', key: 'ortiz', name: 'Ortiz', size: 1, kind: 'W', wants: [{feat: 'bar', level: 'strong', why: 'habit', accord: 'all', said: true}]},
    {at: 3, do: 'arrive', key: 'ward', name: 'Ward', size: 2, kind: 'W', wants: [{feat: 'quiet', level: 'strong', why: 'comfort', accord: 'all'}, {feat: 'booth', level: 'soft', why: 'nice', accord: 'one'}]},
    {at: 4, do: 'arrive', key: 'lund', name: 'Lund', size: 4, kind: 'W', wants: [{feat: 'booth', level: 'soft', why: 'bench', accord: 'most'}, {feat: 'loud', level: 'soft', why: 'comfort', accord: 'one', avoid: true}]},
    {at: 6, do: 'arrive', key: 'abe', name: 'Abe', size: 2, kind: 'W', wants: [{feat: 'bar', level: 'soft', why: 'habit', accord: 'one', said: true}, {feat: 'hightop', level: 'soft', why: 'nice', accord: 'one'}]},
    {at: 0, do: 'arrive', key: 'pike', name: 'Pike', size: 1, kind: 'W', wants: []},
    {at: 0, do: 'place', key: 'pike', table: 'r1', stage: 'seated'},
    {at: 9, do: 'ask', key: 'pike', reason: 'noise', stage: 'seated'},
  ],
}
