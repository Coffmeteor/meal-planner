<script setup>
import { onMounted, reactive, ref } from 'vue'
import * as progressStore from '../stores/progressStore.js'

const emit = defineEmits(['done', 'cancel'])

const form = reactive({
  date: todayYmd(),
  weight: '',
})
const saving = ref(false)
const error = ref('')

onMounted(() => {
  progressStore.loadProgress().catch((err) => {
    console.warn('Failed to refresh progress before weight entry', err)
  })
})

function todayYmd() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function handleSave() {
  const weight = Number(form.weight)
  if (!form.date) {
    error.value = '请选择日期'
    return
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    error.value = '请输入有效体重'
    return
  }

  const existing = progressStore.weights.value.find((item) => item.date === form.date)
  if (existing && !confirm(`该日期已有记录（${existing.weight}kg），要覆盖吗？`)) return

  saving.value = true
  error.value = ''
  try {
    const now = new Date().toISOString()
    const updated = await progressStore.addWeight({
      ...existing,
      id: existing?.id || `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: form.date,
      weight: Math.round(weight * 10) / 10,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    })
    emit('done', { type: 'weights', data: updated })
  } catch (err) {
    console.warn('Failed to save weight', err)
    error.value = '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="sub-page-form" @submit.prevent="handleSave">
    <div class="entry-panel">
      <label>
        <span>日期</span>
        <input v-model="form.date" type="date">
      </label>
      <label>
        <span>体重 kg</span>
        <input
          v-model="form.weight"
          type="number"
          min="1"
          step="0.1"
          inputmode="decimal"
          placeholder="例如 62.5"
        >
      </label>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="sub-page-actions">
      <button type="button" class="ghost-action" :disabled="saving" @click="emit('cancel')">取消</button>
      <button type="submit" class="primary-action" :disabled="saving">
        {{ saving ? '保存中...' : '保存体重' }}
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

.entry-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

label span {
  color: #68736b;
  font-size: 0.82rem;
  font-weight: 800;
}

input {
  width: 100%;
  box-sizing: border-box;
  min-height: 2.75rem;
  border: 1px solid #dfe5dd;
  border-radius: 0.7rem;
  background: #fbfcfa;
  color: #223026;
  font: inherit;
  padding: 0 0.75rem;
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

@media (max-width: 420px) {
  .entry-panel {
    grid-template-columns: 1fr;
  }
}
</style>
