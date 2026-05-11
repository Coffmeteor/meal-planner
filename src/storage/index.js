import { clear, deleteKey, get, set } from './db.js'

const KEYS = {
  profile: 'profile',
  schedule: 'schedule',
  latestPlan: 'latestPlan',
}

async function safeLoad(key, fallback = null) {
  try {
    return (await get(key)) ?? fallback
  } catch (error) {
    console.warn(`Failed to load ${key}`, error)
    return fallback
  }
}

async function safeSave(key, value) {
  try {
    await set(key, value)
  } catch (error) {
    console.warn(`Failed to save ${key}`, error)
  }
}

export function loadProfile() {
  return safeLoad(KEYS.profile)
}

export function loadSchedule() {
  return safeLoad(KEYS.schedule)
}

export function loadLatestPlan() {
  return safeLoad(KEYS.latestPlan, [])
}

export function saveProfile(profile) {
  return safeSave(KEYS.profile, profile)
}

export function saveSchedule(schedule) {
  return safeSave(KEYS.schedule, schedule)
}

export function saveLatestPlan(plan) {
  return safeSave(KEYS.latestPlan, plan)
}

export async function deleteLatestPlan() {
  try {
    await deleteKey(KEYS.latestPlan)
  } catch (error) {
    console.warn('Failed to delete latest plan', error)
  }
}

export async function clearAllData() {
  try {
    await clear()
  } catch (error) {
    console.warn('Failed to clear local data', error)
  }
}

export async function getAppState() {
  try {
    const [profile, schedule, latestPlan] = await Promise.all([
      loadProfile(),
      loadSchedule(),
      loadLatestPlan(),
    ])

    return { profile, schedule, latestPlan }
  } catch (error) {
    console.warn('Failed to load app state', error)
    return { profile: null, schedule: null, latestPlan: [] }
  }
}
