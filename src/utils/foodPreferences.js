import { dualGet, dualSet } from '../storage/index.js'
import { DEFAULT_FOODS } from './foodMeta.js'

const STORAGE_KEY = 'foodPreferences'

export function emptyPreferences() {
  return {
    selectedFoodIds: [],
    customFoods: [],
    updatedAt: null,
    preferenceLevels: {},
  }
}

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

const PREFERENCE_LEVELS = ['frequent', 'normal', 'reduce', 'exclude']

export function isValidLevel(level) {
  return PREFERENCE_LEVELS.includes(level)
}

export function getFoodLevel(prefs, foodId) {
  return prefs?.preferenceLevels?.[foodId] || 'normal'
}

export function setFoodLevel(prefs, foodId, level) {
  const levels = { ...(prefs?.preferenceLevels || {}) }
  if (level === 'normal') {
    delete levels[foodId]
  } else if (isValidLevel(level)) {
    levels[foodId] = level
  }
  return levels
}

export function getAvailableFoods(prefs) {
  if (!prefs) return []
  const selectedIds = Array.isArray(prefs.selectedFoodIds) ? prefs.selectedFoodIds : []
  const levels = prefs.preferenceLevels || {}
  const excludedIds = Object.entries(levels)
    .filter(([, level]) => level === 'exclude')
    .map(([id]) => id)
  const defaults = DEFAULT_FOODS.filter(
    (food) => selectedIds.includes(food.id) && !excludedIds.includes(food.id),
  )
  const customExcluded = (Array.isArray(prefs.customFoods) ? prefs.customFoods : []).filter(
    (food) => !excludedIds.includes(food.id),
  )
  return [...defaults, ...customExcluded]
}

export function checkCategoryCoverage(availableFoods) {
  const needed = ['protein', 'carb', 'vegetable']
  const result = {}

  for (const cat of needed) {
    result[cat] = availableFoods.filter((food) => food.category === cat).length
  }

  return result
}
