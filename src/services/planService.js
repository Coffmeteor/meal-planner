import { calculateCalories } from '../core/nutrition.js'
import { getDayMeals } from '../core/mealPlan.js'
import {
  getFoods,
  getPlan,
  getUserProfile,
  savePlan,
} from '../adapters/storageAdapter.js'
import {
  generateMealPlan,
  generateScheduleFromProfile,
  regenerateDay,
  regenerateSingleMeal,
} from '../utils/planGenerator.js'

export async function generateDailyPlan(profile) {
  const activeProfile = profile || await getUserProfile()
  if (!activeProfile) return null

  const schedule = generateScheduleFromProfile(activeProfile, activeProfile.dietMethod)
  const foods = await getFoods()
  const plan = generateMealPlan(activeProfile, schedule, foods, activeProfile.eatingWindow)
  const latestPlan = {
    plan,
    startDate: plan[0]?.date ?? null,
    generatedAt: new Date().toISOString(),
    scheduleSnapshot: schedule,
    paramsSnapshot: activeProfile,
    days: activeProfile.days ?? plan.length,
    targetCalories: activeProfile.targetCalories ?? plan[0]?.targets?.calories ?? null,
  }
  await savePlan(latestPlan)
  return latestPlan
}

export async function getTodayPlan() {
  const latestPlan = await getPlan()
  const planDays = latestPlan?.plan || []
  const today = formatYmd(new Date())
  return planDays.find((day) => day.date === today) || planDays[0] || null
}

export async function optimizeDayCalories(dayIndex, targetKcal) {
  const latestPlan = await getPlan()
  const planDays = latestPlan?.plan || []
  const index = Number(dayIndex) - 1
  const day = planDays[index]
  if (!day?.meals?.length) return latestPlan

  const nextDay = scaleDay(day, Number(targetKcal) || Number(day.targets?.calories) || 0)
  const nextPlan = replaceDay(latestPlan, index, nextDay)
  await savePlan(nextPlan)
  return nextPlan
}

export async function lockMeal(dayIndex, mealIndex) {
  const latestPlan = await getPlan()
  const planDays = latestPlan?.plan || []
  const dayIdx = Number(dayIndex) - 1
  const mealIdx = Number(mealIndex) - 1
  const meal = planDays[dayIdx]?.meals?.[mealIdx]
  if (!meal) return latestPlan

  const nextMeals = [...planDays[dayIdx].meals]
  nextMeals[mealIdx] = { ...meal, locked: !meal.locked }
  const nextDay = { ...planDays[dayIdx], meals: nextMeals, totals: sumMeals(nextMeals) }
  const nextPlan = replaceDay(latestPlan, dayIdx, nextDay)
  await savePlan(nextPlan)
  return nextPlan
}

export async function swapMeal(dayIndex, mealIndex) {
  const latestPlan = await getPlan()
  const planDays = latestPlan?.plan || []
  const profile = latestPlan?.paramsSnapshot || await getUserProfile()
  const foods = await getFoods()
  if (!planDays.length || !profile) return latestPlan

  const nextPlanDays = regenerateSingleMeal(
    planDays,
    Number(dayIndex) - 1,
    Number(mealIndex) - 1,
    profile,
    latestPlan?.scheduleSnapshot || {},
    foods,
    profile.eatingWindow,
  )
  const nextPlan = { ...latestPlan, plan: nextPlanDays }
  await savePlan(nextPlan)
  return nextPlan
}

export async function regeneratePlanDay(dayIndex) {
  const latestPlan = await getPlan()
  const planDays = latestPlan?.plan || []
  const index = Number(dayIndex) - 1
  const currentDay = planDays[index]
  if (!currentDay) return latestPlan

  const profile = latestPlan?.paramsSnapshot || await getUserProfile()
  const foods = await getFoods()
  const nextDay = regenerateDay(
    profile,
    latestPlan?.scheduleSnapshot || {},
    foods,
    currentDay,
    { editSource: 'service' },
    profile?.eatingWindow,
  )
  const nextPlan = replaceDay(latestPlan, index, nextDay)
  await savePlan(nextPlan)
  return nextPlan
}

function replaceDay(latestPlan, index, day) {
  const plan = [...(latestPlan?.plan || [])]
  plan[index] = day
  return { ...latestPlan, plan }
}

function scaleDay(day, targetKcal) {
  const meals = getDayMeals([day], 1)
  const current = sumMeals(meals).calories
  if (!targetKcal || !current) return day
  const ratio = Math.min(2.5, Math.max(0.5, targetKcal / current))
  const nextMeals = meals.map((meal) => scaleMeal(meal, ratio))
  return { ...day, meals: nextMeals, totals: sumMeals(nextMeals) }
}

function scaleMeal(meal, ratio) {
  const foods = (meal.foods || meal.items || []).map((food) => {
    const portion = Math.max(0, Math.round((Number(food.portion ?? food.grams ?? 100) * ratio) / 5) * 5)
    const sourcePortion = Number(food.portion ?? food.grams ?? 100) || 1
    const foodRatio = portion / sourcePortion
    return {
      ...food,
      portion,
      grams: food.grams != null ? portion : food.grams,
      calories: Math.round(Number(food.calories || 0) * foodRatio),
      protein: roundMacro(Number(food.protein || 0) * foodRatio),
      carbs: roundMacro(Number(food.carbs || 0) * foodRatio),
      fat: roundMacro(Number(food.fat || 0) * foodRatio),
    }
  })
  const totals = calculateCalories({ foods }, foods)
  return {
    ...meal,
    foods,
    items: foods,
    calories: totals.total,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
  }
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

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
