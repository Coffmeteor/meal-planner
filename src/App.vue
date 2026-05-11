<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import CheckinProgress from './components/CheckinProgress.vue'
import DayFoodEditor from './components/DayFoodEditor.vue'
import FoodPreferences from './components/FoodPreferences.vue'
import InputForm from './components/InputForm.vue'
import MealEditor from './components/MealEditor.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import ProfileView from './components/ProfileView.vue'
import RecommendView from './components/RecommendView.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import WeightProgress from './components/WeightProgress.vue'
import {
  clearAllData,
  exportAllData,
  getAppState,
  importAllData,
  loadCheckins,
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
  regenerateDay,
  regenerateSingleMeal,
} from './utils/planGenerator.js'
import { foods as defaultFoods } from './utils/foods.js'
import {
  calculateDayTotals,
  mealFoods,
  normalizeEditedMeal,
} from './utils/mealDisplay.js'

const LS_PREFIX = 'meal-planner:v1:'
const defaultFoodPreferences = emptyPreferences()

const view = ref(null) // null = loading; wizard: 'input' | 'recommend' | 'confirm' | 'foods'; shell: 'plan'
const activeTab = ref('plan')
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const weightLogs = ref([])
const checkins = ref([])
const editMode = ref(false)
const planMeta = ref(null)
const foodPrefs = ref(null)
const foodSetupMode = ref(false)
const recommendation = ref(null)
const saveError = ref('')
const saving = ref(false)
const toastMsg = ref('')
const editingMeal = ref(null)
const editingDayFood = ref(null)

const tabs = [
  { value: 'plan', label: '餐单', icon: '餐' },
  { value: 'foods', label: '食材', icon: '材' },
  { value: 'progress', label: '进度', icon: '趋' },
  { value: 'checkin', label: '打卡', icon: '记' },
  { value: 'profile', label: '我的', icon: '我' },
]

function showToast(msg) {
  toastMsg.value = msg
  setTimeout(() => { toastMsg.value = '' }, 2200)
}

const progress = computed(() => {
  const steps = { input: 1, recommend: 2, confirm: 3, foods: 4, plan: 5 }
  return steps[view.value] || 0
})
const isAppShell = computed(() => view.value === 'plan' && plan.value.length > 0)
const activeTabLabel = computed(() =>
  tabs.find((tab) => tab.value === activeTab.value)?.label || '餐单',
)
const headerPill = computed(() => {
  if (isAppShell.value) return activeTabLabel.value
  return progress.value ? `${progress.value}/5` : ''
})
const todayChecked = computed(() => checkins.value.some((item) => item.date === todayYmd()))

watch(activeTab, (tab) => {
  if (!tabs.some((item) => item.value === tab)) return
  if (tab !== 'plan') {
    editingMeal.value = null
    editingDayFood.value = null
  }
  lsSave('activeTab', tab)
})

const editorMeal = computed(() => {
  if (!editingMeal.value) return null
  return plan.value[editingMeal.value.dayIndex]?.meals?.[editingMeal.value.mealIndex] || null
})
const editorAvailableFoods = computed(() => {
  const available = getAvailableFoods(foodPrefs.value)
  return available.length ? available : defaultFoods
})
const editorMealTargetCalories = computed(() => {
  if (!editingMeal.value) return 0

  const { dayIndex, mealIndex } = editingMeal.value
  const day = plan.value[dayIndex]
  const dailyTarget =
    Number(day?.targets?.calories)
    || Number(planMeta.value?.targetCalories)
    || Number(params.value?.targetCalories)
    || 0
  const split = Number(schedule.value?.split?.[mealIndex])

  if (Number.isFinite(split) && split > 0) return Math.round(dailyTarget * split)

  return Math.round(dailyTarget / Math.max(day?.meals?.length || 1, 1))
})
const dayFoodEditorDay = computed(() => {
  if (editingDayFood.value === null) return null
  return plan.value[editingDayFood.value] || null
})
const dayFoodEditorFoods = computed(() => {
  if (!dayFoodEditorDay.value) return editorAvailableFoods.value
  return mergeFoodsById(editorAvailableFoods.value, foodsUsedByDay(dayFoodEditorDay.value))
})

// ── Startup ──────────────────────────────────────────────────────────

onMounted(loadAppState)

async function loadAppState() {
  try {
    const [appState, loadedFoodPrefs, loadedWeightLogs, loadedCheckins] = await Promise.all([
      getAppState(),
      loadFoodPreferences(),
      loadWeightLogs(),
      loadCheckins(),
    ])
    const lp = appState.latestPlan
    const rawLatestPlan = readLatestPlanFromLocalStorage()
    foodPrefs.value = loadedFoodPrefs
    weightLogs.value = loadedWeightLogs
    checkins.value = loadedCheckins
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

    const savedTab = readJsonFromLocalStorage('activeTab')
    if (tabs.some((tab) => tab.value === savedTab)) activeTab.value = savedTab
    editingMeal.value = null
    editingDayFood.value = null
    view.value = plan.value.length ? 'plan' : 'input'
  } catch (error) {
    console.warn('Failed to initialize app state', error)
    view.value = 'input'
  }
}

// ── LocalStorage sync save (instant, non-blocking) ───────────────────

function lsSave(key, value) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)) } catch (e) { /* */ }
}

function readLatestPlanFromLocalStorage() {
  return readJsonFromLocalStorage('latestPlan')
}

function readJsonFromLocalStorage(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
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
    startDate: planArr[0]?.date ?? formatDateYmd(now),
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

function todayYmd() {
  return formatDateYmd(new Date())
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
  view.value = plan.value.length ? 'plan' : 'input'
}

function handleRefreshRecipe() {
  if (!params.value || !schedule.value) {
    saveError.value = '缺少计划参数，无法刷新'
    return
  }

  const preservedMeals = []
  plan.value.forEach((day, dayIndex) => {
    day.meals.forEach((meal, mealIndex) => {
      if (meal.locked || meal.edited) preservedMeals.push({ dayIndex, mealIndex, meal })
    })
  })

  const existingMeta = planMeta.value || {}
  const oldStartDate = existingMeta.startDate
  const nextPlan = rebasePlanDates(
    generateMealPlan(params.value, schedule.value, resolveAvailableFoods()),
    oldStartDate,
  )

  const daysToRecalculate = new Set()
  preservedMeals.forEach(({ dayIndex, mealIndex, meal }) => {
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

function handleEditMeal({ dayIndex, mealIndex }) {
  if (!plan.value[dayIndex]?.meals?.[mealIndex]) return
  editingMeal.value = { dayIndex, mealIndex }
  nextTick(() => {
    const content = document.querySelector('.app-content')
    if (content) content.scrollTop = 0
  })
}

function handleCancelMealEdit() {
  editingMeal.value = null
}

function handleSaveMeal({ dayIndex, mealIndex, foods, meal: savedMeal }) {
  const meal = plan.value[dayIndex]?.meals?.[mealIndex]
  if (!meal) return

  const now = new Date().toISOString()
  const nextMeal = savedMeal
    ? normalizeEditedMeal(meal, savedMeal.foods || foods, { name: savedMeal.name, updatedAt: now })
    : normalizeEditedMeal(meal, foods, { updatedAt: now })

  plan.value = plan.value.map((day, currentDayIndex) => {
    if (currentDayIndex !== dayIndex) return day

    const meals = day.meals.map((currentMeal, currentMealIndex) =>
      currentMealIndex === mealIndex
        ? {
            ...currentMeal,
            ...nextMeal,
          }
        : currentMeal,
    )

    return {
      ...day,
      meals,
      totals: calculateDayTotals(meals),
      edited: true,
      updatedAt: now,
    }
  })

  editingMeal.value = null
  savePlan()
  showToast('已保存餐次')
}

function handleRefreshDay(dayIndex) {
  const day = plan.value[dayIndex]
  if (!day || !params.value || !schedule.value) return

  const nextDay = regenerateDay(
    params.value,
    schedule.value,
    resolveAvailableFoods(),
    day,
  )
  plan.value = plan.value.map((planDay, currentDayIndex) =>
    currentDayIndex === dayIndex ? nextDay : planDay,
  )
  savePlan()
  showToast('已刷新当天餐单')
}

function handleEditDayFood(dayIndex) {
  if (!plan.value[dayIndex]) return
  editingMeal.value = null
  editingDayFood.value = dayIndex
  nextTick(() => {
    const content = document.querySelector('.app-content')
    if (content) content.scrollTop = 0
  })
}

function handleCancelDayFoodEdit() {
  editingDayFood.value = null
}

function handleSaveDayFood({ dayIndex, selectedFoodIds }) {
  const day = plan.value[dayIndex]
  if (!day || !params.value || !schedule.value) return

  const availableFoods = dayFoodPoolFor(day)
  const selectedSet = new Set(selectedFoodIds)
  const selectedFoods = availableFoods.filter((food) => selectedSet.has(food.id))
  if (!selectedFoods.length) {
    showToast('请至少选择一种食材')
    return
  }

  const now = new Date().toISOString()
  const nextDay = regenerateDay(
    params.value,
    schedule.value,
    selectedFoods,
    day,
    { strictFoodPool: true, editSource: 'dayFoodPool' },
  )
  plan.value = plan.value.map((planDay, currentDayIndex) =>
    currentDayIndex === dayIndex
      ? {
          ...nextDay,
          dayFoodPool: {
            selectedFoodIds: [...selectedFoodIds],
            updatedAt: now,
          },
          edited: true,
          editSource: 'dayFoodPool',
          updatedAt: now,
        }
      : planDay,
  )
  editingDayFood.value = null
  savePlan()
  showToast('已更新当天食材')
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
  const firstConfirm = confirm('确定清空全部本地数据吗？此操作不可恢复。')
  if (!firstConfirm) return
  const secondConfirm = confirm('请再次确认：将删除资料、餐单、食材、体重和打卡记录。')
  if (!secondConfirm) return

  try {
    await clearAllData()
  } catch (e) { /* */ }
  activeTab.value = 'plan'
  for (const k of [
    'profile',
    'schedule',
    'latestPlan',
    'foodPreferences',
    'weightLogs',
    'checkins',
    'activeTab',
  ]) lsRemove(k)
  params.value = null
  schedule.value = null
  plan.value = []
  weightLogs.value = []
  checkins.value = []
  foodPrefs.value = emptyPreferences()
  foodSetupMode.value = false
  editMode.value = false
  recommendation.value = null
  planMeta.value = null
  saveError.value = ''
  saving.value = false
  editingMeal.value = null
  editingDayFood.value = null
  view.value = 'input'
}

async function handleImportData(importData) {
  const snapshot = await exportAllData()
  try {
    await clearAllData()
    lsRemove('activeTab')
    await importAllData(importData)
    activeTab.value = 'plan'
    await loadAppState()
    showToast('导入完成')
  } catch (error) {
    console.warn('Import failed', error)
    try {
      await clearAllData()
      await importAllData(snapshot)
      await loadAppState()
    } catch (restoreError) {
      console.warn('Import restore failed', restoreError)
    }
    saveError.value = '导入失败，已尽量恢复原有数据。'
  }
}

function resolveAvailableFoods() {
  const available = getAvailableFoods(foodPrefs.value)
  return available.length ? available : null
}

function foodsUsedByDay(day) {
  return (day?.meals || []).flatMap((meal) => mealFoods(meal))
}

function mergeFoodsById(...groups) {
  const byId = new Map()
  for (const group of groups) {
    for (const food of group || []) {
      const id = food?.id || (food?.name ? `food-${food.name}` : null)
      if (!id || byId.has(id)) continue
      byId.set(id, { ...food, id })
    }
  }
  return [...byId.values()]
}

function dayFoodPoolFor(day) {
  return mergeFoodsById(editorAvailableFoods.value, foodsUsedByDay(day))
}

function handleWeightLogsSave(updatedLogs) {
  weightLogs.value = updatedLogs
  showToast('已保存体重记录')
}

function handleViewCheckin() {
  setActiveTab('checkin')
}

function handleCheckinSave(updated) {
  checkins.value = updated
  showToast('已保存打卡')
}

async function handleFoodsSave(updatedPrefs, options = {}) {
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
    activeTab.value = 'plan'
    view.value = 'plan'
    return
  }

  if (options.refresh && plan.value.length) {
    handleRefreshRecipe()
  } else {
    showToast('已保存食材')
  }
  view.value = plan.value.length ? 'plan' : 'input'
  activeTab.value = plan.value.length ? 'foods' : 'plan'
}

function handleFoodsClose() {
  if (foodSetupMode.value) {
    foodSetupMode.value = false
    view.value = 'confirm'
  } else {
    view.value = plan.value.length ? 'plan' : 'input'
  }
}

function setActiveTab(tab) {
  activeTab.value = tab
  nextTick(() => {
    const content = document.querySelector('.app-content')
    if (content) content.scrollTop = 0
  })
}
</script>

<template>
  <main class="app-shell" :class="{ 'has-tabs': isAppShell }">
    <div v-if="toastMsg" class="toast-overlay">{{ toastMsg }}</div>
    <header v-if="view" class="app-header">
      <div>
        <span class="eyebrow">轻盈餐盘</span>
        <h1>减脂餐计划</h1>
      </div>
      <div v-if="headerPill" class="progress-pill">{{ headerPill }}</div>
    </header>

    <div v-if="!view" class="loading-shell">
      <div class="loading-dot"></div>
    </div>

    <template v-else-if="isAppShell">
      <section class="app-content tab-content">
        <div v-if="saveError" class="save-error-banner">{{ saveError }}</div>
        <DayFoodEditor
          v-if="activeTab === 'plan' && editingDayFood !== null && dayFoodEditorDay"
          key="day-food-editor"
          :day="dayFoodEditorDay"
          :day-index="editingDayFood"
          :available-foods="dayFoodEditorFoods"
          @save="handleSaveDayFood"
          @cancel="handleCancelDayFoodEdit"
        />
        <MealEditor
          v-else-if="activeTab === 'plan' && editingMeal && editorMeal"
          key="meal-editor"
          :meal="editorMeal"
          :day-index="editingMeal.dayIndex"
          :meal-index="editingMeal.mealIndex"
          :meal-target-calories="editorMealTargetCalories"
          :available-foods="editorAvailableFoods"
          @save-meal="handleSaveMeal"
          @cancel-edit="handleCancelMealEdit"
        />
        <PlanCalendar
          v-else-if="activeTab === 'plan'"
          key="plan-tab"
          :plan="plan"
          :start-date="planMeta?.startDate"
          :plan-meta="planMeta"
          :today-checked="todayChecked"
          @refresh-recipe="handleRefreshRecipe"
          @refresh-day="handleRefreshDay"
          @edit-day-food="handleEditDayFood"
          @view-checkin="handleViewCheckin"
          @edit-meal="handleEditMeal"
          @lock-meal="handleLockMeal"
          @unlock-meal="handleUnlockMeal"
          @replace-meal="handleReplaceMeal"
        />
        <FoodPreferences
          v-else-if="activeTab === 'foods'"
          key="foods-tab"
          :food-preferences="foodPrefs || defaultFoodPreferences"
          mode="manage"
          :show-close="false"
          @save="handleFoodsSave"
        />
        <WeightProgress
          v-else-if="activeTab === 'progress'"
          key="progress-tab"
          :weight-logs="weightLogs"
          :profile="params"
          :checkins="checkins"
          :plan-days="Number(params?.days || planMeta?.days || plan.length || 7)"
          :start-date="planMeta?.startDate || null"
          :show-close="false"
          @save="handleWeightLogsSave"
        />
        <CheckinProgress
          v-else-if="activeTab === 'checkin'"
          key="checkin-tab"
          :checkins="checkins"
          :show-close="false"
          @save="handleCheckinSave"
        />
        <ProfileView
          v-else-if="activeTab === 'profile'"
          key="profile-tab"
          :profile="params"
          :plan-meta="planMeta"
          @edit-profile="handleEditProfile"
          @clear-data="handleClearData"
          @import-data="handleImportData"
        />
      </section>

      <nav class="bottom-tab-bar" aria-label="主导航">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="tab-button"
          :class="{ active: activeTab === tab.value }"
          @click="setActiveTab(tab.value)"
        >
          <span aria-hidden="true">{{ tab.icon }}</span>
          <strong>{{ tab.label }}</strong>
        </button>
      </nav>
    </template>

    <div v-else class="app-content wizard-content">
      <Transition name="slide-fade" mode="out-in">
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
        <FoodPreferences
          v-else-if="view === 'foods'"
          key="foods"
          :food-preferences="foodPrefs || defaultFoodPreferences"
          :mode="foodSetupMode ? 'setup' : 'manage'"
          @save="handleFoodsSave"
          @close="handleFoodsClose"
        />
        <section v-else key="empty-plan" class="empty-state-panel">
          <strong>还没有餐单</strong>
          <p>完成资料、推荐、餐次和食材设置后，将生成第 5 步餐单。</p>
        </section>
      </Transition>
    </div>
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
.has-tabs .toast-overlay {
  bottom: calc(5.6rem + env(safe-area-inset-bottom));
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(1rem); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
