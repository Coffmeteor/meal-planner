// Service: Backup — orchestrates import/export/clear operations
import { importAllData, clearAllData, exportAllData } from '../adapters/storage/index.js'
import { createBackupPayload } from '../domain/backup/index.js'

export async function exportData() {
  const data = await exportAllData()
  return createBackupPayload(data)
}

export async function importData(data) {
  return importAllData(data)
}

export async function clearData() {
  return clearAllData()
}
