// Re-export bridge: domain functions from domain/food-preferences/
// Adapter functions (load/save with storage) kept here for now, will migrate to services in Phase C.
import { dualGet, dualSet } from '../storage/index.js'

const STORAGE_KEY = 'foodPreferences'

export {
  emptyPreferences,
  isValidLevel,
  getFoodLevel,
  setFoodLevel,
  getAvailableFoods,
  checkCategoryCoverage,
} from '../domain/food-preferences/index.js'

export async function loadFoodPreferences() {
  const raw = await dualGet(STORAGE_KEY)
  if (!raw) return emptyPreferences()

  return {
    selectedFoodIds: Array.isArray(raw.selectedFoodIds) ? raw.selectedFoodIds : [],
    customFoods: Array.isArray(raw.customFoods) ? raw.customFoods : [],
    updatedAt: raw.updatedAt ?? null,
    preferenceLevels: raw.preferenceLevels && typeof raw.preferenceLevels === 'object'
      ? raw.preferenceLevels
      : {},
  }
}

export async function saveFoodPreferences(prefs) {
  const data = {
    selectedFoodIds: Array.isArray(prefs.selectedFoodIds) ? prefs.selectedFoodIds : [],
    customFoods: Array.isArray(prefs.customFoods) ? prefs.customFoods : [],
    updatedAt: new Date().toISOString(),
    preferenceLevels: prefs.preferenceLevels && typeof prefs.preferenceLevels === 'object'
      ? prefs.preferenceLevels
      : {},
  }
  await dualSet(STORAGE_KEY, data)
  return data
}
