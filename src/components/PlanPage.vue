<script setup>
import PlanCalendar from './PlanCalendar.vue'
import { pushPage } from '../stores/navigationStore.js'

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

defineEmits([
  'viewCheckin',
  'refreshRecipe',
  'refreshDay',
  'editMeal',
  'editDayFood',
  'lockMeal',
  'unlockMeal',
  'replaceMeal',
])

function openMealEditor({ dayIndex, mealIndex }) {
  pushPage('mealEditor', {
    dayIndex,
    mealIndex,
    mealData: props.plan[dayIndex]?.meals?.[mealIndex] || null,
  })
}

function openDayFoodEditor(dayIndex) {
  pushPage('dayFoodEditor', { dayIndex })
}
</script>

<template>
  <section class="tab-page">
    <PlanCalendar
      :plan="plan"
      :start-date="startDate"
      :plan-meta="planMeta"
      :eating-window="eatingWindow"
      :today-checked="todayChecked"
      @view-checkin="$emit('viewCheckin')"
      @refresh-recipe="$emit('refreshRecipe')"
      @refresh-day="$emit('refreshDay', $event)"
      @edit-meal="openMealEditor"
      @edit-day-food="openDayFoodEditor"
      @lock-meal="$emit('lockMeal', $event)"
      @unlock-meal="$emit('unlockMeal', $event)"
      @replace-meal="$emit('replaceMeal', $event)"
    />
  </section>
</template>
