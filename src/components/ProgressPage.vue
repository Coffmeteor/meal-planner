<script setup>
import CheckinProgress from './CheckinProgress.vue'
import WeightProgress from './WeightProgress.vue'
import { pushPage } from '../stores/navigationStore.js'

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
    <div class="progress-actions">
      <button type="button" class="primary-action" @click="pushPage('weightEntry')">记录体重</button>
      <button type="button" class="ghost-action" @click="pushPage('checkinForm')">今日打卡</button>
    </div>
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

<style scoped>
.progress-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
</style>
