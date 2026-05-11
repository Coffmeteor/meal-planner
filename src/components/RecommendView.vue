<script setup>
import { computed, ref, watch } from 'vue'
import {
  calculateMacrosV2,
  calculateTargetCaloriesV2,
  calculateTdee,
} from '../utils/calc.js'
import { formatCalories, formatMacro } from '../utils/helpers.js'
import { generateScheduleFromProfile } from '../utils/planGenerator.js'

const props = defineProps({
  profile: {
    type: Object,
    required: true,
  },
  dietSuggestion: {
    type: Object,
    required: true,
  },
  deficitSuggestion: {
    type: Object,
    required: true,
  },
  scheduleSuggestion: {
    type: Object,
    required: true,
  },
  macroTargets: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['accept'])

const methodOptions = [
  { value: 'threeMeals', label: '正常三餐' },
  { value: 'threeMealsPlusSnack', label: '三餐+加餐' },
  { value: '14:10', label: '14:10' },
  { value: '16:8', label: '16:8' },
]

const showMethods = ref(false)
const selectedMethod = ref(props.dietSuggestion.method)
const selectedDeficit = ref(props.deficitSuggestion.recommended)

watch(
  () => props.dietSuggestion.method,
  (method) => {
    selectedMethod.value = method
  },
)

watch(
  () => props.deficitSuggestion.recommended,
  (deficit) => {
    selectedDeficit.value = deficit
  },
)

const tdee = computed(() => calculateTdee(props.profile))
const targetCalories = computed(() =>
  calculateTargetCaloriesV2(tdee.value, selectedDeficit.value, props.profile.gender),
)
const deficitCalories = computed(() => Math.round(tdee.value - targetCalories.value))
const schedule = computed(() => generateScheduleFromProfile(props.profile, selectedMethod.value))
const macros = computed(
  () =>
    calculateMacrosV2(props.profile, targetCalories.value, selectedDeficit.value) ||
    props.macroTargets,
)
const methodLabel = computed(
  () => methodOptions.find((item) => item.value === selectedMethod.value)?.label ?? selectedMethod.value,
)
const deficitWarning = computed(() =>
  selectedDeficit.value === 0.2 ? props.deficitSuggestion.warning : null,
)
const proteinNote = computed(() => (props.profile.hasStrength ? '1.8g/kg' : '1.5g/kg'))

function acceptRecommendation() {
  emit('accept', {
    dietMethod: selectedMethod.value,
    deficitPercent: selectedDeficit.value,
    macros: macros.value,
    schedule: schedule.value,
  })
}
</script>

<template>
  <section class="recommend-stack">
    <article class="panel recommend-card">
      <div class="card-head">
        <span>进食方式</span>
        <strong>推荐方案：{{ methodLabel }}</strong>
      </div>
      <p>{{ dietSuggestion.reason }}</p>
      <button type="button" class="ghost-action compact-action" @click="showMethods = !showMethods">
        切换方案
      </button>
      <div v-if="showMethods" class="option-list">
        <button
          v-for="item in methodOptions"
          :key="item.value"
          type="button"
          :class="{ active: selectedMethod === item.value }"
          @click="selectedMethod = item.value"
        >
          {{ item.label }}
        </button>
      </div>
    </article>

    <article class="panel recommend-card">
      <div class="card-head">
        <span>热量目标</span>
        <strong>每日目标：{{ formatCalories(targetCalories) }}</strong>
      </div>
      <div class="metric-grid">
        <div>
          <span>TDEE</span>
          <strong>{{ formatCalories(tdee) }}</strong>
        </div>
        <div>
          <span>缺口</span>
          <strong>{{ formatCalories(deficitCalories) }}</strong>
        </div>
        <div>
          <span>比例</span>
          <strong>{{ Math.round(selectedDeficit * 100) }}%</strong>
        </div>
      </div>
      <div class="deficit-options">
        <button
          v-for="option in deficitSuggestion.options"
          :key="option"
          type="button"
          :class="{ active: selectedDeficit === option }"
          @click="selectedDeficit = option"
        >
          {{ Math.round(option * 100) }}% <span v-if="selectedDeficit === option">✓</span>
        </button>
      </div>
      <div v-if="deficitWarning" class="warning-banner">{{ deficitWarning }}</div>
    </article>

    <article class="panel recommend-card">
      <div class="card-head">
        <span>宏量营养素</span>
        <strong>每日分配</strong>
      </div>
      <div class="macro-list">
        <div>
          <span>蛋白质</span>
          <strong>{{ formatMacro(macros.protein) }}</strong>
          <small>{{ proteinNote }}</small>
        </div>
        <div>
          <span>脂肪</span>
          <strong>{{ formatMacro(macros.fat) }}</strong>
          <small>最低安全线</small>
        </div>
        <div>
          <span>碳水</span>
          <strong>{{ formatMacro(macros.carbs) }}</strong>
          <small>剩余分配</small>
        </div>
      </div>
      <div v-if="macros.warning" class="warning-banner">{{ macros.warning }}</div>
    </article>

    <div class="sticky-action">
      <button type="button" class="primary-action" @click="acceptRecommendation">
        接受推荐，设置餐次安排
      </button>
    </div>
  </section>
</template>
