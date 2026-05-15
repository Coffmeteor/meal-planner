// Domain: Backup — payload creation, validation, migration, normalization
// Pure functions only. No DOM, Vue, localStorage, IndexedDB dependencies.
import { APP_VERSION } from '../../utils/appVersion.js'

const APP_ID = 'meal-planner'
const BACKUP_SCHEMA_VERSION = 1

export function createBackupPayload(data) {
  const exportedAt = new Date().toISOString()
  return {
    app: APP_ID,
    appVersion: APP_VERSION,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    timestamp: exportedAt,
    exportedAt,
    data: data && typeof data === 'object' ? data : {},
  }
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: '备份文件格式不正确。' }
  }
  if (payload.app !== APP_ID) {
    return { valid: false, error: '这不是轻盈餐盘的备份文件。' }
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    return { valid: false, error: '备份文件缺少可导入的数据。' }
  }
  if (Number(payload.backupSchemaVersion || 0) > BACKUP_SCHEMA_VERSION) {
    return { valid: false, error: '备份文件来自更新版本，请先升级应用后再导入。' }
  }
  return { valid: true }
}

export function normalizeBackupPayload(payload) {
  const source =
    payload?.data && typeof payload.data === 'object' ? payload : createBackupPayload(payload)
  return migrateBackupPayload(
    {
      ...source,
      app: source.app || APP_ID,
      appVersion: source.appVersion || 'unknown',
      backupSchemaVersion: Number(source.backupSchemaVersion || 1),
      exportedAt: source.exportedAt || source.timestamp || null,
      data: normalizeData(source.data || {}),
    },
    BACKUP_SCHEMA_VERSION,
  )
}

export function summarizeBackupPayload(payload) {
  const normalized = normalizeBackupPayload(payload)
  const data = normalized.data || {}
  const latestPlan = data.latestPlan
  const planDays = Array.isArray(latestPlan?.plan)
    ? latestPlan.plan.length
    : Array.isArray(latestPlan)
      ? latestPlan.length
      : 0

  return {
    appVersion: normalized.appVersion || 'unknown',
    exportedAt: normalized.exportedAt || normalized.timestamp || null,
    included: {
      profile: Boolean(data.profile),
      schedule: Boolean(data.schedule),
      latestPlan: planDays > 0,
      foodPreferences: Boolean(data.foodPreferences),
      weightLogs: Array.isArray(data.weightLogs) ? data.weightLogs.length : 0,
      checkins: Array.isArray(data.checkins) ? data.checkins.length : 0,
    },
    planDays,
  }
}

export function migrateBackupPayload(payload, targetVersion = BACKUP_SCHEMA_VERSION) {
  const version = Number(payload?.backupSchemaVersion || 1)
  if (version > targetVersion) return payload
  return {
    ...payload,
    backupSchemaVersion: targetVersion,
  }
}

function normalizeData(data) {
  return {
    profile: data.profile ?? null,
    schedule: data.schedule ?? null,
    latestPlan: data.latestPlan ?? null,
    foodPreferences: data.foodPreferences ?? null,
    weightLogs: Array.isArray(data.weightLogs) ? data.weightLogs : [],
    checkins: Array.isArray(data.checkins) ? data.checkins : [],
  }
}
