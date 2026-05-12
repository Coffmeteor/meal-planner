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

const activeCategory = ref('all')
const searchQuery = ref('')
const localPrefs = reactive({
  selectedFoodIds: [],
  customFoods: [],
  updatedAt: null,
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

const visibleFoods = computed(() => {
  const allFoods = [...DEFAULT_FOODS, ...localPrefs.customFoods]
  const foods = activeCategory.value === 'all'
    ? allFoods
    : allFoods.filter((food) => food.category === activeCategory.value)

  return [...foods].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
})
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

function isSelected(id) {
  return localPrefs.selectedFoodIds.includes(id)
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

function preferencesPayload() {
  return {
    selectedFoodIds: [...localPrefs.selectedFoodIds],
    customFoods: [...localPrefs.customFoods],
    updatedAt: localPrefs.updatedAt,
  }
}

function savePreferences() {
  emit('save', preferencesPayload())
}

function saveAndRefresh() {
  emit('save', preferencesPayload(), { refresh: true })
}

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
</script>

<template>
  <section class="food-preferences">
    <div class="section-title compact food-title">
      <div>
        <p>个人可用食材池</p>
        <h2>{{ props.mode === 'setup' ? '选择可用食材' : '我的食材' }}</h2>
      </div>
      <button v-if="showClose" type="button" class="text-action" @click="emit('close')">返回</button>
    </div>

    <div class="food-toolbar">
      <span>已选 {{ selectedCount }} 项</span>
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
                v-if="food.source !== 'custom' && !String(food.id).startsWith('custom-')"
                type="button"
                class="food-card"
                :class="{ selected: isSelected(food.id) }"
                @click="toggleFood(food.id)"
              >
                <span>
                  {{ food.name }}
                  <small class="food-card-meta">{{ categoryLabel(food) }}</small>
                </span>
                <i>{{ isSelected(food.id) ? '✓' : '' }}</i>
              </button>
              <article v-else class="food-card food-card-static selected">
                <span>
                  {{ food.name }}
                  <small class="food-card-meta">{{ categoryLabel(food) }} · 自定义</small>
                </span>
                <i>✓</i>
              </article>
            </template>
          </div>
        </section>
      </div>
      <p v-else class="empty-state">没有找到相关食材</p>
    </template>

    <template v-else>
      <div class="food-grid">
        <template
          v-for="food in visibleFoods"
          :key="food.id"
        >
          <button
            v-if="food.source !== 'custom' && !String(food.id).startsWith('custom-')"
            type="button"
            class="food-card"
            :class="{ selected: isSelected(food.id) }"
            @click="toggleFood(food.id)"
          >
            <span>{{ food.name }}</span>
            <i>{{ isSelected(food.id) ? '✓' : '' }}</i>
          </button>
          <article v-else class="food-card food-card-static selected">
            <span>
              {{ food.name }}
              <small class="food-card-meta">{{ categoryLabel(food) }} · 自定义</small>
            </span>
            <i>✓</i>
          </article>
        </template>
      </div>
    </template>

    <div class="food-actions">
      <template v-if="props.mode === 'setup'">
        <button type="button" class="ghost-action" @click="skipAll">跳过，使用全部食材</button>
        <button type="button" class="primary-action" @click="savePreferences">继续生成餐单</button>
      </template>
      <template v-else>
        <button type="button" class="ghost-action" @click="savePreferences">保存</button>
        <button type="button" class="primary-action" @click="saveAndRefresh">保存并刷新食谱</button>
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
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 900;
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
.custom-list,
.food-actions {
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
