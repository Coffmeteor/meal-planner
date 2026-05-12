import { ref } from 'vue'
import {
  getCheckins,
  getWeights,
  saveCheckins,
  saveWeights,
} from '../adapters/storageAdapter.js'

export const weights = ref([])
export const checkins = ref([])

export async function loadProgress() {
  const [loadedWeights, loadedCheckins] = await Promise.all([getWeights(), getCheckins()])
  weights.value = loadedWeights
  checkins.value = loadedCheckins
  return { weights: weights.value, checkins: checkins.value }
}

export async function addWeight(entry) {
  const next = [
    ...weights.value.filter((item) => item.date !== entry.date),
    entry,
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  weights.value = next
  await saveWeights(next)
  return weights.value
}

export async function addCheckin(entry) {
  const next = [
    ...checkins.value.filter((item) => item.date !== entry.date),
    entry,
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  checkins.value = next
  await saveCheckins(next)
  return checkins.value
}
