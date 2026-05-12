<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import BottomTabBar from './components/BottomTabBar.vue'
import DayFoodEditor from './components/DayFoodEditor.vue'
import FoodPreferences from './components/FoodPreferences.vue'
import FoodsPage from './components/FoodsPage.vue'
import InputForm from './components/InputForm.vue'
import MealEditor from './components/MealEditor.vue'
import PlanPage from './components/PlanPage.vue'
import ProfilePage from './components/ProfilePage.vue'
import ProfileView from './components/ProfileView.vue'
import ProgressPage from './components/ProgressPage.vue'
import RecommendView from './components/RecommendView.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import TodayDashboard from './components/TodayDashboard.vue'
import WeightProgress from './components/WeightProgress.vue'
import CheckinProgress from './components/CheckinProgress.vue'
import {
  clearAllData,
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
} from './utils/planGenerator.js'
import { DEFAULT_FOODS } from './utils/foodMeta.js'
import { normalizeDietMethod, normalizeEatingWindow } from './utils/scheduleUtils.js'
import {
  clearPageStack,
  pageStack,
  popPage,
  pushPage,
} from './stores/navigationStore.js'
import { useToast } from './composables/useToast.js'
import { useScrollRestore } from './composables/useScrollRestore.js'
import * as planService from './services/plan.js'

const LS_PREFIX = 'meal-planner:v1:'
const defaultFoodPreferences = emptyPreferences()

const { toastMsg, showToast } = useToast()
const { queueScrollToPageTop } = useScrollRestore()

const tabs = [
  { value: 'foods', label: '食材' },
  { value: 'plan', label: '餐单' },
  { value: 'today', label: '今日' },
  { value: 'progress', label: '进度' },
  { value: 'profile', label: '我的' },
]

const titleMap = {
  mealEditor: '编辑单餐',
  dayFoodEditor: '编辑今日菜单',
  weightEntry: '身体记录',
  checkinForm: '今日打卡',
  dataBackup: '数据备份/恢复',
  profileEdit: '修改资料',
  lifestyleEdit: '生活习惯',
  planSettings: '饮食计划',
  customFood: '食材偏好',
}

const tabComponents = {
  foods: FoodsPage,
  plan: PlanPage,
  today: TodayDashboard,
  progress: ProgressPage,
  profile: ProfilePage,
}

const subPageComponents = {
  mealEditor: MealEditor,
  dayFoodEditor: DayFoodEditor,
  weightEntry: WeightProgress,
  checkinForm: CheckinProgress,
  dataBackup: ProfileView,
  profileEdit: InputForm,
  lifestyleEdit: InputForm,
  planSettings: InputForm,
  customFood: FoodPreferences,
}

const view = ref(null)
const activeTab = ref('today')
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const planMeta = ref(null)
const foodPrefs = ref(null)
const weightLogs = ref([])
const checkins = ref([])
const foodSetupMode = ref(false)
const recommendation = ref(null)
const saveError = ref('')
const saving = ref(false)
const dataVersion = ref(0)

const isAppShell = computed(() => view.value === 'shell' && plan.value.length > 0)
const activeTabComponent = computed(() => tabComponents[activeTab.value] || TodayDashboard)
const activePage = computed(() => pageStack[pageStack.length - 1] || null)
const activePageTitle = computed(() => titleMap[activePage.value?.name] || '详情')
const activePageComponent = computed(() => subPageComponents[activePage.value?.name] || TodayDashboard)
const hasSubPage = computed(() => pageStack.length > 0)
const startDate = computed(() => planMeta.value?.startDate || plan.value[0]?.date || null)
const eatingWindow = computed(() =>
  planMeta.value?.eatingWindow || schedule.value?.eatingWindow || params.value?.eatingWindow || null,
)
const todayYmd = computed(() => formatDateYmd(new Date()))
const todayChecked = computed(() =>
  checkins.value.some((checkin) => checkin?.date === todayYmd.value),
)
const availableFoodsForEditors = computed(() => {
  const selected = getAvailableFoods(foodPrefs.value)
  return selected.length ? selected : DEFAULT_FOODS
})
const activeTabProps = computed(() => ({
  plan: plan.value,
  planMeta: planMeta.value,
  profile: params.value,
  weightLogs: weightLogs.value,
  checkins: checkins.value,
  foodPreferences: foodPrefs.value || defaultFoodPreferences,
  startDate: startDate.value,
  eatingWindow: eatingWindow.value,
  todayChecked: todayChecked.value,
  planDays: plan.value.length || Number(planMeta.value?.days) || Number(params.value?.days) || 7,
}))
const activePageProps = computed(() => subPageProps(activePage.value))

watch(activeTab, (tab) => {
  if (!tabs.some((item) => item.value === tab)) {
    activeTab.value = 'today'
    return
  }
  lsSave('activeTab', tab)
  queueScrollToPageTop()
})

watch(view, () => queueScrollToPageTop())
watch(hasSubPage, () => queueScrollToPageTop())

onMounted(loadAppState)

// ── App State ─────────────────────────────────────────────────
async function loadAppState() {
  try {
    const [appState, loadedFoodPrefs, loadedWeightLogs, loadedCheckins] = await Promise.all([
      getAppState(),
      loadFoodPreferences(),
      loadWeightLogs(),
      loadCheckins(),
    ])
    const latestPlan = appState.latestPlan
    const rawLatestPlan = readJsonFromLocalStorage('latestPlan')
    const localProfile = readJsonFromLocalStorage('profile')
    const localSchedule = readJsonFromLocalStorage('schedule')
    const localLatestPlanArray = Array.isArray(rawLatestPlan) ? rawLatestPlan : rawLatestPlan?.plan
    const loadedPlan = latestPlan?.plan || localLatestPlanArray || []
    const loadedSchedule =
      appState.schedule
      || latestPlan?.scheduleSnapshot
      || rawLatestPlan?.scheduleSnapshot
      || localSchedule
      || null
    const loadedEatingWindow =
      rawLatestPlan?.eatingWindow
      ?? rawLatestPlan?.paramsSnapshot?.eatingWindow
      ?? rawLatestPlan?.scheduleSnapshot?.eatingWindow
      ?? loadedSchedule?.eatingWindow
      ?? latestPlan?.eatingWindow
      ?? latestPlan?.scheduleSnapshot?.eatingWindow
      ?? null
    const loadedParams =
      latestPlan?.paramsSnapshot
      || rawLatestPlan?.paramsSnapshot
      || appState.profile
      || localProfile
      || null

    foodPrefs.value = loadedFoodPrefs
    weightLogs.value = loadedWeightLogs
    checkins.value = loadedCheckins
    params.value =
      loadedParams && loadedEatingWindow
        ? { ...loadedParams, eatingWindow: loadedEatingWindow }
        : loadedParams
    schedule.value =
      loadedSchedule && loadedEatingWindow && !loadedSchedule.eatingWindow
        ? { ...loadedSchedule, eatingWindow: loadedEatingWindow }
        : loadedSchedule
    plan.value = Array.isArray(loadedPlan) ? loadedPlan : []
    planMeta.value = plan.value.length
      ? buildPlanMeta(latestPlan, rawLatestPlan, loadedEatingWindow)
      : null

    activeTab.value = 'today'
    clearPageStack()
    view.value = plan.value.length ? 'shell' : 'input'
  } catch (error) {
    console.warn('Failed to initialize app state', error)
    view.value = 'input'
  }
}

function buildPlanMeta(latestPlan, rawLatestPlan, loadedEatingWindow) {
  return {
    startDate: latestPlan?.startDate ?? rawLatestPlan?.startDate ?? plan.value[0]?.date ?? null,
    generatedAt: latestPlan?.generatedAt ?? rawLatestPlan?.generatedAt ?? null,
    scheduleSnapshot: latestPlan?.scheduleSnapshot ?? rawLatestPlan?.scheduleSnapshot ?? null,
    paramsSnapshot: latestPlan?.paramsSnapshot ?? rawLatestPlan?.paramsSnapshot ?? null,
    days: rawLatestPlan?.days ?? latestPlan?.days ?? plan.value.length,
    dietMethod: rawLatestPlan?.dietMethod ?? latestPlan?.dietMethod ?? null,
    deficitPercent: rawLatestPlan?.deficitPercent ?? latestPlan?.deficitPercent ?? null,
    targetCalories: rawLatestPlan?.targetCalories ?? latestPlan?.targetCalories ?? null,
    macros: rawLatestPlan?.macros ?? latestPlan?.macros ?? null,
    recommendationReason:
      rawLatestPlan?.recommendationReason ?? latestPlan?.recommendationReason ?? null,
    eatingWindow: loadedEatingWindow,
  }
}

function lsSave(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  } catch (e) {
    // localStorage is best effort.
  }
}

function readJsonFromLocalStorage(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

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

function currentEatingWindow() {
  const rawWindow = schedule.value?.eatingWindow || params.value?.eatingWindow
  return normalizeEatingWindow(
    params.value,
    rawWindow?.type && rawWindow.type !== 'none' ? rawWindow.type : params.value?.dietMethod,
    rawWindow,
  )
}

function resolveAvailableFoods() {
  const available = getAvailableFoods(foodPrefs.value)
  return available.length ? available : null
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

function handleInputSubmit(nextParams) {
  params.value = nextParams
  buildRecommendation(nextParams)
  view.value = 'recommend'
}

function handleRecommendBack() {
  view.value = 'input'
}

function handleRecommendAccept({
  dietMethod,
  deficitPercent,
  macros,
  schedule: acceptedSchedule,
  eatingWindow,
}) {
  const normalizedMethod = normalizeDietMethod(dietMethod)
  const tdee = calculateTdee(params.value)
  const targetCalories = calculateTargetCaloriesV2(tdee, deficitPercent, params.value.gender)
  const acceptedEatingWindow = normalizeEatingWindow(params.value, normalizedMethod, eatingWindow)
  const enrichedParams = {
    ...params.value,
    dietMethod: normalizedMethod,
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

async function handleFoodsSave(updatedPrefs, options = {}) {
  foodPrefs.value = await saveFoodPreferences(updatedPrefs)

  if (foodSetupMode.value) {
    plan.value = generateMealPlan(
      params.value,
      schedule.value,
      resolveAvailableFoods(),
      currentEatingWindow(),
    )
    setPlanMeta(plan.value, {
      dietMethod: params.value?.dietMethod ?? null,
      deficitPercent: params.value?.deficitPercent ?? null,
      targetCalories: params.value?.targetCalories ?? null,
      macros: params.value?.macroTargets ?? null,
      eatingWindow: currentEatingWindow(),
      recommendationReason: params.value?.recommendationReason ?? null,
    })
    savePlan()
    foodSetupMode.value = false
    activeTab.value = 'today'
    view.value = 'shell'
    return
  }

  const scope = options?.scope || 'save'
  showToast(scope === 'save' ? '已保存食材偏好' : scope === 'today' ? '已应用到今日餐单' : '已应用到后续计划')
  if (scope === 'future' && plan.value.length > 0) {
    plan.value = generateMealPlan(params.value, schedule.value, resolveAvailableFoods(), currentEatingWindow())
    setPlanMeta(plan.value)
    savePlan()
    dataVersion.value++
  } else if (scope === 'today' && plan.value.length > 0) {
    const idx = todayIndex()
    const day = plan.value[idx]
    if (day) {
      const regenerated = regenerateDay(params.value, schedule.value, resolveAvailableFoods(), day, { editSource: 'applyFoodPrefs' }, currentEatingWindow())
      const nextPlan = [...plan.value]
      nextPlan[idx] = regenerated
      plan.value = nextPlan
      savePlan()
      dataVersion.value++
    }
  }
}

function handleFoodsClose() {
  view.value = foodSetupMode.value ? 'confirm' : plan.value.length ? 'shell' : 'input'
}

function setActiveTab(tab) {
  if (!tabs.some((item) => item.value === tab)) return
  activeTab.value = tab
}

function todayIndex() {
  const byDate = plan.value.findIndex((day) => day?.date === todayYmd.value)
  if (byDate >= 0) return byDate
  const start = startDate.value ? parseYmd(startDate.value) : null
  if (!start || Number.isNaN(start.getTime())) return 0
  const current = parseYmd(todayYmd.value)
  const diff = Math.floor((current - start) / (1000 * 60 * 60 * 24))
  return clampIndex(diff)
}

function parseYmd(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}

function clampIndex(index) {
  return Math.min(Math.max(Number(index) || 0, 0), Math.max(plan.value.length - 1, 0))
}

function handleEditMeal({ dayIndex, mealIndex }) {
  pushPage('mealEditor', { dayIndex: clampIndex(dayIndex), mealIndex: Number(mealIndex) || 0 })
}

function handleEditDayFood(dayIndex) {
  pushPage('dayFoodEditor', { dayIndex: clampIndex(dayIndex) })
}

function handleSaveMeal({ dayIndex, mealIndex, meal }) {
  plan.value = planService.saveMeal(plan.value, dayIndex, mealIndex, meal)
  savePlan()
  showToast('已保存单餐')
  popPage()
}

function handleCancelMealEdit() {
  popPage()
}

function handleSaveDayFood({ dayIndex, selectedFoodIds }) {
  const day = plan.value[dayIndex]
  if (!day) return

  const selectedIds = new Set(selectedFoodIds || [])
  const selectedFoods = availableFoodsForEditors.value.filter((food) => selectedIds.has(food.id))
  const regenerated = regenerateDay(
    params.value,
    schedule.value,
    selectedFoods,
    day,
    { strictFoodPool: true, editSource: 'dayFoodPool' },
    currentEatingWindow(),
  )

  const nextPlan = [...plan.value]
  nextPlan[dayIndex] = {
    ...regenerated,
    dayFoodPool: { selectedFoodIds: [...selectedIds] },
  }
  plan.value = nextPlan
  savePlan()
  showToast('已刷新当天餐单')
  popPage()
}

function handleCancelDayFoodEdit() {
  popPage()
}

function handleRefreshRecipe() {
  plan.value = planService.refreshPlan(
    params.value, schedule.value, resolveAvailableFoods(), currentEatingWindow(),
  )
  setPlanMeta(plan.value, {
    dietMethod: params.value?.dietMethod ?? planMeta.value?.dietMethod ?? null,
    deficitPercent: params.value?.deficitPercent ?? planMeta.value?.deficitPercent ?? null,
    targetCalories: params.value?.targetCalories ?? planMeta.value?.targetCalories ?? null,
    macros: params.value?.macroTargets ?? planMeta.value?.macros ?? null,
    eatingWindow: currentEatingWindow(),
    recommendationReason: params.value?.recommendationReason ?? planMeta.value?.recommendationReason ?? null,
  })
  savePlan()
  showToast('已刷新食谱')
}

function handleRefreshDay(dayIndex) {
  const index = clampIndex(dayIndex)
  const day = plan.value[index]
  if (!day) return
  plan.value = plan.value.map((d, i) =>
    i === index
      ? planService.refreshDay(params.value, schedule.value, resolveAvailableFoods(), d, currentEatingWindow())
      : d,
  )
  savePlan()
  showToast('已刷新当天餐单')
}

function handleReplaceMeal({ dayIndex, mealIndex }) {
  plan.value = planService.replaceMeal(
    plan.value, clampIndex(dayIndex), Number(mealIndex) || 0,
    params.value, schedule.value, resolveAvailableFoods(), currentEatingWindow(),
  )
  savePlan()
  showToast('已更换这一餐')
}

function handleLockMeal({ dayIndex, mealIndex }) {
  plan.value = planService.setMealLock(plan.value, clampIndex(dayIndex), mealIndex, true)
  savePlan()
  showToast('已锁定这一餐')
}

function handleUnlockMeal({ dayIndex, mealIndex }) {
  plan.value = planService.setMealLock(plan.value, clampIndex(dayIndex), mealIndex, false)
  savePlan()
  showToast('已取消锁定')
}

function handleTodayOptimize(dayIndex) {
  const index = clampIndex(dayIndex)
  const targetCalories = Number(
    plan.value[index]?.targets?.calories || planMeta.value?.targetCalories || params.value?.targetCalories,
  )
  const { plan: nextPlan, error } = planService.optimizeTodayCalories(plan.value, index, targetCalories)
  if (error) {
    showToast(error)
    return
  }
  plan.value = nextPlan
  savePlan()
  showToast('已优化今日热量')
}

async function handleWeightLogsSave(updatedLogs) {
  weightLogs.value = updatedLogs
  await nextTick()
  dataVersion.value++
  showToast('已保存体重')
  popPage()
}

async function handleCheckinSave(updated) {
  checkins.value = updated
  await nextTick()
  dataVersion.value++
  showToast('已保存打卡')
  popPage()
}

async function handleWeightLogsTabSave(updatedLogs) {
  weightLogs.value = updatedLogs
  await nextTick()
  dataVersion.value++
  showToast('已保存体重')
}

async function handleCheckinTabSave(updated) {
  checkins.value = updated
  await nextTick()
  dataVersion.value++
  showToast('已保存打卡')
}

function handleSubPageSave(payload, options) {
  const pageName = activePage.value?.name
  if (pageName === 'dayFoodEditor') handleSaveDayFood(payload)
  if (pageName === 'weightEntry') handleWeightLogsSave(payload)
  if (pageName === 'checkinForm') handleCheckinSave(payload)
  if (pageName === 'customFood') handleCustomFoodSave(payload, options)
  if (pageName === 'profileEdit' || pageName === 'lifestyleEdit' || pageName === 'planSettings') handleProfileEditSubmit(payload)
}

function handleSubPageDone(payload) {
  if (activePage.value?.name === 'weightEntry') handleWeightLogsSave(payload)
  else if (activePage.value?.name === 'checkinForm') handleCheckinSave(payload)
  else nextTick(() => popPage())
}

function handleSubPageCancel() {
  popPage()
}

async function handleCustomFoodSave(updatedPrefs, options = {}) {
  await handleFoodsSave(updatedPrefs, options)
  popPage()
}

async function handleProfileEditSubmit(updatedProfile) {
  const scope = updatedProfile.scope || 'settings'
  params.value = { ...params.value, ...updatedProfile }
  lsSave('profile', params.value)
  await bgSaveProfileAndSchedule(params.value, schedule.value)

  if (scope === 'restart' && plan.value.length > 0) {
    plan.value = generateMealPlan(params.value, schedule.value, resolveAvailableFoods(), currentEatingWindow())
    setPlanMeta(plan.value)
    savePlan()
    showToast('已重新开始计划')
  } else if (scope === 'today' && plan.value.length > 0) {
    const idx = todayIndex()
    for (let i = idx; i < plan.value.length; i++) {
      const day = plan.value[i]
      plan.value[i] = day?.locked || day?.edited
        ? day
        : regenerateDay(params.value, schedule.value, resolveAvailableFoods(), day, { editSource: 'applySettings' }, currentEatingWindow())
    }
    setPlanMeta(plan.value)
    savePlan()
    showToast('已从今天开始应用')
  } else {
    showToast('已保存设置')
  }
  dataVersion.value++
  popPage()
}

async function handleImportData(data) {
  await importAllData(data)
  await loadAppState()
  showToast('已导入备份')
}

async function handleClearData() {
  if (!confirm('清空全部本地数据？此操作不可撤销。')) return
  await clearAllData()
  params.value = null
  schedule.value = null
  plan.value = []
  planMeta.value = null
  foodPrefs.value = defaultFoodPreferences
  weightLogs.value = []
  checkins.value = []
  clearPageStack()
  view.value = 'input'
  showToast('已清空全部数据')
}

function handleImportDataPrompt() {
  pushPage('dataBackup')
}

function handleViewTodayPlan() {
  activeTab.value = 'plan'
}

function handleBack() {
  popPage()
}

function subPageProps(page) {
  const name = page?.name
  const pageParams = page?.params || {}
  const dayIndex = clampIndex(pageParams.dayIndex)
  const mealIndex = Number(pageParams.mealIndex) || 0
  const day = plan.value[dayIndex] || null
  const meal = day?.meals?.[mealIndex] || null
  const splits = schedule.value?.split?.length ? schedule.value.split : []

  if (name === 'mealEditor') {
    return {
      meal,
      dayIndex,
      mealIndex,
      mealTargetCalories: Number(day?.targets?.calories || planMeta.value?.targetCalories || 0)
        * (splits[mealIndex] || (1 / Math.max(day?.meals?.length || 1, 1))),
      availableFoods: availableFoodsForEditors.value,
    }
  }
  if (name === 'dayFoodEditor') {
    return { day, dayIndex, availableFoods: availableFoodsForEditors.value }
  }
  if (name === 'weightEntry') {
    return {
      weightLogs: weightLogs.value,
      profile: params.value,
      checkins: checkins.value,
      planDays: plan.value.length || Number(planMeta.value?.days) || 7,
      startDate: startDate.value,
      showClose: true,
    }
  }
  if (name === 'checkinForm') {
    return { checkins: checkins.value, showClose: true }
  }
  if (name === 'dataBackup') {
    return { profile: params.value, planMeta: planMeta.value }
  }
  if (name === 'profileEdit') {
    return { initialData: params.value, editMode: true, section: 'body' }
  }
  if (name === 'lifestyleEdit') {
    return { initialData: params.value, editMode: true, section: 'lifestyle' }
  }
  if (name === 'planSettings') {
    return { initialData: params.value, editMode: true, section: 'plan' }
  }
  if (name === 'customFood') {
    return {
      foodPreferences: foodPrefs.value || defaultFoodPreferences,
      mode: 'manage',
      showClose: true,
    }
  }
  return {}
}
</script>

<template>
  <main class="app-shell" :class="{ 'has-tabs': isAppShell && !hasSubPage, 'has-top-bar': hasSubPage }">
    <div v-if="toastMsg" class="toast-overlay">{{ toastMsg }}</div>

    <div v-if="!view" class="loading-shell">
      <div class="loading-dot"></div>
    </div>

    <template v-else-if="isAppShell">
      <AppTopBar v-if="hasSubPage" :title="activePageTitle" @back="handleBack" />

      <section class="app-content shell-content" :class="{ 'sub-page-content': hasSubPage }">
        <div v-if="saveError" class="save-error-banner">{{ saveError }}</div>
        <component
          :is="activePageComponent"
          v-if="hasSubPage"
          v-bind="activePageProps"
          @save-meal="handleSaveMeal"
          @cancel-edit="handleCancelMealEdit"
          @save="handleSubPageSave"
          @done="handleSubPageDone"
          @close="handleSubPageCancel"
          @cancel="handleSubPageCancel"
          @submit="handleProfileEditSubmit"
          @edit-profile="pushPage('profileEdit')"
          @clear-data="handleClearData"
          @import-data="handleImportData"
        />
        <component
          :is="activeTabComponent"
          v-else
          :key="dataVersion"
          v-bind="activeTabProps"
          @edit-meal="handleEditMeal"
          @edit-day-food="handleEditDayFood"
          @optimize-day="handleTodayOptimize"
          @view-full-plan="handleViewTodayPlan"
          @record-weight="pushPage('weightEntry')"
          @checkin-today="pushPage('checkinForm')"
          @refresh-recipe="handleRefreshRecipe"
          @refresh-day="handleRefreshDay"
          @lock-meal="handleLockMeal"
          @unlock-meal="handleUnlockMeal"
          @replace-meal="handleReplaceMeal"
          @view-checkin="pushPage('checkinForm')"
          @save="handleFoodsSave"
          @weight-logs-save="handleWeightLogsTabSave"
          @checkin-save="handleCheckinTabSave"
          @custom-food="pushPage('customFood')"
          @profile-edit="pushPage('profileEdit')"
          @lifestyle-edit="pushPage('lifestyleEdit')"
          @plan-settings="pushPage('planSettings')"
          @data-backup="pushPage('dataBackup')"
          @clear-data="handleClearData"
          @import-data="handleImportData"
          @import-data-prompt="handleImportDataPrompt"
          @view-plan="handleViewTodayPlan"
        />
      </section>

      <BottomTabBar
        v-if="!hasSubPage"
        :tabs="tabs"
        :active-tab="activeTab"
        @change="setActiveTab"
      />
    </template>

    <div v-else class="app-content wizard-content">
      <header class="app-header">
        <div>
          <span class="eyebrow">轻盈餐盘</span>
          <h1>减脂餐计划</h1>
        </div>
      </header>
      <Transition name="slide-fade" mode="out-in">
        <InputForm
          v-if="view === 'input'"
          key="input"
          :initial-data="params"
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
          mode="setup"
          @save="handleFoodsSave"
          @close="handleFoodsClose"
        />
        <section v-else key="empty-plan" class="empty-state-panel">
          <strong>还没有餐单</strong>
          <p>完成资料、推荐、餐次和食材设置后，将生成餐单。</p>
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
  background: var(--color-primary);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

.save-error-banner {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-danger);
  font-weight: 700;
  font-size: 0.85rem;
  text-align: center;
}

.toast-overlay {
  position: fixed;
  bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + var(--spacing-md));
  left: 50%;
  z-index: 999;
  max-width: calc(100vw - 2rem);
  padding: 0.6rem 1rem;
  border-radius: var(--radius-pill);
  background: rgba(28, 28, 30, 0.88);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: toast-in 0.2s ease;
}

.has-tabs .toast-overlay {
  bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + var(--spacing-md));
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(1rem); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
