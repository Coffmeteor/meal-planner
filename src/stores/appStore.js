import { ref } from 'vue'

export const currentTab = ref('today')

export function switchTab(name) {
  if (!name) return
  currentTab.value = name
}
