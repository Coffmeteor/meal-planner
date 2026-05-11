<script setup>
import { computed, ref, watch } from 'vue'
import { calculateDailyTargets } from '../utils/calc.js'
import { formatCalories, formatMacro, formatTime } from '../utils/helpers.js'
import { generateSchedule } from '../utils/planGenerator.js'

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
const activeSchedule = computed(() => {
  const initial = props.initialSchedule
  if (Number(initial?.mealCount) === mealCount.value && initial?.times?.length === mealCount.value) {
    return {
      mealCount: mealCount.value,
      mealNames:
        initial.mealNames?.length === mealCount.value
          ? initial.mealNames
          : mealNameMap[mealCount.value],
      times: initial.times,
      split: initial.split?.length === mealCount.value ? initial.split : splitMap[mealCount.value],
    }
  }

  return {
    mealCount: mealCount.value,
    mealNames: mealNameMap[mealCount.value],
    times: generateSchedule(mealCount.value),
    split: splitMap[mealCount.value],
  }
})
const timelineItems = computed(() =>
  activeSchedule.value.times.map((time, index) => ({
    time,
    name: activeSchedule.value.mealNames[index],
  })),
)

watch(
  () => props.initialSchedule,
  (initialSchedule) => {
    if (initialSchedule?.mealCount) {
      mealCount.value = Number(initialSchedule.mealCount)
    }
  },
  { immediate: true },
)

function confirmSchedule() {
  emit('confirm', {
    params: props.params,
    schedule: activeSchedule.value,
  })
}
</script>

<template>
  <section class="panel form-stack">
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
        <button type="button" :disabled="mealCount <= 2" @click="mealCount -= 1">-</button>
        <strong>{{ mealCount }}餐</strong>
        <button type="button" :disabled="mealCount >= 6" @click="mealCount += 1">+</button>
      </div>
    </div>

    <div class="timeline">
      <div v-for="item in timelineItems" :key="item.time" class="timeline-item">
        <span>{{ formatTime(item.time) }}</span>
        <strong>{{ item.name }}</strong>
      </div>
    </div>

    <div class="action-row">
      <button type="button" class="ghost-action" @click="emit('back')">返回修改</button>
      <button type="button" class="primary-action" @click="confirmSchedule">确认生成</button>
    </div>
  </section>
</template>
