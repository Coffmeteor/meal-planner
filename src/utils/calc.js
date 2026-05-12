// Re-export bridge: all nutrition functions now live in domain/nutrition/
// TODO: update downstream imports to use domain/nutrition directly, then delete this file.
export {
  ACTIVITY_LEVELS,
  calculateBmr,
  calculateTdee,
  calculateTargetCalories,
  calculateMacros,
  calculateDailyTargets,
  suggestDietMethod,
  calculateDeficitPercent,
  calculateTargetCaloriesV2,
  calculateMacrosV2,
  deriveTimeAfterWake,
  deriveTimeBeforeSleep,
} from '../domain/nutrition/index.js'

export { deriveEatingWindow } from './scheduleUtils.js'
