// Scenario registry (C3, SOLID O): add a scenario by writing a data file and listing it here; nothing else changes.
import type {Scenario} from '../contracts/index.ts'
import {boothOut} from './boothOut.ts'
import {lunchRush} from './lunchRush.ts'
import {patioSwing} from './patioSwing.ts'
import {tableChange} from './tableChange.ts'
import {vipAccess} from './vipAccess.ts'
export const scenarios: Record<string, Scenario> = Object.fromEntries([boothOut, tableChange, vipAccess, lunchRush, patioSwing].map(s => [s.id, s]))
