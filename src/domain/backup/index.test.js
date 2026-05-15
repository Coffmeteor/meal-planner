import { describe, expect, it, vi } from 'vitest'
import {
  createBackupPayload,
  migrateBackupPayload,
  normalizeBackupPayload,
  summarizeBackupPayload,
  validateBackupPayload,
} from './index.js'

describe('domain/backup', () => {
  it('creates a versioned backup payload around arbitrary app data', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T08:00:00.000Z'))

    expect(createBackupPayload({ profile: { age: 30 } })).toMatchObject({
      app: 'meal-planner',
      backupSchemaVersion: 1,
      timestamp: '2026-05-15T08:00:00.000Z',
      exportedAt: '2026-05-15T08:00:00.000Z',
      data: { profile: { age: 30 } },
    })

    vi.useRealTimers()
  })

  it('rejects malformed, foreign, empty, and future backup payloads', () => {
    expect(validateBackupPayload(null)).toEqual({ valid: false, error: '备份文件格式不正确。' })
    expect(validateBackupPayload({ app: 'other', data: {} })).toEqual({
      valid: false,
      error: '这不是轻盈餐盘的备份文件。',
    })
    expect(validateBackupPayload({ app: 'meal-planner' })).toEqual({
      valid: false,
      error: '备份文件缺少可导入的数据。',
    })
    expect(
      validateBackupPayload({ app: 'meal-planner', backupSchemaVersion: 99, data: {} }),
    ).toEqual({
      valid: false,
      error: '备份文件来自更新版本，请先升级应用后再导入。',
    })
  })

  it('normalizes legacy payloads and summarizes included data', () => {
    const payload = normalizeBackupPayload({
      profile: { age: 30 },
      latestPlan: [{ day: 1 }, { day: 2 }],
      weightLogs: [{ id: 'w1' }],
      checkins: 'bad-data',
    })

    expect(payload).toMatchObject({
      app: 'meal-planner',
      backupSchemaVersion: 1,
      data: {
        profile: { age: 30 },
        schedule: null,
        latestPlan: [{ day: 1 }, { day: 2 }],
        weightLogs: [{ id: 'w1' }],
        checkins: [],
      },
    })

    expect(summarizeBackupPayload(payload)).toMatchObject({
      included: {
        profile: true,
        schedule: false,
        latestPlan: true,
        foodPreferences: false,
        weightLogs: 1,
        checkins: 0,
      },
      planDays: 2,
    })
  })

  it('does not downgrade backups from a newer schema', () => {
    expect(migrateBackupPayload({ backupSchemaVersion: 3 }, 1)).toEqual({ backupSchemaVersion: 3 })
  })
})
