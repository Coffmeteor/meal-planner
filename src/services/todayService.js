import { isCheckedInToday } from '../core/checkins.js'
import { getDayNumber, getDayTotalKcal } from '../core/mealPlan.js'
import { calculateDeviation } from '../core/nutrition.js'
import {
  getCheckins,
  getPlan,
  getUserProfile,
  getWeights,
} from '../adapters/storageAdapter.js'

export async function getTodayData() {
  const [latestPlan, profile, checkins, weights] = await Promise.all([
    getPlan(),
    getUserProfile(),
    getCheckins(),
    getWeights(),
  ])
  const today = formatYmd(new Date())
  const planDays = latestPlan?.plan || []
  const todayPlan = planDays.find((day) => day.date === today) || null
  const meals = todayPlan?.meals || []
  const targetKcal =
    Number(todayPlan?.targets?.calories)
    || Number(latestPlan?.targetCalories)
    || Number(profile?.targetCalories)
    || 0
  const planKcal = Number(todayPlan?.totals?.calories) || getDayTotalKcal(meals)
  const deviation = calculateDeviation(planKcal, targetKcal)
  const dayNumber = todayPlan
    ? getDayNumber(latestPlan?.startDate || planDays[0]?.date, todayPlan.date)
    : null

  return {
    dayNumber,
    targetKcal,
    planKcal,
    deviation,
    todos: getTodos({ plan: todayPlan, checkins, weights, deviation }),
    meals,
  }
}

export function getTodos(planCheckinsWeights = {}) {
  const today = formatYmd(new Date())
  const todos = []
  const weights = planCheckinsWeights.weights || []
  const checkins = planCheckinsWeights.checkins || []
  const plan = planCheckinsWeights.plan || null
  const deviation = planCheckinsWeights.deviation || { diff: 0 }

  if (!weights.some((entry) => entry?.date === today)) {
    todos.push({ id: 'weight', label: '记录今日体重', type: 'weight' })
  }
  if (!isCheckedInToday(checkins)) {
    todos.push({ id: 'checkin', label: '完成今日打卡', type: 'checkin' })
  }
  if (plan && Math.abs(Number(deviation.diff) || 0) > 100) {
    todos.push({ id: 'optimize', label: '优化今日餐单', type: 'plan' })
  }
  if (!plan) {
    todos.push({ id: 'generate', label: '生成/刷新今日餐单', type: 'plan' })
  }

  return todos
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
