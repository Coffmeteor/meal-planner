import { reactive } from 'vue'

export const pageStack = reactive([])

export function pushPage(name, params = {}) {
  pageStack.push({ name, params: params || {} })
}

export function popPage() {
  pageStack.pop()
}

export function replacePage(name, params = {}) {
  if (pageStack.length === 0) {
    pushPage(name, params)
    return
  }

  pageStack.splice(pageStack.length - 1, 1, { name, params: params || {} })
}

export function clearPageStack() {
  pageStack.splice(0, pageStack.length)
}
