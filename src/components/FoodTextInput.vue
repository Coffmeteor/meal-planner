<script setup>
import { computed, ref } from 'vue'
import { localTextParser } from '../adapters/recognitionAdapter.js'
import { mealFoods, normalizeEditedMeal } from '../utils/mealDisplay.js'

const props = defineProps({
  dayIndex: {
    type: Number,
    required: true,
  },
  mealIndex: {
    type: Number,
    required: true,
  },
  mealData: {
    type: Object,
    required: true,
  },
  availableFoods: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['done', 'cancel'])

const text = ref('')
const parsedItems = ref([])
const parseError = ref('')
const hasParsed = computed(() => parsedItems.value.length > 0)

const confidenceLabels = {
  high: '高',
  medium: '中',
  low: '低',
}

function parseInput() {
  parseError.value = ''
  const items = localTextParser(text.value).map((item, index) => ({
    ...item,
    key: `${item.foodName}-${index}-${Date.now()}`,
    estimatedGrams: Math.max(1, Math.round(Number(item.estimatedGrams || 100))),
  }))

  if (!items.length) {
    parseError.value = '没有识别到食材，请换一种写法。'
    return
  }

  parsedItems.value = items
}

function resetInput() {
  parsedItems.value = []
  parseError.value = ''
}

function updateGrams(index, value) {
  const grams = Number(value)
  if (!Number.isFinite(grams) || grams <= 0) return
  parsedItems.value[index] = {
    ...parsedItems.value[index],
    estimatedGrams: Math.round(grams),
  }
}

function removeItem(index) {
  parsedItems.value.splice(index, 1)
}

function confirmAdd() {
  if (!parsedItems.value.length) return

  const additions = parsedItems.value.map((item, index) =>
    buildMealFood(resolveFood(item), item, index),
  )
  const foods = [...mealFoods(props.mealData), ...additions]
  const meal = normalizeEditedMeal(props.mealData, foods, { editSource: 'localTextParser' })

  emit('done', {
    type: 'mealFoods',
    dayIndex: props.dayIndex,
    mealIndex: props.mealIndex,
    foods: meal.foods,
    meal,
  })
}

function resolveFood(item) {
  const foods = Array.isArray(props.availableFoods) ? props.availableFoods : []
  const byId = item.foodId
    ? foods.find((food) => String(food.id) === String(item.foodId))
    : null
  if (byId) return byId

  const name = String(item.foodName || '')
  return foods.find((food) => {
    const foodName = String(food?.name || '')
    return foodName === name || foodName.includes(name) || name.includes(foodName)
  }) || null
}

function buildMealFood(food, item, index) {
  const portion = Math.max(1, Math.round(Number(item.estimatedGrams || 100)))
  if (food) {
    return {
      ...food,
      portion,
      grams: portion,
      unit: 'g',
    }
  }

  return {
    id: `text-food-${Date.now()}-${index}`,
    foodId: null,
    name: item.foodName,
    category: 'snack',
    unit: 'g',
    portion,
    grams: portion,
    per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    source: 'localTextParser',
  }
}
</script>

<template>
  <section class="food-text-input">
    <div v-if="!hasParsed" class="card food-text-card">
      <label class="food-text-label" for="food-textarea">文本内容</label>
      <textarea
        id="food-textarea"
        v-model="text"
        class="food-textarea"
        rows="6"
        placeholder="例如：鸡蛋2个，米饭一碗，牛奶一杯"
      ></textarea>
      <p v-if="parseError" class="food-text-error">{{ parseError }}</p>
      <button type="button" class="btn-primary" :disabled="!text.trim()" @click="parseInput">
        解析
      </button>
    </div>

    <template v-else>
      <div class="card">
        <div class="card-title-row">
          <div>
            <span class="card-kicker">解析结果</span>
            <h2>确认食材和克数</h2>
          </div>
          <button type="button" class="text-action" @click="resetInput">重新输入</button>
        </div>

        <div class="parsed-food-list">
          <div
            v-for="(item, index) in parsedItems"
            :key="item.key"
            class="parsed-food-row"
          >
            <div class="parsed-food-main">
              <strong>{{ item.foodName }}</strong>
              <span class="confidence-badge" :class="item.confidence">
                {{ confidenceLabels[item.confidence] || '低' }}
              </span>
            </div>
            <label class="gram-field parsed-gram-field">
              <input
                type="number"
                inputmode="decimal"
                min="1"
                step="5"
                :value="item.estimatedGrams"
                @input="updateGrams(index, $event.target.value)"
              >
              <span>g</span>
            </label>
            <button type="button" class="meal-action-btn danger" @click="removeItem(index)">
              删除
            </button>
          </div>
        </div>

        <p v-if="!parsedItems.length" class="empty-state-text">没有待添加的食材。</p>
      </div>

      <div class="food-text-actions">
        <button type="button" class="btn-secondary" @click="emit('cancel')">取消</button>
        <button type="button" class="btn-primary" :disabled="!parsedItems.length" @click="confirmAdd">
          确认添加
        </button>
      </div>
    </template>

    <button v-if="!hasParsed" type="button" class="btn-secondary" @click="emit('cancel')">
      取消
    </button>
  </section>
</template>
