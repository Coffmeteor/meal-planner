<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatCalories, formatDate, formatMacros, formatTime } from '../utils/helpers.js'

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
  todayChecked: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'viewCheckin',
  'refreshRecipe',
  'lockMeal',
  'unlockMeal',
  'replaceMeal',
])

const selectedIndex = ref(0)

const selectedDay = computed(() => props.plan[selectedIndex.value] || props.plan[0])
const dayTotals = computed(() => selectedDay.value?.totals || {})
const dietMethodLabels = {
  threeMeals: '正常三餐',
  threeMealsPlusSnack: '三餐+加餐',
  '14:10': '14:10',
  '16:8': '16:8',
}
const summaryMeta = computed(() => {
  if (!props.planMeta) return null
  const hasRecommendationMeta = Boolean(
    props.planMeta.dietMethod
      || props.planMeta.dietMethodLabel
      || props.planMeta.targetCalories
      || props.planMeta.deficitPercent
      || props.planMeta.macros,
  )
  if (!hasRecommendationMeta) return null

  return {
    ...props.planMeta,
    dietMethodLabel: props.planMeta.dietMethodLabel
      || dietMethodLabels[props.planMeta.dietMethod]
      || null,
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
    background: `conic-gradient(#5ba66f 0 ${proteinEnd}%, #f0a24a ${proteinEnd}% ${carbsEnd}%, #e7c65a ${carbsEnd}% 100%)`,
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

function handleReplace(mealIndex) {
  const meal = selectedDay.value?.meals[mealIndex]
  if (!meal) return

  if (meal.locked) {
    alert('该餐已锁定，请先取消锁定再更换')
    return
  }

  emit('replaceMeal', { dayIndex: selectedIndex.value, mealIndex })
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
          蛋白 {{ summaryMeta.macros.protein }}g ·
          脂肪 {{ summaryMeta.macros.fat }}g ·
          碳水 {{ summaryMeta.macros.carbs }}g
        </span>
      </div>
      <div v-if="summaryMeta.startDate && summaryMeta.totalDays && currentDayIndex" class="summary-row">
        <span>计划日期</span>
        <strong>{{ summaryMeta.startDate }} · 第{{ currentDayIndex }}/{{ summaryMeta.totalDays }}天</strong>
      </div>
    </div>

    <div class="plan-top-actions">
      <button type="button" class="primary-action" @click="emit('refreshRecipe')">
        刷新食谱
      </button>
      <button
        v-if="!todayChecked"
        type="button"
        class="ghost-action"
        @click="emit('viewCheckin')"
      >
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
      <div class="section-title compact">
        <p>第{{ selectedIndex + 1 }}天 / 共{{ plan.length }}天</p>
        <h2>{{ formatDate(selectedDay.date) }} 饮食计划</h2>
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

      <div class="meal-list">
        <article
          v-for="(meal, mealIndex) in selectedDay.meals"
          :key="`${meal.time}-${meal.name}-${mealIndex}`"
          class="meal-card"
          :class="{ 'meal-locked': meal.locked }"
        >
          <div class="meal-head">
            <div>
              <span>{{ formatTime(meal.time) }}</span>
              <strong>{{ meal.name }}</strong>
            </div>
            <em>{{ formatCalories(meal.calories) }}</em>
          </div>
          <p>{{ meal.portion }}</p>
          <p v-if="meal.simpleSteps" class="meal-steps">{{ meal.simpleSteps }}</p>
          <small>{{ formatMacros(meal) }}</small>
          <div class="meal-actions">
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
.plan-top-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 0.65rem;
}

.plan-summary {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.7rem 0.8rem;
  border-radius: 0.75rem;
  background: #f5f6f4;
  color: #2f3a32;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.35;
}

.summary-row span {
  color: #68736b;
}

.summary-row strong {
  flex: 0 0 auto;
  color: #223026;
  font-weight: 800;
}

.macro-summary {
  justify-content: flex-start;
  font-size: 0.75rem;
}

.macro-summary span {
  color: #7a847d;
}

.meal-steps {
  font-size: 0.78rem;
  color: #666;
  margin-top: 0.3rem;
  line-height: 1.4;
}

.meal-locked {
  border-left: 3px solid var(--green, #5ba66f);
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
  border: 1px solid rgba(91, 166, 111, 0.35);
  border-radius: 999rem;
  background: #f6fbf5;
  color: var(--green, #5ba66f);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 900;
}

.meal-action-btn.disabled {
  border-color: #e4e4e4;
  background: #f7f7f7;
  color: #bbb;
  cursor: not-allowed;
}

@media (max-width: 360px) {
  .plan-top-actions {
    grid-template-columns: 1fr;
  }
}
</style>
