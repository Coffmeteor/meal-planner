<script setup>
import { computed, onMounted, ref } from 'vue'
import InputForm from './components/InputForm.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import WelcomeHome from './components/WelcomeHome.vue'
import {
  clearAllData,
  getAppState,
  saveLatestPlan,
  saveProfile,
  saveSchedule,
} from './storage/index.js'
import { generateMealPlan } from './utils/planGenerator.js'

const view = ref('input')
const params = ref(null)
const schedule = ref(null)
const plan = ref([])

const progress = computed(() => {
  const steps = { home: 0, input: 1, confirm: 2, plan: 3 }
  return steps[view.value]
})

onMounted(async () => {
  try {
    const appState = await getAppState()
    params.value = appState.profile
    schedule.value = appState.schedule
    plan.value = Array.isArray(appState.latestPlan) ? appState.latestPlan : []

    if (params.value || plan.value.length) {
      view.value = 'home'
    }
  } catch (error) {
    console.warn('Failed to initialize app state', error)
  }
})

function handleInputSubmit(nextParams) {
  params.value = nextParams
  void saveProfile(nextParams)
  view.value = 'confirm'
}

function handleConfirm({ params: confirmedParams, schedule: confirmedSchedule }) {
  params.value = confirmedParams
  schedule.value = confirmedSchedule
  plan.value = generateMealPlan(confirmedParams, confirmedSchedule)
  void saveProfile(confirmedParams)
  void saveSchedule(confirmedSchedule)
  void saveLatestPlan(plan.value)
  view.value = 'plan'
}

function continuePlan() {
  if (plan.value.length) {
    view.value = 'plan'
    return
  }

  regeneratePlan()
}

function modifyProfile() {
  view.value = 'input'
}

function regeneratePlan() {
  if (!params.value) {
    view.value = 'input'
    return
  }

  if (!schedule.value) {
    view.value = 'confirm'
    return
  }

  plan.value = generateMealPlan(params.value, schedule.value)
  void saveLatestPlan(plan.value)
  view.value = 'plan'
}

async function clearData() {
  try {
    await clearAllData()
  } catch (error) {
    console.warn('Failed to clear app data', error)
  }

  params.value = null
  schedule.value = null
  plan.value = []
  view.value = 'input'
}

function restart() {
  view.value = 'input'
  plan.value = []
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
      <WelcomeHome
        v-if="view === 'home'"
        key="home"
        @continue="continuePlan"
        @modify="modifyProfile"
        @regenerate="regeneratePlan"
        @clear="clearData"
      />
      <InputForm
        v-else-if="view === 'input'"
        key="input"
        :initial-data="params"
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
        <PlanCalendar :plan="plan" />
        <button type="button" class="ghost-action full-width" @click="restart">重新填写</button>
      </section>
    </Transition>
  </main>
</template>
