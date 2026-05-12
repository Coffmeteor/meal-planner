import { calculateCalories } from '../core/nutrition.js'
import { getFoodById } from '../core/foods.js'
import { getFoods, getPlan, savePlan } from '../adapters/storageAdapter.js'

export async function addFoodToMeal(dayIndex, mealIndex, foodId, grams) {
  return editMeal(dayIndex, mealIndex, async (meal) => {
    const foodsDb = await getFoods()
    const food = getFoodById(foodsDb, foodId)
    if (!food) return meal
    const nextFoods = [...mealFoods(meal), buildMealFood(food, grams)]
    return normalizeMeal(meal, nextFoods, foodsDb)
  })
}

export async function removeFoodFromMeal(dayIndex, mealIndex, foodId) {
  return editMeal(dayIndex, mealIndex, async (meal) => {
    const foodsDb = await getFoods()
    const nextFoods = mealFoods(meal).filter((food) => String(food.id || food.foodId) !== String(foodId))
    return normalizeMeal(meal, nextFoods, foodsDb)
  })
}

export async function updateFoodGrams(dayIndex, mealIndex, foodId, grams) {
  return editMeal(dayIndex, mealIndex, async (meal) => {
    const foodsDb = await getFoods()
    const nextFoods = mealFoods(meal).map((food) => {
      if (String(food.id || food.foodId) !== String(foodId)) return food
      return buildMealFood({ ...food, per100g: food.per100g }, grams)
    })
    return normalizeMeal(meal, nextFoods, foodsDb)
  })
}

export async function calibrateDay(dayIndex, targetKcal) {
  const latestPlan = await getPlan()
  const plan = [...(latestPlan?.plan || [])]
  const index = Number(dayIndex) - 1
  const day = plan[index]
  if (!day?.meals?.length) return latestPlan

  const current = sumMeals(day.meals).calories
  if (!current || !targetKcal) return latestPlan

  const foodsDb = await getFoods()
  const ratio = Math.min(2.5, Math.max(0.5, Number(targetKcal) / current))
  const meals = day.meals.map((meal) => {
    const nextFoods = mealFoods(meal).map((food) =>
      buildMealFood(food, Math.round((Number(food.portion ?? food.grams ?? 100) * ratio) / 5) * 5),
    )
    return normalizeMeal(meal, nextFoods, foodsDb)
  })

  plan[index] = { ...day, meals, totals: sumMeals(meals), edited: true, updatedAt: new Date().toISOString() }
  const nextPlan = { ...latestPlan, plan }
  await savePlan(nextPlan)
  return nextPlan
}

async function editMeal(dayIndex, mealIndex, updater) {
  const latestPlan = await getPlan()
  const plan = [...(latestPlan?.plan || [])]
  const dayIdx = Number(dayIndex) - 1
  const mealIdx = Number(mealIndex) - 1
  const day = plan[dayIdx]
  const meal = day?.meals?.[mealIdx]
  if (!meal) return latestPlan

  const nextMeal = await updater(meal)
  const meals = [...day.meals]
  meals[mealIdx] = nextMeal
  plan[dayIdx] = { ...day, meals, totals: sumMeals(meals), edited: true, updatedAt: new Date().toISOString() }
  const nextPlan = { ...latestPlan, plan }
  await savePlan(nextPlan)
  return nextPlan
}

function buildMealFood(food, grams) {
  const portion = Math.max(0, Number(grams) || Number(food.defaultPortion) || Number(food.portion) || 100)
  const per100g = food.per100g || normalizePer100g(food, Number(food.portion ?? food.grams ?? portion) || portion)
  const ratio = portion / 100
  return {
    ...food,
    portion,
    grams: portion,
    per100g,
    calories: Math.round(Number(per100g.calories || 0) * ratio),
    protein: roundMacro(Number(per100g.protein || 0) * ratio),
    carbs: roundMacro(Number(per100g.carbs || 0) * ratio),
    fat: roundMacro(Number(per100g.fat || 0) * ratio),
  }
}

function normalizeMeal(meal, foods, foodsDb) {
  const totals = calculateCalories({ foods }, foodsDb)
  return {
    ...meal,
    foods,
    items: foods,
    calories: totals.total,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    edited: true,
    updatedAt: new Date().toISOString(),
  }
}

function mealFoods(meal) {
  if (Array.isArray(meal?.foods)) return meal.foods
  if (Array.isArray(meal?.items)) return meal.items
  return []
}

function sumMeals(meals) {
  return (Array.isArray(meals) ? meals : []).reduce(
    (sum, meal) => ({
      calories: sum.calories + Number(meal.calories || 0),
      protein: sum.protein + Number(meal.protein || 0),
      carbs: sum.carbs + Number(meal.carbs || 0),
      fat: sum.fat + Number(meal.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function normalizePer100g(food, grams) {
  if (food?.per100g) return food.per100g
  const ratio = grams > 0 ? 100 / grams : 1
  return {
    calories: Number(food.calories || 0) * ratio,
    protein: Number(food.protein || 0) * ratio,
    carbs: Number(food.carbs || 0) * ratio,
    fat: Number(food.fat || 0) * ratio,
  }
}

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10
}
