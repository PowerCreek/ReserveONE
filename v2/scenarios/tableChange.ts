// Starter: parties ask to change table after being led; one has a free answer, one does not.
import type {Scenario} from '../contracts/index.ts'
export const tableChange: Scenario = {
  id: 'table-change', title: 'Can we move?',
  brief: 'Garcia was led to a table by the door and feels the draft. Tanaka, already seated, finds the room too loud.',
  seed: {
    tables: [
      {id: 'd1', label: 'D1', capacity: 2, x: 60, y: 120, w: 56, h: 56, feats: ['chairs', 'door']},
      {id: 'q1', label: 'Q1', capacity: 2, x: 300, y: 80, w: 56, h: 56, feats: ['chairs', 'quiet', 'window']},
      {id: 'l1', label: 'L1', capacity: 2, x: 200, y: 260, w: 56, h: 56, feats: ['chairs', 'loud']},
      {id: 'l2', label: 'L2', capacity: 4, x: 300, y: 260, w: 72, h: 72, feats: ['chairs', 'loud', 'bar']},
    ],
    servers: [{id: 'sv1', name: 'Ana', sections: []}],
    busy: [{table: 'l2', size: 4, minAgo: 10}],
  },
  steps: [
    {at: 0, do: 'arrive', key: 'garcia', name: 'Garcia', size: 2, kind: 'W', wants: []},
    {at: 0, do: 'place', key: 'garcia', table: 'd1', stage: 'arrived'},
    {at: 3, do: 'ask', key: 'garcia', reason: 'draft', stage: 'arrived'},
    {at: 0, do: 'arrive', key: 'tanaka', name: 'Tanaka', size: 2, kind: 'W', wants: []},
    {at: 0, do: 'place', key: 'tanaka', table: 'l1', stage: 'seated'},
    {at: 12, do: 'ask', key: 'tanaka', reason: 'noise', stage: 'seated'},
  ],
}
