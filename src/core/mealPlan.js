import { calculateCalories } from './nutrition.js'

export function getDayNumber(planStartDate, targetDate) {
  const start = parseYmd(planStartDate)
  const target = parseYmd(targetDate)
  if (!start || !target) return 1
  return Math.floor((target - start) / 86400000) + 1
}

export function getDayMeals(plan, dayIndex) {
  const day = getPlanDays(plan)[Number(dayIndex) - 1]
  return Array.isArray(day?.meals) ? day.meals : []
}

export function getMealTotalKcal(meal, foodsDb) {
  const explicit = Number(meal?.calories)
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit)
  return calculateCalories(meal, foodsDb).total
}

export function getDayTotalKcal(dayMeals, foodsDb) {
  return (Array.isArray(dayMeals) ? dayMeals : []).reduce(
    (sum, meal) => sum + getMealTotalKcal(meal, foodsDb),
    0,
  )
}

export function getPlanDuration(plan) {
  return getPlanDays(plan).length
}

export function findOverTargetDays(plan, targetKcal, threshold = 100) {
  const target = Number(targetKcal) || 0
  return getPlanDays(plan).reduce((days, day, index) => {
    const total = Number(day?.totals?.calories) || getDayTotalKcal(day?.meals || [])
    if (total - target > Number(threshold || 0)) days.push(index + 1)
    return days
  }, [])
}

function getPlanDays(plan) {
  if (Array.isArray(plan)) return plan
  if (Array.isArray(plan?.plan)) return plan.plan
  if (Array.isArray(plan?.days)) return plan.days
  return []
}

function parseYmd(value) {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}
