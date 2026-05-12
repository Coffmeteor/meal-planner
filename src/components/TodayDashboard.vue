<script setup>
import { computed } from 'vue'

const props = defineProps({
  plan: {
    type: Array,
    default: () => [],
  },
  planMeta: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'editTodayMenu',
  'optimizeTodayCalories',
  'recordWeight',
  'checkinToday',
])

const today = computed(() => {
  const date = new Date()
  return {
    ymd: formatDateYmd(date),
    label: date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }),
  }
})

const planDay = computed(() => {
  const startDate = props.planMeta?.startDate || props.plan[0]?.date
  if (!startDate) return 1

  const start = parseYmd(startDate)
  const now = parseYmd(today.value.ymd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) return 1

  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
  const maxDay = Number(props.planMeta?.days || props.plan.length || diff || 1)
  return Math.min(Math.max(diff, 1), Math.max(maxDay, 1))
})

function parseYmd(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}

function formatDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<template>
  <section class="today-dashboard">
    <header class="today-hero">
      <p>{{ today.label }}</p>
      <h1>今天是计划第 {{ planDay }} 天</h1>
    </header>

    <article class="shell-card">
      <h2>今日状态</h2>
      <div class="empty-card-content"></div>
    </article>

    <article class="shell-card">
      <h2>今日待办</h2>
      <ul class="todo-list" aria-label="今日待办"></ul>
    </article>

    <article class="shell-card">
      <h2>快捷操作</h2>
      <div class="quick-action-grid">
        <button type="button" @click="emit('editTodayMenu')">编辑今日菜单</button>
        <button type="button" @click="emit('optimizeTodayCalories')">一键优化热量</button>
        <button type="button" @click="emit('recordWeight')">记录体重</button>
        <button type="button" @click="emit('checkinToday')">今日打卡</button>
      </div>
    </article>
  </section>
</template>
