import {
  clearAllData as storageClearAllData,
  dualGet,
  dualSet,
  loadCheckins,
  loadLatestPlan,
  loadProfile,
  loadWeightLogs,
  saveCheckin,
  saveLatestPlan,
  saveProfile,
  saveWeightLog,
} from '../storage/index.js'
import { foods as defaultFoods } from '../utils/foods.js'

const FOODS_KEY = 'foods'

export async function getFoods() {
  const foods = await dualGet(FOODS_KEY)
  return Array.isArray(foods) && foods.length ? foods : defaultFoods
}

export function saveFoods(foods) {
  return dualSet(FOODS_KEY, Array.isArray(foods) ? foods : [])
}

export function getPlan() {
  return loadLatestPlan()
}

export function savePlan(plan) {
  return saveLatestPlan(normalizePlanForStorage(plan))
}

export function getCheckins() {
  return loadCheckins()
}

export function saveCheckins(checkins) {
  return dualSet('checkins', Array.isArray(checkins) ? checkins : [])
}

export function getWeights() {
  return loadWeightLogs()
}

export function saveWeights(weights) {
  return dualSet('weightLogs', Array.isArray(weights) ? weights : [])
}

export function getUserProfile() {
  return loadProfile()
}

export function saveUserProfile(profile) {
  return saveProfile(profile)
}

export function clearAllData() {
  return storageClearAllData()
}

export async function upsertWeight(entry) {
  return saveWeightLog(entry)
}

export async function upsertCheckin(entry) {
  return saveCheckin(entry)
}

function normalizePlanForStorage(plan) {
  if (Array.isArray(plan)) {
    return {
      plan,
      startDate: plan[0]?.date ?? null,
      generatedAt: new Date().toISOString(),
    }
  }
  if (plan && Array.isArray(plan.plan)) {
    return {
      ...plan,
      startDate: plan.startDate ?? plan.plan[0]?.date ?? null,
      generatedAt: plan.generatedAt ?? new Date().toISOString(),
    }
  }
  return null
}
