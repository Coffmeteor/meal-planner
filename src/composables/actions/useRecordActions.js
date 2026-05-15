import { nextTick } from 'vue'
import * as bodyRecordService from '../../services/body-records.js'
import * as checkinService from '../../services/checkins.js'

export function useRecordActions(ctx) {
  const { appState, dataVersion, popPage, showToast } = ctx

  async function handleWeightLogsSave(payload) {
    try {
      await appState.saveWeightLogEntry(payload)
      await nextTick()
      showToast('已保存体重')
      popPage()
    } catch (_e) {
      showToast('保存失败')
    }
  }

  async function handleCheckinSave(payload) {
    try {
      await appState.saveCheckinEntry(payload)
      await nextTick()
      showToast('已保存打卡')
      popPage()
    } catch (_e) {
      showToast('保存失败')
    }
  }

  async function handleWeightLogsTabSave(payload) {
    try {
      await appState.saveWeightLogEntry(payload)
      await nextTick()
      showToast('已保存体重')
    } catch (_e) {
      showToast('保存失败')
    }
  }

  async function handleCheckinTabSave(payload) {
    try {
      await appState.saveCheckinEntry(payload)
      await nextTick()
      showToast('已保存打卡')
    } catch (_e) {
      showToast('保存失败')
    }
  }

  async function handleDeleteWeightLog(logId) {
    try {
      const updatedLogs = await bodyRecordService.deleteWeight(logId)
      appState.weightLogs.value = updatedLogs
      await nextTick()
      dataVersion.value++
      showToast('已删除体重记录')
    } catch (_e) {
      showToast('删除失败')
    }
  }

  async function handleDeleteCheckin(checkinId) {
    try {
      const result = await checkinService.remove(checkinId)
      appState.checkins.value = result
      await nextTick()
      dataVersion.value++
      showToast('已删除打卡记录')
    } catch (_e) {
      showToast('删除失败')
    }
  }

  return {
    handleWeightLogsSave,
    handleCheckinSave,
    handleWeightLogsTabSave,
    handleCheckinTabSave,
    handleDeleteWeightLog,
    handleDeleteCheckin,
  }
}
