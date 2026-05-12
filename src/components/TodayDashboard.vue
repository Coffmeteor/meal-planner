<script setup>
import { computed } from 'vue'
import { formatCalories, formatTime } from '../utils/helpers.js'
import { mealFoods, normalizeMealDisplay } from '../utils/mealDisplay.js'

const props = defineProps({
  plan: { type: Array, default: () => [] },
  planMeta: { type: Object, default: null },
  profile: { type: Object, default: null },
  weightLogs: { type: Array, default: () => [] },
  checkins: { type: Array, default: () => [] },
})

const emit = defineEmits([
  'edit-meal', 'edit-day-food', 'optimize-day',
  'view-full-plan', 'record-weight', 'checkin-today',
  'lock-meal', 'unlock-meal',
])

const today = computed(() => {
  const date = new Date()
  return {
    ymd: formatDateYmd(date),
    label: date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }),
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
const calorieDeviation = computed(() => targetCalories.value ? deviation.value : null)
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
const overallStatus = computed(() => {
  const parts = []
  if (!hasTodayCheckin.value) parts.push('待打卡')
  if (!hasTodayWeight.value) parts.push('待记录')
  if (parts.length) return parts.join(' · ')
  if (calorieStatusLabel.value === '接近目标') return '今日状态良好'
  return calorieStatusLabel.value
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
const macroBars = computed(() => {
  const total = Math.max(1, currentProtein.value + currentCarbs.value + currentFat.value)
  return {
    protein: Math.round((currentProtein.value / total) * 100),
    carbs: Math.round((currentCarbs.value / total) * 100),
    fat: Math.round((currentFat.value / total) * 100),
  }
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
    <!-- Header -->
    <header class="today-header">
      <p class="today-date">{{ today.label }}</p>
      <h1 class="today-title">计划第 {{ planDay }} 天</h1>
      <p class="today-subtitle" :style="{ color: calorieStatusColor }">{{ overallStatus }}</p>
    </header>

    <!-- Calorie Card -->
    <article class="today-card calorie-card">
      <div class="calorie-ring-wrap">
        <svg class="calorie-ring" viewBox="0 0 100 100">
          <circle class="ring-track" cx="50" cy="50" r="44" />
          <circle class="ring-fill" cx="50" cy="50" r="44"
            :stroke="calorieStatusColor"
            :stroke-dasharray="`${caloriePercent * 2.76} 276`"
          />
        </svg>
        <div class="ring-center">
          <strong class="ring-value">{{ currentCalories || '--' }}</strong>
          <span class="ring-unit">kcal</span>
        </div>
      </div>
      <div class="calorie-info">
        <div class="calorie-top">
          <span class="calorie-status" :style="{ color: calorieStatusColor }">{{ calorieStatusLabel }}</span>
          <span v-if="calorieDeviation != null" class="calorie-dev" :style="{ color: Math.abs(calorieDeviation) > 100 ? '#ff3b30' : 'var(--color-text)' }">
            {{ calorieDeviation > 0 ? '+' : '' }}{{ calorieDeviation }} kcal
          </span>
        </div>
        <span class="calorie-target">目标 {{ targetCalories ? Math.round(targetCalories) : '--' }} kcal</span>
        <!-- Macro bars -->
        <div class="macro-bar-row">
          <div class="macro-bar-item">
            <span class="macro-bar-label"><span class="macro-mini-dot protein" />蛋白</span>
            <div class="macro-bar-track"><div class="macro-bar-fill protein" :style="{ width: macroBars.protein + '%' }" /></div>
            <span class="macro-bar-val">{{ Math.round(currentProtein) }}g</span>
          </div>
          <div class="macro-bar-item">
            <span class="macro-bar-label"><span class="macro-mini-dot carbs" />碳水</span>
            <div class="macro-bar-track"><div class="macro-bar-fill carbs" :style="{ width: macroBars.carbs + '%' }" /></div>
            <span class="macro-bar-val">{{ Math.round(currentCarbs) }}g</span>
          </div>
          <div class="macro-bar-item">
            <span class="macro-bar-label"><span class="macro-mini-dot fat" />脂肪</span>
            <div class="macro-bar-track"><div class="macro-bar-fill fat" :style="{ width: macroBars.fat + '%' }" /></div>
            <span class="macro-bar-val">{{ Math.round(currentFat) }}g</span>
          </div>
        </div>
      </div>
    </article>

    <!-- Meals Card -->
    <article class="today-card">
      <div class="card-header">
        <h2 class="card-title">今日餐单</h2>
        <button class="card-action-link" @click="emit('view-full-plan')">完整餐单 ›</button>
      </div>
      <div v-if="displayedMeals.length" class="meal-list">
        <div v-for="(meal, mealIndex) in displayedMeals" :key="`${meal.time}-${mealIndex}`"
          class="meal-row" role="button" tabindex="0"
          @click="openMealEditor(mealIndex)" @keydown.enter.prevent="openMealEditor(mealIndex)">
          <div class="meal-left">
            <span class="meal-time-badge">{{ mealWindow(meal, mealIndex) }}</span>
            <strong class="meal-name">{{ meal.label || meal.name }}</strong>
            <small class="meal-ingredients">
              {{ formatCalories(meal.calories) }}
              <template v-if="mealFoods(meal).length"> · {{ mealFoods(meal).slice(0, 2).map((f) => f.name).join('、') }}</template>
            </small>
          </div>
          <span class="meal-arrow">›</span>
          <div class="meal-actions">
            <button class="meal-action-btn" :class="{ active: meal.locked }" @click.stop="meal.locked ? emit('unlock-meal', { dayIndex: todayIndex, mealIndex }) : emit('lock-meal', { dayIndex: todayIndex, mealIndex })" :title="meal.locked ? '解锁' : '锁定'">
              {{ meal.locked ? '🔓' : '🔒' }}
            </button>
            <button class="meal-action-btn edit" @click.stop="openMealEditor(mealIndex)" title="编辑">✎</button>
          </div>
        </div>
      </div>
      <p v-else class="empty-msg">今天还没有餐单</p>
      <div class="card-footer">
        <button class="footer-btn" @click="emit('edit-day-food', todayIndex)">编辑菜单</button>
        <button class="footer-btn accent" @click="emit('optimize-day', todayIndex)">优化热量</button>
      </div>
    </article>

    <!-- Status Card -->
    <article class="today-card">
      <h2 class="card-title" style="padding-bottom:0.4rem">今日状态</h2>
      <div class="status-rows">
        <div class="status-row" @click="emit('record-weight')">
          <div class="status-icon-wrap" :class="{ done: hasTodayWeight }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
          </div>
          <div class="status-text">
            <strong>体重记录</strong>
            <span>{{ hasTodayWeight ? '已完成' : (latestWeight != null ? `最近 ${Math.round(latestWeight * 10) / 10} kg` : '待记录') }}</span>
          </div>
          <span class="status-arrow">›</span>
        </div>
        <div class="status-row" @click="emit('checkin-today')">
          <div class="status-icon-wrap" :class="{ done: hasTodayCheckin }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="status-text">
            <strong>每日打卡</strong>
            <span>{{ hasTodayCheckin ? '已完成' : '待完成' }}</span>
          </div>
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
  gap: 0.65rem;
  padding-bottom: 0.5rem;
}

/* Header */
.today-header {
  padding: 0.15rem 0;
}
.today-date {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.82rem;
  font-weight: 500;
}
.today-title {
  margin: 0.15rem 0 0;
  color: var(--color-text);
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.15;
}
.today-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  font-weight: 500;
}

/* Cards */
.today-card {
  border-radius: 14px;
  background: var(--color-card);
  padding: 0.85rem 1rem;
  box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.04);
}
.card-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 0.35rem;
}
.card-title {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.card-action-link {
  border: none;
  background: none;
  color: var(--color-primary, #34c759);
  font-size: 0.74rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

/* Calorie card */
.calorie-card {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.calorie-ring-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 5rem;
  height: 5rem;
}
.calorie-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-track {
  fill: none;
  stroke: rgba(60, 60, 67, 0.10);
  stroke-width: 6;
}
.ring-fill {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s ease, stroke 0.3s ease;
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
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
}
.ring-unit {
  color: var(--color-muted);
  font-size: 0.62rem;
  font-weight: 500;
  margin-top: 0.12rem;
}
.calorie-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.calorie-top {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.calorie-status {
  font-size: 0.9rem;
  font-weight: 600;
}
.calorie-dev {
  font-size: 0.8rem;
  font-weight: 600;
}
.calorie-target {
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 500;
}

/* Macro bars */
.macro-bar-row {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  margin-top: 0.35rem;
}
.macro-bar-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.macro-bar-label {
  flex: 0 0 2.4rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
}
.macro-mini-dot {
  display: inline-block;
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  flex-shrink: 0;
}
.macro-mini-dot.protein { background: #34c759; }
.macro-mini-dot.carbs { background: #ff9500; }
.macro-mini-dot.fat { background: #ffd60a; }
.macro-bar-track {
  flex: 1 1 auto;
  height: 0.3rem;
  border-radius: 0.15rem;
  background: rgba(60, 60, 67, 0.08);
  overflow: hidden;
}
.macro-bar-fill {
  height: 100%;
  border-radius: 0.15rem;
  transition: width 0.4s ease;
}
.macro-bar-fill.protein { background: #34c759; }
.macro-bar-fill.carbs { background: #ff9500; }
.macro-bar-fill.fat { background: #ffd60a; }
.macro-bar-val {
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 500;
  min-width: 2rem;
  text-align: right;
}

/* Meal list */
.meal-list {
  display: flex;
  flex-direction: column;
}
.meal-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.8rem;
  padding: 0.45rem 0.25rem;
  cursor: pointer;
  transition: background 0.12s ease;
  border-radius: 8px;
}
.meal-row:hover {
  background: rgba(60, 60, 67, 0.04);
}
.meal-row + .meal-row {
  border-top: 0.5px solid var(--color-separator);
}
.meal-left {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}
.meal-time-badge {
  color: var(--color-muted);
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1;
}
.meal-name {
  color: var(--color-text);
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.2;
}
.meal-ingredients {
  color: var(--color-muted);
  font-size: 0.74rem;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meal-arrow {
  flex: 0 0 auto;
  color: #c7c7cc;
  font-size: 1.15rem;
  font-weight: 300;
  line-height: 1;
}
.meal-actions {
  display: flex;
  gap: 0.2rem;
  flex: 0 0 auto;
}
.meal-action-btn {
  width: 1.65rem;
  height: 1.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 0.75rem;
  cursor: pointer;
  color: #8e8e93;
  transition: all 0.12s ease;
}
.meal-action-btn:active {
  background: rgba(60, 60, 67, 0.08);
}
.meal-action-btn.active {
  color: #ff9500;
  background: rgba(255, 149, 0, 0.08);
}
.meal-action-btn.edit:active {
  color: var(--color-primary);
}

/* Card footer */
.card-footer {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.4rem;
  border-top: 0.5px solid var(--color-separator);
}
.footer-btn {
  flex: 1 1 50%;
  min-height: 2.2rem;
  border: none;
  border-radius: 8px;
  background: rgba(60, 60, 67, 0.06);
  color: var(--color-text);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease;
}
.footer-btn:active {
  background: rgba(60, 60, 67, 0.12);
}
.footer-btn.accent {
  background: rgba(52, 199, 89, 0.10);
  color: #34c759;
  font-weight: 600;
}
.footer-btn.accent:active {
  background: rgba(52, 199, 89, 0.18);
}

.empty-msg {
  margin: 0;
  padding: 1rem 0;
  color: var(--color-muted);
  font-size: 0.85rem;
  text-align: center;
}

/* Status */
.status-rows {
  display: flex;
  flex-direction: column;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.65rem;
  padding: 0.4rem 0.25rem;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.12s ease;
}
.status-row:hover {
  background: rgba(60, 60, 67, 0.04);
}
.status-row + .status-row {
  border-top: 0.5px solid var(--color-separator);
}
.status-icon-wrap {
  flex: 0 0 auto;
  width: 1.65rem;
  height: 1.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(60, 60, 67, 0.08);
  color: #8e8e93;
  transition: all 0.2s ease;
}
.status-icon-wrap.done {
  background: rgba(52, 199, 89, 0.12);
  color: #34c759;
}
.status-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.04rem;
}
.status-text strong {
  color: var(--color-text);
  font-size: 0.88rem;
  font-weight: 600;
}
.status-text span {
  color: var(--color-muted);
  font-size: 0.76rem;
  font-weight: 400;
}
.status-arrow {
  flex: 0 0 auto;
  color: #c7c7cc;
  font-size: 1.15rem;
  font-weight: 300;
}
</style>
