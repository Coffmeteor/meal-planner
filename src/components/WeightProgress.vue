<script setup>
import { computed, reactive, ref } from 'vue'
import { deleteWeightLog, saveWeightLog } from '../storage/index.js'
import { analyzeWeightTrend, generateAdvice, getTargetCurve } from '../utils/progress.js'

const props = defineProps({
  weightLogs: {
    type: Array,
    default: () => [],
  },
  profile: {
    type: Object,
    default: null,
  },
  planDays: {
    type: Number,
    default: 7,
  },
})

const emit = defineEmits(['save', 'close'])

const form = reactive({
  date: todayYmd(),
  weight: '',
  hungerLevel: null,
  adherenceLevel: null,
  note: '',
})
const error = ref('')
const saving = ref(false)

const sortedLogs = computed(() =>
  [...props.weightLogs].sort((a, b) => b.date.localeCompare(a.date)),
)
const latestLog = computed(() => sortedLogs.value[0] || null)
const trendInfo = computed(() => analyzeWeightTrend(props.weightLogs))
const advice = computed(() => generateAdvice(props.weightLogs, props.profile))
const targetCurve = computed(() => getTargetCurve(props.profile, props.planDays))
const currentWeight = computed(() => {
  const weight = Number(latestLog.value?.weight)
  return Number.isFinite(weight) && weight > 0 ? weight : null
})
const summary = computed(() => {
  const startWeight = targetCurve.value?.startWeight ?? null
  const targetWeight = targetCurve.value?.targetWeight ?? null
  const current = currentWeight.value

  return {
    startWeight,
    targetWeight,
    currentWeight: current,
    lostWeight: startWeight != null && current != null
      ? Math.round((startWeight - current) * 10) / 10
      : null,
    remainingWeight: targetWeight != null && current != null
      ? Math.max(0, Math.round((current - targetWeight) * 10) / 10)
      : null,
  }
})
const trendText = computed(() => {
  const labels = {
    down: '下降',
    stable: '持平',
    up: '上升',
    insufficient: '待积累',
  }
  return labels[trendInfo.value.trend] || '待积累'
})

function todayYmd() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatKg(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10} kg` : '--'
}

function scoreText(value) {
  return value == null ? '未填' : `${value}/5`
}

function setScore(field, value) {
  form[field] = form[field] === value ? null : value
}

function resetForm() {
  form.date = todayYmd()
  form.weight = ''
  form.hungerLevel = null
  form.adherenceLevel = null
  form.note = ''
  error.value = ''
}

async function handleSave() {
  const weight = Number(form.weight)
  if (!form.date) {
    error.value = '请选择日期'
    return
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    error.value = '请输入有效体重'
    return
  }

  const existing = props.weightLogs.find((log) => log.date === form.date)
  if (existing && !confirm(`该日期已有记录（${existing.weight}kg），要覆盖吗？`)) return

  saving.value = true
  error.value = ''
  try {
    const updatedLogs = await saveWeightLog({
      date: form.date,
      weight: Math.round(weight * 10) / 10,
      hungerLevel: form.hungerLevel,
      adherenceLevel: form.adherenceLevel,
      note: form.note.trim(),
    })
    resetForm()
    emit('save', updatedLogs)
  } catch (e) {
    console.warn('Failed to save weight log', e)
    error.value = '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

async function handleDelete(log) {
  if (!log.id) return
  if (!confirm(`确定删除 ${log.date} 的体重记录吗？`)) return

  saving.value = true
  error.value = ''
  try {
    const updatedLogs = await deleteWeightLog(log.id)
    emit('save', updatedLogs)
  } catch (e) {
    console.warn('Failed to delete weight log', e)
    error.value = '删除失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="weight-progress">
    <div class="section-title compact progress-title">
      <div>
        <p>体重趋势</p>
        <h2>进度记录</h2>
      </div>
      <button type="button" class="text-action" @click="emit('close')">返回</button>
    </div>

    <div class="summary-panel">
      <div class="metric-grid">
        <div class="metric-item">
          <span>起始体重</span>
          <strong>{{ formatKg(summary.startWeight) }}</strong>
        </div>
        <div class="metric-item">
          <span>目标体重</span>
          <strong>{{ formatKg(summary.targetWeight) }}</strong>
        </div>
        <div class="metric-item">
          <span>当前体重</span>
          <strong>{{ formatKg(summary.currentWeight) }}</strong>
        </div>
        <div class="metric-item">
          <span>已减</span>
          <strong>{{ formatKg(summary.lostWeight) }}</strong>
        </div>
        <div class="metric-item">
          <span>距离目标</span>
          <strong>{{ formatKg(summary.remainingWeight) }}</strong>
        </div>
        <div class="metric-item">
          <span>7 日均重</span>
          <strong>{{ trendInfo.avg7 == null ? '--' : formatKg(trendInfo.avg7) }}</strong>
        </div>
      </div>
      <div class="trend-row">
        <span>记录 {{ trendInfo.count }} 条</span>
        <strong>{{ trendText }}</strong>
      </div>
    </div>

    <div class="advice-panel">
      <span>轻量建议</span>
      <p>{{ advice }}</p>
    </div>

    <form class="log-form" @submit.prevent="handleSave">
      <div class="form-grid">
        <label>
          <span>日期</span>
          <input v-model="form.date" type="date">
        </label>
        <label>
          <span>体重</span>
          <input
            v-model="form.weight"
            type="number"
            min="1"
            step="0.1"
            inputmode="decimal"
            placeholder="kg"
          >
        </label>
      </div>

      <div class="score-block">
        <span>饥饿感</span>
        <div class="score-buttons">
          <button
            v-for="score in 5"
            :key="`hunger-${score}`"
            type="button"
            :class="{ active: form.hungerLevel === score }"
            @click="setScore('hungerLevel', score)"
          >
            {{ score }}
          </button>
        </div>
      </div>

      <div class="score-block">
        <span>执行度</span>
        <div class="score-buttons">
          <button
            v-for="score in 5"
            :key="`adherence-${score}`"
            type="button"
            :class="{ active: form.adherenceLevel === score }"
            @click="setScore('adherenceLevel', score)"
          >
            {{ score }}
          </button>
        </div>
      </div>

      <label class="note-field">
        <span>备注</span>
        <textarea v-model="form.note" rows="3" placeholder="可选"></textarea>
      </label>

      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" class="primary-action full-width" :disabled="saving">
        {{ saving ? '保存中...' : '保存记录' }}
      </button>
    </form>

    <div class="recent-panel">
      <div class="recent-head">
        <h3>最近记录</h3>
        <span>{{ sortedLogs.length }} 条</span>
      </div>
      <p v-if="!sortedLogs.length" class="empty-state">还没有体重记录。</p>
      <article v-for="log in sortedLogs" :key="log.id || log.date" class="log-item">
        <div>
          <strong>{{ log.date }} · {{ formatKg(log.weight) }}</strong>
          <span>饥饿 {{ scoreText(log.hungerLevel) }} · 执行 {{ scoreText(log.adherenceLevel) }}</span>
          <p v-if="log.note">{{ log.note }}</p>
        </div>
        <button type="button" class="delete-action" :disabled="saving || !log.id" @click="handleDelete(log)">
          删除
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.weight-progress {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.text-action {
  flex: 0 0 auto;
  min-height: 2.25rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line, #dfe5dd);
  border-radius: 0.8rem;
  color: var(--green-deep, #35754b);
  background: rgba(255, 255, 255, 0.72);
  font-weight: 900;
}

.summary-panel,
.advice-panel,
.log-form,
.recent-panel {
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

.summary-panel {
  padding: 1rem;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.metric-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-item span,
.trend-row span,
.advice-panel span,
.score-block > span,
.note-field span,
.recent-head span {
  color: #68736b;
  font-size: 0.78rem;
}

.metric-item strong {
  color: #223026;
  font-size: 0.98rem;
  line-height: 1.2;
}

.trend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid #edf0ec;
}

.trend-row strong {
  color: var(--green, #5ba66f);
}

.advice-panel {
  padding: 0.9rem 1rem;
}

.advice-panel p {
  margin: 0.35rem 0 0;
  color: #2f3a32;
  font-size: 0.9rem;
  line-height: 1.55;
}

.log-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-grid label,
.note-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dfe5dd;
  border-radius: 0.65rem;
  background: #fbfcfa;
  color: #223026;
  font: inherit;
  padding: 0.7rem 0.75rem;
}

textarea {
  resize: vertical;
}

.score-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.score-buttons {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.45rem;
}

.score-buttons button {
  min-height: 2.3rem;
  border: 1px solid #dfe5dd;
  border-radius: 0.65rem;
  background: #fbfcfa;
  color: #4f5f53;
  font-weight: 800;
}

.score-buttons button.active {
  border-color: var(--green, #5ba66f);
  background: #edf7ef;
  color: #2f7c48;
}

.form-error {
  margin: 0;
  color: #c0392b;
  font-size: 0.82rem;
  font-weight: 700;
}

.recent-panel {
  padding: 1rem;
}

.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.recent-head h3 {
  margin: 0;
  color: #223026;
  font-size: 1rem;
}

.empty-state {
  margin: 0;
  color: #7a847d;
  font-size: 0.88rem;
}

.log-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-top: 1px solid #edf0ec;
}

.log-item div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.log-item strong {
  color: #223026;
  font-size: 0.92rem;
}

.log-item span,
.log-item p {
  margin: 0;
  color: #68736b;
  font-size: 0.8rem;
  line-height: 1.45;
  word-break: break-word;
}

.delete-action {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: #c0392b;
  font-size: 0.82rem;
  font-weight: 800;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 520px) {
  .metric-grid,
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .log-item {
    align-items: stretch;
    flex-direction: column;
  }

  .delete-action {
    align-self: flex-start;
  }
}
</style>
