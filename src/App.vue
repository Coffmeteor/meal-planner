<script setup>
import { computed, onMounted, ref } from 'vue'
import InputForm from './components/InputForm.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import {
  clearAllData,
  getAppState,
  saveLatestPlan,
  saveProfile,
  saveSchedule,
} from './storage/index.js'
import { generateMealPlan } from './utils/planGenerator.js'

const LS_PREFIX = 'meal-planner:v1:'

const view = ref(null) // null = loading; 'input' | 'confirm' | 'plan'
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const editMode = ref(false)
const planMeta = ref(null)
const saveError = ref('')
const saving = ref(false)

const progress = computed(() => {
  const steps = { input: 1, confirm: 2, plan: 3 }
  return steps[view.value] || 0
})

// ── Startup ──────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const appState = await getAppState()
    params.value = appState.profile
    schedule.value = appState.schedule
    const lp = appState.latestPlan
    plan.value = lp?.plan || []
    planMeta.value = plan.value.length
      ? {
          startDate: lp?.startDate ?? plan.value[0]?.date ?? null,
          generatedAt: lp?.generatedAt ?? null,
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
      saveLatestPlan({ plan: planData, ...meta }),
    ])
    saveError.value = ''
  } catch (e) {
    saveError.value = '本地保存失败，数据可能下次无法恢复'
    console.warn('IndexedDB bg save failed', e)
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

// ── Handlers ─────────────────────────────────────────────────────────

function handleInputSubmit(nextParams) {
  params.value = nextParams
  if (editMode.value) {
    handleSaveAndRegenerate(nextParams)
  } else {
    view.value = 'confirm'
  }
}

function handleConfirm({ params: confirmedParams, schedule: confirmedSchedule }) {
  params.value = confirmedParams
  schedule.value = confirmedSchedule
  plan.value = generateMealPlan(confirmedParams, confirmedSchedule)
  setPlanMeta(plan.value)

  // 1. localStorage sync — instant, never blocks UI
  lsSave('profile', confirmedParams)
  lsSave('schedule', confirmedSchedule)
  lsSave('latestPlan', { plan: plan.value, ...planMeta.value })

  // 2. Switch view immediately
  view.value = 'plan'

  // 3. IndexedDB in background — fire and forget
  bgSave(confirmedParams, confirmedSchedule, plan.value, planMeta.value)
}

function handleEditProfile() {
  editMode.value = true
  view.value = 'input'
}

function handleSaveAndRegenerate(newParams) {
  editMode.value = false
  params.value = newParams

  if (!schedule.value) {
    lsSave('profile', newParams)
    bgSave(newParams, null, plan.value, planMeta.value)
    view.value = 'confirm'
    return
  }

  plan.value = generateMealPlan(newParams, schedule.value)
  setPlanMeta(plan.value)

  lsSave('profile', newParams)
  lsSave('latestPlan', { plan: plan.value, ...planMeta.value })

  view.value = 'plan'
  bgSave(newParams, schedule.value, plan.value, planMeta.value)
}

function handleCancelEdit() {
  editMode.value = false
  view.value = 'plan'
}

function handleRegeneratePlan() {
  if (!params.value || !schedule.value) return
  plan.value = generateMealPlan(params.value, schedule.value)
  setPlanMeta(plan.value)

  lsSave('latestPlan', { plan: plan.value, ...planMeta.value })

  view.value = 'plan'
  bgSave(params.value, schedule.value, plan.value, planMeta.value)
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
  planMeta.value = null
  saveError.value = ''
  saving.value = false
  view.value = 'input'
}
</script>

<template>
  <main class="app-shell">
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
        @back="view = 'input'"
        @confirm="handleConfirm"
      />
      <section v-else key="plan" class="result-stack">
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
</style>
