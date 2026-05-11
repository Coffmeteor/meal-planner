<script setup>
import { computed, onMounted, ref } from 'vue'
import FoodPreferences from './components/FoodPreferences.vue'
import InputForm from './components/InputForm.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import RecommendView from './components/RecommendView.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import WeightProgress from './components/WeightProgress.vue'
import {
  clearAllData,
  getAppState,
  loadWeightLogs,
  saveLatestPlan,
  saveProfile,
  saveSchedule,
} from './storage/index.js'
import {
  calculateDeficitPercent,
  calculateMacrosV2,
  calculateTargetCaloriesV2,
  calculateTdee,
  suggestDietMethod,
} from './utils/calc.js'
import {
  emptyPreferences,
  getAvailableFoods,
  loadFoodPreferences,
  saveFoodPreferences,
} from './utils/foodPreferences.js'
import {
  generateMealPlan,
  generateScheduleFromProfile,
  regenerateSingleMeal,
} from './utils/planGenerator.js'

const LS_PREFIX = 'meal-planner:v1:'
const defaultFoodPreferences = emptyPreferences()

const view = ref(null) // null = loading; 'input' | 'recommend' | 'confirm' | 'plan' | 'foods' | 'progress'
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const weightLogs = ref([])
const editMode = ref(false)
const planMeta = ref(null)
const foodPrefs = ref(null)
const foodSetupMode = ref(false)
const recommendation = ref(null)
const saveError = ref('')
const saving = ref(false)
const toastMsg = ref('')

function showToast(msg) {
  toastMsg.value = msg
  setTimeout(() => { toastMsg.value = '' }, 2200)
}

const progress = computed(() => {
  const steps = { input: 1, recommend: 2, confirm: 3, plan: 4 }
  return steps[view.value] || 0
})

// ── Startup ──────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const [appState, loadedFoodPrefs, loadedWeightLogs] = await Promise.all([
      getAppState(),
      loadFoodPreferences(),
      loadWeightLogs(),
    ])
    const lp = appState.latestPlan
    const rawLatestPlan = readLatestPlanFromLocalStorage()
    foodPrefs.value = loadedFoodPrefs
    weightLogs.value = loadedWeightLogs
    params.value = lp?.paramsSnapshot || appState.profile || null
    schedule.value = appState.schedule || appState.latestPlan?.scheduleSnapshot || null
    plan.value = lp?.plan || []
    planMeta.value = plan.value.length
      ? {
          startDate: lp?.startDate ?? plan.value[0]?.date ?? null,
          generatedAt: lp?.generatedAt ?? null,
          scheduleSnapshot: lp?.scheduleSnapshot ?? null,
          paramsSnapshot: lp?.paramsSnapshot ?? null,
          days: rawLatestPlan?.days ?? lp?.days ?? plan.value.length,
          dietMethod: rawLatestPlan?.dietMethod ?? lp?.dietMethod ?? null,
          deficitPercent: rawLatestPlan?.deficitPercent ?? lp?.deficitPercent ?? null,
          targetCalories: rawLatestPlan?.targetCalories ?? lp?.targetCalories ?? null,
          macros: rawLatestPlan?.macros ?? lp?.macros ?? null,
          recommendationReason: rawLatestPlan?.recommendationReason ?? lp?.recommendationReason ?? null,
        }
      : null

    view.value = plan.value.length ? 'plan' : 'input'
  } catch (error) {
    console.warn('Failed to initialize app state', error)
    view.value = 'input'
  }
})

// ── LocalStorage sync save (instant, non-blocking) ───────────────────

function lsSave(key, value) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)) } catch (e) { /* */ }
}

function readLatestPlanFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_PREFIX + 'latestPlan')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function lsRemove(key) {
  try { localStorage.removeItem(LS_PREFIX + key) } catch (e) { /* */ }
}

// ── Background async save to IndexedDB ───────────────────────────────

async function bgSave(profileData, scheduleData, planData, meta) {
  saving.value = true
  try {
    await Promise.all([
      saveProfile(profileData),
      saveSchedule(scheduleData),
      saveLatestPlan({
        plan: planData,
        ...meta,
        scheduleSnapshot: scheduleData,
        paramsSnapshot: profileData,
      }),
    ])
    saveError.value = ''
  } catch (e) {
    saveError.value = '本地保存失败，数据可能下次无法恢复'
    console.warn('IndexedDB bg save failed', e)
  } finally {
    saving.value = false
  }
}

async function bgSaveProfileAndSchedule(profileData, scheduleData) {
  saving.value = true
  try {
    await Promise.all([saveProfile(profileData), saveSchedule(scheduleData)])
    saveError.value = ''
  } catch (e) {
    saveError.value = '本地保存失败，数据可能下次无法恢复'
    console.warn('IndexedDB profile/schedule save failed', e)
  } finally {
    saving.value = false
  }
}

function savePlan() {
  if (!plan.value.length) return

  const existingMeta = planMeta.value || {}
  lsSave('latestPlan', {
    plan: plan.value,
    ...existingMeta,
    scheduleSnapshot: schedule.value,
    paramsSnapshot: params.value,
  })
  bgSave(params.value, schedule.value, plan.value, existingMeta)
}

// ── Plan metadata helper ─────────────────────────────────────────────

function setPlanMeta(planArr, recommendationFields = {}) {
  const now = new Date()
  planMeta.value = {
    generatedAt: now.toISOString(),
    startDate: planArr[0]?.date ?? now.toISOString().slice(0, 10),
    days: recommendationFields.days ?? params.value?.days ?? planArr.length,
    dietMethod: recommendationFields.dietMethod ?? params.value?.dietMethod ?? null,
    deficitPercent: recommendationFields.deficitPercent ?? params.value?.deficitPercent ?? null,
    targetCalories: recommendationFields.targetCalories ?? params.value?.targetCalories ?? null,
    macros: recommendationFields.macros ?? params.value?.macroTargets ?? null,
    recommendationReason:
      recommendationFields.recommendationReason
      ?? params.value?.recommendationReason
      ?? null,
  }
}

function formatDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function rebasePlanDates(planArr, startDate) {
  if (!startDate) return planArr
  const [year, month, day] = String(startDate).split('-').map(Number)
  if (!year || !month || !day) return planArr

  const base = new Date(year, month - 1, day)
  if (Number.isNaN(base.getTime())) return planArr

  return planArr.map((dayPlan, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + index)
    return {
      ...dayPlan,
      date: formatDateYmd(date),
    }
  })
}

function calculateDayTotals(meals) {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + (meal.calories || 0),
      protein: sum.protein + (meal.protein || 0),
      carbs: sum.carbs + (meal.carbs || 0),
      fat: sum.fat + (meal.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function buildRecommendation(profile) {
  const dietSuggestion = suggestDietMethod(profile)
  const deficitSuggestion = calculateDeficitPercent(profile)
  const tdee = calculateTdee(profile)
  const targetCalories = calculateTargetCaloriesV2(
    tdee,
    deficitSuggestion.recommended,
    profile.gender,
  )
  const scheduleSuggestion = generateScheduleFromProfile(profile, dietSuggestion.method)
  const macroTargets = calculateMacrosV2(profile, targetCalories, deficitSuggestion.recommended)

  recommendation.value = {
    dietSuggestion,
    deficitSuggestion,
    scheduleSuggestion,
    macroTargets,
  }
}

// ── Handlers ─────────────────────────────────────────────────────────

function handleInputSubmit(nextParams) {
  params.value = nextParams
  editMode.value = false
  buildRecommendation(nextParams)
  view.value = 'recommend'
}

function handleRecommendAccept({ dietMethod, deficitPercent, macros, schedule: acceptedSchedule }) {
  const tdee = calculateTdee(params.value)
  const targetCalories = calculateTargetCaloriesV2(tdee, deficitPercent, params.value.gender)
  const enrichedParams = {
    ...params.value,
    dietMethod,
    deficitPercent,
    targetCalories,
    macroTargets: {
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
    },
    recommendationReason: recommendation.value?.dietSuggestion?.reason ?? null,
  }

  params.value = enrichedParams
  schedule.value = acceptedSchedule

  lsSave('profile', enrichedParams)
  lsSave('schedule', acceptedSchedule)
  bgSaveProfileAndSchedule(enrichedParams, acceptedSchedule)

  view.value = 'confirm'
}

function handleConfirm({ params: confirmedParams, schedule: confirmedSchedule }) {
  params.value = confirmedParams
  schedule.value = confirmedSchedule
  foodSetupMode.value = true

  lsSave('profile', confirmedParams)
  lsSave('schedule', confirmedSchedule)
  bgSaveProfileAndSchedule(confirmedParams, confirmedSchedule)

  view.value = 'foods'
}

function handleEditProfile() {
  editMode.value = true
  view.value = 'input'
}

function handleCancelEdit() {
  editMode.value = false
  view.value = 'plan'
}

function handleRefreshRecipe() {
  if (!params.value || !schedule.value) {
    saveError.value = '缺少计划参数，无法刷新'
    return
  }

  const lockedMeals = []
  plan.value.forEach((day, dayIndex) => {
    day.meals.forEach((meal, mealIndex) => {
      if (meal.locked) lockedMeals.push({ dayIndex, mealIndex, meal })
    })
  })

  const existingMeta = planMeta.value || {}
  const oldStartDate = existingMeta.startDate
  const nextPlan = rebasePlanDates(
    generateMealPlan(params.value, schedule.value, resolveAvailableFoods()),
    oldStartDate,
  )

  const daysToRecalculate = new Set()
  lockedMeals.forEach(({ dayIndex, mealIndex, meal }) => {
    if (nextPlan[dayIndex]?.meals[mealIndex]) {
      nextPlan[dayIndex].meals[mealIndex] = meal
      daysToRecalculate.add(dayIndex)
    }
  })
  daysToRecalculate.forEach((dayIndex) => {
    nextPlan[dayIndex].totals = calculateDayTotals(nextPlan[dayIndex].meals)
  })

  plan.value = nextPlan

  const recFields = {
    dietMethod: existingMeta.dietMethod ?? params.value?.dietMethod ?? null,
    deficitPercent: existingMeta.deficitPercent ?? params.value?.deficitPercent ?? null,
    targetCalories: existingMeta.targetCalories ?? params.value?.targetCalories ?? null,
    macros: existingMeta.macros ?? params.value?.macroTargets ?? null,
    recommendationReason:
      existingMeta.recommendationReason
      ?? params.value?.recommendationReason
      ?? null,
  }
  setPlanMeta(plan.value, recFields)
  savePlan()
  showToast('✅ 已刷新食谱')
}

function handleLockMeal({ dayIndex, mealIndex }) {
  if (!plan.value[dayIndex]?.meals[mealIndex]) return

  plan.value = plan.value.map((day, currentDayIndex) => {
    if (currentDayIndex !== dayIndex) return day

    return {
      ...day,
      meals: day.meals.map((meal, currentMealIndex) =>
        currentMealIndex === mealIndex
          ? { ...meal, locked: true, updatedAt: new Date().toISOString() }
          : meal,
      ),
    }
  })
  savePlan()
}

function handleUnlockMeal({ dayIndex, mealIndex }) {
  if (!plan.value[dayIndex]?.meals[mealIndex]) return

  plan.value = plan.value.map((day, currentDayIndex) => {
    if (currentDayIndex !== dayIndex) return day

    return {
      ...day,
      meals: day.meals.map((meal, currentMealIndex) =>
        currentMealIndex === mealIndex
          ? { ...meal, locked: false, updatedAt: new Date().toISOString() }
          : meal,
      ),
    }
  })
  savePlan()
}

function handleReplaceMeal({ dayIndex, mealIndex }) {
  const oldMeal = plan.value[dayIndex]?.meals[mealIndex]
  if (!oldMeal) return

  if (oldMeal.locked) {
    showToast('请先取消锁定再更换')
    return
  }

  plan.value = regenerateSingleMeal(
    plan.value,
    dayIndex,
    mealIndex,
    params.value,
    schedule.value,
    resolveAvailableFoods(),
  )
  savePlan()
  showToast('✅ 已更换')
}

async function handleClearData() {
  try {
    await clearAllData()
  } catch (e) { /* */ }
  for (const k of ['profile', 'schedule', 'latestPlan', 'foodPreferences', 'weightLogs']) lsRemove(k)
  params.value = null
  schedule.value = null
  plan.value = []
  weightLogs.value = []
  foodPrefs.value = emptyPreferences()
  foodSetupMode.value = false
  editMode.value = false
  recommendation.value = null
  planMeta.value = null
  saveError.value = ''
  saving.value = false
  view.value = 'input'
}

function resolveAvailableFoods() {
  const available = getAvailableFoods(foodPrefs.value)
  return available.length ? available : null
}

function handleManageFoods() {
  foodSetupMode.value = false
  view.value = 'foods'
}

function handleViewProgress() {
  view.value = 'progress'
}

function handleWeightLogsSave(updatedLogs) {
  weightLogs.value = updatedLogs
  view.value = 'plan'
}

async function handleFoodsSave(updatedPrefs) {
  foodPrefs.value = await saveFoodPreferences(updatedPrefs)

  if (foodSetupMode.value) {
    plan.value = generateMealPlan(params.value, schedule.value, resolveAvailableFoods())
    const recFields = {
      dietMethod: params.value?.dietMethod ?? null,
      deficitPercent: params.value?.deficitPercent ?? null,
      targetCalories: params.value?.targetCalories ?? null,
      macros: params.value?.macroTargets ?? null,
      recommendationReason: params.value?.recommendationReason ?? null,
    }
    setPlanMeta(plan.value, recFields)
    savePlan()
    foodSetupMode.value = false
    view.value = 'plan'
    return
  }

  view.value = plan.value.length ? 'plan' : 'input'
}

function handleFoodsClose() {
  if (foodSetupMode.value) {
    foodSetupMode.value = false
    view.value = 'confirm'
  } else {
    view.value = plan.value.length ? 'plan' : 'input'
  }
}
</script>

<template>
  <main class="app-shell">
    <div v-if="toastMsg" class="toast-overlay">{{ toastMsg }}</div>
    <header v-if="view" class="app-header">
      <div>
        <span class="eyebrow">轻盈餐盘</span>
        <h1>减脂餐计划</h1>
      </div>
      <div v-if="view === 'foods'" class="progress-pill">食材</div>
      <div v-else-if="view === 'progress'" class="progress-pill">进度</div>
      <div v-else-if="view !== 'plan'" class="progress-pill">{{ progress }}/3</div>
      <div v-else class="progress-pill">餐单</div>
    </header>

    <div v-if="!view" class="loading-shell">
      <div class="loading-dot"></div>
    </div>

    <Transition v-else name="slide-fade" mode="out-in">
      <InputForm
        v-if="view === 'input'"
        key="input"
        :initial-data="editMode ? params : null"
        :edit-mode="editMode"
        @cancel="handleCancelEdit"
        @submit="handleInputSubmit"
      />
      <ScheduleConfirm
        v-else-if="view === 'confirm'"
        key="confirm"
        :params="params"
        :initial-schedule="schedule"
        @back="view = 'recommend'"
        @confirm="handleConfirm"
      />
      <RecommendView
        v-else-if="view === 'recommend' && recommendation"
        key="recommend"
        :profile="params"
        :diet-suggestion="recommendation.dietSuggestion"
        :deficit-suggestion="recommendation.deficitSuggestion"
        :schedule-suggestion="recommendation.scheduleSuggestion"
        :macro-targets="recommendation.macroTargets"
        @accept="handleRecommendAccept"
      />
      <section v-else-if="view === 'plan'" key="plan" class="result-stack">
        <div v-if="saveError" class="save-error-banner">{{ saveError }}</div>
        <PlanCalendar
          :plan="plan"
          :start-date="planMeta?.startDate"
          :plan-meta="planMeta"
          @edit-profile="handleEditProfile"
          @refresh-recipe="handleRefreshRecipe"
          @clear-data="handleClearData"
          @manage-foods="handleManageFoods"
          @view-progress="handleViewProgress"
          @lock-meal="handleLockMeal"
          @unlock-meal="handleUnlockMeal"
          @replace-meal="handleReplaceMeal"
        />
      </section>
      <WeightProgress
        v-else-if="view === 'progress'"
        key="progress"
        :weight-logs="weightLogs"
        :profile="params"
        :plan-days="Number(params?.days || planMeta?.days || plan.length || 7)"
        @save="handleWeightLogsSave"
        @close="view = 'plan'"
      />
      <FoodPreferences
        v-else-if="view === 'foods'"
        key="foods"
        :food-preferences="foodPrefs || defaultFoodPreferences"
        :mode="foodSetupMode ? 'setup' : 'manage'"
        @save="handleFoodsSave"
        @close="handleFoodsClose"
      />
    </Transition>
  </main>
</template>

<style scoped>
.loading-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.loading-dot {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--green, #5ba66f);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
.save-error-banner {
  padding: 0.75rem 1rem;
  border-radius: 0.85rem;
  background: #fff0d8;
  color: #c0392b;
  font-weight: 700;
  font-size: 0.85rem;
  text-align: center;
}
.toast-overlay {
  position: fixed;
  bottom: 3rem;
  left: 50%;
  transform: translateX(-50%);
  background: #2d3436;
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  font-size: 0.9rem;
  font-weight: 600;
  z-index: 999;
  animation: toast-in 0.25s ease;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(1rem); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
