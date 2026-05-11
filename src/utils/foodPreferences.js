import { dualGet, dualSet } from '../storage/index.js'
import { DEFAULT_FOODS } from './foodMeta.js'

const STORAGE_KEY = 'foodPreferences'

export function emptyPreferences() {
  return { selectedFoodIds: [], customFoods: [], updatedAt: null }
}

export async function loadFoodPreferences() {
  const raw = await dualGet(STORAGE_KEY)
  if (!raw) return emptyPreferences()

  return {
    selectedFoodIds: Array.isArray(raw.selectedFoodIds) ? raw.selectedFoodIds : [],
    customFoods: Array.isArray(raw.customFoods) ? raw.customFoods : [],
    updatedAt: raw.updatedAt ?? null,
  }
}

export async function saveFoodPreferences(prefs) {
  const data = {
    selectedFoodIds: Array.isArray(prefs.selectedFoodIds) ? prefs.selectedFoodIds : [],
    customFoods: Array.isArray(prefs.customFoods) ? prefs.customFoods : [],
    updatedAt: new Date().toISOString(),
  }
  await dualSet(STORAGE_KEY, data)
  return data
}

export function getAvailableFoods(prefs) {
  if (!prefs) return []
  const selectedIds = Array.isArray(prefs.selectedFoodIds) ? prefs.selectedFoodIds : []
  const defaults = DEFAULT_FOODS.filter((food) => selectedIds.includes(food.id))
  return [...defaults, ...(Array.isArray(prefs.customFoods) ? prefs.customFoods : [])]
}

export function checkCategoryCoverage(availableFoods) {
  const needed = ['protein', 'carb', 'vegetable']
  const result = {}

  for (const cat of needed) {
    result[cat] = availableFoods.filter((food) => food.category === cat).length
  }

  return result
}
