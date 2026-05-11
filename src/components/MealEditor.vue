<script setup>
import { computed, ref, watch } from 'vue'
import { formatTime } from '../utils/helpers.js'
import { normalizeEditedMeal } from '../utils/mealDisplay.js'

const props = defineProps({
  meal: {
    type: Object,
    required: true,
  },
  dayIndex: {
    type: Number,
    required: true,
  },
  mealIndex: {
    type: Number,
    required: true,
  },
  mealTargetCalories: {
    type: Number,
    default: 0,
  },
  availableFoods: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['saveMeal', 'cancelEdit'])

const categoryLabels = {
  protein: '蛋白质',
  carb: '主食',
  vegetable: '蔬菜',
  fruit: '水果',
  dairy: '乳制品',
  fat: '脂肪',
  condiment: '调味',
  snack: '零食',
}
const categoryOrder = ['protein', 'carb', 'vegetable', 'fruit', 'dairy', 'fat', 'condiment', 'snack']

const localFoods = ref([])
const pickerMode = ref(null)
const replaceIndex = ref(null)
const pickerCategory = ref(null)

const normalizedAvailableFoods = computed(() =>
  props.availableFoods.map((food) => normalizeFood(food)).filter((food) => food.name),
)
const groupedFoods = computed(() => {
  const filtered = pickerCategory.value
    ? normalizedAvailableFoods.value.filter((food) => food.category === pickerCategory.value)
    : normalizedAvailableFoods.value

  return categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category] || category,
      foods: filtered.filter((food) => food.category === category),
    }))
    .filter((group) => group.foods.length)
})
const pickerOpen = computed(() => Boolean(pickerMode.value))
const pickerTitle = computed(() =>
  pickerMode.value === 'replace'
    ? `替换${categoryLabels[pickerCategory.value] || '食材'}`
    : '添加食材',
)
const mealTotals = computed(() =>
  localFoods.value.reduce(
    (total, food) => ({
      calories: total.calories + Number(food.calories || 0),
      protein: total.protein + Number(food.protein || 0),
      carbs: total.carbs + Number(food.carbs || 0),
      fat: total.fat + Number(food.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  ),
)
const roundedTotals = computed(() => ({
  calories: Math.round(mealTotals.value.calories),
  protein: Math.round(mealTotals.value.protein),
  carbs: Math.round(mealTotals.value.carbs),
  fat: Math.round(mealTotals.value.fat),
}))
const calorieDeviation = computed(() =>
  Math.round(roundedTotals.value.calories - Number(props.mealTargetCalories || 0)),
)
const deviationText = computed(() => {
  const abs = Math.abs(calorieDeviation.value)
  if (abs <= 50) return '接近目标'
  if (abs >= 100) return '偏离较多'
  return '稍有偏差'
})
const deviationClass = computed(() => ({
  close: Math.abs(calorieDeviation.value) <= 50,
  far: Math.abs(calorieDeviation.value) >= 100,
}))

watch(
  () => props.meal,
  (meal) => {
    localFoods.value = getMealFoods(meal).map((food) => normalizeFood(food))
  },
  { immediate: true },
)

function getMealFoods(meal) {
  if (Array.isArray(meal?.foods) && meal.foods.length) return meal.foods
  if (Array.isArray(meal?.items) && meal.items.length) return meal.items
  return []
}

function normalizeFood(food) {
  const portion = positiveNumber(food?.portion, food?.defaultPortion, 100)
  const per100g = normalizePer100g(food, portion)
  return scaleFood(
    {
      ...food,
      category: food?.category || 'snack',
      unit: food?.unit || 'g',
      per100g,
    },
    portion,
  )
}

function normalizePer100g(food, portion) {
  if (food?.per100g) {
    return {
      calories: Number(food.per100g.calories || 0),
      protein: Number(food.per100g.protein || 0),
      carbs: Number(food.per100g.carbs || 0),
      fat: Number(food.per100g.fat || 0),
    }
  }

  const ratio = portion > 0 ? 100 / portion : 1
  return {
    calories: Number(food?.calories || 0) * ratio,
    protein: Number(food?.protein || 0) * ratio,
    carbs: Number(food?.carbs || 0) * ratio,
    fat: Number(food?.fat || 0) * ratio,
  }
}

function positiveNumber(...values) {
  for (const value of values) {
    const number = Number(value)
    if (Number.isFinite(number) && number > 0) return number
  }
  return 0
}

function scaleFood(food, portion) {
  const safePortion = Math.max(0, Number(portion) || 0)
  const ratio = safePortion / 100
  return {
    ...food,
    portion: safePortion,
    calories: Math.round(Number(food.per100g?.calories || 0) * ratio),
    protein: roundMacro(Number(food.per100g?.protein || 0) * ratio),
    carbs: roundMacro(Number(food.per100g?.carbs || 0) * ratio),
    fat: roundMacro(Number(food.per100g?.fat || 0) * ratio),
  }
}

function roundMacro(value) {
  return Math.round(value * 10) / 10
}

function isNutOrButter(food) {
  const text = `${food?.name || ''} ${(food?.tags || []).join(' ')}`
  return /坚果|花生|杏仁|腰果|核桃|芝麻酱|花生酱/.test(text)
}

function isOilOrFat(food) {
  if (isNutOrButter(food)) return false
  return food?.category === 'fat' && /油|黄油|酱/.test(food?.name || '')
}

function roundPortionForFood(food, value, mode = 'nearest') {
  const number = Math.max(0, Number(value) || 0)
  if (isOilOrFat(food)) return Math.round(number)
  const step = 5
  if (food?.category === 'vegetable' || mode === 'floor') return Math.floor(number / step) * step
  return Math.round(number / step) * step
}

function defaultPortionFor(food) {
  if (food.category === 'fat') return isNutOrButter(food) ? 20 : 10
  if (food.category === 'dairy') return 200
  if (food.category === 'vegetable') return 100
  if (['protein', 'carb', 'fruit'].includes(food.category)) return 100
  return roundPortionForFood(food, food.defaultPortion || 100)
}

function updatePortion(index, value) {
  const food = localFoods.value[index]
  if (!food) return
  if (value === '' || value === undefined || value === null) return
  const cleaned = String(value).replace(/^0+(?=\d)/, '')
  const num = parseFloat(cleaned)
  if (isNaN(num) || num <= 0) return
  const portion = roundPortionForFood(food, cleaned)
  localFoods.value[index] = scaleFood(food, portion)
}

function blurPortion(index, value) {
  const food = localFoods.value[index]
  if (!food) return
  const num = parseFloat(value)
  if (isNaN(num) || num <= 0 || value === '' || value === undefined || value === null) {
    localFoods.value[index] = scaleFood(food, defaultPortionFor(food))
  }
}

function removeFood(index) {
  localFoods.value.splice(index, 1)
}

function openAddPicker() {
  pickerMode.value = 'add'
  replaceIndex.value = null
  pickerCategory.value = null
}

function openReplacePicker(index) {
  const food = localFoods.value[index]
  if (!food) return

  pickerMode.value = 'replace'
  replaceIndex.value = index
  pickerCategory.value = food.category
}

function closePicker() {
  pickerMode.value = null
  replaceIndex.value = null
  pickerCategory.value = null
}

function pickFood(food) {
  if (pickerMode.value === 'replace' && replaceIndex.value !== null) {
    const oldFood = localFoods.value[replaceIndex.value]
    const targetCalories = Number(oldFood?.calories || 0)
    const caloriesPer100g = Number(food.per100g?.calories || 0)
    const rawPortion = caloriesPer100g > 0
      ? (targetCalories / caloriesPer100g) * 100
      : defaultPortionFor(food)
    const portion = Math.max(1, roundPortionForFood(food, rawPortion))
    localFoods.value[replaceIndex.value] = scaleFood(food, portion)
  } else {
    const portion = defaultPortionFor(food)
    localFoods.value.push(scaleFood(food, portion))
  }

  closePicker()
}

function handleSave() {
  const normalizedMeal = normalizeEditedMeal(props.meal, localFoods.value)
  emit('saveMeal', {
    dayIndex: props.dayIndex,
    mealIndex: props.mealIndex,
    foods: normalizedMeal.foods,
    meal: normalizedMeal,
  })
}
</script>

<template>
  <section class="meal-editor">
    <div class="meal-editor-head">
      <button type="button" class="meal-editor-back" @click="emit('cancelEdit')">返回</button>
      <div>
        <span>{{ formatTime(meal.time) }}</span>
        <h2>{{ meal.name }}</h2>
      </div>
    </div>

    <div class="meal-editor-summary panel">
      <div class="calorie-line">
        <span>目标: {{ Math.round(mealTargetCalories) }} kcal</span>
        <span>当前: {{ roundedTotals.calories }} kcal</span>
        <strong class="deviation-badge" :class="deviationClass">
          {{ calorieDeviation > 0 ? '+' : '' }}{{ calorieDeviation }} kcal · {{ deviationText }}
        </strong>
      </div>
      <div class="macro-strip">
        <span>蛋白 {{ roundedTotals.protein }}g</span>
        <span>碳水 {{ roundedTotals.carbs }}g</span>
        <span>脂肪 {{ roundedTotals.fat }}g</span>
      </div>
    </div>

    <div class="meal-editor-foods">
      <div
        v-for="(food, index) in localFoods"
        :key="`${food.name}-${index}`"
        class="food-edit-row"
      >
        <div class="food-edit-main">
          <strong>{{ food.name }}</strong>
          <span>{{ categoryLabels[food.category] || food.category }}</span>
        </div>
        <label class="gram-field">
          <input
            type="number"
            inputmode="decimal"
            min="0"
            :step="isOilOrFat(food) ? 1 : 5"
            :value="food.portion"
            @input="updatePortion(index, $event.target.value)"
            @blur="blurPortion(index, $event.target.value)"
          >
          <span>g</span>
        </label>
        <em>{{ Math.round(food.calories) }} kcal</em>
        <div class="food-row-actions">
          <button type="button" class="meal-action-btn" @click="openReplacePicker(index)">替换</button>
          <button type="button" class="meal-action-btn danger" @click="removeFood(index)">删除</button>
        </div>
      </div>
      <button type="button" class="ghost-action full-width" @click="openAddPicker">
        添加食材
      </button>
    </div>

    <div class="meal-editor-actions">
      <button type="button" class="ghost-action" @click="emit('cancelEdit')">放弃</button>
      <button type="button" class="primary-action" @click="handleSave">保存</button>
    </div>

    <div v-if="pickerOpen" class="meal-picker-backdrop" @click.self="closePicker">
      <div class="meal-picker">
        <div class="meal-picker-head">
          <strong>{{ pickerTitle }}</strong>
          <button type="button" class="meal-editor-back" @click="closePicker">关闭</button>
        </div>
        <div v-if="groupedFoods.length" class="food-picker-groups">
          <section v-for="group in groupedFoods" :key="group.category" class="food-picker-group">
            <h3>{{ group.label }}</h3>
            <div
              v-for="food in group.foods"
              :key="food.id || food.name"
              class="food-picker-row"
            >
              <div>
                <strong>{{ food.name }}</strong>
                <span>{{ Math.round(food.per100g.calories) }} kcal / 100g</span>
              </div>
              <button type="button" class="meal-action-btn" @click="pickFood(food)">添加</button>
            </div>
          </section>
        </div>
        <p v-else class="picker-empty">没有可选食材</p>
      </div>
    </div>
  </section>
</template>
