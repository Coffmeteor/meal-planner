import { foods as defaultFoods } from '../utils/foods.js'
import { getFoodById } from './foods.js'

export function calculateCalories(meal, foodsDb = defaultFoods) {
  return mealItems(meal).reduce(
    (total, item) => {
      const nutrition = itemNutrition(item, foodsDb)
      return {
        total: total.total + nutrition.total,
        protein: total.protein + nutrition.protein,
        carbs: total.carbs + nutrition.carbs,
        fat: total.fat + nutrition.fat,
      }
    },
    { total: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function calculateDeviation(actualKcal, targetKcal) {
  const actual = Number(actualKcal) || 0
  const target = Number(targetKcal) || 0
  const diff = Math.round(actual - target)
  return {
    diff,
    percentage: target > 0 ? Math.round((diff / target) * 1000) / 10 : 0,
  }
}

export function isCalorieBalanced(actualKcal, targetKcal, threshold = 100) {
  return Math.abs(calculateDeviation(actualKcal, targetKcal).diff) <= Number(threshold)
}

export function calculateMacroRatio(meal, foodsDb = defaultFoods) {
  const totals = calculateCalories(meal, foodsDb)
  const proteinKcal = totals.protein * 4
  const carbsKcal = totals.carbs * 4
  const fatKcal = totals.fat * 9
  const macroKcal = proteinKcal + carbsKcal + fatKcal

  if (macroKcal <= 0) {
    return { proteinPct: 0, carbsPct: 0, fatPct: 0 }
  }

  return {
    proteinPct: Math.round((proteinKcal / macroKcal) * 100),
    carbsPct: Math.round((carbsKcal / macroKcal) * 100),
    fatPct: Math.round((fatKcal / macroKcal) * 100),
  }
}

export function formatCalorie(cal) {
  return `${Math.round(Number(cal) || 0)} kcal`
}

function mealItems(meal) {
  if (Array.isArray(meal?.foods)) return meal.foods
  if (Array.isArray(meal?.items)) return meal.items
  return []
}

function itemNutrition(item, foodsDb) {
  const grams = Number(item?.grams ?? item?.portion ?? item?.amount ?? item?.defaultPortion ?? 100) || 0
  const source = resolveFood(item, foodsDb)
  const per100g = normalizePer100g(source || item, grams)
  const ratio = grams / 100

  return {
    total: Math.round(Number(per100g.calories || 0) * ratio),
    protein: roundMacro(Number(per100g.protein || 0) * ratio),
    carbs: roundMacro(Number(per100g.carbs || 0) * ratio),
    fat: roundMacro(Number(per100g.fat || 0) * ratio),
  }
}

function resolveFood(item, foodsDb) {
  if (item?.per100g) return item
  if (item?.id || item?.foodId) return getFoodById(foodsDb, item.id || item.foodId)
  if (item?.name) {
    return (Array.isArray(foodsDb) ? foodsDb : []).find((food) => food.name === item.name) || null
  }
  return null
}

function normalizePer100g(food, grams) {
  if (food?.per100g) return food.per100g
  if (food?.calories != null || food?.protein != null || food?.carbs != null || food?.fat != null) {
    const ratio = grams > 0 ? 100 / grams : 1
    return {
      calories: Number(food.calories || 0) * ratio,
      protein: Number(food.protein || 0) * ratio,
      carbs: Number(food.carbs || 0) * ratio,
      fat: Number(food.fat || 0) * ratio,
    }
  }
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10
}
