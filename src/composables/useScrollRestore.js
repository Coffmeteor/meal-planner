// Composable: useScrollRestore — scroll to top on page transitions
import { nextTick } from 'vue'

export function useScrollRestore() {
  let scrollPending = false

  function queueScrollToPageTop() {
    if (scrollPending) return
    scrollPending = true
    nextTick(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'auto' })
        scrollPending = false
      })
    })
  }

  return { queueScrollToPageTop }
}
