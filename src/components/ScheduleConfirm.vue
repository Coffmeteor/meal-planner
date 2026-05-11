<script setup>
import { computed, ref } from 'vue'
import { calculateDailyTargets } from '../utils/calc.js'
import { formatCalories, formatMacro, formatTime } from '../utils/helpers.js'
import { generateSchedule } from '../utils/planGenerator.js'

const props = defineProps({
  params: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['back', 'confirm'])

const mealCount = ref(4)
const times = computed(() => generateSchedule(mealCount.value))
const targets = computed(() => calculateDailyTargets(props.params))
const mealNameMap = {
  3: ['早餐', '午餐', '晚餐'],
  4: ['早餐', '午餐', '下午加餐', '晚餐'],
  5: ['早餐', '上午加餐', '午餐', '下午加餐', '晚餐'],
  6: ['早餐', '上午加餐', '午餐', '下午加餐', '晚餐', '晚间轻食'],
}
const timelineItems = computed(() =>
  times.value.map((time, index) => ({
    time,
    name: mealNameMap[mealCount.value][index],
  })),
)

function confirmSchedule() {
  emit('confirm', {
    params: props.params,
    schedule: {
      mealCount: mealCount.value,
      times: times.value,
    },
  })
}
</script>

<template>
  <section class="panel form-stack">
    <div class="section-title">
      <p>第二步</p>
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
        <button type="button" :disabled="mealCount <= 3" @click="mealCount -= 1">-</button>
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
