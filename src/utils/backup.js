// Re-export bridge: all backup functions now live in domain/backup/
// TODO: update downstream imports to use domain/backup directly, then delete this file.
export {
  createBackupPayload,
  validateBackupPayload,
  normalizeBackupPayload,
  summarizeBackupPayload,
  migrateBackupPayload,
} from '../domain/backup/index.js'
