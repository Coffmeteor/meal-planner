<script setup>
import { computed, ref, watch } from 'vue'
import {
  FOOD_CATEGORY_LABELS,
  FOOD_CATEGORY_OPTIONS,
} from '../utils/foodMeta.js'
import { formatDate } from '../utils/helpers.js'
import { mealFoods } from '../utils/mealDisplay.js'

const props = defineProps({
  day: {
    type: Object,
    required: true,
  },
  dayIndex: {
    type: Number,
    required: true,
  },
  availableFoods: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['save', 'cancel'])

const tabs = [
  { value: 'all', label: FOOD_CATEGORY_LABELS.all },
  ...FOOD_CATEGORY_OPTIONS,
]
const activeCategory = ref('all')
const selectedFoodIds = ref([])
const searchQuery = ref('')

const foodPool = computed(() => {
  const byId = new Map()
  for (const food of props.availableFoods) {
    const normalized = normalizeFood(food)
    if (normalized.id) byId.set(normalized.id, normalized)
  }
  for (const meal of props.day?.meals || []) {
    for (const food of mealFoods(meal)) {
      const normalized = normalizeFood(food)
      if (normalized.id && !byId.has(normalized.id)) byId.set(normalized.id, normalized)
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
})
const visibleFoods = computed(() =>
  activeCategory.value === 'all'
    ? foodPool.value
    : foodPool.value.filter((food) => food.category === activeCategory.value),
)
const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase())
const isSearching = computed(() => normalizedSearch.value.length > 0)
const searchGroups = computed(() => {
  if (!isSearching.value) return []

  const groups = new Map()
  const foods = foodPool.value.filter((food) => foodMatchesSearch(food, normalizedSearch.value))
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
const selectedCount = computed(() => selectedFoodIds.value.length)

watch(
  () => props.day,
  (day) => {
    const existing = day?.dayFoodPool?.selectedFoodIds
    selectedFoodIds.value = Array.isArray(existing) && existing.length
      ? [...existing]
      : usedFoodIds(day)
  },
  { immediate: true },
)

function normalizeFood(food) {
  return {
    ...food,
    name: food?.name || '未命名食材',
    id: food?.id || `food-${food?.name || 'unknown'}`,
    category: food?.category || 'snack',
    unit: food?.unit || 'g',
  }
}

function usedFoodIds(day) {
  const ids = new Set()
  for (const meal of day?.meals || []) {
    for (const food of mealFoods(meal)) {
      const id = food?.id || (food?.name ? `food-${food.name}` : null)
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

function isSelected(foodId) {
  return selectedFoodIds.value.includes(foodId)
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

function toggleFood(foodId) {
  selectedFoodIds.value = isSelected(foodId)
    ? selectedFoodIds.value.filter((id) => id !== foodId)
    : [...selectedFoodIds.value, foodId]
}

function selectCurrent() {
  selectedFoodIds.value = usedFoodIds(props.day)
}

function selectAll() {
  selectedFoodIds.value = foodPool.value.map((food) => food.id)
}

function handleSave() {
  if (!selectedFoodIds.value.length) {
    alert('请至少选择一种当天可用食材。')
    return
  }
  if (!confirm('将重新分配当天未锁定餐，已锁定/已编辑餐会保留。')) return

  emit('save', {
    dayIndex: props.dayIndex,
    selectedFoodIds: [...selectedFoodIds.value],
  })
}
</script>

<template>
  <section class="day-food-editor">
    <div class="section-title compact food-title">
      <div>
        <p>{{ formatDate(day.date) }}</p>
        <h2>编辑当天食材</h2>
      </div>
      <button type="button" class="text-action" @click="emit('cancel')">返回</button>
    </div>

    <div class="day-food-toolbar">
      <span>已选 {{ selectedCount }} 项</span>
      <div>
        <button type="button" class="text-action" @click="selectCurrent">当天已用</button>
        <button type="button" class="text-action" @click="selectAll">全选</button>
      </div>
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

    <label class="food-search">
      <input v-model="searchQuery" class="food-search-input" type="search" placeholder="搜索食材" />
    </label>

    <template v-if="isSearching">
      <div v-if="searchGroups.length" class="food-search-groups">
        <section v-for="group in searchGroups" :key="group.value" class="food-category-group">
          <h3 class="food-category-heading">{{ group.label }}</h3>
          <div class="food-grid">
            <button
              v-for="food in group.foods"
              :key="food.id"
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
          </div>
        </section>
      </div>
      <p v-else class="empty-state">没有找到相关食材</p>
    </template>

    <template v-else>
      <div class="food-grid">
        <button
          v-for="food in visibleFoods"
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
    </template>

    <p v-if="!isSearching && !foodPool.length" class="empty-state">
      暂无可选食材。
    </p>

    <div class="day-food-actions">
      <button type="button" class="ghost-action" @click="emit('cancel')">取消</button>
      <button type="button" class="primary-action" :disabled="!selectedCount" @click="handleSave">
        确认并刷新当天
      </button>
    </div>
  </section>
</template>
