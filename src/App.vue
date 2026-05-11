<script setup>
import { computed, onMounted, ref } from 'vue'
import InputForm from './components/InputForm.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import {
  clearAllData,
  getAppState,
  loadLatestPlan,
  saveLatestPlan,
  saveProfile,
  saveSchedule,
} from './storage/index.js'
import { generateMealPlan } from './utils/planGenerator.js'

const view = ref('input')
const params = ref(null)
const schedule = ref(null)
const plan = ref([])
const editMode = ref(false)
const planMeta = ref(null)
const saveError = ref('')

const progress = computed(() => {
  const steps = { input: 1, confirm: 2, plan: 3 }
  return steps[view.value]
})

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

    if (plan.value.length) {
      view.value = 'plan'
    } else {
      view.value = 'input'
    }
  } catch (error) {
    console.warn('Failed to initialize app state', error)
  }
})

// ── helpers ─────────────────────────────────────────────────────────

async function saveAllAndVerify(profileData, scheduleData, planData, planMetaData) {
  saveError.value = ''

  const [profileOk, scheduleOk, planOk] = await Promise.all([
    saveProfile(profileData),
    saveSchedule(scheduleData),
    saveLatestPlan({ plan: planData, ...planMetaData }),
  ])

  if (!planOk) {
    saveError.value = '本地保存失败，请不要关闭页面，建议刷新后重试'
    console.warn('IndexedDB write failed for latestPlan')
    return false
  }

  // Verify by re-reading
  const verify = await loadLatestPlan()
  if (!verify?.plan?.length) {
    saveError.value = '保存校验失败，请勿关闭页面'
    console.warn('Save verification failed — latestPlan not readable after write')
    return false
  }

  return true
}

function setPlanMeta(planArr) {
  const now = new Date()
  planMeta.value = {
    generatedAt: now.toISOString(),
    startDate: planArr[0]?.date ?? now.toISOString().slice(0, 10),
  }
}

// ── handlers ────────────────────────────────────────────────────────

function handleInputSubmit(nextParams) {
  params.value = nextParams
  if (editMode.value) {
    handleSaveAndRegenerate(nextParams)
  } else {
    view.value = 'confirm'
  }
}

async function handleConfirm({ params: confirmedParams, schedule: confirmedSchedule }) {
  params.value = confirmedParams
  schedule.value = confirmedSchedule
  plan.value = generateMealPlan(confirmedParams, confirmedSchedule)
  setPlanMeta(plan.value)
  const ok = await saveAllAndVerify(confirmedParams, confirmedSchedule, plan.value, planMeta.value)
  if (ok) view.value = 'plan'
  // If not ok, stay on current view with saveError shown
}

function handleEditProfile() {
  editMode.value = true
  view.value = 'input'
}

async function handleSaveAndRegenerate(newParams) {
  editMode.value = false
  params.value = newParams

  if (!schedule.value) {
    await saveProfile(newParams)
    view.value = 'confirm'
    return
  }

  plan.value = generateMealPlan(newParams, schedule.value)
  setPlanMeta(plan.value)
  const ok = await saveAllAndVerify(newParams, schedule.value, plan.value, planMeta.value)
  if (ok) view.value = 'plan'
}

function handleCancelEdit() {
  editMode.value = false
  view.value = 'plan'
}

async function handleRegeneratePlan() {
  if (!params.value || !schedule.value) return
  plan.value = generateMealPlan(params.value, schedule.value)
  setPlanMeta(plan.value)
  const ok = await saveAllAndVerify(params.value, schedule.value, plan.value, planMeta.value)
  if (ok) view.value = 'plan'
}

async function handleClearData() {
  try {
    await clearAllData()
  } catch (error) {
    console.warn('Failed to clear app data', error)
  }
  params.value = null
  schedule.value = null
  plan.value = []
  editMode.value = false
  planMeta.value = null
  saveError.value = ''
  view.value = 'input'
}
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <div>
        <span class="eyebrow">轻盈餐盘</span>
        <h1>减脂餐计划</h1>
      </div>
      <div class="progress-pill">{{ progress }}/3</div>
    </header>

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
