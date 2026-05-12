<script setup>
import PlanCalendar from './PlanCalendar.vue'

defineProps({
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
      @edit-meal="$emit('editMeal', $event)"
      @edit-day-food="$emit('editDayFood', $event)"
      @lock-meal="$emit('lockMeal', $event)"
      @unlock-meal="$emit('unlockMeal', $event)"
      @replace-meal="$emit('replaceMeal', $event)"
    />
  </section>
</template>
