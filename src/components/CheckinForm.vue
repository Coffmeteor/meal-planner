<script setup>
import { onMounted, reactive, ref } from 'vue'
import * as progressStore from '../stores/progressStore.js'

const emit = defineEmits(['done', 'cancel'])

const form = reactive({
  mealCompleted: 'full',
  note: '',
  moodRating: null,
})
const saving = ref(false)
const error = ref('')

onMounted(() => {
  progressStore.loadProgress().catch((err) => {
    console.warn('Failed to refresh progress before checkin', err)
  })
})

function todayYmd() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function setMood(score) {
  form.moodRating = form.moodRating === score ? null : score
}

async function handleSave() {
  saving.value = true
  error.value = ''

  try {
    const date = todayYmd()
    const existing = progressStore.checkins.value.find((item) => item.date === date)
    const now = new Date().toISOString()
    const updated = await progressStore.addCheckin({
      ...existing,
      id: existing?.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date,
      mealCompleted: form.mealCompleted,
      moodRating: form.moodRating,
      note: form.note.trim(),
      ateOut: existing?.ateOut ?? false,
      exerciseDone: existing?.exerciseDone ?? false,
      sleepQuality: existing?.sleepQuality ?? null,
      hungerLevel: existing?.hungerLevel ?? null,
      adherenceLevel: existing?.adherenceLevel ?? (form.mealCompleted === 'full' ? 5 : 3),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    })
    emit('done', { type: 'checkins', data: updated })
  } catch (err) {
    console.warn('Failed to save checkin', err)
    error.value = '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="sub-page-form" @submit.prevent="handleSave">
    <div class="field-block">
      <span>今日餐单是否全部吃完</span>
      <div class="segmented two-wide">
        <button
          type="button"
          :class="{ active: form.mealCompleted === 'full' }"
          @click="form.mealCompleted = 'full'"
        >
          是
        </button>
        <button
          type="button"
          :class="{ active: form.mealCompleted === 'partial' }"
          @click="form.mealCompleted = 'partial'"
        >
          否
        </button>
      </div>
    </div>

    <div class="field-block">
      <span>今日心情</span>
      <div class="score-buttons">
        <button
          v-for="score in 5"
          :key="score"
          type="button"
          :class="{ active: form.moodRating === score }"
          @click="setMood(score)"
        >
          {{ score }}
        </button>
      </div>
    </div>

    <label class="field-block">
      <span>备注</span>
      <textarea v-model="form.note" rows="4" placeholder="可选"></textarea>
    </label>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="sub-page-actions">
      <button type="button" class="ghost-action" :disabled="saving" @click="emit('cancel')">取消</button>
      <button type="submit" class="primary-action" :disabled="saving">
        {{ saving ? '保存中...' : '保存打卡' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.sub-page-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

.field-block > span,
.field-block span {
  color: #68736b;
  font-size: 0.82rem;
  font-weight: 800;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #dfe5dd;
  border-radius: 0.7rem;
  background: #fbfcfa;
  color: #223026;
  font: inherit;
  padding: 0.75rem;
  resize: vertical;
}

.score-buttons {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.45rem;
}

.score-buttons button {
  min-height: 2.4rem;
  border: 1px solid #dfe5dd;
  border-radius: 0.65rem;
  background: #fbfcfa;
  color: #4f5f53;
  font-weight: 900;
}

.score-buttons button.active {
  border-color: var(--green, #5ba66f);
  background: #edf7ef;
  color: #2f7c48;
}

.sub-page-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.form-error {
  margin: 0;
  color: #c0392b;
  font-size: 0.82rem;
  font-weight: 800;
}
</style>
