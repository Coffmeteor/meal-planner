import { clear as idbClear, deleteKey, get as idbGet, set as idbSet } from './db.js'

const KEYS = {
  profile: 'profile',
  schedule: 'schedule',
  latestPlan: 'latestPlan',
  foodPreferences: 'foodPreferences',
  weightLogs: 'weightLogs',
  checkins: 'checkins',
}

const LS_PREFIX = 'meal-planner:v1:'
const SCHEMA_VERSION = 1
const SCHEMA_KEY = 'schemaVersion'

/**
 * Normalize latestPlan to consistent { plan, startDate, generatedAt } shape.
 * Handles both old (raw array) and new ({ plan, ... }) formats.
 * Returns null if no valid plan data.
 */
function normalizeLatestPlan(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) {
    return raw.length ? { plan: raw, startDate: raw[0]?.date ?? null, generatedAt: null } : null
  }
  if (raw && Array.isArray(raw.plan) && raw.plan.length) {
    return {
      plan: raw.plan,
      startDate: raw.startDate ?? raw.plan[0]?.date ?? null,
      generatedAt: raw.generatedAt ?? null,
      scheduleSnapshot: raw.scheduleSnapshot ?? null,
      paramsSnapshot: normalizeProfile(raw.paramsSnapshot),
    }
  }
  return null
}

export function normalizeProfile(raw) {
  if (!raw) return null
  const normalized = {
    gender: raw.gender ?? 'female',
    age: raw.age ?? 28,
    height: raw.height ?? 165,
    weight: raw.weight ?? 62,
    targetWeight: raw.targetWeight ?? 56,
    activity: raw.activity ?? 'light',
    days: raw.days ?? 7,
    wakeTime: raw.wakeTime ?? '07:00',
    sleepTime: raw.sleepTime ?? '23:00',
    breakfastHabit: raw.breakfastHabit ?? 'always',
    dietScenario: raw.dietScenario ?? 'mixed',
    exerciseFreq: raw.exerciseFreq ?? 1,
    hasStrength: raw.hasStrength ?? false,
    hasCardio: raw.hasCardio ?? false,
  }

  for (const key of ['dietMethod', 'deficitPercent', 'targetCalories', 'macroTargets']) {
    if (raw[key] !== undefined) {
      normalized[key] = raw[key]
    }
  }

  return normalized
}

// ── Write queue (serializes writes to prevent races) ────────────

let writeQueue = Promise.resolve()

function queuedWrite(fn) {
  writeQueue = writeQueue.then(fn).catch((_e) => {
    console.warn('Write queue error', _e)
  })
  return writeQueue
}

// ── One-time localStorage → IDB migration ──────────────────────

let migrationDone = false

export async function migrateFromLocalStorage() {
  if (migrationDone) return
  migrationDone = true

  try {
    // Check if schema version exists in IDB (meaning migration already ran)
    const version = await idbGet(SCHEMA_KEY)
    if (version === SCHEMA_VERSION) return

    // Migrate any key found in localStorage but not in IDB
    for (const key of Object.values(KEYS)) {
      try {
        const idbValue = await idbGet(key)
        if (idbValue !== undefined && idbValue !== null) continue

        const raw = localStorage.getItem(LS_PREFIX + key)
        if (!raw) continue

        const value = JSON.parse(raw)
        await idbSet(key, value)
      } catch (_e) {
        console.warn(`Migration failed for ${key}`, _e)
      }
    }

    // Write schema version to mark migration complete
    await idbSet(SCHEMA_KEY, SCHEMA_VERSION)

    // Clear localStorage keys after successful migration
    for (const key of Object.values(KEYS)) {
      try {
        localStorage.removeItem(LS_PREFIX + key)
      } catch (_e) {
        /* best-effort */
      }
    }
  } catch (_e) {
    console.warn('localStorage migration failed', _e)
  }
}

// ── Dual storage helpers ────────────────────────────────────────
// IDB is primary. localStorage is written as disaster-recovery backup only.
// Reads always go to IDB first; localStorage read is last-resort fallback.

async function dualGet(key, fallback = null) {
  // 1. Try IndexedDB (primary)
  try {
    const value = await idbGet(key)
    if (value !== undefined && value !== null) return value
  } catch (_e) {
    console.warn(`IDB read failed for ${key}`, _e)
  }
  // 2. Fallback to localStorage (only if IDB is unavailable)
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) return JSON.parse(raw)
  } catch (_e) {
    console.warn(`localStorage read failed for ${key}`, _e)
  }
  return fallback
}

async function dualSet(key, value) {
  let idbOk = false
  // 1. Write to IndexedDB (primary) — queued to prevent races
  await queuedWrite(async () => {
    try {
      await idbSet(key, value)
      idbOk = true
    } catch (_e) {
      console.warn(`IDB write failed for ${key}`, _e)
    }
  })
  // 2. Write to localStorage (backup)
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  } catch (_e) {
    console.warn(`localStorage write failed for ${key}`, _e)
  }
  return idbOk
}

async function dualDelete(key) {
  await queuedWrite(async () => {
    try {
      await deleteKey(key)
    } catch (_e) {
      /* best-effort */
    }
  })
  try {
    localStorage.removeItem(LS_PREFIX + key)
  } catch (_e) {
    /* best-effort */
  }
}

async function dualClear() {
  await queuedWrite(async () => {
    try {
      await idbClear()
    } catch (_e) {
      /* best-effort */
    }
  })
  for (const k of Object.values(KEYS)) {
    try {
      localStorage.removeItem(LS_PREFIX + k)
    } catch (_e) {
      /* */
    }
  }
}

// ── Public API ────────────────────────────────────────────────────

export function loadProfile() {
  return dualGet(KEYS.profile).then(normalizeProfile)
}

export function loadSchedule() {
  return dualGet(KEYS.schedule)
}

export async function loadLatestPlan() {
  const raw = await dualGet(KEYS.latestPlan)
  return normalizeLatestPlan(raw)
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

export async function loadWeightLogs() {
  const raw = await dualGet(KEYS.weightLogs)
  if (!Array.isArray(raw)) return []
  return raw
}

export async function saveWeightLog(entry) {
  const logs = await loadWeightLogs()
  const existingIndex = logs.findIndex((log) => log.date === entry.date)
  const now = new Date().toISOString()

  if (existingIndex >= 0) {
    logs[existingIndex] = {
      ...logs[existingIndex],
      ...entry,
      updatedAt: now,
    }
  } else {
    logs.push({
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: entry.date,
      weight: entry.weight,
      waist: entry.waist ?? null,
      hip: entry.hip ?? null,
      chest: entry.chest ?? null,
      bodyFat: entry.bodyFat ?? null,
      hungerLevel: entry.hungerLevel ?? null,
      adherenceLevel: entry.adherenceLevel ?? null,
      note: entry.note ?? '',
      createdAt: now,
      updatedAt: now,
    })
  }

  logs.sort((a, b) => b.date.localeCompare(a.date))
  await dualSet(KEYS.weightLogs, logs)
  return logs
}

export async function deleteWeightLog(logId) {
  const logs = await loadWeightLogs()
  const filtered = logs.filter((log) => log.id !== logId)
  await dualSet(KEYS.weightLogs, filtered)
  return filtered
}

export async function loadCheckins() {
  const raw = await dualGet(KEYS.checkins)
  if (!Array.isArray(raw)) return []
  return raw
}

export async function saveCheckin(entry) {
  const logs = await loadCheckins()
  const existingIndex = logs.findIndex((log) => log.date === entry.date)
  const now = new Date().toISOString()

  if (existingIndex >= 0) {
    logs[existingIndex] = {
      ...logs[existingIndex],
      ...entry,
      updatedAt: now,
    }
  } else {
    logs.push({
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: entry.date,
      mealCompleted: entry.mealCompleted ?? 'partial',
      ateOut: !!entry.ateOut,
      exerciseDone: !!entry.exerciseDone,
      sleepQuality: entry.sleepQuality ?? null,
      hungerLevel: entry.hungerLevel ?? null,
      adherenceLevel: entry.adherenceLevel ?? null,
      note: entry.note ?? '',
      createdAt: now,
      updatedAt: now,
    })
  }

  logs.sort((a, b) => b.date.localeCompare(a.date))
  await dualSet(KEYS.checkins, logs)
  return logs
}

export async function deleteCheckin(logId) {
  const logs = await loadCheckins()
  const filtered = logs.filter((log) => log.id !== logId)
  await dualSet(KEYS.checkins, filtered)
  return filtered
}

export async function clearAllData() {
  await dualClear()
}

export async function exportAllData() {
  const entries = await Promise.all(
    Object.entries(KEYS).map(async ([name, key]) => [name, await dualGet(key)]),
  )
  return Object.fromEntries(entries)
}

export async function importAllData(data) {
  if (!data || typeof data !== 'object') return

  for (const [name, key] of Object.entries(KEYS)) {
    if (!Object.prototype.hasOwnProperty.call(data, name)) continue

    const value = data[name]
    if (value === undefined || value === null) {
      await dualDelete(key)
    } else {
      await dualSet(key, value)
    }
  }
}

export { dualGet, dualSet, dualDelete }

export async function getAppState() {
  try {
    const profile = await loadProfile()
    const schedule = await loadSchedule()
    const latestPlan = await loadLatestPlan()
    return {
      profile,
      schedule,
      latestPlan: latestPlan
        ? {
            ...latestPlan,
            paramsSnapshot: normalizeProfile(latestPlan.paramsSnapshot),
          }
        : null,
    }
  } catch (error) {
    console.warn('Failed to load app state', error)
    return { profile: null, schedule: null, latestPlan: null }
  }
}
