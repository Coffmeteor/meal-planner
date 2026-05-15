<script setup>
import { ref } from 'vue'
import { APP_VERSION } from '../utils/appVersion.js'
import {
  normalizeBackupPayload,
  summarizeBackupPayload,
  validateBackupPayload,
} from '../domain/backup/index.js'

const props = defineProps({
  profile: {
    type: Object,
    default: null,
  },
  planMeta: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['editProfile', 'clearData', 'importData', 'exportData'])

const fileInput = ref(null)
const backupError = ref('')
const importSummary = ref(null)

async function handleExport() {
  backupError.value = ''
  emit('exportData')
}

function openImportFile() {
  backupError.value = ''
  importSummary.value = null
  fileInput.value?.click()
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  backupError.value = ''
  importSummary.value = null

  try {
    const payload = JSON.parse(await file.text())
    const validation = validateBackupPayload(payload)
    if (!validation.valid) {
      backupError.value = validation.error
      return
    }

    const normalized = normalizeBackupPayload(payload)
    importSummary.value = summarizeBackupPayload(normalized)
    if (!confirm(summaryText(importSummary.value))) return
    if (!confirm('导入会覆盖当前浏览器里的本地数据，是否继续？')) return

    emit('importData', normalized.data)
  } catch (error) {
    backupError.value = '无法读取备份文件，请确认这是有效的 JSON 文件。'
  }
}

function summaryText(summary) {
  return [
    `备份版本: ${summary.appVersion}`,
    `导出时间: ${formatDateTime(summary.exportedAt)}`,
    `餐单: ${summary.planDays ? `${summary.planDays} 天` : '无'}`,
    `体重记录: ${summary.included.weightLogs} 条`,
    `打卡记录: ${summary.included.checkins} 条`,
    '是否导入这份备份？',
  ].join('\n')
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('zh-CN')
}
</script>

<template>
  <section class="data-backup-view">
    <div class="backup-card">
      <h3>导出数据</h3>
      <p>将资料、餐单、食材、体重和打卡记录导出为 JSON 文件。</p>
      <p>数据仅在本地处理，不会上传。</p>
      <button type="button" class="ghost-action full-width" @click="handleExport">导出备份</button>
    </div>

    <div class="backup-card">
      <h3>导入数据</h3>
      <p>从 JSON 备份文件恢复数据。导入会覆盖当前本地数据。</p>
      <button type="button" class="ghost-action full-width" @click="openImportFile">
        选择备份文件
      </button>
      <input
        ref="fileInput"
        class="backup-file-input"
        type="file"
        accept="application/json,.json"
        @change="handleImportFile"
      />
      <p v-if="importSummary" class="backup-summary">
        备份 {{ importSummary.appVersion }} · {{ importSummary.planDays || 0 }} 天餐单 · 体重
        {{ importSummary.included.weightLogs }} 条 · 打卡 {{ importSummary.included.checkins }} 条
      </p>
    </div>

    <p v-if="backupError" class="backup-error">{{ backupError }}</p>

    <div class="backup-card danger-card">
      <button type="button" class="danger-action full-width" @click="emit('clearData')">
        清空全部数据
      </button>
      <span class="version-label">{{ APP_VERSION }}</span>
    </div>
  </section>
</template>

<style scoped>
.data-backup-view {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.backup-card {
  padding: 1rem;
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.backup-card h3 {
  margin: 0 0 0.35rem;
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.backup-card p {
  margin: 0 0 0.65rem;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}

.backup-file-input {
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

.backup-summary {
  margin: 0.65rem 0 0;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary-deep);
  font-size: 0.82rem;
  font-weight: 600;
}

.backup-error {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  background: rgba(255, 59, 48, 0.08);
  color: var(--color-danger);
  font-size: 0.82rem;
  font-weight: 600;
}

.danger-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.danger-action {
  min-height: 2.6rem;
  border: 1px solid rgba(255, 59, 48, 0.2);
  border-radius: var(--radius-sm);
  background: rgba(255, 59, 48, 0.06);
  color: var(--color-danger);
  font-weight: 700;
}

.version-label {
  color: var(--color-muted);
  font-size: 0.72rem;
}

.full-width {
  width: 100%;
}
</style>
