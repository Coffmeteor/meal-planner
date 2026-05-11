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

/**
 * Normalize latestPlan to consistent { plan, startDate, generatedAt } shape.
 * Handles both old (raw array) and new ({ plan, ... }) formats.
 * Returns null if no valid plan data.
 */
function normalizeLatestPlan(raw) {
  if (!raw) return null
  // Old format: latestPlan was stored as a raw array
  if (Array.isArray(raw)) {
    return raw.length
      ? { plan: raw, startDate: raw[0]?.date ?? null, generatedAt: null }
      : null
  }
  // New format: { plan, startDate, generatedAt }
  if (raw && Array.isArray(raw.plan) && raw.plan.length) {
    return {
      plan: raw.plan,
      startDate: raw.startDate ?? raw.plan[0]?.date ?? null,
      generatedAt: raw.generatedAt ?? null,
    }
  }
  return null
}

export function loadProfile() {
  return safeLoad(KEYS.profile)
}

export function loadSchedule() {
  return safeLoad(KEYS.schedule)
}

export async function loadLatestPlan() {
  const raw = await safeLoad(KEYS.latestPlan)
  return normalizeLatestPlan(raw)
}

export function saveProfile(profile) {
  return safeSave(KEYS.profile, profile)
}

export function saveSchedule(schedule) {
  return safeSave(KEYS.schedule, schedule)
}

export function saveLatestPlan(latestPlan) {
  return safeSave(KEYS.latestPlan, latestPlan)
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
    return { profile: null, schedule: null, latestPlan: null }
  }
}
