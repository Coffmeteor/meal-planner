// Composable: useAppState — core reactive state + persistence
// Extracts all data refs, load/save logic, and derived state from App.vue.
import { computed, ref } from 'vue'
import {
  clearAllData,
  getAppState,
  importAllData,
  loadCheckins,
  loadWeightLogs,
  migrateFromLocalStorage,
  saveCheckin,
  saveLatestPlan,
  saveProfile,
  saveSchedule,
  saveWeightLog,
} from '../adapters/storage/index.js'
import { emptyPreferences, getAvailableFoods } from '../domain/food-preferences/index.js'
import { loadFoodPreferences, saveFoodPreferences } from '../services/food-preferences.js'
import { DEFAULT_FOODS } from '../utils/foodMeta.js'
import { normalizeEatingWindow } from '../domain/meal-plan/scheduleUtils.js'

const LS_PREFIX = 'meal-planner:v1:'

export function lsSave(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  } catch (_e) {
    // localStorage is best effort.
  }
}

function formatDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseYmd(value) {
  const [year, month, day] = String(value || '')
    .split('-')
    .map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}

export function useAppState() {
  // ── Core state ────────────────────────────────────────────────
  const params = ref(null)
  const schedule = ref(null)
  const plan = ref([])
  const planMeta = ref(null)
  const foodPrefs = ref(null)
  const weightLogs = ref([])
  const checkins = ref([])
  const saveError = ref('')
  const saving = ref(false)
  const dataVersion = ref(0)
  const defaultFoodPreferences = emptyPreferences()

  // ── Derived state ─────────────────────────────────────────────
  const startDate = computed(() => planMeta.value?.startDate || plan.value[0]?.date || null)
  const eatingWindow = computed(
    () =>
      planMeta.value?.eatingWindow ||
      schedule.value?.eatingWindow ||
      params.value?.eatingWindow ||
      null,
  )
  const todayYmd = computed(() => formatDateYmd(new Date()))
  const todayChecked = computed(() =>
    checkins.value.some((checkin) => checkin?.date === todayYmd.value),
  )
  const availableFoodsForEditors = computed(() => {
    const selected = getAvailableFoods(foodPrefs.value)
    return selected.length ? selected : DEFAULT_FOODS
  })

  // ── Index helpers ─────────────────────────────────────────────
  function clampIndex(index) {
    return Math.min(Math.max(Number(index) || 0, 0), Math.max(plan.value.length - 1, 0))
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

  // ── Persistence ───────────────────────────────────────────────
  async function loadAppState() {
    try {
      // One-time localStorage → IDB migration, then IDB is the sole read source
      await migrateFromLocalStorage()

      const [appState, loadedFoodPrefs, loadedWeightLogs, loadedCheckins] = await Promise.all([
        getAppState(),
        loadFoodPreferences(),
        loadWeightLogs(),
        loadCheckins(),
      ])
      const latestPlan = appState.latestPlan
      const loadedPlan = latestPlan?.plan || []
      const loadedSchedule = appState.schedule || latestPlan?.scheduleSnapshot || null
      const loadedEatingWindow =
        latestPlan?.eatingWindow ??
        latestPlan?.scheduleSnapshot?.eatingWindow ??
        loadedSchedule?.eatingWindow ??
        null
      const loadedParams = latestPlan?.paramsSnapshot || appState.profile || null

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
      planMeta.value = plan.value.length ? buildPlanMeta(latestPlan, loadedEatingWindow) : null
    } catch (error) {
      console.warn('Failed to initialize app state', error)
    }
  }

  function buildPlanMeta(latestPlan, loadedEatingWindow) {
    return {
      startDate: latestPlan?.startDate ?? plan.value[0]?.date ?? null,
      generatedAt: latestPlan?.generatedAt ?? null,
      scheduleSnapshot: latestPlan?.scheduleSnapshot ?? null,
      paramsSnapshot: latestPlan?.paramsSnapshot ?? null,
      days: latestPlan?.days ?? plan.value.length,
      dietMethod: latestPlan?.dietMethod ?? null,
      deficitPercent: latestPlan?.deficitPercent ?? null,
      targetCalories: latestPlan?.targetCalories ?? null,
      macros: latestPlan?.macros ?? null,
      recommendationReason: latestPlan?.recommendationReason ?? null,
      eatingWindow: loadedEatingWindow,
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
    } catch (_e) {
      saveError.value = '本地保存失败，数据可能下次无法恢复'
      console.warn('IndexedDB bg save failed', _e)
    } finally {
      saving.value = false
    }
  }

  async function bgSaveProfileAndSchedule(profileData, scheduleData) {
    saving.value = true
    try {
      await Promise.all([saveProfile(profileData), saveSchedule(scheduleData)])
      saveError.value = ''
    } catch (_e) {
      saveError.value = '本地保存失败，数据可能下次无法恢复'
      console.warn('IndexedDB profile/schedule save failed', _e)
    } finally {
      saving.value = false
    }
  }

  function persistPlan() {
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
        recommendationFields.eatingWindow ??
        schedule.value?.eatingWindow ??
        params.value?.eatingWindow ??
        null,
      recommendationReason:
        recommendationFields.recommendationReason ?? params.value?.recommendationReason ?? null,
    }
  }

  async function saveWeightLogEntry(payload) {
    weightLogs.value = await saveWeightLog(payload)
    dataVersion.value++
  }

  async function saveCheckinEntry(payload) {
    checkins.value = await saveCheckin(payload)
    dataVersion.value++
  }

  async function saveFoodPrefs(updatedPrefs) {
    foodPrefs.value = await saveFoodPreferences(updatedPrefs)
    return foodPrefs.value
  }

  async function importData(data) {
    await importAllData(data)
    await loadAppState()
  }

  async function clearData() {
    await clearAllData()
    params.value = null
    schedule.value = null
    plan.value = []
    planMeta.value = null
    foodPrefs.value = defaultFoodPreferences
    weightLogs.value = []
    checkins.value = []
  }

  return {
    // Core state
    params,
    schedule,
    plan,
    planMeta,
    foodPrefs,
    weightLogs,
    checkins,
    saveError,
    saving,
    dataVersion,
    defaultFoodPreferences,

    // Derived
    startDate,
    eatingWindow,
    todayYmd,
    todayChecked,
    availableFoodsForEditors,

    // Helpers
    clampIndex,
    todayIndex,
    currentEatingWindow,
    resolveAvailableFoods,
    lsSave,
    formatDateYmd,
    parseYmd,

    // Persistence
    loadAppState,
    persistPlan,
    setPlanMeta,
    bgSaveProfileAndSchedule,
    saveWeightLogEntry,
    saveCheckinEntry,
    saveFoodPrefs,
    importData,
    clearData,
  }
}
