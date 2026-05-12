// Service: Checkins — orchestrates daily check-in operations
import { saveCheckin, deleteCheckin, loadCheckins } from '../../adapters/storage/index.js'

export async function save(entry) {
  return saveCheckin(entry)
}

export async function remove(logId) {
  return deleteCheckin(logId)
}

export async function load() {
  return loadCheckins()
}
