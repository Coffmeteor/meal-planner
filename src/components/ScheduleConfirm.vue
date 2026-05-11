<script setup>
import { computed, ref, watch } from 'vue'
import { calculateDailyTargets } from '../utils/calc.js'
import { formatCalories, formatMacro } from '../utils/helpers.js'
import { generateScheduleFromProfile } from '../utils/planGenerator.js'
import {
  addMinutesToTime,
  autoDistributeMeals,
  normalizeDietMethod,
  normalizeEatingWindow,
  validateScheduleTimes,
} from '../utils/scheduleUtils.js'

const props = defineProps({
  params: {
    type: Object,
    required: true,
  },
  initialSchedule: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['back', 'confirm'])

const mealCount = ref(4)
const currentSchedule = ref(null)
const eatingWindow = ref({ type: 'none' })
const targets = computed(() => calculateDailyTargets(props.params))
const mealNameMap = {
  2: ['午餐', '晚餐'],
  3: ['早餐', '午餐', '晚餐'],
  4: ['早餐', '午餐', '下午加餐', '晚餐'],
  5: ['早餐', '上午加餐', '午餐', '下午加餐', '晚餐'],
  6: ['早餐', '上午加餐', '午餐', '下午加餐', '晚餐', '晚间轻食'],
}
const splitMap = {
  2: [0.5, 0.5],
  3: [0.3, 0.4, 0.3],
  4: [0.28, 0.38, 0.1, 0.24],
  5: [0.24, 0.1, 0.32, 0.1, 0.24],
  6: [0.22, 0.09, 0.28, 0.09, 0.24, 0.08],
}
const windowMealNameMap = {
  2: ['午餐', '晚餐'],
  3: ['午餐', '下午加餐', '晚餐'],
  4: ['午餐', '下午加餐', '晚餐', '晚间轻食'],
}
const windowSplitMap = {
  2: [0.5, 0.5],
  3: [0.45, 0.1, 0.45],
  4: [0.38, 0.1, 0.37, 0.15],
}
const dietMethod = computed(() => normalizeDietMethod(props.params?.dietMethod || 'threeMeals'))
const isWindowMethod = computed(() => eatingWindow.value?.type && eatingWindow.value.type !== 'none')
const canEditMealCount = computed(() => isWindowMethod.value)
const minMealCount = computed(() => (isWindowMethod.value ? 2 : mealCount.value))
const maxMealCount = computed(() => (isWindowMethod.value ? 4 : mealCount.value))
const timelineItems = computed(() =>
  (currentSchedule.value?.times || []).map((time, index) => ({
    time,
    name: currentSchedule.value?.mealNames?.[index] || mealNameMap[mealCount.value]?.[index] || '轻食',
  })),
)
const validation = computed(() =>
  validateScheduleTimes(currentSchedule.value || {}, eatingWindow.value),
)

watch(
  () => [props.params, props.initialSchedule],
  () => {
    resetFromProps()
  },
  { immediate: true },
)

function resetFromProps() {
  const initialWindow = props.initialSchedule?.eatingWindow || props.params?.eatingWindow
  eatingWindow.value = normalizeEatingWindow(props.params, dietMethod.value, initialWindow)
  const baseSchedule = props.initialSchedule?.mealCount
    ? props.initialSchedule
    : generateScheduleFromProfile(props.params, dietMethod.value, eatingWindow.value)
  const nextCount = boundedMealCount(Number(baseSchedule?.mealCount) || defaultMealCount())
  mealCount.value = nextCount
  currentSchedule.value = normalizeSchedule(baseSchedule, nextCount)
}

function defaultMealCount() {
  if (dietMethod.value === 'threeMealsPlusSnack') return 4
  if (isWindowMethod.value) return dietMethod.value === '16:8' ? 2 : 3
  return 3
}

function boundedMealCount(value) {
  if (!isWindowMethod.value) return defaultMealCount()
  return Math.min(4, Math.max(2, Number(value) || defaultMealCount()))
}

function mealNamesFor(count) {
  if (isWindowMethod.value) return windowMealNameMap[count] || windowMealNameMap[3]
  if (dietMethod.value === 'threeMealsPlusSnack') return mealNameMap[4]
  return mealNameMap[3]
}

function splitFor(count) {
  return isWindowMethod.value ? windowSplitMap[count] : splitMap[count]
}

function normalizeSchedule(schedule, count) {
  const names = schedule?.mealNames?.length === count ? schedule.mealNames : mealNamesFor(count)
  const split = schedule?.split?.length === count ? schedule.split : splitFor(count)
  const times =
    schedule?.times?.length === count
      ? schedule.times
      : generateScheduleFromProfile(props.params, dietMethod.value, eatingWindow.value).times

  return {
    mealCount: count,
    mealNames: names,
    times: times.slice(0, count),
    split,
    eatingWindow: eatingWindow.value,
  }
}

function setMealCount(nextCount) {
  if (!canEditMealCount.value) return

  const count = boundedMealCount(nextCount)
  mealCount.value = count
  const times = Array.from(
    { length: count },
    (_, index) => currentSchedule.value?.times?.[index] || eatingWindow.value.start,
  )
  currentSchedule.value = autoDistributeMeals({
    mealCount: count,
    mealNames: mealNamesFor(count),
    times,
    split: splitFor(count),
    eatingWindow: eatingWindow.value,
  }, eatingWindow.value)
}

function updateMealTime(index, time) {
  const times = [...(currentSchedule.value?.times || [])]
  times[index] = time
  currentSchedule.value = {
    ...currentSchedule.value,
    times,
    eatingWindow: eatingWindow.value,
  }
}

function updateWindowStart(start) {
  const nextWindow = normalizeEatingWindow(props.params, eatingWindow.value.type, {
    ...eatingWindow.value,
    start,
    end: addMinutesToTime(start, Number(eatingWindow.value.eatingHours || 0) * 60),
  })
  eatingWindow.value = nextWindow
  currentSchedule.value = {
    ...currentSchedule.value,
    eatingWindow: nextWindow,
  }
}

function distributeMealsInWindow() {
  currentSchedule.value = autoDistributeMeals(
    {
      ...currentSchedule.value,
      eatingWindow: eatingWindow.value,
    },
    eatingWindow.value,
  )
}

function emitBack() {
  emit('back', {
    params: {
      ...props.params,
      eatingWindow: eatingWindow.value,
    },
    schedule: {
      ...currentSchedule.value,
      eatingWindow: eatingWindow.value,
    },
  })
}

function confirmSchedule() {
  emit('confirm', {
    params: {
      ...props.params,
      eatingWindow: eatingWindow.value,
    },
    schedule: {
      ...currentSchedule.value,
      eatingWindow: eatingWindow.value,
    },
  })
}
</script>

<template>
  <section class="panel form-stack">
    <div class="top-action-row">
      <button type="button" class="ghost-action compact-action" @click="emitBack">
        返回推荐
      </button>
    </div>

    <div class="section-title">
      <p>餐次</p>
      <h2>确认进食节奏</h2>
    </div>

    <div class="metric-grid">
      <div>
        <span>基础代谢</span>
        <strong>{{ formatCalories(targets.bmr) }}</strong>
      </div>
      <div>
        <span>日消耗</span>
        <strong>{{ formatCalories(targets.tdee) }}</strong>
      </div>
      <div>
        <span>目标</span>
        <strong>{{ formatCalories(targets.calories) }}</strong>
      </div>
    </div>

    <div class="macro-strip">
      <span>蛋白 {{ formatMacro(targets.macros.protein) }}</span>
      <span>碳水 {{ formatMacro(targets.macros.carbs) }}</span>
      <span>脂肪 {{ formatMacro(targets.macros.fat) }}</span>
    </div>

    <div class="field-group">
      <span class="field-label">每日餐次</span>
      <div class="stepper">
        <button
          type="button"
          :disabled="!canEditMealCount || mealCount <= minMealCount"
          @click="setMealCount(mealCount - 1)"
        >
          -
        </button>
        <strong>{{ mealCount }}餐</strong>
        <button
          type="button"
          :disabled="!canEditMealCount || mealCount >= maxMealCount"
          @click="setMealCount(mealCount + 1)"
        >
          +
        </button>
      </div>
    </div>

    <div v-if="isWindowMethod" class="eating-window-editor">
      <div class="field-label">进食窗口</div>
      <div class="window-grid">
        <label>
          <span>开始</span>
          <input
            :value="eatingWindow.start"
            class="time-input"
            type="time"
            @input="updateWindowStart($event.target.value)"
          />
        </label>
        <div>
          <span>结束</span>
          <strong>{{ eatingWindow.end }}</strong>
        </div>
        <div>
          <span>空腹</span>
          <strong>{{ eatingWindow.fastingHours }}小时</strong>
        </div>
      </div>
      <button type="button" class="ghost-action compact-action" @click="distributeMealsInWindow">
        按窗口自动分配餐次
      </button>
    </div>

    <div class="timeline">
      <div v-for="(item, index) in timelineItems" :key="`${item.name}-${index}`" class="timeline-item editable">
        <input
          :value="item.time"
          class="time-input meal-time-input"
          type="time"
          @input="updateMealTime(index, $event.target.value)"
        />
        <strong>{{ item.name }}</strong>
      </div>
    </div>

    <div v-if="!validation.valid" class="warning-banner">
      {{ validation.errors.join('；') }}
    </div>

    <div class="action-row">
      <button type="button" class="ghost-action" @click="emitBack">返回修改</button>
      <button
        type="button"
        class="primary-action"
        :disabled="!validation.valid"
        @click="confirmSchedule"
      >
        确认生成
      </button>
    </div>
  </section>
</template>
