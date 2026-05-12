<script setup>
import WeightProgress from './WeightProgress.vue'
import CheckinProgress from './CheckinProgress.vue'

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

const emit = defineEmits(['recordWeight', 'checkinToday', 'weightLogsSave', 'checkinSave'])
</script>

<template>
  <section class="tab-page-shell progress-page">
    <div class="tab-page-heading">
      <div>
        <p>进度记录</p>
        <h1>进度</h1>
      </div>
    </div>
    <div class="quick-action-grid">
      <button type="button" class="primary-action" @click="emit('recordWeight')">记录体重</button>
      <button type="button" class="ghost-action" @click="emit('checkinToday')">今日打卡</button>
    </div>
    <WeightProgress
      :weight-logs="weightLogs"
      :profile="profile"
      :checkins="checkins"
      :plan-days="planDays"
      :start-date="startDate"
      :show-close="false"
      @save="emit('weightLogsSave', $event)"
    />
    <CheckinProgress
      :checkins="checkins"
      :show-close="false"
      @save="emit('checkinSave', $event)"
    />
  </section>
</template>
