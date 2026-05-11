<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  DEFAULT_FOODS,
  FOOD_CATEGORY_LABELS,
  FOOD_CATEGORY_OPTIONS,
} from '../utils/foodMeta.js'

const props = defineProps({
  foodPreferences: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['save', 'close'])

const tabs = [
  { value: 'all', label: FOOD_CATEGORY_LABELS.all },
  ...FOOD_CATEGORY_OPTIONS,
]
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

const activeCategory = ref('all')
const showForm = ref(false)
const error = ref('')
const localPrefs = reactive({
  selectedFoodIds: [],
  customFoods: [],
  updatedAt: null,
})
const form = reactive({
  name: '',
  category: 'protein',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
})

watch(
  () => props.foodPreferences,
  (prefs) => {
    localPrefs.selectedFoodIds = Array.isArray(prefs.selectedFoodIds)
      ? [...prefs.selectedFoodIds]
      : []
    localPrefs.customFoods = Array.isArray(prefs.customFoods) ? [...prefs.customFoods] : []
    localPrefs.updatedAt = prefs.updatedAt ?? null
  },
  { immediate: true },
)

const visibleDefaults = computed(() => {
  const foods = activeCategory.value === 'all'
    ? DEFAULT_FOODS
    : DEFAULT_FOODS.filter((food) => food.category === activeCategory.value)

  return [...foods].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
})

const sortedCustomFoods = computed(() =>
  [...localPrefs.customFoods].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
)

function isSelected(id) {
  return localPrefs.selectedFoodIds.includes(id)
}

function toggleFood(id) {
  if (isSelected(id)) {
    localPrefs.selectedFoodIds = localPrefs.selectedFoodIds.filter((foodId) => foodId !== id)
  } else {
    localPrefs.selectedFoodIds = [...localPrefs.selectedFoodIds, id]
  }
}

function categoryAverages(category) {
  const foods = DEFAULT_FOODS.filter((food) => food.category === category)
  const totals = foods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.per100g.calories,
      protein: sum.protein + food.per100g.protein,
      carbs: sum.carbs + food.per100g.carbs,
      fat: sum.fat + food.per100g.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const count = Math.max(foods.length, 1)

  return {
    calories: Math.round(totals.calories / count),
    protein: Number((totals.protein / count).toFixed(1)),
    carbs: Number((totals.carbs / count).toFixed(1)),
    fat: Number((totals.fat / count).toFixed(1)),
  }
}

function numericValue(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function resetForm() {
  form.name = ''
  form.category = 'protein'
  form.calories = ''
  form.protein = ''
  form.carbs = ''
  form.fat = ''
  error.value = ''
}

function addCustomFood() {
  const name = form.name.trim()
  if (!name) {
    error.value = '请输入食材名称'
    return
  }
  if (!form.category) {
    error.value = '请选择分类'
    return
  }

  const values = {
    calories: numericValue(form.calories),
    protein: numericValue(form.protein),
    carbs: numericValue(form.carbs),
    fat: numericValue(form.fat),
  }
  const averages = categoryAverages(form.category)
  const isComplete = Object.values(values).every((value) => value !== null)
  const per100g = {
    calories: values.calories ?? averages.calories,
    protein: values.protein ?? averages.protein,
    carbs: values.carbs ?? averages.carbs,
    fat: values.fat ?? averages.fat,
  }

  localPrefs.customFoods = [
    ...localPrefs.customFoods,
    {
      id: `custom-${Date.now()}`,
      name,
      category: form.category,
      source: isComplete ? 'custom' : 'estimated',
      per100g,
      mealFit: mealFitByCategory[form.category] || ['lunch', 'dinner'],
      tags: [FOOD_CATEGORY_LABELS[form.category]],
      defaultPortion: defaultPortionByCategory[form.category] || 100,
      unit: form.category === 'dairy' ? 'ml' : 'g',
    },
  ]
  showForm.value = false
  resetForm()
}

function deleteCustomFood(id) {
  localPrefs.customFoods = localPrefs.customFoods.filter((food) => food.id !== id)
}

function savePreferences() {
  emit('save', {
    selectedFoodIds: [...localPrefs.selectedFoodIds],
    customFoods: [...localPrefs.customFoods],
    updatedAt: localPrefs.updatedAt,
  })
}
</script>

<template>
  <section class="food-preferences">
    <div class="section-title compact food-title">
      <div>
        <p>个人可用食材池</p>
        <h2>我的食材</h2>
      </div>
      <button type="button" class="text-action" @click="emit('close')">返回</button>
    </div>

    <div class="food-tabs" aria-label="食材分类">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        :class="{ active: activeCategory === tab.value }"
        @click="activeCategory = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="food-grid">
      <button
        v-for="food in visibleDefaults"
        :key="food.id"
        type="button"
        class="food-card"
        :class="{ selected: isSelected(food.id) }"
        @click="toggleFood(food.id)"
      >
        <span>{{ food.name }}</span>
        <i>{{ isSelected(food.id) ? '✓' : '' }}</i>
      </button>
    </div>

    <div class="custom-section">
      <button type="button" class="ghost-action" @click="showForm = !showForm">
        + 新增自定义食材
      </button>

      <div v-if="showForm" class="custom-form">
        <label>
          <span>名称</span>
          <input v-model="form.name" type="text" placeholder="例如 鸡肉丸" />
        </label>
        <label>
          <span>分类</span>
          <select v-model="form.category">
            <option
              v-for="option in FOOD_CATEGORY_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <div class="macro-inputs">
          <label>
            <span>热量</span>
            <input v-model="form.calories" type="number" min="0" inputmode="decimal" />
          </label>
          <label>
            <span>蛋白</span>
            <input v-model="form.protein" type="number" min="0" inputmode="decimal" />
          </label>
          <label>
            <span>碳水</span>
            <input v-model="form.carbs" type="number" min="0" inputmode="decimal" />
          </label>
          <label>
            <span>脂肪</span>
            <input v-model="form.fat" type="number" min="0" inputmode="decimal" />
          </label>
        </div>
        <p class="form-hint">不填完整将用同类平均值估算</p>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button type="button" class="primary-action" @click="addCustomFood">保存</button>
      </div>

      <div v-if="sortedCustomFoods.length" class="custom-list">
        <article v-for="food in sortedCustomFoods" :key="food.id" class="custom-food">
          <div>
            <strong>{{ food.name }}</strong>
            <span>
              {{ FOOD_CATEGORY_LABELS[food.category] }}
              <em v-if="food.source === 'estimated'">估算</em>
            </span>
            <small v-if="food.source === 'estimated'">
              该食材营养为估算值，仅用于粗略规划
            </small>
          </div>
          <button type="button" @click="deleteCustomFood(food.id)">删除</button>
        </article>
      </div>
    </div>

    <button type="button" class="primary-action" @click="savePreferences">保存并返回</button>
  </section>
</template>

<style scoped>
.food-preferences {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.food-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.text-action {
  flex: 0 0 auto;
  min-height: 2.25rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  color: var(--green-deep);
  background: rgba(255, 255, 255, 0.72);
  font-weight: 900;
}

.food-tabs {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
  scrollbar-width: none;
}

.food-tabs::-webkit-scrollbar {
  display: none;
}

.food-tabs button {
  flex: 0 0 auto;
  min-height: 2.35rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  border-radius: 999rem;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.72);
  font-size: 0.85rem;
  font-weight: 900;
}

.food-tabs button.active {
  border-color: rgba(91, 166, 111, 0.55);
  color: #fff;
  background: var(--green);
}

.food-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.food-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-height: 3rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  color: var(--text);
  background: rgba(255, 254, 251, 0.86);
  font-weight: 900;
  text-align: left;
}

.food-card.selected {
  border-color: rgba(91, 166, 111, 0.65);
  background: #edf7ed;
  color: var(--green-deep);
}

.food-card i {
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 auto;
  border: 1px solid rgba(91, 166, 111, 0.45);
  border-radius: 50%;
  color: var(--green-deep);
  font-style: normal;
  line-height: 1.15rem;
  text-align: center;
}

.custom-section,
.custom-form,
.custom-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.custom-form {
  padding: 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: #fffaf1;
}

.custom-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 800;
}

.custom-form input,
.custom-form select {
  min-height: 2.5rem;
  padding: 0 0.7rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: #fffdf7;
  color: var(--text);
  font-size: 1rem;
  font-weight: 800;
}

.macro-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.form-hint,
.form-error {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.35;
}

.form-hint {
  color: var(--muted);
}

.form-error {
  color: #c0392b;
}

.custom-food {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  background: rgba(255, 254, 251, 0.88);
}

.custom-food div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.custom-food strong {
  color: var(--text);
  font-size: 0.95rem;
}

.custom-food span,
.custom-food small {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.custom-food em {
  margin-left: 0.35rem;
  padding: 0.08rem 0.4rem;
  border-radius: 999rem;
  color: var(--green-deep);
  background: #edf7ed;
  font-style: normal;
}

.custom-food button {
  align-self: center;
  flex: 0 0 auto;
  min-height: 2rem;
  padding: 0 0.65rem;
  border-radius: 0.65rem;
  color: #a33a2a;
  background: #fff0d8;
  font-weight: 900;
}
</style>
