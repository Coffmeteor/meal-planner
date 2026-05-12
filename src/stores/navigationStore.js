import { computed, reactive } from 'vue'

const pageStack = reactive([])

export const currentPage = computed(() => pageStack[pageStack.length - 1] || null)
export const currentPageParams = computed(() => currentPage.value?.params || {})
export const hasSubPage = computed(() => pageStack.length > 0)

export function pushPage(name, params = {}) {
  if (!name) return
  pageStack.push({ name, params })
}

export function popPage() {
  if (pageStack.length) pageStack.pop()
}

export function replacePage(name, params = {}) {
  if (!name) return
  if (pageStack.length) {
    pageStack.splice(pageStack.length - 1, 1, { name, params })
    return
  }
  pushPage(name, params)
}

export function clearPageStack() {
  pageStack.splice(0, pageStack.length)
}

export const navigationStore = {
  pageStack,
  currentPage,
  currentPageParams,
  hasSubPage,
  pushPage,
  popPage,
  replacePage,
  clearPageStack,
}
