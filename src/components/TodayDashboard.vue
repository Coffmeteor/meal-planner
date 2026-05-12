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
      weekday: 'long',
    }),
  }
})

const planDay = computed(() => {
  return todayIndex.value + 1
})
const todayIndex = computed(() => {
  const byDate = props.plan.findIndex((day) => day?.date === today.value.ymd)
  if (byDate >= 0) return byDate

  const startDate = props.planMeta?.startDate || props.plan[0]?.date
  if (!startDate) return 0

  const start = parseYmd(startDate)
  const now = parseYmd(today.value.ymd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) return 0

  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  const maxIndex = Math.max(props.plan.length - 1, 0)
  return Math.min(Math.max(diff, 0), maxIndex)
})
const todayPlan = computed(() => props.plan[todayIndex.value] || null)
const displayedMeals = computed(() =>
  (todayPlan.value?.meals || []).map((meal) => normalizeMealDisplay(meal)),
)
const targetCalories = computed(() =>
  Number(todayPlan.value?.targets?.calories)
  || Number(props.planMeta?.targetCalories)
  || Number(props.profile?.targetCalories)
  || 0,
)
const currentCalories = computed(() => Number(todayPlan.value?.totals?.calories || 0))
const deviation = computed(() => Math.round(currentCalories.value - targetCalories.value))
const deviationText = computed(() => {
  if (!targetCalories.value) return '--'
  return `${deviation.value > 0 ? '+' : ''}${deviation.value} kcal`
})
const calorieStatus = computed(() => {
  const abs = Math.abs(deviation.value)
  if (!targetCalories.value || abs <= 50) return '接近目标'
  if (abs <= 150) return '略有偏差'
  return '偏离较多'
})
const calorieStatusClass = computed(() => ({
  close: !targetCalories.value || Math.abs(deviation.value) <= 50,
  warning: targetCalories.value && Math.abs(deviation.value) > 50 && Math.abs(deviation.value) <= 150,
  danger: targetCalories.value && Math.abs(deviation.value) > 150,
}))
const hasTodayWeight = computed(() =>
  props.weightLogs.some((log) => log?.date === today.value.ymd),
)
const hasTodayCheckin = computed(() =>
  props.checkins.some((checkin) => checkin?.date === today.value.ymd),
)
const todos = computed(() => {
  const items = []
  if (!hasTodayWeight.value) {
    items.push({ key: 'weight', label: '记录今日体重', action: () => emit('record-weight') })
  }
  if (!hasTodayCheckin.value) {
    items.push({ key: 'checkin', label: '完成今日打卡', action: () => emit('checkin-today') })
  }
  if (Math.abs(deviation.value) > 100) {
    items.push({
      key: 'optimize',
      label: '优化今日餐单',
      action: () => emit('optimize-day', todayIndex.value),
    })
  }
  return items
})

function parseYmd(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}

function formatDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
    <header class="today-hero">
      <p>{{ today.label }}</p>
      <h1>今天是计划第 {{ planDay }} 天</h1>
    </header>

    <article class="shell-card calorie-card">
      <h2>今日热量</h2>
      <div class="calorie-grid">
        <div>
          <span>目标</span>
          <strong>{{ targetCalories ? Math.round(targetCalories) : '--' }} kcal</strong>
        </div>
        <div>
          <span>当前餐单</span>
          <strong>{{ formatCalories(currentCalories) }}</strong>
        </div>
        <div>
          <span>偏差</span>
          <strong :class="{ over: Math.abs(deviation) > 100 }">{{ deviationText }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong class="status-label" :class="calorieStatusClass">{{ calorieStatus }}</strong>
        </div>
      </div>
    </article>

    <article class="shell-card today-action-card" aria-label="今日操作">
      <button type="button" class="primary-action" @click="emit('edit-day-food', todayIndex)">
        编辑今日菜单
      </button>
      <button type="button" class="ghost-action" @click="emit('optimize-day', todayIndex)">
        一键优化热量
      </button>
      <button type="button" class="text-action quiet" @click="emit('view-full-plan')">
        查看完整餐单
      </button>
    </article>

    <article class="shell-card meals-card">
      <h2>今日餐单</h2>
      <div v-if="displayedMeals.length" class="today-meal-list">
        <article
          v-for="(meal, mealIndex) in displayedMeals"
          :key="`${meal.time}-${mealIndex}`"
          role="button"
          tabindex="0"
          class="today-meal-row"
          @click="openMealEditor(mealIndex)"
          @keydown.enter.prevent="openMealEditor(mealIndex)"
          @keydown.space.prevent="openMealEditor(mealIndex)"
        >
          <span class="meal-time">{{ mealWindow(meal, mealIndex) }}</span>
          <strong>{{ meal.label || meal.name }}</strong>
          <small>
            {{ formatCalories(meal.calories) }}
            <template v-if="mealFoods(meal).length">
              · {{ mealFoods(meal).slice(0, 3).map((food) => food.name).join('、') }}
            </template>
          </small>
          <button type="button" class="meal-edit-chip" @click.stop="openMealEditor(mealIndex)">
            编辑
          </button>
        </article>
      </div>
      <p v-else class="empty-state">今天还没有餐单。</p>
    </article>

    <article class="shell-card">
      <h2>今日待办</h2>
      <ul v-if="todos.length" class="todo-list" aria-label="今日待办">
        <li v-for="todo in todos" :key="todo.key">
          <button type="button" @click="todo.action()">{{ todo.label }}</button>
        </li>
      </ul>
      <p v-else class="empty-state">今日记录已完成。</p>
    </article>
  </section>
</template>
