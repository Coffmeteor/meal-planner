<script setup>
import CheckinProgress from './CheckinProgress.vue'
import WeightProgress from './WeightProgress.vue'

defineProps({
  weightLogs: {
    type: Array,
    default: () => [],
  },
  profile: {
    type: Object,
    default: null,
  },
  checkins: {
    type: Array,
    default: () => [],
  },
  planDays: {
    type: Number,
    default: 7,
  },
  startDate: {
    type: String,
    default: null,
  },
})

defineEmits(['saveWeightLogs', 'saveCheckins'])
</script>

<template>
  <section class="tab-page progress-tab-page">
    <WeightProgress
      :weight-logs="weightLogs"
      :profile="profile"
      :checkins="checkins"
      :plan-days="planDays"
      :start-date="startDate"
      :show-close="false"
      @save="$emit('saveWeightLogs', $event)"
    />
    <CheckinProgress
      :checkins="checkins"
      :show-close="false"
      @save="$emit('saveCheckins', $event)"
    />
  </section>
</template>
