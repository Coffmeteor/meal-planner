// Service: Food Preferences — orchestration and storage I/O
import { dualGet, dualSet } from '../adapters/storage/index.js'
import { emptyPreferences, getAvailableFoods } from '../domain/food-preferences/index.js'
import { generateMealPlan } from '../domain/meal-plan/index.js'

const STORAGE_KEY = 'foodPreferences'

export async function loadFoodPreferences() {
  const raw = await dualGet(STORAGE_KEY)
  if (!raw) return emptyPreferences()

  return {
    selectedFoodIds: Array.isArray(raw.selectedFoodIds) ? raw.selectedFoodIds : [],
    customFoods: Array.isArray(raw.customFoods) ? raw.customFoods : [],
    updatedAt: raw.updatedAt ?? null,
    preferenceLevels:
      raw.preferenceLevels && typeof raw.preferenceLevels === 'object' ? raw.preferenceLevels : {},
  }
}

export async function saveFoodPreferences(prefs) {
  const data = {
    selectedFoodIds: Array.isArray(prefs.selectedFoodIds) ? prefs.selectedFoodIds : [],
    customFoods: Array.isArray(prefs.customFoods) ? prefs.customFoods : [],
    updatedAt: new Date().toISOString(),
    preferenceLevels:
      prefs.preferenceLevels && typeof prefs.preferenceLevels === 'object'
        ? prefs.preferenceLevels
        : {},
  }
  await dualSet(STORAGE_KEY, data)
  return data
}

export function applyPreferencesToPlan(params, schedule, foodPrefs, eatingWindow) {
  const available = getAvailableFoods(foodPrefs)
  if (!available.length) return []
  return generateMealPlan(params, schedule, available, eatingWindow)
}
