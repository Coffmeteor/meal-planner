<script setup>
import PlanCalendar from './PlanCalendar.vue'

defineProps({
  plan: {
    type: Array,
    default: () => [],
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
  'editMeal',
  'editDayFood',
  'refreshRecipe',
  'refreshDay',
  'lockMeal',
  'unlockMeal',
  'replaceMeal',
  'viewCheckin',
])
</script>

<template>
  <section class="tab-page-shell plan-page">
    <PlanCalendar
      :plan="plan"
      :start-date="startDate"
      :plan-meta="planMeta"
      :eating-window="eatingWindow"
      :today-checked="todayChecked"
      @edit-meal="emit('editMeal', $event)"
      @edit-day-food="emit('editDayFood', $event)"
      @refresh-recipe="emit('refreshRecipe')"
      @refresh-day="emit('refreshDay', $event)"
      @lock-meal="emit('lockMeal', $event)"
      @unlock-meal="emit('unlockMeal', $event)"
      @replace-meal="emit('replaceMeal', $event)"
      @view-checkin="emit('viewCheckin')"
    />
  </section>
</template>
