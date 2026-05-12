import { computed, ref } from 'vue'
import { getRecentFoods } from '../core/foods.js'
import { getFoods, saveFoods as persistFoods } from '../adapters/storageAdapter.js'

export const foods = ref([])

export const recentFoods = computed(() => getRecentFoods(foods.value))

export async function loadFoods() {
  foods.value = await getFoods()
  return foods.value
}

export async function saveFoods() {
  await persistFoods(foods.value)
  return foods.value
}
