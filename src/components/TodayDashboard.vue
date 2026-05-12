<script setup>
import { computed } from 'vue'
import { pushPage } from '../stores/navigationStore.js'
import { formatTime } from '../utils/helpers.js'
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

const emit = defineEmits(['editMeal', 'optimizeDay', 'replaceMeal'])

const today = computed(() => formatDateYmd(new Date()))
const todayIndex = computed(() => resolveTodayIndex())
const todayPlan = computed(() => props.plan[todayIndex.value] || null)
const dayNumber = computed(() => todayIndex.value + 1)
const targetCalories = computed(() =>
  Number(todayPlan.value?.targets?.calories)
  || Number(props.planMeta?.targetCalories)
  || Number(props.profile?.targetCalories)
  || 0,
)
const currentCalories = computed(() =>
  Math.round(Number(todayPlan.value?.totals?.calories || 0)),
)
const calorieDeviation = computed(() =>
  Math.round(currentCalories.value - Number(targetCalories.value || 0)),
)
const meals = computed(() =>
  (todayPlan.value?.meals || []).map((meal) => normalizeMealDisplay(meal)),
)
const hasWeightToday = computed(() => props.weightLogs.some((log) => log.date === today.value))
const hasCheckinToday = computed(() => props.checkins.some((log) => log.date === today.value))
const recentExecution = computed(() => {
  const logs = [...props.checkins]
    .filter((log) => log.mealCompleted != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
  if (logs.length < 3) return null

  const score = { full: 1, partial: 0.5, missed: 0 }
  return logs.reduce((sum, log) => sum + (score[log.mealCompleted] ?? 0), 0) / logs.length
})
const isLowExecution = computed(() =>
  recentExecution.value !== null && recentExecution.value < 0.6,
)
const todos = computed(() => {
  const items = []
  if (!todayPlan.value) {
    items.push({
      key: 'no-plan',
      label: '生成/刷新今日餐单',
      action: () => pushPage('planDay', { dayIndex: todayIndex.value }),
    })
  }
  if (!hasWeightToday.value) {
    items.push({
      key: 'weight',
      label: '记录今日体重',
      action: () => pushPage('weightEntry'),
    })
  }
  if (!hasCheckinToday.value) {
    items.push({
      key: 'checkin',
      label: '完成今日打卡',
      action: () => pushPage('checkinForm'),
    })
  }
  if (todayPlan.value && Math.abs(calorieDeviation.value) > 100) {
    items.push({
      key: 'deviation',
      label: '优化今日餐单',
      action: () => openMealEditor(0),
    })
  }
  return items
})

function formatDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parsePlanDate(dateValue) {
  if (typeof dateValue === 'string') {
    const [year, month, day] = dateValue.split('-').map(Number)
    if (year && month && day) return new Date(year, month - 1, day)
  }
  return new Date(dateValue)
}

function resolveTodayIndex() {
  if (!props.plan.length) return 0

  const exactIndex = props.plan.findIndex((day) => day.date === today.value)
  if (exactIndex >= 0) return exactIndex

  const startDate = props.planMeta?.startDate || props.plan[0]?.date
  if (!startDate) return 0

  const start = parsePlanDate(startDate)
  if (Number.isNaN(start.getTime())) return 0

  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return Math.min(props.plan.length - 1, Math.max(0, diffDays))
}

function mealCalories(meal) {
  return Math.round(Number(meal?.calories || 0))
}

function mealSummary(meal) {
  const foods = mealFoods(meal)
  if (!foods.length) return meal.portion || '暂无食材明细'
  return foods.slice(0, 3).map((food) => food.name).join('、')
}

function openTodayPlan() {
  openMealEditor(0)
}

function openMealEditor(mealIndex) {
  const mealData = todayPlan.value?.meals?.[mealIndex]
  if (!mealData) {
    pushPage('planDay', { dayIndex: todayIndex.value })
    return
  }
  pushPage('mealEditor', {
    dayIndex: todayIndex.value,
    mealIndex,
    mealData,
  })
}

function replaceFirstMeal() {
  if (!todayPlan.value?.meals?.length) {
    openTodayPlan()
    return
  }
  emit('replaceMeal', { dayIndex: todayIndex.value, mealIndex: 0 })
}
</script>

<template>
  <section class="today-dashboard">
    <article class="app-card today-header-card">
      <span class="card-kicker">今日</span>
      <h1>今天是计划第 {{ dayNumber }} 天</h1>
      <p>{{ todayPlan?.date || today }}</p>
    </article>

    <article class="app-card calorie-card">
      <div>
        <span>目标热量</span>
        <strong>{{ Math.round(targetCalories || 0) }} kcal</strong>
      </div>
      <div>
        <span>当前餐单</span>
        <strong>{{ currentCalories }} kcal</strong>
      </div>
      <div>
        <span>偏差</span>
        <strong :class="{ positive: calorieDeviation > 0, balanced: Math.abs(calorieDeviation) <= 50 }">
          {{ calorieDeviation > 0 ? '+' : '' }}{{ calorieDeviation }} kcal
        </strong>
      </div>
    </article>

    <article class="app-card">
      <div class="card-title-row">
        <div>
          <span class="card-kicker">餐次</span>
          <h2>今日餐单</h2>
        </div>
        <button type="button" class="text-action" @click="openTodayPlan">编辑</button>
      </div>
      <div v-if="meals.length" class="today-meal-list">
        <button
          v-for="(meal, index) in meals"
          :key="`${meal.time}-${meal.name}-${index}`"
          type="button"
          class="today-meal-row"
          @click="openMealEditor(index)"
        >
          <span>{{ formatTime(meal.time) || '--:--' }}</span>
          <strong>{{ meal.label || meal.name }}</strong>
          <small>{{ mealSummary(meal) }}</small>
          <em>{{ mealCalories(meal) }} kcal</em>
        </button>
      </div>
      <p v-else class="empty-state">今天还没有餐单。</p>
    </article>

    <article class="app-card">
      <div class="card-title-row">
        <div>
          <span class="card-kicker">待办</span>
          <h2>今天要做</h2>
        </div>
      </div>
      <div v-if="todos.length" class="todo-list">
        <button
          v-for="todo in todos"
          :key="todo.key"
          type="button"
          class="todo-row"
          @click="todo.action"
        >
          {{ todo.label }}
        </button>
      </div>
      <p v-else class="empty-state">今日记录已完整。</p>
      <p v-if="isLowExecution" class="todo-reminder">
        最近 7 天执行率偏低，今天先完成最容易坚持的一餐。
      </p>
    </article>

    <article class="app-card">
      <div class="card-title-row">
        <div>
          <span class="card-kicker">快捷操作</span>
          <h2>快速处理</h2>
        </div>
      </div>
      <div class="quick-action-grid">
        <button type="button" class="ghost-action" @click="openTodayPlan">编辑今天餐单</button>
        <button type="button" class="ghost-action" @click="emit('optimizeDay', todayIndex)">一键优化热量</button>
        <button type="button" class="ghost-action" @click="replaceFirstMeal">换一餐</button>
        <button type="button" class="primary-action" @click="pushPage('checkinForm')">今日打卡</button>
      </div>
    </article>
  </section>
</template>
