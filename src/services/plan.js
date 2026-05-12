// Service: Plan — orchestrates meal plan CRUD operations
// Calls domain + adapter, contains no core algorithm.
import { generateMealPlan, regenerateDay, regenerateSingleMeal } from '../domain/meal-plan/index.js'
import { calculateDayTotals } from '../domain/meal-plan/mealDisplay.js'
import { saveLatestPlan } from '../adapters/storage/index.js'

/**
 * Create a new meal plan from profile, schedule, and food preferences.
 * Returns the generated plan array.
 */
export function createPlan(params, schedule, availableFoods, eatingWindow) {
  if (!params || !schedule) return []
  return generateMealPlan(params, schedule, availableFoods, eatingWindow)
}

/**
 * Regenerate the entire meal plan (new seed).
 */
export function refreshPlan(params, schedule, availableFoods, eatingWindow) {
  return generateMealPlan(params, schedule, availableFoods, eatingWindow)
}

/**
 * Regenerate a single day's meals, preserving locked meals.
 */
export function refreshDay(params, schedule, availableFoods, day, eatingWindow) {
  return regenerateDay(params, schedule, availableFoods, day, { editSource: 'refreshDay' }, eatingWindow)
}

/**
 * Regenerate a single meal, preserving locked meals on the day.
 */
export function replaceMeal(plan, dayIndex, mealIndex, params, schedule, availableFoods, eatingWindow) {
  return regenerateSingleMeal(plan, dayIndex, mealIndex, params, schedule, availableFoods, eatingWindow)
}

/**
 * Save an edited meal back to the plan.
 */
export function saveMeal(plan, dayIndex, mealIndex, meal) {
  const day = plan[dayIndex]
  if (!day?.meals?.[mealIndex] || !meal) return plan

  const nextPlan = [...plan]
  const nextMeals = [...day.meals]
  nextMeals[mealIndex] = meal
  nextPlan[dayIndex] = {
    ...day,
    meals: nextMeals,
    totals: calculateDayTotals(nextMeals),
    edited: true,
    updatedAt: new Date().toISOString(),
  }
  return nextPlan
}

/**
 * Save regenerated day foods back to the plan.
 */
export function saveDayFood(plan, dayIndex, selectedFoods, regeneratedDay) {
  const day = plan[dayIndex]
  if (!day) return plan

  const selectedIds = new Set(selectedFoods || [])
  const nextPlan = [...plan]
  nextPlan[dayIndex] = {
    ...regeneratedDay,
    dayFoodPool: { selectedFoodIds: [...selectedIds] },
  }
  return nextPlan
}

/**
 * Set lock state on a meal.
 */
export function setMealLock(plan, dayIndex, mealIndex, locked) {
  const day = plan[dayIndex]
  if (!day?.meals?.[mealIndex]) return plan

  const nextMeals = [...day.meals]
  nextMeals[mealIndex] = { ...nextMeals[mealIndex], locked }
  const nextPlan = [...plan]
  nextPlan[dayIndex] = { ...day, meals: nextMeals, updatedAt: new Date().toISOString() }
  return nextPlan
}

/**
 * Optimize today's calories by scaling unlocked meals proportionally.
 */
export function optimizeTodayCalories(plan, dayIndex, targetCalories) {
  const day = plan[dayIndex]
  if (!day) return { plan, error: '无效日期' }

  const currentCalories = Number(day?.totals?.calories || 0)
  if (!targetCalories || !currentCalories) {
    return { plan, error: '缺少热量数据' }
  }

  const adjustableMeals = day.meals.filter((meal) => !meal?.locked)
  const adjustableCalories = adjustableMeals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0)
  const lockedCalories = currentCalories - adjustableCalories
  const needed = targetCalories - lockedCalories

  if (!adjustableMeals.length) {
    return { plan, error: '所有餐点已锁定，无法优化' }
  }
  if (needed <= 0 || adjustableCalories <= 0) {
    return { plan, error: '已接近目标，无需优化' }
  }

  const ratio = Math.min(2.5, Math.max(0.5, needed / adjustableCalories))
  const nextMeals = day.meals.map((meal) => {
    if (meal?.locked) return meal
    return scaleMeal(meal, ratio)
  })

  const nextPlan = [...plan]
  nextPlan[dayIndex] = {
    ...day,
    meals: nextMeals,
    totals: calculateDayTotals(nextMeals),
    optimized: true,
    editSource: 'todayOptimize',
    updatedAt: new Date().toISOString(),
  }
  return { plan: nextPlan, error: null }
}

/**
 * Scale a meal's food portions and nutrition by ratio.
 */
function scaleMeal(meal, ratio) {
  const scaleFood = (food) => {
    const portion = Math.max(1, Math.round((Number(food.portion || food.defaultPortion || 100) * ratio) / 5) * 5)
    const previousPortion = Math.max(1, Number(food.portion || food.defaultPortion || 100))
    const foodRatio = portion / previousPortion
    return {
      ...food,
      portion,
      calories: Math.round(Number(food.calories || 0) * foodRatio),
      protein: Math.round(Number(food.protein || 0) * foodRatio * 10) / 10,
      carbs: Math.round(Number(food.carbs || 0) * foodRatio * 10) / 10,
      fat: Math.round(Number(food.fat || 0) * foodRatio * 10) / 10,
    }
  }

  const foods = (meal.foods || meal.items || []).map(scaleFood)
  if (!foods.length) {
    return {
      ...meal,
      calories: Math.round(Number(meal.calories || 0) * ratio),
      protein: Math.round(Number(meal.protein || 0) * ratio * 10) / 10,
      carbs: Math.round(Number(meal.carbs || 0) * ratio * 10) / 10,
      fat: Math.round(Number(meal.fat || 0) * ratio * 10) / 10,
      edited: true,
    }
  }

  const totals = foods.reduce(
    (sum, food) => ({
      calories: sum.calories + Number(food.calories || 0),
      protein: sum.protein + Number(food.protein || 0),
      carbs: sum.carbs + Number(food.carbs || 0),
      fat: sum.fat + Number(food.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return {
    ...meal,
    foods,
    items: foods,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    portion: foods.map((food) => `${food.name}${Math.round(food.portion || 0)}${food.unit || 'g'}`).join(' + '),
    edited: true,
  }
}

/**
 * Persist plan to storage (fire-and-forget IndexedDB).
 */
export async function savePlan(params, schedule, plan, meta) {
  await saveLatestPlan({
    plan,
    ...meta,
    scheduleSnapshot: schedule,
    paramsSnapshot: params,
  })
}
