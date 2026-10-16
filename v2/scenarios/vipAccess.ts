// Starter: a VIP and an accessibility need arrive together and want the same table.
import type {Scenario} from '../contracts/index.ts'
export const vipAccess: Scenario = {
  id: 'vip-access', title: 'VIP and access',
  brief: 'Rossi (VIP) wants the window. Nguyen needs an accessible table. Only A1 is both.',
  seed: {
    tables: [
      {id: 'a1', label: 'A1', capacity: 4, x: 100, y: 80, w: 72, h: 72, feats: ['chairs', 'window', 'accessible', 'roomy']},
      {id: 'w2', label: 'W2', capacity: 4, x: 100, y: 200, w: 72, h: 72, feats: ['chairs', 'window']},
      {id: 'c2', label: 'C2', capacity: 4, x: 300, y: 80, w: 72, h: 72, feats: ['chairs', 'quiet']},
      {id: 'c3', label: 'C3', capacity: 4, x: 300, y: 200, w: 72, h: 72, feats: ['chairs', 'accessible']},
    ],
    servers: [{id: 'sv1', name: 'Ana', sections: []}, {id: 'sv2', name: 'Ben', sections: []}],
    busy: [{table: 'c3', size: 2, minAgo: 40}],
  },
  steps: [
    {at: 0, do: 'arrive', key: 'rossi', name: 'Rossi', size: 4, kind: 'V', wants: [{feat: 'window', level: 'strong', why: 'occasion', accord: 'all', said: true}]},
    {at: 0, do: 'arrive', key: 'nguyen', name: 'Nguyen', size: 3, kind: 'W', wants: [{feat: 'accessible', level: 'need', why: 'mobility', accord: 'all'}]},
  ],
}
