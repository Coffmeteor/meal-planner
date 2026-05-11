<script setup>
import { computed, ref } from 'vue'
import InputForm from './components/InputForm.vue'
import PlanCalendar from './components/PlanCalendar.vue'
import ScheduleConfirm from './components/ScheduleConfirm.vue'
import { generateMealPlan } from './utils/planGenerator.js'

const view = ref('input')
const params = ref(null)
const plan = ref([])

const progress = computed(() => {
  const steps = { input: 1, confirm: 2, plan: 3 }
  return steps[view.value]
})

function handleInputSubmit(nextParams) {
  params.value = nextParams
  view.value = 'confirm'
}

function handleConfirm({ params: confirmedParams, schedule }) {
  params.value = confirmedParams
  plan.value = generateMealPlan(confirmedParams, schedule)
  view.value = 'plan'
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
      <InputForm v-if="view === 'input'" key="input" @submit="handleInputSubmit" />
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
