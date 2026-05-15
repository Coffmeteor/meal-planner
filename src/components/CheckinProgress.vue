<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { analyzeRecentCheckins, generateCheckinAdvice } from '../domain/checkins/index.js'

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

const emit = defineEmits(['save', 'close', 'deleteCheckin'])

const form = reactive({
  date: todayYmd(),
  mealCompleted: 'partial',
  ateOut: false,
  exerciseDone: false,
  sleepQuality: null,
  hungerLevel: null,
  adherenceLevel: null,
  note: '',
})
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

watch(
  () => [form.date, props.checkins],
  () => fillFromExistingDate(),
  { immediate: true },
)

function todayYmd() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fillFromExistingDate() {
  const existing = props.checkins.find((log) => log.date === form.date)
  if (!existing) {
    form.mealCompleted = 'partial'
    form.ateOut = false
    form.exerciseDone = false
    form.sleepQuality = null
    form.hungerLevel = null
    form.adherenceLevel = null
    form.note = ''
    return
  }

  form.mealCompleted = existing.mealCompleted ?? 'partial'
  form.ateOut = !!existing.ateOut
  form.exerciseDone = !!existing.exerciseDone
  form.sleepQuality = existing.sleepQuality ?? null
  form.hungerLevel = existing.hungerLevel ?? null
  form.adherenceLevel = existing.adherenceLevel ?? null
  form.note = existing.note ?? ''
}

function setScore(field, value) {
  form[field] = form[field] === value ? null : value
}

function scoreText(value) {
  return value == null ? '未填' : `${value}/5`
}

function percentText(value) {
  return value == null ? '--' : `${Math.round(value * 100)}%`
}

async function handleSave() {
  if (!form.date) {
    error.value = '请选择日期'
    return
  }

  saving.value = true
  error.value = ''
  try {
    const payload = {
      date: form.date,
      mealCompleted: form.mealCompleted,
      ateOut: form.ateOut,
      exerciseDone: form.exerciseDone,
      sleepQuality: form.sleepQuality,
      hungerLevel: form.hungerLevel,
      adherenceLevel: form.adherenceLevel,
      note: form.note.trim(),
    }
    emit('save', payload)
  } catch (e) {
    console.warn('Failed to save checkin', e)
    error.value = '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

async function handleDelete(id) {
  if (!id) return
  if (!confirm('删除这条打卡记录？')) return

  saving.value = true
  error.value = ''
  try {
    emit('deleteCheckin', id)
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
      <button v-if="showClose" type="button" class="text-action" @click="emit('close')">
        返回
      </button>
    </div>

    <form class="checkin-panel checkin-form" @submit.prevent="handleSave">
      <label>
        <span>日期</span>
        <input v-model="form.date" type="date" />
      </label>

      <div class="field-block">
        <span>餐单完成度</span>
        <div class="completion-grid">
          <button
            v-for="option in ['full', 'partial', 'missed']"
            :key="option"
            type="button"
            :class="{ active: form.mealCompleted === option }"
            @click="form.mealCompleted = option"
          >
            {{ completionLabels[option] }}
          </button>
        </div>
      </div>

      <div class="toggle-grid">
        <button
          type="button"
          class="toggle-button"
          :class="{ active: form.ateOut }"
          @click="form.ateOut = !form.ateOut"
        >
          外食：{{ form.ateOut ? '是' : '否' }}
        </button>
        <button
          type="button"
          class="toggle-button"
          :class="{ active: form.exerciseDone }"
          @click="form.exerciseDone = !form.exerciseDone"
        >
          运动：{{ form.exerciseDone ? '是' : '否' }}
        </button>
      </div>

      <div class="field-block">
        <span>睡眠质量</span>
        <div class="score-buttons">
          <button
            v-for="score in 5"
            :key="`sleep-${score}`"
            type="button"
            :class="{ active: form.sleepQuality === score }"
            @click="setScore('sleepQuality', score)"
          >
            {{ score }}
          </button>
        </div>
      </div>

      <div class="field-block">
        <span>饥饿感</span>
        <div class="score-buttons">
          <button
            v-for="score in 5"
            :key="`hunger-${score}`"
            type="button"
            :class="{ active: form.hungerLevel === score }"
            @click="setScore('hungerLevel', score)"
          >
            {{ score }}
          </button>
        </div>
      </div>

      <div class="field-block">
        <span>执行度</span>
        <div class="score-buttons">
          <button
            v-for="score in 5"
            :key="`adherence-${score}`"
            type="button"
            :class="{ active: form.adherenceLevel === score }"
            @click="setScore('adherenceLevel', score)"
          >
            {{ score }}
          </button>
        </div>
      </div>

      <label>
        <span>备注</span>
        <textarea v-model="form.note" rows="3" placeholder="可选"></textarea>
      </label>

      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="form-action-bar" :class="{ single: !showClose }">
        <button v-if="showClose" type="button" class="ghost-action" @click="emit('close')">
          放弃
        </button>
        <button type="submit" class="primary-action full-width" :disabled="saving">
          {{ saving ? '保存中...' : '保存打卡' }}
        </button>
      </div>
    </form>

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
            外食 {{ log.ateOut ? '是' : '否' }} · 运动 {{ log.exerciseDone ? '是' : '否' }} · 饥饿
            {{ scoreText(log.hungerLevel) }} · 执行 {{ scoreText(log.adherenceLevel) }}
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
  padding: 0 0.5rem calc(5rem + env(safe-area-inset-bottom));
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-button);
  color: var(--color-primary-deep);
  background: var(--color-card);
  font-weight: 900;
}

.checkin-panel {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-card);
  box-shadow: var(--shadow-card);
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
  color: var(--color-muted);
  font-size: 0.78rem;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-button);
  background: var(--color-card);
  color: var(--color-text);
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-button);
  background: var(--color-card);
  color: var(--color-muted);
  font-weight: 800;
}

.completion-grid button.active,
.toggle-button.active,
.score-buttons button.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-deep);
}

.checkin-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 0.75rem;
}

.checkin-metrics div {
  min-width: 0;
  padding: 0.75rem 0.45rem;
  border-radius: var(--radius-button);
  background: #f8fafc;
  text-align: center;
}

.checkin-metrics span,
.checkin-metrics strong {
  display: block;
}

.checkin-metrics strong {
  margin-top: 0.2rem;
  color: var(--color-text);
  font-size: 0.95rem;
}

.panel-head h3 {
  margin: 0;
  color: var(--color-text);
  font-size: 1rem;
}

.advice-panel p,
.empty-state {
  margin: 0.35rem 0 0;
  color: var(--color-text);
  font-size: 0.9rem;
  line-height: 1.55;
}

.empty-state {
  color: var(--color-muted);
}

.checkin-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0;
  border-top: 1px solid var(--color-border);
}

.checkin-item div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.checkin-item strong {
  color: var(--color-text);
  font-size: 0.92rem;
}

.checkin-item span,
.checkin-item p {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.8rem;
  line-height: 1.45;
  word-break: break-word;
}

.delete-action {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--color-danger);
  font-size: 0.82rem;
  font-weight: 800;
}

.form-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.82rem;
  font-weight: 700;
}

.form-action-bar {
  position: fixed;
  right: max(1rem, calc((100vw - 30rem) / 2 + 1rem));
  bottom: calc(1rem + env(safe-area-inset-bottom));
  left: max(1rem, calc((100vw - 30rem) / 2 + 1rem));
  z-index: 21;
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 0.65rem;
  padding: 0.65rem;
  border: 0.5px solid var(--color-separator);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -0.5px 4px rgba(0, 0, 0, 0.06);
}

.form-action-bar.single {
  grid-template-columns: 1fr;
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
    padding: 0 0.25rem calc(5rem + env(safe-area-inset-bottom));
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
