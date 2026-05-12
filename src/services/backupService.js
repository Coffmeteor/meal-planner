import { downloadJSON } from '../adapters/fileAdapter.js'
import {
  getCheckins,
  getFoods,
  getPlan,
  getUserProfile,
  getWeights,
  saveCheckins,
  saveFoods,
  savePlan,
  saveUserProfile,
  saveWeights,
} from '../adapters/storageAdapter.js'

export async function exportAll() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    foods: await getFoods(),
    plan: await getPlan(),
    checkins: await getCheckins(),
    weights: await getWeights(),
    profile: await getUserProfile(),
  }
  downloadJSON(data, `meal-planner-backup-${formatYmd(new Date())}.json`)
  return data
}

export async function importAll(jsonData) {
  const validation = validateBackup(jsonData)
  if (!validation.valid) {
    return { success: false, errors: validation.errors }
  }

  const errors = []
  await saveSafely(() => saveFoods(jsonData.foods || []), errors, 'foods')
  await saveSafely(() => savePlan(jsonData.plan || null), errors, 'plan')
  await saveSafely(() => saveCheckins(jsonData.checkins || []), errors, 'checkins')
  await saveSafely(() => saveWeights(jsonData.weights || []), errors, 'weights')
  await saveSafely(() => saveUserProfile(jsonData.profile || null), errors, 'profile')

  return { success: errors.length === 0, errors }
}

export function validateBackup(jsonData) {
  const errors = []
  if (!jsonData || typeof jsonData !== 'object') {
    return { valid: false, errors: ['备份文件格式无效'] }
  }
  if (jsonData.foods != null && !Array.isArray(jsonData.foods)) errors.push('foods 必须是数组')
  if (jsonData.checkins != null && !Array.isArray(jsonData.checkins)) errors.push('checkins 必须是数组')
  if (jsonData.weights != null && !Array.isArray(jsonData.weights)) errors.push('weights 必须是数组')
  if (jsonData.plan != null && !Array.isArray(jsonData.plan?.plan) && !Array.isArray(jsonData.plan)) {
    errors.push('plan 必须是计划对象或数组')
  }
  if (jsonData.profile != null && typeof jsonData.profile !== 'object') errors.push('profile 必须是对象')
  return { valid: errors.length === 0, errors }
}

async function saveSafely(action, errors, label) {
  try {
    await action()
  } catch (error) {
    errors.push(`${label}: ${error?.message || '保存失败'}`)
  }
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
