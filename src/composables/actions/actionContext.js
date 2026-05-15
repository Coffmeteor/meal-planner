// Shared dependency normalization for app action composables.

export function createActionContext({
  appState,
  navigation,
  toast,
  activeTab,
  foodSetupMode,
  view,
}) {
  const { params, schedule, plan, planMeta, dataVersion } = appState
  const { popPage, pushPage } = navigation
  const { showToast } = toast

  function currentEatingWindow() {
    return appState.currentEatingWindow()
  }

  function resolveAvailableFoods() {
    return appState.resolveAvailableFoods()
  }

  function clampIndex(index) {
    return appState.clampIndex(index)
  }

  function buildPlanMetadata(fromParams = true) {
    const meta = {}
    if (fromParams) {
      meta.dietMethod = params.value?.dietMethod ?? planMeta.value?.dietMethod ?? null
      meta.deficitPercent = params.value?.deficitPercent ?? planMeta.value?.deficitPercent ?? null
      meta.targetCalories = params.value?.targetCalories ?? planMeta.value?.targetCalories ?? null
      meta.macros = params.value?.macroTargets ?? planMeta.value?.macros ?? null
      meta.recommendationReason =
        params.value?.recommendationReason ?? planMeta.value?.recommendationReason ?? null
    } else {
      meta.dietMethod = params.value?.dietMethod ?? null
      meta.deficitPercent = params.value?.deficitPercent ?? null
      meta.targetCalories = params.value?.targetCalories ?? null
      meta.macros = params.value?.macroTargets ?? null
      meta.recommendationReason = params.value?.recommendationReason ?? null
    }
    meta.eatingWindow = currentEatingWindow()
    return meta
  }

  return {
    appState,
    params,
    schedule,
    plan,
    planMeta,
    dataVersion,
    activeTab,
    foodSetupMode,
    view,
    popPage,
    pushPage,
    showToast,
    currentEatingWindow,
    resolveAvailableFoods,
    clampIndex,
    buildPlanMetadata,
  }
}
