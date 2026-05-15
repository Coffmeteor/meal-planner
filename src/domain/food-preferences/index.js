// Domain: Food Preferences — food filtering, preference levels, candidate scoring
// Pure functions only. No DOM, Vue, localStorage, IndexedDB dependencies.
import { DEFAULT_FOODS } from '../../utils/foodMeta.js'

export function emptyPreferences() {
  return {
    selectedFoodIds: [],
    customFoods: [],
    updatedAt: null,
    preferenceLevels: {},
  }
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
