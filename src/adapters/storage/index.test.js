import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => ({
  store: new Map(),
  failGet: false,
  failSet: false,
  failDelete: false,
  failClear: false,
}))

vi.mock('./db.js', () => ({
  get: vi.fn(async (key) => {
    if (dbMock.failGet) throw new Error('mock idb get failure')
    return dbMock.store.get(key)
  }),
  set: vi.fn(async (key, value) => {
    if (dbMock.failSet) throw new Error('mock idb set failure')
    dbMock.store.set(key, value)
    return undefined
  }),
  deleteKey: vi.fn(async (key) => {
    if (dbMock.failDelete) throw new Error('mock idb delete failure')
    dbMock.store.delete(key)
    return undefined
  }),
  delete: vi.fn(async (key) => {
    if (dbMock.failDelete) throw new Error('mock idb delete failure')
    dbMock.store.delete(key)
    return undefined
  }),
  clear: vi.fn(async () => {
    if (dbMock.failClear) throw new Error('mock idb clear failure')
    dbMock.store.clear()
    return undefined
  }),
}))

import {
  clearAllData,
  dualGet,
  exportAllData,
  getAppState,
  importAllData,
  loadLatestPlan,
  loadProfile,
  loadWeightLogs,
  migrateFromLocalStorage,
  saveLatestPlan,
  saveProfile,
  saveWeightLog,
} from './index.js'

const LS_PREFIX = 'meal-planner:v1:'

describe('adapters/storage', () => {
  beforeEach(() => {
    dbMock.store.clear()
    dbMock.failGet = false
    dbMock.failSet = false
    dbMock.failDelete = false
    dbMock.failClear = false
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('normalizes legacy profile data with default fields', async () => {
    await saveProfile({ age: 31, weight: 63 })

    await expect(loadProfile()).resolves.toMatchObject({
      gender: 'female',
      age: 31,
      height: 165,
      weight: 63,
      targetWeight: 56,
      activity: 'light',
      days: 7,
    })
  })

  it('normalizes legacy latestPlan array into metadata shape', async () => {
    await saveLatestPlan([{ day: 1, date: '2026-05-15', meals: [] }])

    await expect(loadLatestPlan()).resolves.toEqual({
      plan: [{ day: 1, date: '2026-05-15', meals: [] }],
      startDate: '2026-05-15',
      generatedAt: null,
    })
  })

  it('falls back to localStorage when IndexedDB reads fail', async () => {
    localStorage.setItem(LS_PREFIX + 'profile', JSON.stringify({ gender: 'male', age: 40 }))
    dbMock.failGet = true

    await expect(loadProfile()).resolves.toMatchObject({ gender: 'male', age: 40 })
  })

  it('writes localStorage backup even if IndexedDB write fails', async () => {
    dbMock.failSet = true

    await saveProfile({ gender: 'male', age: 42 })

    expect(JSON.parse(localStorage.getItem(LS_PREFIX + 'profile'))).toMatchObject({
      gender: 'male',
      age: 42,
    })
  })

  it('saves weight logs by date and keeps newest date first', async () => {
    await saveWeightLog({ date: '2026-05-14', weight: 62 })
    await saveWeightLog({ date: '2026-05-15', weight: 61.5 })
    await saveWeightLog({ date: '2026-05-14', weight: 61.8, note: 'updated' })

    const logs = await loadWeightLogs()
    expect(logs).toHaveLength(2)
    expect(logs.map((log) => log.date)).toEqual(['2026-05-15', '2026-05-14'])
    expect(logs[1]).toMatchObject({ weight: 61.8, note: 'updated' })
  })

  it('imports and exports all app data keys through storage adapters', async () => {
    const payload = {
      profile: { age: 30 },
      schedule: { mealCount: 3 },
      latestPlan: { plan: [{ day: 1, date: '2026-05-15' }] },
      foodPreferences: { selectedFoodIds: ['chicken_breast'] },
      weightLogs: [{ id: 'w1', date: '2026-05-15', weight: 62 }],
      checkins: [{ id: 'c1', date: '2026-05-15' }],
    }

    await importAllData(payload)

    await expect(exportAllData()).resolves.toMatchObject(payload)
    await expect(getAppState()).resolves.toMatchObject({
      profile: expect.objectContaining({ age: 30 }),
      schedule: { mealCount: 3 },
      latestPlan: expect.objectContaining({ startDate: '2026-05-15' }),
    })
  })

  it('clears IndexedDB and localStorage app data', async () => {
    await importAllData({
      profile: { age: 30 },
      schedule: { mealCount: 3 },
    })

    await clearAllData()

    await expect(dualGet('profile')).resolves.toBeNull()
    expect(localStorage.getItem(LS_PREFIX + 'profile')).toBeNull()
  })

  it('migrates localStorage app data into IndexedDB and removes migrated keys', async () => {
    localStorage.setItem(LS_PREFIX + 'profile', JSON.stringify({ age: 35 }))
    localStorage.setItem(LS_PREFIX + 'schedule', JSON.stringify({ mealCount: 4 }))

    await migrateFromLocalStorage()

    expect(dbMock.store.get('profile')).toEqual({ age: 35 })
    expect(dbMock.store.get('schedule')).toEqual({ mealCount: 4 })
    expect(dbMock.store.get('schemaVersion')).toBe(1)
    expect(localStorage.getItem(LS_PREFIX + 'profile')).toBeNull()
    expect(localStorage.getItem(LS_PREFIX + 'schedule')).toBeNull()
  })
})
