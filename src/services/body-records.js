// Service: Body Records — orchestrates weight/body record operations
import { saveWeightLog, deleteWeightLog, loadWeightLogs } from '../adapters/storage/index.js'

export async function saveWeight(entry) {
  return saveWeightLog(entry)
}

export async function deleteWeight(logId) {
  return deleteWeightLog(logId)
}

export async function loadWeights() {
  return loadWeightLogs()
}
