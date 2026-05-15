// Composable: useWizardFlow — wizard view navigation + recommendation logic
// Manages the setup flow: input → recommend → confirm → foods → shell
import { ref } from 'vue'
import {
  calculateDeficitPercent,
  calculateMacrosV2,
  calculateTargetCaloriesV2,
  calculateTdee,
  suggestDietMethod,
} from '../domain/nutrition/index.js'
import { generateScheduleFromProfile } from '../domain/meal-plan/index.js'
import { normalizeDietMethod, normalizeEatingWindow } from '../domain/meal-plan/scheduleUtils.js'

export function useWizardFlow(appState) {
  const view = ref(null)
  const recommendation = ref(null)
  const foodSetupMode = ref(false)

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
    appState.params.value = nextParams
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
    const tdee = calculateTdee(appState.params.value)
    const targetCalories = calculateTargetCaloriesV2(
      tdee,
      deficitPercent,
      appState.params.value.gender,
    )
    const acceptedEatingWindow = normalizeEatingWindow(
      appState.params.value,
      normalizedMethod,
      eatingWindow,
    )
    const enrichedParams = {
      ...appState.params.value,
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

    appState.params.value = enrichedParams
    appState.schedule.value = {
      ...acceptedSchedule,
      eatingWindow: acceptedEatingWindow,
    }

    appState.lsSave('profile', enrichedParams)
    appState.lsSave('schedule', appState.schedule.value)
    appState.bgSaveProfileAndSchedule(enrichedParams, appState.schedule.value)

    view.value = 'confirm'
  }

  function handleConfirmBack(payload = {}) {
    if (payload.params) appState.params.value = payload.params
    if (payload.schedule) appState.schedule.value = payload.schedule
    view.value = 'recommend'
  }

  function handleConfirm({ params: confirmedParams, schedule: confirmedSchedule }) {
    appState.params.value = confirmedParams
    appState.schedule.value = confirmedSchedule
    foodSetupMode.value = true

    appState.lsSave('profile', confirmedParams)
    appState.lsSave('schedule', confirmedSchedule)
    appState.bgSaveProfileAndSchedule(confirmedParams, confirmedSchedule)

    view.value = 'foods'
  }

  function handleFoodsClose() {
    view.value = foodSetupMode.value ? 'confirm' : appState.plan.value.length ? 'shell' : 'input'
  }

  return {
    view,
    recommendation,
    foodSetupMode,
    handleInputSubmit,
    handleRecommendBack,
    handleRecommendAccept,
    handleConfirmBack,
    handleConfirm,
    handleFoodsClose,
  }
}
