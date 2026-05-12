// Service: Food Preferences — orchestrates food preference save/apply
import { saveFoodPreferences } from '../../utils/foodPreferences.js'
import { generateMealPlan } from '../../domain/meal-plan/index.js'
import { getAvailableFoods } from '../../domain/food-preferences/index.js'

export async function savePreferences(prefs) {
  return saveFoodPreferences(prefs)
}

export function applyPreferencesToPlan(params, schedule, foodPrefs, eatingWindow) {
  const available = getAvailableFoods(foodPrefs)
  if (!available.length) return []
  return generateMealPlan(params, schedule, available, eatingWindow)
}
