<script setup>
import { computed, reactive, ref } from 'vue'
import {
  analyzeWeightTrend,
  buildWeightChartData,
  generateAdvice,
  getTargetCurve,
} from '../utils/progress.js'
import { analyzeRecentCheckins, generateCheckinAdvice } from '../domain/checkins/index.js'

const props = defineProps({
  weightLogs: {
    type: Array,
    default: () => [],
  },
  profile: {
    type: Object,
    default: null,
  },
  checkins: {
    type: Array,
    default: () => [],
  },
  planDays: {
    type: Number,
    default: 7,
  },
  startDate: {
    type: String,
    default: null,
  },
  showClose: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['save', 'close', 'deleteWeightLog'])

const form = reactive({
  date: todayYmd(),
  weight: '',
  waist: '',
  hip: '',
  chest: '',
  bodyFat: '',
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
const checkinAnalysis = computed(() => analyzeRecentCheckins(props.checkins))
const checkinAdvice = computed(() => generateCheckinAdvice(props.checkins, trendInfo.value))
const shouldShowCheckinSummary = computed(() => checkinAnalysis.value.count >= 3)
const targetCurve = computed(() => getTargetCurve(props.profile, props.planDays))
const chartData = computed(() =>
  buildWeightChartData(props.weightLogs, props.profile, props.planDays, props.startDate),
)
const currentWeight = computed(() => {
  const weight = Number(latestLog.value?.weight)
  return Number.isFinite(weight) && weight > 0 ? weight : null
})
const hasWeightLogs = computed(() => props.weightLogs.length > 0)
const summary = computed(() => {
  const startWeight = targetCurve.value?.startWeight ?? null
  const targetWeight = targetCurve.value?.targetWeight ?? null
  const current = currentWeight.value

  return {
    startWeight,
    targetWeight,
    currentWeight: hasWeightLogs.value ? current : null,
    lostWeight:
      hasWeightLogs.value && startWeight != null && current != null
        ? Math.round((startWeight - current) * 10) / 10
        : null,
    remainingWeight:
      hasWeightLogs.value && targetWeight != null && current != null
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
const actualPolyline = computed(() =>
  chartData.value.actualPoints.map((point) => `${toX(point.date)},${toY(point.weight)}`).join(' '),
)
const maPolyline = computed(() =>
  chartData.value.movingAvgPoints
    .map((point) => `${toX(point.date)},${toY(point.weight)}`)
    .join(' '),
)
const targetPolyline = computed(() =>
  chartData.value.targetPoints.map((point) => `${toX(point.date)},${toY(point.weight)}`).join(' '),
)
const gridLines = computed(() => [0, 1, 2].map((index) => 140 - (index / 2) * 120))

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

function toTimestamp(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number)
  if (!year || !month || !day) return 0
  return new Date(year, month - 1, day).getTime()
}

function toX(dateStr) {
  const dates = chartData.value.dates
  if (!dates.length) return 0

  const first = toTimestamp(dates[0])
  const last = toTimestamp(dates[dates.length - 1])
  const current = toTimestamp(dateStr)
  if (!first || !last || !current) return 20
  if (last === first) return 160

  return 20 + ((current - first) / (last - first)) * 280
}

function toY(weight) {
  const { minY, maxY } = chartData.value
  const range = maxY - minY || 1
  return 140 - ((weight - minY) / range) * 120
}

function setScore(field, value) {
  form[field] = form[field] === value ? null : value
}

function resetForm() {
  form.date = todayYmd()
  form.weight = ''
  form.waist = ''
  form.hip = ''
  form.chest = ''
  form.bodyFat = ''
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
    const entry = {
      date: form.date,
      weight: Math.round(weight * 10) / 10,
      hungerLevel: form.hungerLevel,
      adherenceLevel: form.adherenceLevel,
      note: form.note.trim(),
    }
    const waist = Number(form.waist)
    const hip = Number(form.hip)
    const chest = Number(form.chest)
    const bodyFat = Number(form.bodyFat)
    if (Number.isFinite(waist) && waist > 0) entry.waist = Math.round(waist * 10) / 10
    if (Number.isFinite(hip) && hip > 0) entry.hip = Math.round(hip * 10) / 10
    if (Number.isFinite(chest) && chest > 0) entry.chest = Math.round(chest * 10) / 10
    if (Number.isFinite(bodyFat) && bodyFat > 0) entry.bodyFat = Math.round(bodyFat * 10) / 10
    resetForm()
    emit('save', entry)
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
    emit('deleteWeightLog', log.id)
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
        <p>记录</p>
        <h2>身体记录</h2>
      </div>
      <button v-if="showClose" type="button" class="text-action" @click="emit('close')">
        返回
      </button>
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

    <div v-if="shouldShowCheckinSummary" class="advice-panel checkin-summary">
      <span>执行复盘</span>
      <div class="checkin-summary-grid">
        <strong>执行率 {{ Math.round(checkinAnalysis.adherenceRate * 100) }}%</strong>
        <strong>外食 {{ checkinAnalysis.ateOutCount }} 次</strong>
        <strong>运动 {{ checkinAnalysis.exerciseCount }} 次</strong>
      </div>
      <p>{{ checkinAdvice }}</p>
    </div>

    <div v-if="chartData.actualPoints.length >= 2" class="chart-panel">
      <div class="chart-head">
        <span>体重趋势</span>
      </div>
      <svg class="weight-chart" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid meet">
        <line
          v-for="(y, index) in gridLines"
          :key="index"
          :x1="0"
          :y1="y"
          :x2="320"
          :y2="y"
          stroke="var(--color-border)"
          stroke-dasharray="3,3"
          stroke-width="1"
        />
        <polyline
          v-if="chartData.targetPoints.length"
          :points="targetPolyline"
          fill="none"
          stroke="var(--color-muted)"
          stroke-width="1.5"
          stroke-dasharray="5,4"
        />
        <polyline
          v-if="chartData.movingAvgPoints.length"
          :points="maPolyline"
          fill="none"
          stroke="var(--color-primary)"
          stroke-width="2"
        />
        <polyline
          :points="actualPolyline"
          fill="none"
          stroke="var(--color-primary-deep)"
          stroke-width="2"
        />
        <circle
          v-for="(point, index) in chartData.actualPoints"
          :key="index"
          :cx="toX(point.date)"
          :cy="toY(point.weight)"
          r="3"
          fill="var(--color-primary-deep)"
        />
      </svg>
      <div class="chart-legend">
        <span class="legend-item"><i class="dot actual"></i>实际体重</span>
        <span v-if="chartData.movingAvgPoints.length" class="legend-item">
          <i class="line avg"></i>7 日均重
        </span>
        <span v-if="chartData.targetPoints.length" class="legend-item">
          <i class="line target"></i>目标曲线
        </span>
      </div>
    </div>
    <div v-else class="chart-panel chart-empty">
      <p>
        {{ hasWeightLogs ? '继续记录几天后生成趋势图' : '添加第一条体重记录后，将开始生成趋势' }}
      </p>
    </div>

    <form class="log-form" @submit.prevent="handleSave">
      <div class="form-grid">
        <label>
          <span>日期</span>
          <input v-model="form.date" type="date" />
        </label>
        <label>
          <span>体重 (kg)</span>
          <input
            v-model="form.weight"
            type="number"
            min="1"
            step="0.1"
            inputmode="decimal"
            placeholder="kg"
          />
        </label>
      </div>

      <details class="body-measure-details">
        <summary>围度与体脂（可选）</summary>
        <div class="form-grid body-grid">
          <label>
            <span>腰围 (cm)</span>
            <input
              v-model="form.waist"
              type="number"
              min="1"
              step="0.1"
              inputmode="decimal"
              placeholder="cm"
            />
          </label>
          <label>
            <span>臀围 (cm)</span>
            <input
              v-model="form.hip"
              type="number"
              min="1"
              step="0.1"
              inputmode="decimal"
              placeholder="cm"
            />
          </label>
          <label>
            <span>胸围 (cm)</span>
            <input
              v-model="form.chest"
              type="number"
              min="1"
              step="0.1"
              inputmode="decimal"
              placeholder="cm"
            />
          </label>
          <label>
            <span>体脂率 (%)</span>
            <input
              v-model="form.bodyFat"
              type="number"
              min="1"
              step="0.1"
              inputmode="decimal"
              placeholder="%"
            />
          </label>
        </div>
      </details>

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
      <div class="form-action-bar" :class="{ single: !showClose }">
        <button v-if="showClose" type="button" class="ghost-action" @click="emit('close')">
          放弃
        </button>
        <button type="submit" class="primary-action full-width" :disabled="saving">
          {{ saving ? '保存中...' : '保存记录' }}
        </button>
      </div>
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
          <span>
            饥饿 {{ scoreText(log.hungerLevel) }} · 执行 {{ scoreText(log.adherenceLevel) }}
            <template v-if="log.waist"> · 腰围 {{ log.waist }}cm</template>
            <template v-if="log.bodyFat"> · 体脂 {{ log.bodyFat }}%</template>
          </span>
          <p v-if="log.note">{{ log.note }}</p>
        </div>
        <button
          type="button"
          class="delete-action"
          :disabled="saving || !log.id"
          @click="handleDelete(log)"
        >
          删除
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.weight-progress {
  display: flex;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  flex-direction: column;
  gap: 1rem;
  padding: 0 0.5rem calc(5rem + env(safe-area-inset-bottom));
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-button);
  color: var(--color-primary-deep);
  background: var(--color-card);
  font-weight: 900;
}

.summary-panel,
.advice-panel,
.chart-panel,
.log-form,
.recent-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
  box-shadow: var(--shadow-card);
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
  color: var(--color-muted);
  font-size: 0.78rem;
}

.metric-item strong {
  color: var(--color-text);
  font-size: 0.98rem;
  line-height: 1.2;
}

.trend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--color-border);
}

.trend-row strong {
  color: var(--color-primary-deep);
}

.advice-panel {
  padding: 0.9rem 1rem;
}

.advice-panel p {
  margin: 0.35rem 0 0;
  color: var(--color-text);
  font-size: 0.9rem;
  line-height: 1.55;
}

.checkin-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.checkin-summary-grid strong {
  min-width: 0;
  padding: 0.55rem 0.45rem;
  border-radius: var(--radius-button);
  background: #f8fafc;
  color: var(--color-text);
  font-size: 0.78rem;
  line-height: 1.35;
  text-align: center;
}

.chart-panel {
  padding: 1rem;
}

.chart-panel.chart-empty p {
  margin: 0;
  padding: 2rem 0;
  color: var(--color-muted);
  font-size: 0.88rem;
  text-align: center;
}

.chart-head {
  margin-bottom: 0.75rem;
}

.chart-head span {
  color: var(--color-muted);
  font-size: 0.78rem;
}

.weight-chart {
  display: block;
  width: 100%;
  height: auto;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--color-muted);
  font-size: 0.75rem;
}

.legend-item .dot.actual {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary-deep);
}

.legend-item .line.avg {
  display: inline-block;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  background: var(--color-primary);
}

.legend-item .line.target {
  display: inline-block;
  width: 18px;
  height: 0;
  border-top: 2px dashed #bbb;
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-button);
  background: var(--color-card);
  color: var(--color-text);
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-button);
  background: var(--color-card);
  color: var(--color-muted);
  font-weight: 800;
}

.score-buttons button.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-deep);
}

.form-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.82rem;
  font-weight: 700;
}

.form-action-bar {
  position: fixed;
  right: max(1rem, calc((100vw - 30rem) / 2 + 1rem));
  bottom: calc(1rem + env(safe-area-inset-bottom));
  left: max(1rem, calc((100vw - 30rem) / 2 + 1rem));
  z-index: 21;
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 0.65rem;
  padding: 0.65rem;
  border: 0.5px solid var(--color-separator);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -0.5px 4px rgba(0, 0, 0, 0.06);
}

.body-measure-details {
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-sm);
  padding: 0;
}

.body-measure-details summary {
  padding: 0.65rem 0.85rem;
  color: var(--color-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}

.body-measure-details summary::before {
  content: '+ ';
}

.body-measure-details[open] summary::before {
  content: '− ';
}

.body-grid {
  padding: 0 0.85rem 0.75rem;
}

.form-action-bar.single {
  grid-template-columns: 1fr;
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
  color: var(--color-text);
  font-size: 1rem;
}

.empty-state {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.88rem;
}

.log-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-top: 1px solid var(--color-border);
}

.log-item div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.log-item strong {
  color: var(--color-text);
  font-size: 0.92rem;
}

.log-item span,
.log-item p {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.8rem;
  line-height: 1.45;
  word-break: break-word;
}

.delete-action {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--color-danger);
  font-size: 0.82rem;
  font-weight: 800;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 520px) {
  .metric-grid,
  .checkin-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .form-grid {
    grid-template-columns: 1fr;
  }

  .log-item {
    align-items: stretch;
    flex-direction: column;
  }

  .delete-action {
    align-self: flex-start;
  }
}

@media (max-width: 400px) {
  .weight-progress {
    padding: 0 0.25rem calc(5rem + env(safe-area-inset-bottom));
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .score-buttons button {
    min-height: 2rem;
    font-size: 0.85rem;
  }
}

@media (max-width: 360px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .metric-item strong {
    font-size: 0.9rem;
  }
}
</style>
