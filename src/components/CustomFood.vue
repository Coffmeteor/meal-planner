<script setup>
import { reactive, ref } from 'vue'
import * as foodStore from '../stores/foodStore.js'
import { FOOD_CATEGORY_LABELS, FOOD_CATEGORY_OPTIONS } from '../utils/foodMeta.js'
import { loadFoodPreferences, saveFoodPreferences } from '../utils/foodPreferences.js'

const emit = defineEmits(['done', 'cancel'])

const mealFitByCategory = {
  protein: ['breakfast', 'lunch', 'dinner', 'snack'],
  carb: ['breakfast', 'lunch', 'dinner'],
  vegetable: ['lunch', 'dinner', 'snack'],
  fat: ['snack'],
  fruit: ['snack'],
  dairy: ['breakfast', 'snack'],
}
const defaultPortionByCategory = {
  protein: 120,
  carb: 150,
  vegetable: 180,
  fat: 15,
  fruit: 150,
  dairy: 250,
}

const form = reactive({
  name: '',
  category: 'protein',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
})
const saving = ref(false)
const error = ref('')

function numericValue(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

async function handleSave() {
  const name = form.name.trim()
  const values = {
    calories: numericValue(form.calories),
    protein: numericValue(form.protein),
    carbs: numericValue(form.carbs),
    fat: numericValue(form.fat),
  }

  if (!name) {
    error.value = '请输入食材名称'
    return
  }
  if (Object.values(values).some((value) => value === null)) {
    error.value = '请填写有效的每 100g 营养数据'
    return
  }

  saving.value = true
  error.value = ''
  try {
    const food = {
      id: `custom-${Date.now()}`,
      name,
      category: form.category,
      source: 'custom',
      per100g: values,
      mealFit: mealFitByCategory[form.category] || ['lunch', 'dinner'],
      tags: [FOOD_CATEGORY_LABELS[form.category]],
      defaultPortion: defaultPortionByCategory[form.category] || 100,
      unit: form.category === 'dairy' ? 'ml' : 'g',
    }

    foodStore.foods.value = [...foodStore.foods.value, food]
    await foodStore.saveFoods()

    const prefs = await loadFoodPreferences()
    const nextPrefs = await saveFoodPreferences({
      ...prefs,
      customFoods: [...(prefs.customFoods || []), food],
    })

    emit('done', { type: 'foodPreferences', data: nextPrefs })
  } catch (err) {
    console.warn('Failed to save custom food', err)
    error.value = '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="custom-food-page" @submit.prevent="handleSave">
    <div class="custom-panel">
      <label>
        <span>食材名称</span>
        <input v-model="form.name" type="text" placeholder="例如 鸡肉丸">
      </label>
      <label>
        <span>分类</span>
        <select v-model="form.category">
          <option v-for="option in FOOD_CATEGORY_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label>
        <span>热量 / 100g</span>
        <input v-model="form.calories" type="number" min="0" inputmode="decimal">
      </label>
      <label>
        <span>蛋白质 / 100g</span>
        <input v-model="form.protein" type="number" min="0" inputmode="decimal">
      </label>
      <label>
        <span>碳水 / 100g</span>
        <input v-model="form.carbs" type="number" min="0" inputmode="decimal">
      </label>
      <label>
        <span>脂肪 / 100g</span>
        <input v-model="form.fat" type="number" min="0" inputmode="decimal">
      </label>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="sub-page-actions">
      <button type="button" class="ghost-action" :disabled="saving" @click="emit('cancel')">取消</button>
      <button type="submit" class="primary-action" :disabled="saving">
        {{ saving ? '保存中...' : '保存食材' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.custom-food-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.custom-panel {
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
  .custom-panel {
    grid-template-columns: 1fr;
  }
}
</style>
