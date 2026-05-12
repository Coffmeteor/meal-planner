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

    <div class="progress-dashboard-actions">
      <button type="button" class="primary-action" @click="emit('recordWeight')">
        添加体重
      </button>
      <button type="button" class="ghost-action" @click="emit('recordWeight')">
        查看体重记录
      </button>
      <button type="button" class="ghost-action" @click="emit('checkinToday')">
        今日打卡
      </button>
    </div>

    <section class="progress-dashboard-card weight-trend-card">
      <div class="progress-card-head">
        <div>
          <p>体重趋势</p>
          <h2>{{ currentWeight == null ? '添加第一条体重记录' : formatKg(currentWeight) }}</h2>
        </div>
        <span>{{ trendText }}</span>
      </div>

      <div class="progress-stat-grid">
        <div>
          <span>目标体重</span>
          <strong>{{ formatKg(targetWeight) }}</strong>
        </div>
        <div>
          <span>7 日均重</span>
          <strong>{{ formatKg(recentAverageWeight) }}</strong>
        </div>
        <div>
          <span>距离目标</span>
          <strong>{{ formatKg(remainingWeight) }}</strong>
        </div>
      </div>

      <p class="progress-advice">{{ weightAdvice }}</p>
      <button
        v-if="currentWeight == null"
        type="button"
        class="primary-action full-width"
        @click="emit('recordWeight')"
      >
        添加第一条体重记录
      </button>
    </section>

    <section class="progress-dashboard-card execution-review-card">
      <div class="progress-card-head">
        <div>
          <p>执行复盘</p>
          <h2>近 7 天执行率 {{ executionRateText }}</h2>
        </div>
        <span>{{ checkinStatusText }}</span>
      </div>

      <div class="progress-stat-grid">
        <div>
          <span>记录天数</span>
          <strong>{{ checkinAnalysis.count }} 天</strong>
        </div>
        <div>
          <span>外食</span>
          <strong>{{ checkinAnalysis.ateOutCount }} 次</strong>
        </div>
        <div>
          <span>运动</span>
          <strong>{{ checkinAnalysis.exerciseCount }} 次</strong>
        </div>
        <div>
          <span>平均饥饿</span>
          <strong>{{ scoreText(checkinAnalysis.avgHunger) }}</strong>
        </div>
        <div>
          <span>平均执行</span>
          <strong>{{ scoreText(checkinAnalysis.avgAdherence) }}</strong>
        </div>
        <div>
          <span>平均睡眠</span>
          <strong>{{ scoreText(checkinAnalysis.avgSleep) }}</strong>
        </div>
      </div>

      <p class="progress-advice">{{ checkinAdvice }}</p>
      <button type="button" class="ghost-action full-width" @click="emit('checkinToday')">
        查看打卡记录
      </button>
    </section>
  </section>
</template>
