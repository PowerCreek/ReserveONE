// Starter: the weather turns and patio guests ask for shade, shelter or a different table. Play it any way you like.
import type {Scenario} from '../contracts/index.ts'
export const patioSwing: Scenario = {
  id: 'patio-swing', title: 'Patio weather',
  brief: 'Late afternoon sun on the patio, a breeze at the door. Guests want the patio, then ask to move for sun or draft.',
  seed: {
    tables: [
      {id: 'p1', label: 'P1', capacity: 2, x: 560, y: 80, w: 56, h: 56, feats: ['chairs', 'patio', 'sunny']},
      {id: 'p2', label: 'P2', capacity: 4, x: 560, y: 200, w: 72, h: 72, feats: ['chairs', 'patio', 'sunny']},
      {id: 'p3', label: 'P3', capacity: 4, x: 560, y: 320, w: 72, h: 72, feats: ['chairs', 'patio']},
      {id: 'n1', label: 'N1', capacity: 2, x: 120, y: 120, w: 56, h: 56, feats: ['chairs', 'door']},
      {id: 'n2', label: 'N2', capacity: 4, x: 300, y: 100, w: 72, h: 72, feats: ['chairs', 'window', 'sunny']},
      {id: 'n3', label: 'N3', capacity: 4, x: 300, y: 260, w: 72, h: 72, feats: ['chairs', 'window', 'quiet']},
      {id: 'n4', label: 'N4', capacity: 2, x: 300, y: 400, w: 56, h: 56, feats: ['chairs', 'quiet']},
    ],
    servers: [{id: 'sv1', name: 'Ana', sections: []}, {id: 'sv2', name: 'Ben', sections: []}],
    busy: [{table: 'p3', size: 3, minAgo: 20}],
  },
  steps: [
    {at: 0, do: 'arrive', key: 'moss', name: 'Moss', size: 2, kind: 'W', wants: [{feat: 'patio', level: 'strong', why: 'nice', accord: 'all', said: true}, {feat: 'sunny', level: 'soft', why: 'comfort', accord: 'one', avoid: true}]},
    {at: 2, do: 'arrive', key: 'cole', name: 'Cole', size: 4, kind: 'W', wants: [{feat: 'patio', level: 'soft', why: 'habit', accord: 'most', said: true}]},
    {at: 5, do: 'arrive', key: 'iyer', name: 'Iyer', size: 2, kind: 'W', wants: [{feat: 'window', level: 'soft', why: 'nice', accord: 'one'}, {feat: 'door', level: 'strong', why: 'comfort', accord: 'all', avoid: true}]},
    {at: 0, do: 'arrive', key: 'dunn', name: 'Dunn', size: 2, kind: 'W', wants: []},
    {at: 0, do: 'place', key: 'dunn', table: 'p1', stage: 'seated'},
    {at: 4, do: 'ask', key: 'dunn', reason: 'sun', stage: 'seated'},
    {at: 0, do: 'arrive', key: 'fox', name: 'Fox', size: 2, kind: 'W', wants: []},
    {at: 0, do: 'place', key: 'fox', table: 'n1', stage: 'arrived'},
    {at: 8, do: 'ask', key: 'fox', reason: 'draft', stage: 'arrived'},
  ],
}
