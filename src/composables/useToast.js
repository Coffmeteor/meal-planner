// Composable: useToast — reactive toast notification
import { ref } from 'vue'

export function useToast() {
  const toastMsg = ref('')
  let toastTimer = null

  function showToast(msg) {
    toastMsg.value = msg
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toastMsg.value = ''
    }, 2200)
  }

  return { toastMsg, showToast }
}
