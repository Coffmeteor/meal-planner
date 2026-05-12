export { MEAL_TEMPLATES } from '../../utils/mealTemplates.js'
export const mealNameMap = {
  2: ['第一餐', '第二餐'],
  3: ['第一餐', '第二餐', '第三餐'],
  4: ['第一餐', '第二餐', '加餐1', '第三餐'],
  5: ['第一餐', '加餐1', '第二餐', '加餐2', '第三餐'],
  6: ['第一餐', '加餐1', '第二餐', '加餐2', '第三餐', '加餐3'],
}

export const mealProfiles = [
  { category: 'breakfast', type: 'main' },
  { category: 'snack', type: 'snack' },
  { category: 'lunch', type: 'main' },
  { category: 'snack', type: 'snack' },
  { category: 'dinner', type: 'main' },
  { category: 'snack', type: 'snack' },
]

export const splitMap = {
  2: [0.5, 0.5],
  3: [0.3, 0.4, 0.3],
  4: [0.28, 0.38, 0.1, 0.24],
  5: [0.24, 0.1, 0.32, 0.1, 0.24],
  6: [0.22, 0.09, 0.28, 0.09, 0.24, 0.08],
}

// Re-export meal planner functions from their new domain location
export {
  generateSchedule,
  generateScheduleFromProfile,
  generateMealPlan,
  regenerateSingleMeal,
  regenerateDay,
} from './planGenerator.js'
