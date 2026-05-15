// Adapter: File — JSON export/import, file selection, download
// Platform-level file operations. No domain logic.
import {
  createBackupPayload,
  validateBackupPayload,
  summarizeBackupPayload,
} from '../../domain/backup/index.js'

/**
 * Trigger browser download of data as a JSON file.
 */
export function downloadJSON(data, filename = 'meal-planner-backup.json') {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Create a backup payload and trigger download.
 */
export function downloadBackup(data) {
  const payload = createBackupPayload(data)
  downloadJSON(payload, `meal-planner-backup-${new Date().toISOString().slice(0, 10)}.json`)
  return payload
}

/**
 * Trigger a file picker for JSON files.
 * Returns a Promise that resolves with the parsed JSON, or null if cancelled.
 * Works around iOS Safari file input display:none issue by using sr-only positioning.
 */
export function pickJSONFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'

    // iOS Safari requires the input to be visible — sr-only pattern
    Object.assign(input.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
    })

    // Clean up on any resolution
    const cleanup = () => {
      document.body.removeChild(input)
      clearTimeout(timeoutId)
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 120000) // 2-minute timeout

    input.onchange = (event) => {
      const file = event.target.files?.[0]
      if (!file) {
        cleanup()
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          cleanup()
          resolve(data)
        } catch {
          cleanup()
          resolve(null) // Invalid JSON
        }
      }
      reader.onerror = () => {
        cleanup()
        resolve(null)
      }
      reader.readAsText(file)
    }

    // User cancelled
    input.oncancel = () => {
      cleanup()
      resolve(null)
    }

    document.body.appendChild(input)
    input.click()
  })
}

/**
 * Parse and validate a file from a drag-and-drop or change event.
 * Returns { valid, data, error, summary }.
 */
export async function parseImportFile(file) {
  if (!file) {
    return { valid: false, error: '未选择文件' }
  }

  let raw
  try {
    raw = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file)
    })
  } catch {
    return { valid: false, error: '文件读取失败' }
  }

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return { valid: false, error: '文件格式不正确，请选择JSON文件' }
  }

  const validation = validateBackupPayload(payload)
  if (!validation.valid) {
    return validation
  }

  const summary = summarizeBackupPayload(payload)
  return { valid: true, data: payload.data, summary }
}

/**
 * Read a JSON file from a File object (for drag-drop scenarios).
 */
export function readFileAsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result))
      } catch {
        reject(new Error('文件格式不正确'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
