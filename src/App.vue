<script setup>
import { computed, onMounted, ref } from 'vue'
import InputForm from './components/InputForm.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import RecommendView from './components/RecommendView.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import {
  clearAllData,
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
  generateMealPlan,
  generateSchedule,
  generateScheduleFromProfile,
} from './utils/planGenerator.js'

const LS_PREFIX = 'meal-planner:v1:'

const view = ref(null) // null = loading; 'input' | 'recommend' | 'confirm' | 'plan'
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const editMode = ref(false)
const planMeta = ref(null)
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
    const appState = await getAppState()
    const lp = appState.latestPlan
    params.value = lp?.paramsSnapshot || appState.profile || null
    schedule.value = appState.schedule || appState.latestPlan?.scheduleSnapshot || null
    plan.value = lp?.plan || []
    planMeta.value = plan.value.length
      ? {
          startDate: lp?.startDate ?? plan.value[0]?.date ?? null,
          generatedAt: lp?.generatedAt ?? null,
          scheduleSnapshot: lp?.scheduleSnapshot ?? null,
          paramsSnapshot: lp?.paramsSnapshot ?? null,
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

// ── Plan metadata helper ─────────────────────────────────────────────

function setPlanMeta(planArr) {
  const now = new Date()
  planMeta.value = {
    generatedAt: now.toISOString(),
    startDate: planArr[0]?.date ?? now.toISOString().slice(0, 10),
  }
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
  plan.value = generateMealPlan(confirmedParams, confirmedSchedule)
  setPlanMeta(plan.value)

  // 1. localStorage sync — instant, never blocks UI
  lsSave('profile', confirmedParams)
  lsSave('schedule', confirmedSchedule)
  lsSave('latestPlan', {
    plan: plan.value,
    ...planMeta.value,
    scheduleSnapshot: schedule.value,
    paramsSnapshot: params.value,
  })

  // 2. Switch view immediately
  view.value = 'plan'

  // 3. IndexedDB in background — fire and forget
  bgSave(confirmedParams, confirmedSchedule, plan.value, planMeta.value)
}

function handleEditProfile() {
  editMode.value = true
  view.value = 'input'
}

function handleCancelEdit() {
  editMode.value = false
  view.value = 'plan'
}

async function handleRegeneratePlan() {
  let sched = schedule.value || planMeta.value?.scheduleSnapshot
  const prof = params.value || planMeta.value?.paramsSnapshot

  if (!prof) {
    saveError.value = '缺少个人资料，请先填写资料'
    return
  }
  if (!sched) {
    const defaultTimes = generateSchedule(4)
    sched = {
      mealCount: 4,
      mealNames: ['早餐', '午餐', '下午加餐', '晚餐'],
      times: defaultTimes,
      split: [0.28, 0.38, 0.1, 0.24],
    }
  }

  params.value = prof
  schedule.value = sched
  plan.value = generateMealPlan(prof, sched)
  setPlanMeta(plan.value)

  lsSave('latestPlan', {
    plan: plan.value,
    ...planMeta.value,
    scheduleSnapshot: sched,
    paramsSnapshot: prof,
  })

  view.value = 'plan'
  bgSave(prof, sched, plan.value, planMeta.value)
  showToast('✅ 已重新生成减脂计划')
}

async function handleClearData() {
  try {
    await clearAllData()
  } catch (e) { /* */ }
  for (const k of ['profile', 'schedule', 'latestPlan']) lsRemove(k)
  params.value = null
  schedule.value = null
  plan.value = []
  editMode.value = false
  recommendation.value = null
  planMeta.value = null
  saveError.value = ''
  saving.value = false
  view.value = 'input'
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
      <div v-if="view !== 'plan'" class="progress-pill">{{ progress }}/3</div>
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
          @edit-profile="handleEditProfile"
          @regenerate="handleRegeneratePlan"
          @clear-data="handleClearData"
        />
      </section>
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
