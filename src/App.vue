<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
import { useAppState } from './composables/useAppState.js'
import { useWizardFlow } from './composables/useWizardFlow.js'
import { usePlanActions } from './composables/usePlanActions.js'
import { useSubPages } from './composables/useSubPages.js'
import { useToast } from './composables/useToast.js'
import { useScrollRestore } from './composables/useScrollRestore.js'

// ── Composables ────────────────────────────────────────────────
const app = useAppState()
const toast = useToast()
const nav = useSubPages(app)
const { queueScrollToPageTop } = useScrollRestore()

// ── Create refs before composables that depend on them ─────────
const activeTab = ref('today')

const wizard = useWizardFlow(app)
const actions = usePlanActions({
  appState: app,
  navigation: nav,
  toast,
  activeTab,
  foodSetupMode: wizard.foodSetupMode,
  view: wizard.view,
})

const { toastMsg } = toast

// ── Expose refs for template auto-unwrapping ───────────────────
const {
  params,
  schedule,
  plan,
  planMeta,
  foodPrefs,
  weightLogs,
  checkins,
  startDate,
  eatingWindow,
  todayChecked,
  dataVersion,
  saveError,
  defaultFoodPreferences,
} = app
const { view, recommendation, foodSetupMode } = wizard
const { hasSubPage, activePage, activePageTitle } = nav

// ── Tab config ─────────────────────────────────────────────────
const tabs = [
  { value: 'foods', label: '食材' },
  { value: 'plan', label: '餐单' },
  { value: 'today', label: '今日' },
  { value: 'progress', label: '进度' },
  { value: 'profile', label: '我的' },
]

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

// ── Computed ───────────────────────────────────────────────────
const isAppShell = computed(() => wizard.view.value === 'shell' && app.plan.value.length > 0)
const activeTabComponent = computed(() => tabComponents[activeTab.value] || TodayDashboard)
const activePageComponent = computed(
  () => subPageComponents[nav.activePage.value?.name] || TodayDashboard,
)
const activePageProps = computed(() => nav.subPageProps(nav.activePage.value))

const activeTabProps = computed(() => ({
  plan: app.plan.value,
  planMeta: app.planMeta.value,
  profile: app.params.value,
  weightLogs: app.weightLogs.value,
  checkins: app.checkins.value,
  foodPreferences: app.foodPrefs.value || app.defaultFoodPreferences,
  startDate: app.startDate.value,
  eatingWindow: app.eatingWindow.value,
  todayChecked: app.todayChecked.value,
  planDays:
    app.plan.value.length ||
    Number(app.planMeta.value?.days) ||
    Number(app.params.value?.days) ||
    7,
}))

// ── Watchers ───────────────────────────────────────────────────
watch(activeTab, (tab) => {
  if (!tabs.some((item) => item.value === tab)) {
    activeTab.value = 'today'
    return
  }
  app.lsSave('activeTab', tab)
  queueScrollToPageTop()
})

watch(wizard.view, () => queueScrollToPageTop())
watch(nav.hasSubPage, () => queueScrollToPageTop())

// ── Init ───────────────────────────────────────────────────────
onMounted(async () => {
  await app.loadAppState()
  try {
    const raw = localStorage.getItem('meal-planner:v1:activeTab')
    const saved = raw ? JSON.parse(raw) : null
    if (saved && tabs.some((t) => t.value === saved)) activeTab.value = saved
  } catch (e) {
    /* ignore */
  }
  nav.clearPageStack()
  wizard.view.value = app.plan.value.length ? 'shell' : 'input'
})

// ── Delegated handlers ─────────────────────────────────────────
async function handleFoodsSave(updatedPrefs, options = {}) {
  const result = await actions.handleFoodsSave(updatedPrefs, options)
  if (result === 'shell') {
    wizard.foodSetupMode.value = false
    activeTab.value = 'today'
    wizard.view.value = 'shell'
  }
}

async function handleClearData() {
  const cleared = await actions.handleClearData()
  if (!cleared) return
  nav.clearPageStack()
  wizard.view.value = 'input'
}

function setActiveTab(tab) {
  if (!tabs.some((item) => item.value === tab)) return
  activeTab.value = tab
}

function handleSubPageSave(payload, options) {
  nav.handleSubPageSave(payload, options, actions)
}

function handleSubPageDone(payload) {
  nav.handleSubPageDone(payload, actions)
}
</script>

<template>
  <main
    class="app-shell"
    :class="{ 'has-tabs': isAppShell && !hasSubPage, 'has-top-bar': hasSubPage }"
  >
    <div v-if="toastMsg" class="toast-overlay">{{ toastMsg }}</div>

    <template v-if="isAppShell">
      <AppTopBar v-if="hasSubPage" :title="activePageTitle" @back="nav.handleBack" />

      <section class="app-content shell-content" :class="{ 'sub-page-content': hasSubPage }">
        <div v-if="saveError" class="save-error-banner">{{ saveError }}</div>
        <component
          :is="activePageComponent"
          v-if="hasSubPage"
          v-bind="activePageProps"
          @save-meal="actions.handleSaveMeal"
          @cancel-edit="actions.handleCancelMealEdit"
          @save="handleSubPageSave"
          @done="handleSubPageDone"
          @close="nav.handleSubPageCancel"
          @cancel="nav.handleSubPageCancel"
          @submit="actions.handleProfileEditSubmit"
          @edit-profile="nav.pushPage('profileEdit')"
          @clear-data="handleClearData"
          @import-data="actions.handleImportData"
          @delete-weight-log="actions.handleDeleteWeightLog"
          @delete-checkin="actions.handleDeleteCheckin"
          @export-data="actions.handleExportData"
        />
        <component
          :is="activeTabComponent"
          v-else
          :key="dataVersion"
          v-bind="activeTabProps"
          @edit-meal="actions.handleEditMeal"
          @edit-day-food="actions.handleEditDayFood"
          @optimize-day="actions.handleTodayOptimize"
          @view-full-plan="actions.handleViewTodayPlan"
          @record-weight="nav.pushPage('weightEntry')"
          @checkin-today="nav.pushPage('checkinForm')"
          @refresh-recipe="actions.handleRefreshRecipe"
          @refresh-day="actions.handleRefreshDay"
          @lock-meal="actions.handleLockMeal"
          @unlock-meal="actions.handleUnlockMeal"
          @replace-meal="actions.handleReplaceMeal"
          @view-checkin="nav.pushPage('checkinForm')"
          @save="handleFoodsSave"
          @weight-logs-save="actions.handleWeightLogsTabSave"
          @checkin-save="actions.handleCheckinTabSave"
          @custom-food="nav.pushPage('customFood')"
          @profile-edit="nav.pushPage('profileEdit')"
          @lifestyle-edit="nav.pushPage('lifestyleEdit')"
          @plan-settings="nav.pushPage('planSettings')"
          @data-backup="nav.pushPage('dataBackup')"
          @clear-data="handleClearData"
          @import-data="actions.handleImportData"
          @delete-weight-log="actions.handleDeleteWeightLog"
          @delete-checkin="actions.handleDeleteCheckin"
          @export-data="actions.handleExportData"
          @import-data-prompt="actions.handleImportDataPrompt"
          @view-plan="actions.handleViewTodayPlan"
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
          v-if="!view || view === 'input'"
          key="input"
          :initial-data="params"
          @submit="wizard.handleInputSubmit"
        />
        <ScheduleConfirm
          v-else-if="view === 'confirm'"
          key="confirm"
          :params="params"
          :initial-schedule="schedule"
          @back="wizard.handleConfirmBack"
          @confirm="wizard.handleConfirm"
        />
        <RecommendView
          v-else-if="view === 'recommend' && recommendation"
          key="recommend"
          :profile="params"
          :diet-suggestion="recommendation.dietSuggestion"
          :deficit-suggestion="recommendation.deficitSuggestion"
          :schedule-suggestion="recommendation.scheduleSuggestion"
          :macro-targets="recommendation.macroTargets"
          @back="wizard.handleRecommendBack"
          @accept="wizard.handleRecommendAccept"
        />
        <FoodPreferences
          v-else-if="view === 'foods'"
          key="foods"
          :food-preferences="foodPrefs || defaultFoodPreferences"
          mode="setup"
          @save="handleFoodsSave"
          @close="wizard.handleFoodsClose"
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
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
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
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
