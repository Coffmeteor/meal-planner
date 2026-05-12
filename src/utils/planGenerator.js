// Re-export bridge: all meal-plan functions now live in domain/meal-plan/
// TODO: update downstream imports to use domain/meal-plan directly, then delete this file.
export {
  generateSchedule,
  generateScheduleFromProfile,
  generateMealPlan,
  regenerateSingleMeal,
  regenerateDay,
} from '../domain/meal-plan/index.js'
