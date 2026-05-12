<script setup>
import { computed, onMounted, ref } from 'vue'
import * as backupService from '../services/backupService.js'
import {
  getCheckins,
  getFoods,
  getPlan,
  getUserProfile,
  getWeights,
} from '../adapters/storageAdapter.js'

const emit = defineEmits(['done', 'cancel'])

const fileInput = ref(null)
const status = ref('')
const error = ref('')
const loading = ref(false)
const lastExportAt = ref(localStorage.getItem('meal-planner:last-export-at') || '')
const sizeBytes = ref(0)

const sizeText = computed(() => {
  if (!sizeBytes.value) return '--'
  if (sizeBytes.value < 1024) return `${sizeBytes.value} B`
  return `${Math.round(sizeBytes.value / 102.4) / 10} KB`
})

onMounted(refreshSizeEstimate)

async function buildSnapshot() {
  return {
    foods: await getFoods(),
    plan: await getPlan(),
    checkins: await getCheckins(),
    weights: await getWeights(),
    profile: await getUserProfile(),
  }
}

async function refreshSizeEstimate() {
  try {
    sizeBytes.value = new Blob([JSON.stringify(await buildSnapshot())]).size
  } catch (err) {
    sizeBytes.value = 0
  }
}

function formatDateTime(value) {
  if (!value) return '尚未导出'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '尚未导出'
  return date.toLocaleString('zh-CN')
}

async function handleExport() {
  loading.value = true
  status.value = ''
  error.value = ''
  try {
    await backupService.exportAll()
    lastExportAt.value = new Date().toISOString()
    localStorage.setItem('meal-planner:last-export-at', lastExportAt.value)
    await refreshSizeEstimate()
    status.value = '导出完成'
  } catch (err) {
    console.warn('Backup export failed', err)
    error.value = '导出失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function openImportFile() {
  status.value = ''
  error.value = ''
  fileInput.value?.click()
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  loading.value = true
  status.value = ''
  error.value = ''
  try {
    const result = await backupService.importAll(JSON.parse(await file.text()))
    if (!result.success) {
      error.value = result.errors?.join('；') || '导入失败'
      return
    }
    await refreshSizeEstimate()
    status.value = '导入完成'
  } catch (err) {
    console.warn('Backup import failed', err)
    error.value = '无法读取备份文件，请确认这是有效的 JSON 文件'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="backup-page">
    <div class="backup-panel">
      <div class="backup-stat">
        <span>上次导出</span>
        <strong>{{ formatDateTime(lastExportAt) }}</strong>
      </div>
      <div class="backup-stat">
        <span>数据估算</span>
        <strong>{{ sizeText }}</strong>
      </div>
    </div>

    <div class="backup-panel">
      <button type="button" class="primary-action" :disabled="loading" @click="handleExport">
        导出数据
      </button>
      <button type="button" class="ghost-action" :disabled="loading" @click="openImportFile">
        导入数据
      </button>
      <input
        ref="fileInput"
        class="hidden-input"
        type="file"
        accept="application/json,.json"
        @change="handleImportFile"
      >
      <p v-if="status" class="status-text">{{ status }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>

    <div class="sub-page-actions">
      <button type="button" class="ghost-action" :disabled="loading" @click="emit('cancel')">返回</button>
      <button type="button" class="primary-action" :disabled="loading" @click="emit('done', { type: 'backup' })">
        完成
      </button>
    </div>
  </section>
</template>

<style scoped>
.backup-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.backup-panel {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

.backup-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: #f6f8f4;
}

.backup-stat span,
.status-text,
.error-text {
  color: #68736b;
  font-size: 0.82rem;
  font-weight: 800;
}

.backup-stat strong {
  color: #223026;
  font-size: 0.92rem;
  text-align: right;
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.status-text,
.error-text {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.7rem;
  background: #f6fbf5;
}

.error-text {
  color: #b33b2e;
  background: #fff0d8;
}

.sub-page-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
</style>
