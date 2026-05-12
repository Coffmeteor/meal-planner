<script setup>
import { computed } from 'vue'
import {
  analyzeWeightTrend,
  generateAdvice,
  getTargetCurve,
} from '../utils/progress.js'
import { analyzeRecentCheckins, generateCheckinAdvice } from '../utils/checkins.js'

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
})

const emit = defineEmits([
  'recordWeight',
  'checkinToday',
  'weightLogsSave',
  'checkinSave',
])

const validWeightLogs = computed(() =>
  props.weightLogs
    .filter((log) => log.weight != null && Number(log.weight) > 0)
    .sort((a, b) => b.date.localeCompare(a.date)),
)
const latestWeightLog = computed(() => validWeightLogs.value[0] || null)
const trendInfo = computed(() => analyzeWeightTrend(props.weightLogs))
const targetCurve = computed(() => getTargetCurve(props.profile, props.planDays))
const checkinAnalysis = computed(() => analyzeRecentCheckins(props.checkins))
const weightAdvice = computed(() => generateAdvice(props.weightLogs, props.profile))
const checkinAdvice = computed(() => generateCheckinAdvice(props.checkins, trendInfo.value))
const recentAverageWeight = computed(() => {
  const recent = validWeightLogs.value.slice(0, 7)
  if (!recent.length) return null

  return Math.round(
    (recent.reduce((sum, log) => sum + Number(log.weight), 0) / recent.length) * 10,
  ) / 10
})
const targetWeight = computed(() => {
  const value = targetCurve.value?.targetWeight ?? props.profile?.targetWeight
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
})
const currentWeight = computed(() => {
  const number = Number(latestWeightLog.value?.weight)
  return Number.isFinite(number) && number > 0 ? number : null
})
const remainingWeight = computed(() => {
  if (currentWeight.value == null || targetWeight.value == null) return null
  return Math.max(0, Math.round((currentWeight.value - targetWeight.value) * 10) / 10)
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
const executionRateText = computed(() =>
  checkinAnalysis.value.adherenceRate == null
    ? '--'
    : `${Math.round(checkinAnalysis.value.adherenceRate * 100)}%`,
)
const todayCheckin = computed(() => {
  const today = todayYmd()
  return props.checkins.find((checkin) => checkin?.date === today) || null
})
const checkinStatusText = computed(() => {
  if (!todayCheckin.value) return '今日未打卡'
  const labels = { full: '完成', partial: '部分完成', missed: '未完成' }
  return labels[todayCheckin.value.mealCompleted] || '已打卡'
})
const totalWeightEntries = computed(() => validWeightLogs.value.length)
const totalCheckinEntries = computed(() => props.checkins.length)
const latestBodyMeasurements = computed(() => {
  const last = validWeightLogs.value[0]
  if (!last) return null
  const fields = ['waist', 'hip', 'chest', 'bodyFat', 'thigh', 'arm']
  const values = {}
  let hasAny = false
  for (const f of fields) {
    if (last[f] != null && Number(last[f]) > 0) { values[f] = Number(last[f]); hasAny = true }
  }
  return hasAny ? values : null
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
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}` : '--'
}

function scoreText(value) {
  return value == null ? '--' : `${value}/5`
}
</script>

<template>
  <section class="tab-page-shell progress-page">
    <div class="tab-page-heading">
      <div>
        <p>进度记录</p>
        <h1>进度</h1>
      </div>
    </div>

    <!-- Weight Summary Card -->
    <section class="progress-dashboard-card weight-hero-card">
      <div class="progress-card-head">
        <div>
          <p>体重</p>
          <h2 class="big-number">{{ currentWeight == null ? '--' : formatKg(currentWeight) }}<small> kg</small></h2>
        </div>
        <span class="trend-badge" :class="trendInfo.trend">{{ trendText }}</span>
      </div>

      <div class="stat-row">
        <div class="stat-cell">
          <span>目标</span>
          <strong>{{ formatKg(targetWeight) }}<small>kg</small></strong>
        </div>
        <div class="stat-cell">
          <span>7日均值</span>
          <strong>{{ formatKg(recentAverageWeight) }}<small>kg</small></strong>
        </div>
        <div class="stat-cell">
          <span>距目标</span>
          <strong>{{ remainingWeight != null ? formatKg(remainingWeight) : '--' }}<small>kg</small></strong>
        </div>
      </div>

      <p v-if="weightAdvice" class="progress-advice">{{ weightAdvice }}</p>
      <button
        type="button"
        class="ghost-action full-width"
        @click="emit('recordWeight')"
      >
        {{ currentWeight == null ? '添加第一条体重记录' : '记录体重' }}
      </button>
    </section>

    <!-- Execution Summary Card -->
    <section class="progress-dashboard-card execution-review-card">
      <div class="progress-card-head">
        <div>
          <p>执行复盘</p>
          <h2 class="big-number">{{ executionRateText }}<small> 近7天执行率</small></h2>
        </div>
        <span class="status-badge">{{ checkinStatusText }}</span>
      </div>

      <div class="stat-row stat-row-2col">
        <div class="stat-cell">
          <span>记录天数</span>
          <strong>{{ checkinAnalysis.count }}</strong>
        </div>
        <div class="stat-cell">
          <span>外食</span>
          <strong>{{ checkinAnalysis.ateOutCount }} 次</strong>
        </div>
        <div class="stat-cell">
          <span>运动</span>
          <strong>{{ checkinAnalysis.exerciseCount }} 次</strong>
        </div>
        <div class="stat-cell">
          <span>平均饥饿</span>
          <strong>{{ scoreText(checkinAnalysis.avgHunger) }}</strong>
        </div>
        <div class="stat-cell">
          <span>平均执行</span>
          <strong>{{ scoreText(checkinAnalysis.avgAdherence) }}</strong>
        </div>
        <div class="stat-cell">
          <span>平均睡眠</span>
          <strong>{{ scoreText(checkinAnalysis.avgSleep) }}</strong>
        </div>
      </div>

      <p v-if="checkinAdvice" class="progress-advice">{{ checkinAdvice }}</p>
      <button type="button" class="ghost-action full-width" @click="emit('checkinToday')">
        查看打卡记录
      </button>
    </section>

    <!-- Body Measurements Card -->
    <section v-if="latestBodyMeasurements" class="progress-dashboard-card body-measure-card">
      <div class="progress-card-head">
        <div>
          <p>身体围度</p>
          <h2 class="big-number">最近记录</h2>
        </div>
      </div>
      <div class="stat-row stat-row-2col">
        <div v-if="latestBodyMeasurements.waist" class="stat-cell"><span>腰围</span><strong>{{ latestBodyMeasurements.waist }}<small>cm</small></strong></div>
        <div v-if="latestBodyMeasurements.hip" class="stat-cell"><span>臀围</span><strong>{{ latestBodyMeasurements.hip }}<small>cm</small></strong></div>
        <div v-if="latestBodyMeasurements.chest" class="stat-cell"><span>胸围</span><strong>{{ latestBodyMeasurements.chest }}<small>cm</small></strong></div>
        <div v-if="latestBodyMeasurements.bodyFat" class="stat-cell"><span>体脂率</span><strong>{{ latestBodyMeasurements.bodyFat }}<small>%</small></strong></div>
        <div v-if="latestBodyMeasurements.thigh" class="stat-cell"><span>大腿围</span><strong>{{ latestBodyMeasurements.thigh }}<small>cm</small></strong></div>
        <div v-if="latestBodyMeasurements.arm" class="stat-cell"><span>上臂围</span><strong>{{ latestBodyMeasurements.arm }}<small>cm</small></strong></div>
      </div>
      <button type="button" class="ghost-action full-width" @click="emit('recordWeight')">记录身体数据</button>
    </section>

    <!-- Quick Stats -->
    <section class="progress-dashboard-card">
      <div class="progress-card-head">
        <div>
          <p>记录统计</p>
          <h2>数据概览</h2>
        </div>
      </div>
      <div class="stat-row stat-row-2col">
        <div class="stat-cell">
          <span>体重记录</span>
          <strong>{{ totalWeightEntries }} 条</strong>
        </div>
        <div class="stat-cell">
          <span>打卡记录</span>
          <strong>{{ totalCheckinEntries }} 条</strong>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.progress-page {
  padding-bottom: 0.5rem;
}

.progress-dashboard-card {
  display: grid;
  gap: var(--spacing-md);
  min-width: 0;
  padding: var(--spacing-lg);
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.progress-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
}

.progress-card-head > div {
  min-width: 0;
}

.progress-card-head p {
  margin: 0 0 0.35rem;
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.progress-card-head h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.big-number {
  font-size: 2rem !important;
  font-weight: 800 !important;
  letter-spacing: -0.02em;
  line-height: 1.1 !important;
}

.big-number small {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-muted);
}

.trend-badge,
.status-badge {
  flex: 0 1 auto;
  min-height: 1.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-pill);
  font-size: 0.72rem;
  font-weight: 600;
  text-align: center;
}

.trend-badge {
  color: var(--color-primary-deep);
  background: var(--color-primary-soft);
}

.trend-badge.down { color: var(--color-primary-deep); background: var(--color-primary-soft); }
.trend-badge.stable { color: var(--color-warning); background: var(--orange-soft); }
.trend-badge.up { color: var(--color-danger); background: rgba(255, 59, 48, 0.08); }
.trend-badge.insufficient { color: var(--color-muted); background: rgba(142, 142, 147, 0.08); }

.status-badge {
  color: var(--color-primary-deep);
  background: var(--color-primary-soft);
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.stat-row-2col {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-cell {
  min-width: 0;
  padding: 0.6rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  text-align: center;
}

.stat-cell span,
.stat-cell strong {
  display: block;
}

.stat-cell span {
  color: var(--color-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.stat-cell strong {
  margin-top: 0.12rem;
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-cell strong small {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-muted);
}

.progress-advice {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.55;
}

.full-width {
  width: 100%;
}

@media (max-width: 24rem) {
  .stat-row {
    grid-template-columns: 1fr;
  }

  .stat-row-2col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
