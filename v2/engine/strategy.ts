// Seating strategy (lane E-S, contracts/strategy.ts): pure and advisory. Reads the floor's future (planner, keeper, fit) and the host's levers (`StratCtl`), ranks and warns, never seats.
import type {Strategist} from '../contracts/strategy.ts'
import {ctxOf} from './strategy-ctx.ts'
import {gates} from './strategy-holds.ts'
import {lanesOf, pairsOf} from './strategy-lanes.ts'
import {jointOf, movesOf, sizesOf} from './strategy-moves.ts'
import {risksOf, shareOf} from './strategy-risk.ts'
export const strategy: Strategist['strategy'] = (p, w, now, ctl) => {
  const c = ctxOf(p, w, now, ctl)
  const [sizes, moves, share] = [sizesOf(ctl), movesOf(c), shareOf(c)]
  return {lanes: lanesOf(c), moves, sizes, joint: jointOf(c), pairs: pairsOf(c), risks: risksOf(c, moves, sizes, share), share, ...gates(c)}
}
