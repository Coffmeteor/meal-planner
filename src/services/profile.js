// Service: Profile — orchestrates profile save operations
import { saveProfile, saveSchedule } from '../../adapters/storage/index.js'

export async function saveProfileAndSchedule(params, schedule) {
  await Promise.all([saveProfile(params), saveSchedule(schedule)])
}
