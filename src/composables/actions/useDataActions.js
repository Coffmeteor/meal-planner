import * as backupService from '../../services/backup.js'

function downloadJsonFile(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function todayFileDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function useDataActions(ctx) {
  const { appState, pushPage, showToast } = ctx

  async function handleImportData(data) {
    await appState.importData(data)
    showToast('已导入备份')
  }

  async function handleClearData() {
    if (!confirm('清空全部本地数据？此操作不可撤销。')) {
      return false
    }
    await appState.clearData()
    showToast('已清空全部数据')
    return true
  }

  function handleImportDataPrompt() {
    pushPage('dataBackup')
  }

  async function handleExportData() {
    try {
      const payload = await backupService.exportData()
      downloadJsonFile(payload, `meal-planner-backup-${todayFileDate()}.json`)
    } catch (_e) {
      showToast('导出失败，请稍后重试')
    }
  }

  return {
    handleImportData,
    handleClearData,
    handleImportDataPrompt,
    handleExportData,
  }
}
