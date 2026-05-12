// Re-export bridge: now in domain/meal-plan/
export {
  normalizeDietMethod,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
  isTimeWithinRange,
  isIncreasingTimes,
  deriveEatingWindow,
  normalizeEatingWindow,
  validateScheduleTimes,
  autoDistributeMeals,
} from '../domain/meal-plan/scheduleUtils.js'
