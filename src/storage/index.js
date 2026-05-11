import { clear as idbClear, deleteKey, get as idbGet, set as idbSet } from './db.js'

const KEYS = {
  profile: 'profile',
  schedule: 'schedule',
  latestPlan: 'latestPlan',
}

// localStorage fallback prefix — used when IndexedDB is unavailable or fails.
const LS_PREFIX = 'meal-planner:v1:'

/**
 * Normalize latestPlan to consistent { plan, startDate, generatedAt } shape.
 * Handles both old (raw array) and new ({ plan, ... }) formats.
 * Returns null if no valid plan data.
 */
function normalizeLatestPlan(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw.length
      ? { plan: raw, startDate: raw[0]?.date ?? null, generatedAt: null }
      : null
  }
  if (raw && Array.isArray(raw.plan) && raw.plan.length) {
    return {
      plan: raw.plan,
      startDate: raw.startDate ?? raw.plan[0]?.date ?? null,
      generatedAt: raw.generatedAt ?? null,
    }
  }
  return null
}

// ── Dual storage helpers ────────────────────────────────────────────

async function dualGet(key, fallback = null) {
  // 1. Try IndexedDB
  try {
    const value = await idbGet(key)
    if (value !== undefined && value !== null) return value
  } catch (e) {
    console.warn(`IDB read failed for ${key}`, e)
  }
  // 2. Fallback to localStorage
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn(`localStorage read failed for ${key}`, e)
  }
  return fallback
}

async function dualSet(key, value) {
  let idbOk = false
  // 1. Write to IndexedDB (primary)
  try {
    await idbSet(key, value)
    idbOk = true
  } catch (e) {
    console.warn(`IDB write failed for ${key}`, e)
  }
  // 2. Always write to localStorage (backup / cross-browser fallback)
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.warn(`localStorage write failed for ${key}`, e)
  }
  return idbOk // return whether primary storage succeeded
}

async function dualDelete(key) {
  try {
    await deleteKey(key)
  } catch (e) { /* best-effort */ }
  try {
    localStorage.removeItem(LS_PREFIX + key)
  } catch (e) { /* best-effort */ }
}

async function dualClear() {
  try {
    await idbClear()
  } catch (e) { /* best-effort */ }
  for (const k of Object.values(KEYS)) {
    try { localStorage.removeItem(LS_PREFIX + k) } catch (e) { /* */ }
  }
}

// ── Public API ────────────────────────────────────────────────────────

export function loadProfile() {
  return dualGet(KEYS.profile)
}

export function loadSchedule() {
  return dualGet(KEYS.schedule)
}

export async function loadLatestPlan() {
  const raw = await dualGet(KEYS.latestPlan)
  const normalized = normalizeLatestPlan(raw)

  // If IDB returned nothing but localStorage had something, write back to IDB
  // so next load is faster.
  if (normalized && raw !== undefined) {
    try {
      const idbValue = await idbGet(KEYS.latestPlan)
      if (!idbValue) {
        await idbSet(KEYS.latestPlan, raw)
      }
    } catch (e) { /* best-effort */ }
  }

  return normalized
}

export async function saveProfile(profile) {
  return dualSet(KEYS.profile, profile)
}

export async function saveSchedule(schedule) {
  return dualSet(KEYS.schedule, schedule)
}

export async function saveLatestPlan(latestPlan) {
  return dualSet(KEYS.latestPlan, latestPlan)
}

export async function deleteLatestPlan() {
  return dualDelete(KEYS.latestPlan)
}

export async function clearAllData() {
  await dualClear()
}

export async function getAppState() {
  try {
    // Load sequentially (not Promise.all) so localStorage fallback has
    // a chance to write back to IndexedDB for each key.
    const profile = await loadProfile()
    const schedule = await loadSchedule()
    const latestPlan = await loadLatestPlan()
    return { profile, schedule, latestPlan }
  } catch (error) {
    console.warn('Failed to load app state', error)
    return { profile: null, schedule: null, latestPlan: null }
  }
}
