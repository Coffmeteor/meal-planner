<script setup>
import { computed, ref } from 'vue'
import { formatCalories, formatDate, formatMacros, formatTime } from '../utils/helpers.js'

const props = defineProps({
  plan: {
    type: Array,
    required: true,
  },
})

const selectedIndex = ref(0)

const selectedDay = computed(() => props.plan[selectedIndex.value] || props.plan[0])
const dayTotals = computed(() => selectedDay.value?.totals || {})
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
</script>

<template>
  <section class="plan-view">
    <div class="day-scroll" aria-label="日期选择">
      <button
        v-for="(day, index) in plan"
        :key="day.date"
        type="button"
        class="day-card"
        :class="{ active: selectedIndex === index }"
        @click="selectedIndex = index"
      >
        <span>第{{ day.day }}天</span>
        <strong>{{ formatDate(day.date) }}</strong>
        <small>{{ formatCalories(day.totals.calories) }}</small>
      </button>
    </div>

    <div v-if="selectedDay" class="panel plan-detail">
      <div class="section-title compact">
        <p>第三步</p>
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
        <article v-for="meal in selectedDay.meals" :key="`${meal.time}-${meal.name}`" class="meal-card">
          <div class="meal-head">
            <div>
              <span>{{ formatTime(meal.time) }}</span>
              <strong>{{ meal.name }}</strong>
            </div>
            <em>{{ formatCalories(meal.calories) }}</em>
          </div>
          <p>{{ meal.portion }}</p>
          <small>{{ formatMacros(meal) }}</small>
        </article>
      </div>
    </div>
  </section>
</template>
