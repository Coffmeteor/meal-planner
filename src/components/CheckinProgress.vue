<script setup>
import { computed, ref } from 'vue'
import { deleteCheckin } from '../storage/index.js'
import { analyzeRecentCheckins, generateCheckinAdvice } from '../utils/checkins.js'

const props = defineProps({
  checkins: {
    type: Array,
    default: () => [],
  },
  showClose: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['save', 'close'])

const saving = ref(false)
const error = ref('')

const sortedCheckins = computed(() =>
  [...props.checkins].sort((a, b) => b.date.localeCompare(a.date)),
)
const recentAnalysis = computed(() => analyzeRecentCheckins(props.checkins))
const advice = computed(() => generateCheckinAdvice(props.checkins))

const completionLabels = {
  full: '完成',
  partial: '部分',
  missed: '未完成',
}

function scoreText(value) {
  return value == null ? '未填' : `${value}/5`
}

function percentText(value) {
  return value == null ? '--' : `${Math.round(value * 100)}%`
}

async function handleDelete(id) {
  if (!id) return
  if (!confirm('删除这条打卡记录？')) return

  saving.value = true
  error.value = ''
  try {
    const result = await deleteCheckin(id)
    emit('save', result)
  } catch (e) {
    console.warn('Failed to delete checkin', e)
    error.value = '删除失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="checkin-progress">
    <div class="section-title compact checkin-title">
      <div>
        <p>执行打卡</p>
        <h2>今日打卡</h2>
      </div>
      <button v-if="showClose" type="button" class="text-action" @click="emit('close')">返回</button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="checkin-panel">
      <div class="panel-head">
        <h3>最近 7 天</h3>
        <span>{{ recentAnalysis.count }} 天</span>
      </div>
      <div class="checkin-metrics">
        <div>
          <span>执行率</span>
          <strong>{{ percentText(recentAnalysis.adherenceRate) }}</strong>
        </div>
        <div>
          <span>外食次数</span>
          <strong>{{ recentAnalysis.ateOutCount }} 次</strong>
        </div>
        <div>
          <span>运动次数</span>
          <strong>{{ recentAnalysis.exerciseCount }} 次</strong>
        </div>
        <div>
          <span>平均饥饿感</span>
          <strong>{{ scoreText(recentAnalysis.avgHunger) }}</strong>
        </div>
        <div>
          <span>平均执行度</span>
          <strong>{{ scoreText(recentAnalysis.avgAdherence) }}</strong>
        </div>
        <div>
          <span>平均睡眠</span>
          <strong>{{ scoreText(recentAnalysis.avgSleep) }}</strong>
        </div>
      </div>
    </div>

    <div class="checkin-panel advice-panel">
      <span>复盘建议</span>
      <p>{{ advice }}</p>
    </div>

    <div class="checkin-panel">
      <div class="panel-head">
        <h3>最近打卡记录</h3>
        <span>{{ sortedCheckins.length }} 条</span>
      </div>
      <p v-if="!sortedCheckins.length" class="empty-state">还没有打卡记录。</p>
      <article v-for="log in sortedCheckins" :key="log.id || log.date" class="checkin-item">
        <div>
          <strong>{{ log.date }} · {{ completionLabels[log.mealCompleted] || '未填' }}</strong>
          <span>
            外食 {{ log.ateOut ? '是' : '否' }} ·
            运动 {{ log.exerciseDone ? '是' : '否' }} ·
            饥饿 {{ scoreText(log.hungerLevel) }} ·
            执行 {{ scoreText(log.adherenceLevel) }}
          </span>
          <p v-if="log.note">{{ log.note }}</p>
        </div>
        <button
          type="button"
          class="delete-action"
          :disabled="saving || !log.id"
          @click="handleDelete(log.id)"
        >
          删除
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.checkin-progress {
  display: flex;
  max-width: 100%;
  overflow-x: hidden;
  flex-direction: column;
  gap: 1rem;
  padding: 0 0.5rem;
}

.checkin-title,
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.text-action {
  flex: 0 0 auto;
  min-height: 2.25rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line, #dfe5dd);
  border-radius: 0.8rem;
  color: var(--green-deep, #35754b);
  background: rgba(255, 255, 255, 0.72);
  font-weight: 900;
}

.checkin-panel {
  padding: 1rem;
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

.checkin-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.checkin-form label,
.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.checkin-form label > span,
.field-block > span,
.panel-head span,
.checkin-metrics span,
.advice-panel span {
  color: #68736b;
  font-size: 0.78rem;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dfe5dd;
  border-radius: 0.65rem;
  background: #fbfcfa;
  color: #223026;
  font: inherit;
  padding: 0.7rem 0.75rem;
}

textarea {
  resize: vertical;
}

.completion-grid,
.toggle-grid,
.score-buttons,
.checkin-metrics {
  display: grid;
  gap: 0.45rem;
}

.completion-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.toggle-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.score-buttons {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.completion-grid button,
.toggle-button,
.score-buttons button {
  min-height: 2.65rem;
  border: 1px solid #dfe5dd;
  border-radius: 0.65rem;
  background: #fbfcfa;
  color: #4f5f53;
  font-weight: 800;
}

.completion-grid button.active,
.toggle-button.active,
.score-buttons button.active {
  border-color: var(--green, #5ba66f);
  background: #edf7ef;
  color: #2f7c48;
}

.checkin-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.75rem;
}

.checkin-metrics div {
  min-width: 0;
  padding: 0.75rem 0.45rem;
  border-radius: 0.75rem;
  background: #f6f8f4;
  text-align: center;
}

.checkin-metrics span,
.checkin-metrics strong {
  display: block;
}

.checkin-metrics strong {
  margin-top: 0.2rem;
  color: #223026;
  font-size: 0.95rem;
}

.panel-head h3 {
  margin: 0;
  color: #223026;
  font-size: 1rem;
}

.advice-panel p,
.empty-state {
  margin: 0.35rem 0 0;
  color: #2f3a32;
  font-size: 0.9rem;
  line-height: 1.55;
}

.empty-state {
  color: #7a847d;
}

.checkin-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-top: 1px solid #edf0ec;
}

.checkin-item div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.checkin-item strong {
  color: #223026;
  font-size: 0.92rem;
}

.checkin-item span,
.checkin-item p {
  margin: 0;
  color: #68736b;
  font-size: 0.8rem;
  line-height: 1.45;
  word-break: break-word;
}

.delete-action {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: #c0392b;
  font-size: 0.82rem;
  font-weight: 800;
}

.form-error {
  margin: 0;
  color: #c0392b;
  font-size: 0.82rem;
  font-weight: 700;
}

@media (max-width: 520px) {
  .checkin-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .checkin-item {
    align-items: stretch;
    flex-direction: column;
  }

  .delete-action {
    align-self: flex-start;
  }
}

@media (max-width: 400px) {
  .checkin-progress {
    padding: 0 0.25rem;
  }

  .toggle-grid,
  .completion-grid {
    grid-template-columns: 1fr;
  }

  .score-buttons button {
    min-height: 2.4rem;
    font-size: 0.85rem;
  }
}
</style>
