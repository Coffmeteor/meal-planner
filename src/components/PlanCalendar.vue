<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatCalories, formatDate, formatMacros, formatTime } from '../utils/helpers.js'
import { mealFoods, normalizeMealDisplay } from '../domain/meal-plan/mealDisplay.js'
import { normalizeDietMethod } from '../domain/meal-plan/scheduleUtils.js'
import {
  CALORIE_DEVIATION_MINOR,
  CALORIE_DEVIATION_MODERATE,
} from '../domain/meal-plan/constants.js'

const props = defineProps({
  plan: {
    type: Array,
    required: true,
  },
  startDate: {
    type: String,
    default: null,
  },
  planMeta: {
    type: Object,
    default: null,
  },
  eatingWindow: {
    type: Object,
    default: null,
  },
  todayChecked: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'viewCheckin',
  'refreshRecipe',
  'refreshDay',
  'editMeal',
  'editDayFood',
  'lockMeal',
  'unlockMeal',
  'replaceMeal',
])

const selectedIndex = ref(0)

const selectedDay = computed(() => props.plan[selectedIndex.value] || props.plan[0])
const displayedMeals = computed(() =>
  (selectedDay.value?.meals || []).map((meal) => normalizeMealDisplay(meal)),
)
const dayTotals = computed(() => selectedDay.value?.totals || {})
const dayTargetCalories = computed(
  () =>
    Number(selectedDay.value?.targets?.calories) || Number(summaryMeta.value?.targetCalories) || 0,
)
const dayDeviation = computed(() =>
  Math.round(Number(dayTotals.value.calories || 0) - Number(dayTargetCalories.value || 0)),
)
const dayDeviationText = computed(() => deviationLabel(dayDeviation.value))
const dayDeviationClass = computed(() => ({
  close: Math.abs(dayDeviation.value) <= CALORIE_DEVIATION_MINOR,
  far: Math.abs(dayDeviation.value) >= CALORIE_DEVIATION_MODERATE,
}))
const dietMethodLabels = {
  threeMeals: '正常三餐',
  threeMealsPlusSnack: '三餐+加餐',
  '14:10': '14:10 进食窗口',
  '16:8': '16:8 进食窗口',
}
const eatingWindowLabel = computed(() => {
  const window = props.eatingWindow || props.planMeta?.eatingWindow
  if (window?.type && window.type !== 'none') {
    return `${normalizeDietMethod(window.type)} 进食窗口 ${window.start}-${window.end}`
  }

  const method = normalizeDietMethod(props.planMeta?.dietMethod)
  return props.planMeta?.dietMethodLabel || dietMethodLabels[method] || null
})
const summaryMeta = computed(() => {
  if (!props.planMeta) return null

  return {
    ...props.planMeta,
    dietMethodLabel: eatingWindowLabel.value,
    totalDays: props.planMeta.totalDays || props.planMeta.days || props.plan.length || null,
  }
})
const currentDayIndex = computed(() => {
  const startDate = summaryMeta.value?.startDate
  const totalDays = Number(summaryMeta.value?.totalDays)
  if (!startDate || !totalDays) return null

  const start = parsePlanDate(startDate)
  if (Number.isNaN(start.getTime())) return null

  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  return Math.min(totalDays, Math.max(1, diffDays + 1))
})
const macroStyle = computed(() => {
  const proteinCalories = (dayTotals.value.protein || 0) * 4
  const carbsCalories = (dayTotals.value.carbs || 0) * 4
  const fatCalories = (dayTotals.value.fat || 0) * 9
  const total = Math.max(1, proteinCalories + carbsCalories + fatCalories)
  const proteinEnd = (proteinCalories / total) * 100
  const carbsEnd = proteinEnd + (carbsCalories / total) * 100

  return {
    background: `conic-gradient(var(--color-primary) 0 ${proteinEnd}%, var(--color-warning) ${proteinEnd}% ${carbsEnd}%, #eab308 ${carbsEnd}% 100%)`,
  }
})

onMounted(() => {
  if (props.startDate) {
    const start = parsePlanDate(props.startDate)
    start.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24))

    if (diffDays >= 0 && diffDays < props.plan.length) {
      selectedIndex.value = diffDays
    }
  }
})

function dayLabel(dayObj) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayDate = parsePlanDate(dayObj.date)

  if (dayDate.toDateString() === today.toDateString()) return '今天'

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dayDate.toDateString() === tomorrow.toDateString()) return '明天'

  return formatDate(dayObj.date)
}

function parsePlanDate(dateValue) {
  if (typeof dateValue === 'string') {
    const [year, month, day] = dateValue.split('-').map(Number)
    if (year && month && day) {
      return new Date(year, month - 1, day)
    }
  }

  return new Date(dateValue)
}

function toggleLock(mealIndex) {
  const meal = selectedDay.value?.meals[mealIndex]
  if (!meal) return

  if (meal.locked) {
    emit('unlockMeal', { dayIndex: selectedIndex.value, mealIndex })
  } else {
    emit('lockMeal', { dayIndex: selectedIndex.value, mealIndex })
  }
}

function deviationLabel(value) {
  const abs = Math.abs(value)
  if (abs <= CALORIE_DEVIATION_MINOR) return '接近目标'
  if (abs >= CALORIE_DEVIATION_MODERATE) return '偏离较多'
  return '稍有偏差'
}

function handleEdit(mealIndex) {
  emit('editMeal', { dayIndex: selectedIndex.value, mealIndex })
}

function handleReplace(mealIndex) {
  const meal = selectedDay.value?.meals[mealIndex]
  if (!meal) return

  if (meal.locked) {
    alert('该餐已锁定，请先取消锁定再更换')
    return
  }

  emit('replaceMeal', { dayIndex: selectedIndex.value, mealIndex })
}

function handleRefreshDay() {
  const hasEditedMeals = selectedDay.value?.meals?.some((meal) => meal?.edited === true)
  if (hasEditedMeals && !confirm('刷新当天会替换未锁定餐，已编辑餐和已锁定餐保留。')) {
    return
  }

  emit('refreshDay', selectedIndex.value)
}

function handleEditDayFood() {
  emit('editDayFood', selectedIndex.value)
}
</script>

<template>
  <section class="plan-view">
    <div v-if="summaryMeta" class="plan-summary">
      <div v-if="summaryMeta.dietMethodLabel" class="summary-row">
        <span>进食方案</span>
        <strong>{{ summaryMeta.dietMethodLabel }}</strong>
      </div>
      <div v-if="summaryMeta.targetCalories" class="summary-row">
        <span>每日目标</span>
        <strong>{{ summaryMeta.targetCalories }} kcal</strong>
      </div>
      <div v-if="summaryMeta.deficitPercent" class="summary-row">
        <span>热量缺口</span>
        <strong>{{ Math.round(summaryMeta.deficitPercent * 100) }}%</strong>
      </div>
      <div v-if="summaryMeta.macros" class="summary-row macro-summary">
        <span>
          蛋白 {{ summaryMeta.macros.protein }}g · 脂肪 {{ summaryMeta.macros.fat }}g · 碳水
          {{ summaryMeta.macros.carbs }}g
        </span>
      </div>
      <div
        v-if="summaryMeta.startDate && summaryMeta.totalDays && currentDayIndex"
        class="summary-row"
      >
        <span>计划日期</span>
        <strong
          >{{ summaryMeta.startDate }} · 第{{ currentDayIndex }}/{{
            summaryMeta.totalDays
          }}天</strong
        >
      </div>
    </div>

    <div class="plan-top-actions">
      <button type="button" class="primary-action" @click="emit('refreshRecipe')">刷新食谱</button>
      <button v-if="!todayChecked" type="button" class="ghost-action" @click="emit('viewCheckin')">
        今日未打卡，去打卡
      </button>
    </div>

    <div class="day-scroll" aria-label="日期选择">
      <button
        v-for="(day, index) in plan"
        :key="day.date"
        type="button"
        class="day-card"
        :class="{ active: selectedIndex === index }"
        @click="selectedIndex = index"
      >
        <span>{{ dayLabel(day) }}</span>
        <strong>第{{ day.day }}天</strong>
        <small>{{ formatCalories(day.totals.calories) }}</small>
      </button>
    </div>

    <div v-if="selectedDay" class="panel plan-detail">
      <div class="section-title compact day-title-row">
        <div>
          <p>第{{ selectedIndex + 1 }}天 / 共{{ plan.length }}天</p>
          <h2>{{ formatDate(selectedDay.date) }} 饮食计划</h2>
        </div>
        <div class="day-title-actions">
          <button type="button" class="day-refresh-btn" @click="handleEditDayFood">编辑当天</button>
          <button type="button" class="day-refresh-btn" @click="handleRefreshDay">
            刷新当天餐单
          </button>
        </div>
      </div>

      <div class="macro-card">
        <div class="donut" :style="macroStyle">
          <span>{{ formatCalories(dayTotals.calories) }}</span>
        </div>
        <div class="legend">
          <span><i class="protein"></i>蛋白 {{ Math.round(dayTotals.protein) }}g</span>
          <span><i class="carbs"></i>碳水 {{ Math.round(dayTotals.carbs) }}g</span>
          <span><i class="fat"></i>脂肪 {{ Math.round(dayTotals.fat) }}g</span>
        </div>
      </div>
      <div class="day-deviation-card">
        <span>
          今日目标: {{ Math.round(dayTargetCalories) }} kcal | 当前:
          {{ Math.round(dayTotals.calories || 0) }} kcal | {{ dayDeviation > 0 ? '+' : ''
          }}{{ dayDeviation }} kcal
        </span>
        <strong :class="dayDeviationClass">{{ dayDeviationText }}</strong>
        <small>
          蛋白: {{ Math.round(dayTotals.protein || 0) }}g / 碳水:
          {{ Math.round(dayTotals.carbs || 0) }}g / 脂肪: {{ Math.round(dayTotals.fat || 0) }}g
        </small>
      </div>

      <div class="meal-list">
        <article
          v-for="(meal, mealIndex) in displayedMeals"
          :key="`${meal.time}-${meal.name}-${mealIndex}`"
          class="meal-card"
          :class="{ 'meal-locked': meal.locked }"
        >
          <div class="meal-head">
            <div>
              <span
                >{{ formatTime(meal.time) }}
                <small class="meal-label">{{ meal.label || meal.name }}</small>
              </span>
              <strong v-if="meal.label" class="meal-dish-name">{{ meal.name }}</strong>
              <small v-if="meal.edited" class="edited-badge">已编辑</small>
            </div>
            <em>{{ formatCalories(meal.calories) }}</em>
          </div>
          <ul v-if="mealFoods(meal).length" class="meal-food-list">
            <li v-for="(food, foodIndex) in mealFoods(meal)" :key="`${food.name}-${foodIndex}`">
              <span>{{ food.name }}</span>
              <small>{{ Math.round(food.portion || 0) }}{{ food.unit || 'g' }}</small>
            </li>
          </ul>
          <p v-else>{{ meal.portion }}</p>
          <p v-if="meal.simpleSteps" class="meal-steps">{{ meal.simpleSteps }}</p>
          <small>{{ formatMacros(meal) }}</small>
          <div class="meal-actions">
            <button type="button" class="meal-action-btn" @click="handleEdit(mealIndex)">
              编辑
            </button>
            <button type="button" class="meal-action-btn" @click="toggleLock(mealIndex)">
              {{ meal.locked ? '已锁定' : '锁定' }}
            </button>
            <button
              type="button"
              class="meal-action-btn"
              :class="{ disabled: meal.locked }"
              :aria-disabled="meal.locked"
              @click="handleReplace(mealIndex)"
            >
              换这一餐
            </button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.plan-view,
.plan-detail {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  box-sizing: border-box;
}

.plan-top-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 0.65rem;
  max-width: 100%;
  min-width: 0;
}

.plan-top-actions > * {
  min-width: 0;
}

.plan-summary {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  gap: 0.4rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
  color: var(--color-text);
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  gap: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.35;
}

.summary-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-muted);
}

.summary-row strong {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text);
  font-weight: 800;
  text-align: right;
}

.macro-summary {
  justify-content: flex-start;
  font-size: 0.75rem;
}

.macro-summary span {
  color: var(--color-muted);
}

.day-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  gap: 0.75rem;
}

.day-title-row > div:first-child {
  min-width: 0;
}

.day-refresh-btn {
  flex: 0 0 auto;
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999rem;
  background: var(--color-card);
  color: var(--color-primary-deep);
  font-size: 0.74rem;
  font-weight: 900;
}

.day-title-actions {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  gap: 0.45rem;
}

.day-deviation-card {
  display: grid;
  gap: 0.3rem;
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-card);
  background: #f8fafc;
  color: var(--color-text);
  line-height: 1.4;
}

.day-deviation-card span,
.day-deviation-card small {
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.day-deviation-card strong,
.deviation-badge {
  color: var(--color-warning);
  font-size: 0.82rem;
}

.day-deviation-card strong.close {
  color: var(--color-primary-deep);
}

.day-deviation-card strong.far {
  color: var(--color-danger);
}

.meal-steps {
  font-size: 0.78rem;
  color: var(--color-muted);
  margin-top: 0.3rem;
  line-height: 1.4;
}

.meal-locked {
  border-left: 3px solid var(--color-primary);
}

.edited-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.25rem;
  margin-left: 0.35rem;
  padding: 0 0.45rem;
  border-radius: 999rem;
  background: #fffbeb;
  color: var(--color-warning);
  font-size: 0.68rem;
  font-weight: 900;
  vertical-align: middle;
}

.meal-food-list {
  display: grid;
  gap: 0.35rem;
  margin: 0.6rem 0 0.45rem;
  padding: 0;
  list-style: none;
}

.meal-food-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.42rem 0.55rem;
  border-radius: 0.65rem;
  background: #f8fafc;
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: 800;
}

.meal-food-list small {
  flex: 0 0 auto;
  color: var(--color-muted);
}

.meal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.meal-action-btn {
  min-height: 2.25rem;
  padding: 0 0.85rem;
  border: 1px solid var(--color-primary-border);
  border-radius: 999rem;
  background: var(--color-primary-soft);
  color: var(--color-primary-deep);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 900;
}

.meal-action-btn.disabled {
  border-color: #e4e4e4;
  background: #f7f7f7;
  color: var(--color-muted);
  cursor: not-allowed;
}

@media (max-width: 360px) {
  .plan-top-actions {
    grid-template-columns: 1fr;
  }

  .day-title-row {
    flex-direction: column;
  }

  .day-title-actions {
    width: 100%;
    justify-content: stretch;
  }

  .day-title-actions .day-refresh-btn {
    flex: 1 1 0;
  }
}
</style>
