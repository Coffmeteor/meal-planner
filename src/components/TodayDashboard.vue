<script setup>
import { computed } from 'vue'
import { formatCalories, formatTime } from '../utils/helpers.js'
import { mealFoods, normalizeMealDisplay } from '../utils/mealDisplay.js'

const props = defineProps({
  plan: {
    type: Array,
    default: () => [],
  },
  planMeta: {
    type: Object,
    default: null,
  },
  profile: {
    type: Object,
    default: null,
  },
  weightLogs: {
    type: Array,
    default: () => [],
  },
  checkins: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'edit-meal',
  'edit-day-food',
  'optimize-day',
  'view-full-plan',
  'record-weight',
  'checkin-today',
])

const today = computed(() => {
  const date = new Date()
  return {
    ymd: formatDateYmd(date),
    label: date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }),
  }
})

const planDay = computed(() => todayIndex.value + 1)
const todayIndex = computed(() => {
  const byDate = props.plan.findIndex((day) => day?.date === today.value.ymd)
  if (byDate >= 0) return byDate
  const startDate = props.planMeta?.startDate || props.plan[0]?.date
  if (!startDate) return 0
  const start = parseYmd(startDate)
  const now = parseYmd(today.value.ymd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) return 0
  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return Math.min(Math.max(diff, 0), Math.max(props.plan.length - 1, 0))
})
const todayPlan = computed(() => props.plan[todayIndex.value] || null)
const displayedMeals = computed(() =>
  (todayPlan.value?.meals || []).map((meal) => normalizeMealDisplay(meal)),
)
const targetCalories = computed(() =>
  Number(todayPlan.value?.targets?.calories) || Number(props.planMeta?.targetCalories) || Number(props.profile?.targetCalories) || 0,
)
const currentCalories = computed(() => Number(todayPlan.value?.totals?.calories || 0))
const currentProtein = computed(() => Number(todayPlan.value?.totals?.protein || 0))
const currentCarbs = computed(() => Number(todayPlan.value?.totals?.carbs || 0))
const currentFat = computed(() => Number(todayPlan.value?.totals?.fat || 0))
const deviation = computed(() => Math.round(currentCalories.value - targetCalories.value))
const calorieDeviation = computed(() => {
  if (!targetCalories.value) return null
  return deviation.value
})
const calorieStatusColor = computed(() => {
  if (!targetCalories.value) return '#8e8e93'
  const abs = Math.abs(deviation.value)
  if (abs <= 50) return '#34c759'
  if (abs <= 150) return '#ff9500'
  return '#ff3b30'
})
const calorieStatusLabel = computed(() => {
  if (!targetCalories.value) return '未设定目标'
  const abs = Math.abs(deviation.value)
  if (abs <= 50) return '接近目标'
  if (abs <= 150) return '略有偏差'
  return '偏离较多'
})
const hasTodayWeight = computed(() => props.weightLogs.some((log) => log?.date === today.value.ymd))
const hasTodayCheckin = computed(() => props.checkins.some((checkin) => checkin?.date === today.value.ymd))
const latestWeight = computed(() => {
  const sorted = [...props.weightLogs]
    .filter((log) => log.weight != null && Number(log.weight) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  return sorted[0]?.weight ?? null
})
const caloriePercent = computed(() => {
  if (!targetCalories.value || targetCalories.value <= 0) return 0
  return Math.min(Math.round((currentCalories.value / targetCalories.value) * 100), 150)
})

function parseYmd(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}

function formatDateYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function mealWindow(meal, index) {
  const start = formatTime(meal?.time)
  const next = displayedMeals.value[index + 1]?.time
  if (!next) return `${start} 后`
  return `${start} - ${formatTime(next)}`
}

function openMealEditor(mealIndex) {
  emit('edit-meal', { dayIndex: todayIndex.value, mealIndex })
}
</script>

<template>
  <section class="today-dashboard">
    <header class="today-header">
      <div class="today-header-text">
        <p class="today-date">{{ today.label }}</p>
        <h1 class="today-title">计划第 {{ planDay }} 天</h1>
      </div>
    </header>

    <!-- Calorie Ring Card -->
    <article class="today-ring-card">
      <div class="ring-container">
        <svg class="calorie-ring" viewBox="0 0 100 100">
          <circle class="ring-track" cx="50" cy="50" r="42" />
          <circle
            class="ring-fill"
            cx="50" cy="50" r="42"
            :stroke="calorieStatusColor"
            :stroke-dasharray="`${caloriePercent * 2.64} 264`"
          />
        </svg>
        <div class="ring-center">
          <strong class="ring-value">{{ currentCalories || '--' }}</strong>
          <span class="ring-unit">kcal</span>
        </div>
      </div>
      <div class="ring-info">
        <div class="ring-label-row">
          <span class="ring-status" :style="{ color: calorieStatusColor }">{{ calorieStatusLabel }}</span>
          <span v-if="calorieDeviation != null" class="ring-deviation" :class="{ over: Math.abs(calorieDeviation) > 100 }">
            {{ calorieDeviation > 0 ? '+' : '' }}{{ calorieDeviation }}
          </span>
        </div>
        <span class="ring-target">目标 {{ targetCalories ? Math.round(targetCalories) : '--' }} kcal</span>
        <div class="ring-macros">
          <span class="macro-dot protein" />蛋白 {{ Math.round(currentProtein) }}g
          <span class="macro-dot carbs" />碳水 {{ Math.round(currentCarbs) }}g
          <span class="macro-dot fat" />脂肪 {{ Math.round(currentFat) }}g
        </div>
      </div>
    </article>

    <!-- Meals Card -->
    <article class="today-section-card">
      <h2 class="section-heading">今日餐单</h2>
      <div v-if="displayedMeals.length" class="today-meal-list">
        <div
          v-for="(meal, mealIndex) in displayedMeals"
          :key="`${meal.time}-${mealIndex}`"
          class="today-meal-row"
          role="button"
          tabindex="0"
          @click="openMealEditor(mealIndex)"
          @keydown.enter.prevent="openMealEditor(mealIndex)"
        >
          <div class="meal-row-left">
            <span class="meal-time">{{ mealWindow(meal, mealIndex) }}</span>
            <strong class="meal-name">{{ meal.label || meal.name }}</strong>
            <small class="meal-meta">
              {{ formatCalories(meal.calories) }}
              <template v-if="mealFoods(meal).length">
                · {{ mealFoods(meal).slice(0, 2).map((f) => f.name).join('、') }}
              </template>
            </small>
          </div>
          <span class="meal-arrow">›</span>
        </div>
      </div>
      <p v-else class="today-empty">今天还没有餐单</p>
    </article>

    <!-- Status / Actions Card -->
    <article class="today-section-card">
      <h2 class="section-heading">今日状态</h2>
      <div class="today-status-list">
        <div class="status-row" @click="emit('record-weight')">
          <div class="status-dot" :class="{ done: hasTodayWeight }" />
          <div class="status-content">
            <strong>体重记录</strong>
            <span>{{ hasTodayWeight ? '已完成' : (latestWeight != null ? `最近 ${Math.round(latestWeight * 10) / 10} kg` : '待记录') }}</span>
          </div>
          <span class="status-arrow">›</span>
        </div>
        <div class="status-row" @click="emit('checkin-today')">
          <div class="status-dot" :class="{ done: hasTodayCheckin }" />
          <div class="status-content">
            <strong>每日打卡</strong>
            <span>{{ hasTodayCheckin ? '已完成' : '待完成' }}</span>
          </div>
          <span class="status-arrow">›</span>
        </div>
      </div>
    </article>

    <!-- Quick Actions -->
    <article class="today-section-card">
      <h2 class="section-heading">操作</h2>
      <div class="today-action-list">
        <div class="action-row" @click="emit('edit-day-food', todayIndex)">
          <strong>编辑今日菜单</strong>
          <span class="status-arrow">›</span>
        </div>
        <div class="action-row" @click="emit('optimize-day', todayIndex)">
          <strong>优化热量</strong>
          <span class="status-arrow">›</span>
        </div>
        <div class="action-row" @click="emit('view-full-plan')">
          <strong>查看完整餐单</strong>
          <span class="status-arrow">›</span>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.today-dashboard {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.today-header {
  display: grid;
  gap: 0.1rem;
  padding: 0.15rem 0 0;
}

.today-date {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.today-title {
  margin: 0;
  color: var(--color-text);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

/* Ring Card */
.today-ring-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.ring-container {
  position: relative;
  flex: 0 0 auto;
  width: 4.25rem;
  height: 4.25rem;
}

.calorie-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: rgba(60, 60, 67, 0.08);
  stroke-width: 7;
}

.ring-fill {
  fill: none;
  stroke-width: 7;
  stroke-linecap: round;
  transition: stroke-dasharray 0.6s ease, stroke 0.3s ease;
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-value {
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
}

.ring-unit {
  color: var(--color-muted);
  font-size: 0.6rem;
  font-weight: 500;
  margin-top: 0.1rem;
}

.ring-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ring-label-row {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.ring-status {
  font-size: 0.88rem;
  font-weight: 600;
}

.ring-deviation {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
}

.ring-deviation.over {
  color: #ff3b30;
}

.ring-target {
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 500;
}

.ring-macros {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.6;
}

.macro-dot {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  margin-right: 0.1rem;
  vertical-align: middle;
}

.macro-dot.protein { background: #34c759; }
.macro-dot.carbs { background: #ff9500; }
.macro-dot.fat { background: #ffd60a; }

/* Section Cards */
.today-section-card {
  padding: 0.65rem 0;
  border-radius: var(--radius-card);
  background: var(--color-card);
}

.section-heading {
  margin: 0;
  padding: 0 0.85rem 0.45rem;
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Meal List */
.today-meal-list {
  display: flex;
  flex-direction: column;
}

.today-meal-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.4rem;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.today-meal-row:active {
  background: rgba(60, 60, 67, 0.06);
}

.meal-row-left {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.meal-time {
  color: var(--color-muted);
  font-size: 0.68rem;
  font-weight: 500;
}

.meal-name {
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.25;
}

.meal-meta {
  color: var(--color-muted);
  font-size: 0.72rem;
  font-weight: 400;
}

.meal-arrow {
  flex: 0 0 auto;
  color: #c7c7cc;
  font-size: 1.2rem;
  font-weight: 300;
  line-height: 1;
}

.today-empty {
  margin: 0;
  padding: 0.85rem;
  color: var(--color-muted);
  font-size: 0.85rem;
  text-align: center;
}

/* Status List */
.today-status-list {
  display: flex;
  flex-direction: column;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.25rem;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.status-row:active {
  background: rgba(60, 60, 67, 0.06);
}

.status-dot {
  flex: 0 0 auto;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #c7c7cc;
  transition: background 0.2s ease;
}

.status-dot.done {
  background: #34c759;
}

.status-content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.status-content strong {
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 600;
}

.status-content span {
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 400;
}

.status-arrow {
  flex: 0 0 auto;
  color: #c7c7cc;
  font-size: 1.2rem;
  font-weight: 300;
  line-height: 1;
}

/* Action List */
.today-action-list {
  display: flex;
  flex-direction: column;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.25rem;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.action-row:active {
  background: rgba(60, 60, 67, 0.06);
}

.action-row strong {
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: 500;
}

.action-row + .action-row {
  border-top: 0.5px solid var(--color-separator);
}

.status-row + .status-row {
  border-top: 0.5px solid var(--color-separator);
}

.today-meal-row + .today-meal-row {
  border-top: 0.5px solid var(--color-separator);
}

/* Macros row for ring info */
.ring-macros .macro-dot {
  vertical-align: middle;
  margin-right: 0.15rem;
}
</style>
