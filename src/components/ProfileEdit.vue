<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getUserProfile, saveUserProfile } from '../adapters/storageAdapter.js'

const emit = defineEmits(['done', 'cancel'])

const form = reactive({
  name: '',
  targetCalories: '',
  dietMethod: 'threeMeals',
  age: '',
  gender: 'female',
  height: '',
  weight: '',
})
const saving = ref(false)
const error = ref('')
const existingProfile = ref({})

onMounted(async () => {
  const profile = await getUserProfile()
  existingProfile.value = profile || {}
  Object.assign(form, {
    name: profile?.name || '',
    targetCalories: profile?.targetCalories || '',
    dietMethod: profile?.dietMethod || 'threeMeals',
    age: profile?.age || '',
    gender: profile?.gender || 'female',
    height: profile?.height || '',
    weight: profile?.weight || '',
  })
})

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

async function handleSave() {
  const age = numberOrNull(form.age)
  const height = numberOrNull(form.height)
  const weight = numberOrNull(form.weight)
  if (!age || !height || !weight) {
    error.value = '请填写有效的年龄、身高和体重'
    return
  }

  saving.value = true
  error.value = ''
  try {
    const profile = {
      ...existingProfile.value,
      name: form.name.trim(),
      targetCalories: numberOrNull(form.targetCalories),
      dietMethod: form.dietMethod,
      age,
      gender: form.gender,
      height,
      weight,
    }
    await saveUserProfile(profile)
    emit('done', { type: 'profile', data: profile })
  } catch (err) {
    console.warn('Failed to save profile', err)
    error.value = '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="profile-edit" @submit.prevent="handleSave">
    <div class="edit-panel">
      <label>
        <span>姓名</span>
        <input v-model="form.name" type="text" placeholder="可选">
      </label>
      <label>
        <span>目标热量 kcal</span>
        <input v-model="form.targetCalories" type="number" min="1" inputmode="numeric">
      </label>
      <label>
        <span>饮食类型</span>
        <select v-model="form.dietMethod">
          <option value="threeMeals">正常三餐</option>
          <option value="threeMealsPlusSnack">三餐+加餐</option>
          <option value="14:10">14:10 进食窗口</option>
          <option value="16:8">16:8 进食窗口</option>
        </select>
      </label>
      <label>
        <span>年龄</span>
        <input v-model="form.age" type="number" min="12" max="90" inputmode="numeric">
      </label>
      <label>
        <span>性别</span>
        <select v-model="form.gender">
          <option value="female">女性</option>
          <option value="male">男性</option>
        </select>
      </label>
      <label>
        <span>身高 cm</span>
        <input v-model="form.height" type="number" min="120" max="220" inputmode="numeric">
      </label>
      <label>
        <span>体重 kg</span>
        <input v-model="form.weight" type="number" min="35" max="180" step="0.1" inputmode="decimal">
      </label>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="sub-page-actions">
      <button type="button" class="ghost-action" :disabled="saving" @click="emit('cancel')">取消</button>
      <button type="submit" class="primary-action" :disabled="saving">
        {{ saving ? '保存中...' : '保存资料' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.profile-edit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.edit-panel {
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

input,
select {
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

@media (max-width: 520px) {
  .edit-panel {
    grid-template-columns: 1fr;
  }
}
</style>
