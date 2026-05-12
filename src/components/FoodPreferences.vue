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
  mode: {
    type: String,
    default: 'manage',
  },
  showClose: {
    type: Boolean,
    default: true,
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
const searchQuery = ref('')
const localPrefs = reactive({
  selectedFoodIds: [],
  customFoods: [],
  updatedAt: null,
  preferenceLevels: {},
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
    localPrefs.preferenceLevels = prefs.preferenceLevels && typeof prefs.preferenceLevels === 'object'
      ? { ...prefs.preferenceLevels }
      : {}
  },
  { immediate: true },
)

const visibleDefaults = computed(() => {
  const defaults = activeCategory.value === 'all'
    ? DEFAULT_FOODS
    : DEFAULT_FOODS.filter((food) => food.category === activeCategory.value)
  const customs = activeCategory.value === 'all'
    ? localPrefs.customFoods
    : localPrefs.customFoods.filter((food) => food.category === activeCategory.value)

  return [...defaults, ...customs].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
})

const sortedCustomFoods = computed(() =>
  [...localPrefs.customFoods].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')),
)
const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => normalizedSearch.value.length > 0)
const searchGroups = computed(() => {
  if (!isSearching.value) return []

  const groups = new Map()
  const foods = [...DEFAULT_FOODS, ...localPrefs.customFoods]
    .filter((food) => foodMatchesSearch(food, normalizedSearch.value))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))

  for (const food of foods) {
    const category = food.category || 'protein'
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category).push(food)
  }

  return FOOD_CATEGORY_OPTIONS
    .map((option) => ({
      value: option.value,
      label: option.label,
      foods: groups.get(option.value) || [],
    }))
    .filter((group) => group.foods.length)
})
const selectedCount = computed(() =>
  localPrefs.selectedFoodIds.length + localPrefs.customFoods.length,
)
const isDirty = computed(() => {
  const currentSelected = [...localPrefs.selectedFoodIds].sort()
  const savedSelected = Array.isArray(props.foodPreferences.selectedFoodIds)
    ? [...props.foodPreferences.selectedFoodIds].sort()
    : []
  const currentCustom = [...localPrefs.customFoods].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  )
  const savedCustom = Array.isArray(props.foodPreferences.customFoods)
    ? [...props.foodPreferences.customFoods].sort((a, b) =>
      String(a.id).localeCompare(String(b.id)),
    )
    : []

  return JSON.stringify(currentSelected) !== JSON.stringify(savedSelected)
    || JSON.stringify(currentCustom) !== JSON.stringify(savedCustom)
    || JSON.stringify(localPrefs.preferenceLevels || {}) !== JSON.stringify(props.foodPreferences.preferenceLevels || {})
})

const LEVEL_LABELS = { frequent: '常吃', normal: '普通', reduce: '少吃', exclude: '不吃' }
const LEVEL_ORDER = ['normal', 'frequent', 'reduce', 'exclude']
const LEVEL_COLORS = { frequent: '#34c759', normal: '#8e8e93', reduce: '#ff9500', exclude: '#ff3b30' }

function isSelected(id) {
  return localPrefs.selectedFoodIds.includes(id)
}

function getLevel(foodId) {
  return localPrefs.preferenceLevels[foodId] || 'normal'
}

function cycleLevel(foodId) {
  const current = getLevel(foodId)
  const idx = LEVEL_ORDER.indexOf(current)
  const next = LEVEL_ORDER[(idx + 1) % LEVEL_ORDER.length]
  if (next === 'normal') {
    delete localPrefs.preferenceLevels[foodId]
  } else {
    localPrefs.preferenceLevels = { ...localPrefs.preferenceLevels, [foodId]: next }
  }
}

function categoryLabel(food) {
  return FOOD_CATEGORY_LABELS[food?.category] || food?.category || '其他'
}

function foodMatchesSearch(food, keyword) {
  const category = food?.category || ''
  const fields = [
    food?.name,
    category,
    FOOD_CATEGORY_LABELS[category],
    ...(Array.isArray(food?.tags) ? food.tags : []),
  ]

  return fields.some((field) => String(field || '').toLowerCase().includes(keyword))
}

function toggleFood(id) {
  if (isSelected(id)) {
    localPrefs.selectedFoodIds = localPrefs.selectedFoodIds.filter((foodId) => foodId !== id)
  } else {
    localPrefs.selectedFoodIds = [...localPrefs.selectedFoodIds, id]
  }
}

function selectAllFoods() {
  const allIds = DEFAULT_FOODS.map((f) => f.id)
  localPrefs.selectedFoodIds = [...new Set([...localPrefs.selectedFoodIds, ...allIds])]
}

function clearAllFoods() {
  const defaultIds = new Set(DEFAULT_FOODS.map((f) => f.id))
  localPrefs.selectedFoodIds = localPrefs.selectedFoodIds.filter(
    (id) => !defaultIds.has(id),
  )
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
  if (!confirm('删除这个自定义食材吗？')) return
  localPrefs.customFoods = localPrefs.customFoods.filter((food) => food.id !== id)
  localPrefs.selectedFoodIds = localPrefs.selectedFoodIds.filter((foodId) => foodId !== id)
}

function preferencesPayload() {
  return {
    selectedFoodIds: [...localPrefs.selectedFoodIds],
    customFoods: [...localPrefs.customFoods],
    updatedAt: localPrefs.updatedAt,
    preferenceLevels: { ...localPrefs.preferenceLevels },
  }
}

function savePreferences() {
  emit('save', preferencesPayload(), { scope: foodScope.value })
}

const foodScope = ref('save')

function clearSelection() {
  localPrefs.selectedFoodIds = []
}

function skipAll() {
  emit('save', {
    selectedFoodIds: [],
    customFoods: [],
    updatedAt: new Date().toISOString(),
  })
}

defineExpose({
  selectedCount,
  isDirty,
  savePreferences,
})
</script>

<template>
  <section class="food-preferences">
    <div class="section-title compact food-title">
      <div>
        <p>个人可用食材池</p>
        <h2>{{ props.mode === 'setup' ? '选择可用食材' : '我的食材' }}</h2>
      </div>
      <span v-if="isDirty" class="dirty-indicator">未保存更改</span>
      <button v-if="showClose" type="button" class="text-action" @click="emit('close')">返回</button>
    </div>

    <div class="food-toolbar">
      <span>
        已选 {{ selectedCount }} 项
        <em v-if="isDirty">未保存更改</em>
      </span>
      <button type="button" class="text-action" @click="clearSelection">清空勾选</button>
    </div>
    <p v-if="selectedCount === 0" class="empty-state">
      当前没有选择食材；生成或刷新餐单时将使用默认全部食材。
    </p>

    <label class="food-search">
      <input v-model="searchQuery" class="food-search-input" type="search" placeholder="搜索食材" />
    </label>

    <div class="food-batch-tools">
      <button type="button" class="food-batch-btn" @click="selectAllFoods">全选</button>
      <button type="button" class="food-batch-btn" @click="clearAllFoods">取消全选</button>
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

    <template v-if="isSearching">
      <div v-if="searchGroups.length" class="food-search-groups">
        <section v-for="group in searchGroups" :key="group.value" class="food-category-group">
          <h3 class="food-category-heading">{{ group.label }}</h3>
          <div class="food-grid">
            <template v-for="food in group.foods" :key="food.id">
              <button
                type="button"
                class="food-card"
                :class="{ selected: isSelected(food.id) }"
                @click="toggleFood(food.id)"
              >
                <span>
                  {{ food.name }}
                  <small class="food-card-meta">{{ categoryLabel(food) }}{{ food.source === 'custom' || String(food.id).startsWith('custom-') ? ' · 自定义' : '' }}</small>
                </span>
                <span class="food-card-actions">
                  <span
                    v-if="isSelected(food.id)"
                    class="level-badge"
                    :style="{ background: LEVEL_COLORS[getLevel(food.id)] + '18', color: LEVEL_COLORS[getLevel(food.id)] }"
                    @click.stop="cycleLevel(food.id)"
                  >{{ LEVEL_LABELS[getLevel(food.id)] }}</span>
                  <i>{{ isSelected(food.id) ? '✓' : '' }}</i>
                </span>
              </button>
            </template>
          </div>
        </section>
      </div>
      <p v-else class="empty-state">没有找到相关食材</p>
    </template>

    <template v-else>
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
          <span class="food-card-actions">
            <span
              v-if="isSelected(food.id)"
              class="level-badge"
              :style="{ background: LEVEL_COLORS[getLevel(food.id)] + '18', color: LEVEL_COLORS[getLevel(food.id)] }"
              @click.stop="cycleLevel(food.id)"
            >{{ LEVEL_LABELS[getLevel(food.id)] }}</span>
            <i>{{ isSelected(food.id) ? '✓' : '' }}</i>
          </span>
        </button>
      </div>
    </template>

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

      <div v-if="!isSearching && sortedCustomFoods.length" class="custom-list">
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

    <div class="food-actions">
      <span class="food-actions-count">
        已选 {{ selectedCount }} 项
        <em v-if="isDirty">未保存更改</em>
      </span>
      <template v-if="props.mode === 'setup'">
        <button type="button" class="ghost-action" @click="skipAll">跳过，使用全部食材</button>
        <button type="button" class="primary-action" @click="savePreferences">继续生成餐单</button>
      </template>
      <template v-else>
        <div v-if="props.mode !== 'setup'" class="field-group" style="padding:0 0.5rem">
          <span class="field-label" style="font-size:0.78rem;color:var(--color-muted)">应用范围</span>
          <div class="segmented three-wide">
            <button type="button" :class="{ active: foodScope === 'save' }" @click="foodScope = 'save'">仅保存</button>
            <button type="button" :class="{ active: foodScope === 'today' }" @click="foodScope = 'today'">应用到今日</button>
            <button type="button" :class="{ active: foodScope === 'future' }" @click="foodScope = 'future'">应用到后续</button>
          </div>
        </div>
        <button type="button" class="primary-action" @click="savePreferences">保存</button>
      </template>
    </div>
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
  flex-wrap: wrap;
}

.food-title > div {
  min-width: 0;
}

.dirty-indicator {
  min-height: 1.75rem;
  display: inline-flex;
  align-items: center;
  padding: 0 0.6rem;
  border-radius: 999rem;
  color: #8a5a00;
  background: #fff0d8;
  font-size: 0.76rem;
  font-weight: 900;
}

.food-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.8rem;
  background: rgba(255, 254, 251, 0.86);
}

.food-toolbar span {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 900;
}

.food-toolbar em,
.food-actions-count em {
  color: #8a5a00;
  font-style: normal;
}

.food-toolbar .text-action {
  min-height: 2rem;
  padding: 0 0.65rem;
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

.empty-state {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  background: #fff8ef;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.5;
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
  border-color: var(--color-primary);
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
  border-color: var(--color-primary);
  background: #edf7ed;
  color: var(--green-deep);
}

.food-card i {
  width: 1.25rem;
  height: 1.25rem;
  flex: 0 0 auto;
  border: 1px solid var(--color-primary-border);
  border-radius: 50%;
  color: var(--green-deep);
  font-style: normal;
  line-height: 1.15rem;
  text-align: center;
}

.food-card-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
}

.level-badge {
  min-height: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999rem;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.4rem;
  cursor: pointer;
  white-space: nowrap;
}

.custom-section,
.custom-form,
.custom-list,
.food-actions {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.food-actions-count {
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 900;
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
