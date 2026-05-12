import { computed, ref } from 'vue'
import { getPlan, savePlan } from '../adapters/storageAdapter.js'

export const plan = ref(null)

export const todayMeals = computed(() => {
  const days = plan.value?.plan || []
  const today = formatYmd(new Date())
  return days.find((day) => day.date === today)?.meals || days[0]?.meals || []
})

export async function loadPlan() {
  plan.value = await getPlan()
  return plan.value
}

export async function updatePlan(newPlan) {
  plan.value = newPlan
  await savePlan(newPlan)
  return plan.value
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
