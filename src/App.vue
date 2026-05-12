<script setup>
import { computed, defineComponent, nextTick, onMounted, ref, watch } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import BottomTabBar from './components/BottomTabBar.vue'
import FoodPreferences from './components/FoodPreferences.vue'
import FoodsPage from './components/FoodsPage.vue'
import InputForm from './components/InputForm.vue'
import PlanPage from './components/PlanPage.vue'
import ProfilePage from './components/ProfilePage.vue'
import ProgressPage from './components/ProgressPage.vue'
import RecommendView from './components/RecommendView.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import TodayDashboard from './components/TodayDashboard.vue'
import {
  getAppState,
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
} from './utils/planGenerator.js'
import { normalizeDietMethod, normalizeEatingWindow } from './utils/scheduleUtils.js'
import {
  clearPageStack,
  pageStack,
  popPage,
  pushPage,
} from './stores/navigationStore.js'

const LS_PREFIX = 'meal-planner:v1:'
const defaultFoodPreferences = emptyPreferences()

const tabs = [
  { value: 'foods', label: '食材', icon: '🥬' },
  { value: 'plan', label: '餐单', icon: '🍱' },
  { value: 'today', label: '今日', icon: '☀️' },
  { value: 'progress', label: '进度', icon: '📈' },
  { value: 'profile', label: '我的', icon: '🙂' },
]

const titleMap = {
  dayFoodEditor: '编辑今日菜单',
  weightLogger: '记录体重',
  todayCheckin: '今日打卡',
}

const tabComponents = {
  foods: FoodsPage,
  plan: PlanPage,
  today: TodayDashboard,
  progress: ProgressPage,
  profile: ProfilePage,
}

const DemoSubPage = defineComponent({
  name: 'DemoSubPage',
  props: {
    page: {
      type: Object,
      required: true,
    },
  },
  computed: {
    heading() {
      return titleMap[this.page?.name] || '演示页面'
    },
    dateText() {
      return this.page?.params?.date || ''
    },
  },
  template: `
    <section class="sub-page-demo shell-card">
      <p class="sub-page-kicker">Demo</p>
      <h2>{{ heading }}</h2>
      <p v-if="dateText">日期：{{ dateText }}</p>
      <div class="empty-card-content"></div>
    </section>
  `,
})

const view = ref(null)
const activeTab = ref('today')
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const planMeta = ref(null)
const foodPrefs = ref(null)
const foodSetupMode = ref(false)
const recommendation = ref(null)
const saveError = ref('')
const saving = ref(false)
const toastMsg = ref('')

const isAppShell = computed(() => view.value === 'shell' && plan.value.length > 0)
const activeTabComponent = computed(() => tabComponents[activeTab.value] || TodayDashboard)
const activePage = computed(() => pageStack[pageStack.length - 1] || null)
const activePageTitle = computed(() => titleMap[activePage.value?.name] || '详情')
const activePageComponent = computed(() => DemoSubPage)
const hasSubPage = computed(() => pageStack.length > 0)

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

let toastTimer = null
function showToast(msg) {
  toastMsg.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMsg.value = ''
  }, 2200)
}

let scrollPending = false
function queueScrollToPageTop() {
  if (scrollPending) return
  scrollPending = true
  nextTick(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
      scrollPending = false
    })
  })
}

async function loadAppState() {
  try {
    const [appState, loadedFoodPrefs] = await Promise.all([
      getAppState(),
      loadFoodPreferences(),
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

async function handleFoodsSave(updatedPrefs) {
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

  showToast('已保存食材')
}

function handleFoodsClose() {
  view.value = foodSetupMode.value ? 'confirm' : plan.value.length ? 'shell' : 'input'
}

function setActiveTab(tab) {
  if (!tabs.some((item) => item.value === tab)) return
  activeTab.value = tab
}

function pushTodayMenuDemo() {
  pushPage('dayFoodEditor', { date: formatDateYmd(new Date()) })
}

function handleOptimizeTodayCalories() {
  showToast('已提交热量优化演示')
}

function pushWeightDemo() {
  pushPage('weightLogger', { date: formatDateYmd(new Date()) })
}

function pushCheckinDemo() {
  pushPage('todayCheckin', { date: formatDateYmd(new Date()) })
}
</script>

<template>
  <main class="app-shell" :class="{ 'has-tabs': isAppShell && !hasSubPage, 'has-top-bar': hasSubPage }">
    <div v-if="toastMsg" class="toast-overlay">{{ toastMsg }}</div>

    <div v-if="!view" class="loading-shell">
      <div class="loading-dot"></div>
    </div>

    <template v-else-if="isAppShell">
      <AppTopBar v-if="hasSubPage" :title="activePageTitle" @back="popPage" />

      <section class="app-content shell-content" :class="{ 'sub-page-content': hasSubPage }">
        <div v-if="saveError" class="save-error-banner">{{ saveError }}</div>
        <component
          :is="activePageComponent"
          v-if="hasSubPage"
          :page="activePage"
        />
        <component
          :is="activeTabComponent"
          v-else
          :plan="plan"
          :plan-meta="planMeta"
          :profile="params"
          @edit-today-menu="pushTodayMenuDemo"
          @optimize-today-calories="handleOptimizeTodayCalories"
          @record-weight="pushWeightDemo"
          @checkin-today="pushCheckinDemo"
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
  z-index: 999;
  max-width: calc(100vw - 2rem);
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  background: #2d3436;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  transform: translateX(-50%);
  animation: toast-in 0.25s ease;
}

.has-tabs .toast-overlay {
  bottom: calc(5.6rem + env(safe-area-inset-bottom));
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(1rem); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
