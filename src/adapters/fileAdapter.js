export function downloadJSON(data, filename) {
  if (!isFileAPISupported()) return false

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `meal-planner-backup-${formatYmd(new Date())}.json`
  link.click()
  URL.revokeObjectURL(url)
  return true
}

export function uploadJSON() {
  if (!isFileAPISupported()) return Promise.resolve(null)

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(JSON.parse(String(reader.result || 'null')))
        } catch (error) {
          console.warn('Failed to parse uploaded JSON', error)
          resolve(null)
        }
      }
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })
}

export function isFileAPISupported() {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && typeof Blob !== 'undefined'
    && typeof FileReader !== 'undefined'
    && typeof URL !== 'undefined'
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
