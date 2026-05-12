<script setup>
import { computed, nextTick, onMounted, provide, ref, watch } from 'vue'
import CheckinForm from './components/CheckinForm.vue'
import CustomFood from './components/CustomFood.vue'
import DataBackup from './components/DataBackup.vue'
import DayFoodEditor from './components/DayFoodEditor.vue'
import FoodsPage from './components/FoodsPage.vue'
import FoodPreferences from './components/FoodPreferences.vue'
import InputForm from './components/InputForm.vue'
import MealEditor from './components/MealEditor.vue'
import PlanPage from './components/PlanPage.vue'
import ProfileEdit from './components/ProfileEdit.vue'
import ProfilePage from './components/ProfilePage.vue'
import ProgressPage from './components/ProgressPage.vue'
import RecommendView from './components/RecommendView.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import TodayDashboard from './components/TodayDashboard.vue'
import WeightEntry from './components/WeightEntry.vue'
import {
  clearPageStack,
  currentPage,
  currentPageParams,
  hasSubPage,
  popPage,
  pushPage,
} from './stores/navigationStore.js'
import * as appStore from './stores/appStore.js'
import * as foodStore from './stores/foodStore.js'
import * as planStore from './stores/planStore.js'
import * as progressStore from './stores/progressStore.js'
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
import { normalizeDietMethod, normalizeEatingWindow } from './utils/scheduleUtils.js'
import { foods as defaultFoods } from './utils/foods.js'
import {
  calculateDayTotals,
  mealFoods,
  normalizeEditedMeal,
} from './utils/mealDisplay.js'

const LS_PREFIX = 'meal-planner:v1:'
const defaultFoodPreferences = emptyPreferences()

const view = ref(null) // null = loading; wizard: 'input' | 'recommend' | 'confirm' | 'foods'; shell: 'plan'
const activeTab = ref('today')
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

provide('appStore', appStore)
provide('foodStore', foodStore)
provide('planStore', planStore)
provide('progressStore', progressStore)

const tabs = [
  { value: 'today', label: '今日', icon: '今' },
  { value: 'plan', label: '餐单', icon: '餐' },
  { value: 'foods', label: '食材', icon: '材' },
  { value: 'progress', label: '进度', icon: '趋' },
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
const tabComponents = {
  today: TodayDashboard,
  plan: PlanPage,
  foods: FoodsPage,
  progress: ProgressPage,
  profile: ProfilePage,
}
const subPageComponents = {
  planDay: PlanPage,
  mealEditor: MealEditor,
  dayFoodEditor: DayFoodEditor,
  checkinForm: CheckinForm,
  weightEntry: WeightEntry,
  dataBackup: DataBackup,
  profileEdit: ProfileEdit,
  customFood: CustomFood,
}
const subPageTitles = {
  planDay: '今日餐单',
  mealEditor: '编辑餐次',
  dayFoodEditor: '编辑当天食材',
  weightEntry: '记录体重',
  checkinForm: '今日打卡',
  dataBackup: '数据备份/恢复',
  profileEdit: '修改资料',
  customFood: '自定义食材',
}
const currentPageName = computed(() => currentPage.value?.name || null)
const topBarTitle = computed(() => subPageTitles[currentPageName.value] || '详情')
const currentPageComponent = computed(() => {
  if (hasSubPage.value) return subPageComponents[currentPageName.value] || PlanPage
  return tabComponents[activeTab.value] || TodayDashboard
})
const currentPageProps = computed(() => {
  if (hasSubPage.value) return subPageProps(currentPageName.value)
  return tabPageProps(activeTab.value)
})
const pageKey = computed(() => {
  if (view.value !== 'plan') return `wizard:${view.value || 'loading'}`
  if (hasSubPage.value) return `sub:${currentPageName.value}:${JSON.stringify(currentPageParams.value)}`
  return `tab:${activeTab.value}`
})

watch(activeTab, (tab) => {
  if (!tabs.some((item) => item.value === tab)) return
  appStore.switchTab(tab)
  if (tab !== 'plan') {
    editingMeal.value = null
    editingDayFood.value = null
  }
  lsSave('activeTab', tab)
})

watch(pageKey, () => {
  scrollToPageTop()
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
  const pageParams = currentPageParams.value || {}
  const dayIndex = Number(pageParams.dayIndex ?? editingMeal.value?.dayIndex)
  const mealIndex = Number(pageParams.mealIndex ?? editingMeal.value?.mealIndex ?? 0)
  if (!Number.isFinite(dayIndex) || !Number.isFinite(mealIndex)) return 0

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
const currentDayIndex = computed(() => resolveTodayIndex())

function sharedPlanProps() {
  return {
    plan: plan.value,
    startDate: planMeta.value?.startDate,
    planMeta: planMeta.value,
    eatingWindow: planMeta.value?.eatingWindow || schedule.value?.eatingWindow || params.value?.eatingWindow,
    todayChecked: todayChecked.value,
  }
}

function tabPageProps(tab) {
  if (tab === 'today') {
    return {
      plan: plan.value,
      planMeta: planMeta.value,
      profile: params.value,
      weightLogs: weightLogs.value,
      checkins: checkins.value,
    }
  }
  if (tab === 'plan') return sharedPlanProps()
  if (tab === 'foods') {
    return {
      foodPreferences: foodPrefs.value || defaultFoodPreferences,
    }
  }
  if (tab === 'progress') {
    return {
      weightLogs: weightLogs.value,
      profile: params.value,
      checkins: checkins.value,
      planDays: Number(params.value?.days || planMeta.value?.days || plan.value.length || 7),
      startDate: planMeta.value?.startDate || null,
    }
  }
  if (tab === 'profile') {
    return {
      profile: params.value,
      planMeta: planMeta.value,
    }
  }
  return {}
}

function subPageProps(name) {
  if (name === 'mealEditor') {
    const pageParams = currentPageParams.value || {}
    const dayIndex = Number(pageParams.dayIndex ?? editingMeal.value?.dayIndex)
    const mealIndex = Number(pageParams.mealIndex ?? editingMeal.value?.mealIndex ?? 0)
    const meal = plan.value[dayIndex]?.meals?.[mealIndex] || pageParams.mealData || null
    return meal
      ? {
          meal,
          dayIndex,
          mealIndex,
          mealTargetCalories: editorMealTargetCalories.value,
          availableFoods: editorAvailableFoods.value,
        }
      : {}
  }
  if (name === 'dayFoodEditor') {
    const pageParams = currentPageParams.value || {}
    const dayIndex = Number(pageParams.dayIndex ?? editingDayFood.value)
    const day = plan.value[dayIndex] || null
    return day
      ? {
          day,
          dayIndex,
          availableFoods: mergeFoodsById(editorAvailableFoods.value, foodsUsedByDay(day)),
        }
      : {}
  }
  if (['weightEntry', 'checkinForm', 'dataBackup', 'profileEdit', 'customFood'].includes(name)) return currentPageParams.value
  return sharedPlanProps()
}

// ── Startup ──────────────────────────────────────────────────────────

onMounted(loadAppState)

let _scrollPending = false
function scrollToPageTop() {
  if (_scrollPending) return
  _scrollPending = true
  nextTick(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
      _scrollPending = false
    })
  })
}

watch(view, () => scrollToPageTop())
watch(activeTab, () => scrollToPageTop())

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
    const loadedSchedule = appState.schedule || appState.latestPlan?.scheduleSnapshot || null
    const loadedEatingWindow =
      rawLatestPlan?.eatingWindow
      ?? rawLatestPlan?.paramsSnapshot?.eatingWindow
      ?? rawLatestPlan?.scheduleSnapshot?.eatingWindow
      ?? loadedSchedule?.eatingWindow
      ?? lp?.eatingWindow
      ?? lp?.scheduleSnapshot?.eatingWindow
      ?? null
    const loadedParams = lp?.paramsSnapshot || appState.profile || null
    params.value =
      loadedParams && loadedEatingWindow
        ? { ...loadedParams, eatingWindow: loadedEatingWindow }
        : loadedParams
    schedule.value =
      loadedSchedule && loadedEatingWindow && !loadedSchedule.eatingWindow
        ? { ...loadedSchedule, eatingWindow: loadedEatingWindow }
        : loadedSchedule
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
          eatingWindow: loadedEatingWindow,
        }
      : null

    const savedTab = readJsonFromLocalStorage('activeTab')
    if (tabs.some((tab) => tab.value === savedTab)) activeTab.value = savedTab
    editingMeal.value = null
    editingDayFood.value = null
    clearPageStack()
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
    eatingWindow:
      recommendationFields.eatingWindow
      ?? schedule.value?.eatingWindow
      ?? params.value?.eatingWindow
      ?? null,
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

function handleRecommendBack() {
  view.value = 'input'
}

function currentEatingWindow() {
  const rawWindow = schedule.value?.eatingWindow || params.value?.eatingWindow
  return normalizeEatingWindow(
    params.value,
    rawWindow?.type && rawWindow.type !== 'none' ? rawWindow.type : params.value?.dietMethod,
    rawWindow,
  )
}

function handleRecommendAccept({
  dietMethod,
  deficitPercent,
  macros,
  schedule: acceptedSchedule,
  eatingWindow,
}) {
  dietMethod = normalizeDietMethod(dietMethod)
  const tdee = calculateTdee(params.value)
  const targetCalories = calculateTargetCaloriesV2(tdee, deficitPercent, params.value.gender)
  const acceptedEatingWindow = normalizeEatingWindow(params.value, dietMethod, eatingWindow)
  const enrichedParams = {
    ...params.value,
    dietMethod,
    deficitPercent,
    eatingWindow: acceptedEatingWindow,
    targetCalories,
    macroTargets: {
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
    },
    recommendationReason: recommendation.value?.dietSuggestion?.reason ?? null,
  }

  params.value = enrichedParams
  schedule.value = {
    ...acceptedSchedule,
    eatingWindow: acceptedEatingWindow,
  }

  lsSave('profile', enrichedParams)
  lsSave('schedule', schedule.value)
  bgSaveProfileAndSchedule(enrichedParams, schedule.value)

  view.value = 'confirm'
}

function handleConfirmBack(payload = {}) {
  if (payload.params) params.value = payload.params
  if (payload.schedule) schedule.value = payload.schedule
  view.value = 'recommend'
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
    generateMealPlan(params.value, schedule.value, resolveAvailableFoods(), currentEatingWindow()),
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
    eatingWindow: existingMeta.eatingWindow ?? currentEatingWindow(),
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
  pushPage('mealEditor', { dayIndex, mealIndex })
}

function handleCancelMealEdit() {
  editingMeal.value = null
  if (currentPageName.value === 'mealEditor') popPage()
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
  if (currentPageName.value === 'mealEditor') popPage()
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
    {},
    currentEatingWindow(),
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
  pushPage('dayFoodEditor', { dayIndex })
}

function handleCancelDayFoodEdit() {
  editingDayFood.value = null
  if (currentPageName.value === 'dayFoodEditor') popPage()
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
    currentEatingWindow(),
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
  if (currentPageName.value === 'dayFoodEditor') popPage()
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
    currentEatingWindow(),
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
  activeTab.value = 'today'
  clearPageStack()
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
    activeTab.value = 'today'
    clearPageStack()
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
  pushPage('checkinForm')
}

function handleCheckinSave(updated) {
  checkins.value = updated
  showToast('已保存打卡')
}

async function handleSubPageDone(payload = {}) {
  const pageName = currentPageName.value

  if (payload.type === 'weights') {
    weightLogs.value = payload.data || []
    showToast('已保存体重记录')
  } else if (payload.type === 'checkins') {
    checkins.value = payload.data || []
    showToast('已保存打卡')
  } else if (payload.type === 'profile') {
    params.value = payload.data || params.value
    lsSave('profile', params.value)
    showToast('已保存资料')
  } else if (payload.type === 'foodPreferences') {
    foodPrefs.value = payload.data || (await loadFoodPreferences())
    showToast('已保存食材')
  } else if (payload.type === 'backup') {
    await loadAppState()
    showToast('数据已更新')
    return
  }

  if (pageName === 'mealEditor') editingMeal.value = null
  if (pageName === 'dayFoodEditor') editingDayFood.value = null
  popPage()
}

function handleSubPageCancel() {
  if (currentPageName.value === 'mealEditor') editingMeal.value = null
  if (currentPageName.value === 'dayFoodEditor') editingDayFood.value = null
  popPage()
}

function handlePageSave(payload, options = {}) {
  if (currentPageName.value === 'dayFoodEditor') {
    handleSaveDayFood(payload)
    return
  }
  if (currentPageName.value === 'weightEntry') {
    handleWeightLogsSave(payload)
    return
  }
  if (currentPageName.value === 'checkinForm') {
    handleCheckinSave(payload)
    return
  }
  handleFoodsSave(payload, options)
}

async function handleFoodsSave(updatedPrefs, options = {}) {
  foodPrefs.value = await saveFoodPreferences(updatedPrefs)

  if (foodSetupMode.value) {
    plan.value = generateMealPlan(params.value, schedule.value, resolveAvailableFoods(), currentEatingWindow())
    const recFields = {
      dietMethod: params.value?.dietMethod ?? null,
      deficitPercent: params.value?.deficitPercent ?? null,
      targetCalories: params.value?.targetCalories ?? null,
      macros: params.value?.macroTargets ?? null,
      eatingWindow: currentEatingWindow(),
      recommendationReason: params.value?.recommendationReason ?? null,
    }
    setPlanMeta(plan.value, recFields)
    savePlan()
    foodSetupMode.value = false
    activeTab.value = 'today'
    clearPageStack()
    view.value = 'plan'
    return
  }

  if (options.refresh && plan.value.length) {
    handleRefreshRecipe()
  } else {
    showToast('已保存食材')
  }
  view.value = plan.value.length ? 'plan' : 'input'
  activeTab.value = plan.value.length ? 'foods' : 'today'
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
  if (!tabs.some((item) => item.value === tab)) return
  activeTab.value = tab
  clearPageStack()
}

function handleBack() {
  if (currentPageName.value === 'mealEditor') editingMeal.value = null
  if (currentPageName.value === 'dayFoodEditor') editingDayFood.value = null
  popPage()
}

function handleTodayOptimize(dayIndex = currentDayIndex.value) {
  handleRefreshDay(dayIndex)
  pushPage('mealEditor', { dayIndex, mealIndex: 0 })
}

function resolveTodayIndex() {
  if (!plan.value.length) return 0

  const today = todayYmd()
  const exactIndex = plan.value.findIndex((day) => day.date === today)
  if (exactIndex >= 0) return exactIndex

  const startDate = planMeta.value?.startDate || plan.value[0]?.date
  if (!startDate) return 0

  const [year, month, day] = String(startDate).split('-').map(Number)
  if (!year || !month || !day) return 0

  const start = new Date(year, month - 1, day)
  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return Math.min(plan.value.length - 1, Math.max(0, diffDays))
}
</script>

<template>
  <main class="app-shell" :class="{ 'has-tabs': isAppShell, 'has-sub-page': hasSubPage }">
    <div v-if="toastMsg" class="toast-overlay">{{ toastMsg }}</div>

    <div v-if="!view" class="loading-shell">
      <div class="loading-dot"></div>
    </div>

    <template v-else-if="isAppShell">
      <header v-if="hasSubPage" class="top-bar">
        <button type="button" class="top-back-button" aria-label="返回" @click="handleBack">‹</button>
        <h1>{{ topBarTitle }}</h1>
        <span aria-hidden="true"></span>
      </header>

      <section class="app-content page-viewport">
        <div v-if="saveError" class="save-error-banner">{{ saveError }}</div>
        <component
          :is="currentPageComponent"
          :key="pageKey"
          v-bind="currentPageProps"
          @refresh-recipe="handleRefreshRecipe"
          @refresh-day="handleRefreshDay"
          @edit-day-food="handleEditDayFood"
          @view-checkin="handleViewCheckin"
          @edit-meal="handleEditMeal"
          @lock-meal="handleLockMeal"
          @unlock-meal="handleUnlockMeal"
          @replace-meal="handleReplaceMeal"
          @save="handlePageSave"
          @save-meal="handleSaveMeal"
          @cancel-edit="handleCancelMealEdit"
          @done="handleSubPageDone"
          @cancel="handleSubPageCancel"
          @save-weight-logs="handleWeightLogsSave"
          @save-checkins="handleCheckinSave"
          @edit-profile="handleEditProfile"
          @clear-data="handleClearData"
          @import-data="handleImportData"
          @optimize-day="handleTodayOptimize"
        />
      </section>

      <nav v-if="!hasSubPage" class="bottom-tab-bar" aria-label="主导航">
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

    <template v-else>
      <header class="app-header">
        <div>
          <span class="eyebrow">轻盈餐盘</span>
          <h1>减脂餐计划</h1>
        </div>
        <div v-if="headerPill" class="progress-pill">{{ headerPill }}</div>
      </header>

      <div class="app-content wizard-content">
      <Transition name="slide-fade" mode="out-in">
        <InputForm
          v-if="view === 'input'"
          key="input"
          :initial-data="params"
          :edit-mode="editMode"
          @cancel="handleCancelEdit"
          @submit="handleInputSubmit"
        />
        <ScheduleConfirm
          v-else-if="view === 'confirm'"
          key="confirm"
          :params="params"
          :initial-schedule="schedule"
          @back="handleConfirmBack"
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
          @back="handleRecommendBack"
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
    </template>
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
