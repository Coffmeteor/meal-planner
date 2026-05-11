<script setup>
import { computed, ref } from 'vue'
import { ACTIVITY_LEVELS } from '../utils/calc.js'
import { APP_VERSION } from '../utils/appVersion.js'
import {
  createBackupPayload,
  normalizeBackupPayload,
  summarizeBackupPayload,
  validateBackupPayload,
} from '../utils/backup.js'
import { exportAllData } from '../storage/index.js'

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

const emit = defineEmits(['editProfile', 'clearData', 'importData'])

const fileInput = ref(null)
const backupError = ref('')
const importSummary = ref(null)

const genderLabels = {
  female: '女性',
  male: '男性',
}

const profileRows = computed(() => {
  const profile = props.profile || {}
  return [
    { label: '性别', value: genderLabels[profile.gender] || '--' },
    { label: '年龄', value: formatValue(profile.age, '岁') },
    { label: '身高', value: formatValue(profile.height, 'cm') },
    { label: '当前体重', value: formatValue(profile.weight, 'kg') },
    { label: '目标体重', value: formatValue(profile.targetWeight, 'kg') },
    { label: '日常活动', value: ACTIVITY_LEVELS[profile.activity]?.label || '--' },
    { label: '计划天数', value: formatValue(props.planMeta?.days || profile.days, '天') },
  ]
})

function formatValue(value, unit) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  return `${number}${unit}`
}

async function handleExport() {
  backupError.value = ''
  try {
    const payload = createBackupPayload(await exportAllData())
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meal-planner-backup-${formatDateYmd(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    backupError.value = '导出失败，请稍后重试。'
  }
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

function formatDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<template>
  <section class="profile-view">
    <div class="section-title compact">
      <p>个人设置</p>
      <h2>我的</h2>
    </div>

    <div class="profile-panel">
      <div class="profile-grid">
        <div v-for="row in profileRows" :key="row.label" class="profile-item">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
        </div>
      </div>
      <button type="button" class="primary-action" @click="emit('editProfile')">
        修改资料
      </button>
    </div>

    <div class="profile-panel note-panel">
      <strong>本地存储</strong>
      <p>资料、餐单、食材、体重和打卡记录仅保存在当前浏览器。</p>
    </div>

    <div class="profile-panel backup-panel">
      <div>
        <strong>数据备份</strong>
        <p>导出和导入都只在当前浏览器本地处理，不会上传数据。</p>
      </div>
      <div class="backup-actions">
        <button type="button" class="ghost-action" @click="handleExport">
          导出数据
        </button>
        <button type="button" class="ghost-action" @click="openImportFile">
          导入数据
        </button>
      </div>
      <input
        ref="fileInput"
        class="backup-file-input"
        type="file"
        accept="application/json,.json"
        @change="handleImportFile"
      >
      <p v-if="importSummary" class="backup-summary">
        备份 {{ importSummary.appVersion }} ·
        {{ importSummary.planDays || 0 }} 天餐单 ·
        体重 {{ importSummary.included.weightLogs }} 条 ·
        打卡 {{ importSummary.included.checkins }} 条
      </p>
      <p v-if="backupError" class="backup-error">{{ backupError }}</p>
    </div>

    <div class="profile-panel settings-panel">
      <button type="button" class="danger-action" @click="emit('clearData')">
        清空全部数据
      </button>
      <span>{{ APP_VERSION }}</span>
    </div>
  </section>
</template>

<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-panel {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.profile-item {
  min-width: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: #f6f8f4;
}

.profile-item span,
.settings-panel span {
  display: block;
  color: #68736b;
  font-size: 0.78rem;
  font-weight: 800;
}

.profile-item strong {
  display: block;
  margin-top: 0.2rem;
  color: #223026;
  font-size: 0.98rem;
  line-height: 1.25;
}

.note-panel strong {
  color: #223026;
}

.note-panel p,
.backup-panel p {
  margin: 0;
  color: #68736b;
  font-size: 0.9rem;
  line-height: 1.55;
}

.backup-panel strong {
  color: #223026;
}

.backup-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
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
  padding: 0.7rem 0.8rem;
  border-radius: 0.7rem;
  background: #f6fbf5;
  font-weight: 800;
}

.backup-error {
  padding: 0.7rem 0.8rem;
  border-radius: 0.7rem;
  background: #fff0d8;
  color: #b33b2e !important;
  font-weight: 900;
}

.danger-action {
  min-height: 2.75rem;
  border: 1px solid #f0c8bf;
  border-radius: 0.85rem;
  background: #fff7f5;
  color: #b33b2e;
  font-weight: 900;
}

.settings-panel {
  text-align: center;
}

@media (max-width: 360px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
