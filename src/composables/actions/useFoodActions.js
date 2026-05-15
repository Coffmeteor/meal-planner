import { generateMealPlan, regenerateDay } from '../../domain/meal-plan/index.js'
import { nextPlanSeed } from '../../utils/planSeed.js'

export function useFoodActions(ctx) {
  const {
    appState,
    params,
    schedule,
    plan,
    dataVersion,
    activeTab,
    foodSetupMode,
    view,
    popPage,
    showToast,
    currentEatingWindow,
    resolveAvailableFoods,
    buildPlanMetadata,
  } = ctx

  async function handleFoodsSave(updatedPrefs, options = {}) {
    await appState.saveFoodPrefs(updatedPrefs)

    if (foodSetupMode.value) {
      plan.value = generateMealPlan(
        params.value,
        schedule.value,
        resolveAvailableFoods(),
        currentEatingWindow(),
        nextPlanSeed(),
      )
      appState.setPlanMeta(plan.value, buildPlanMetadata(false))
      appState.persistPlan()
      activeTab.value = 'today'
      view.value = 'shell'
      return 'shell'
    }

    const scope = options?.scope || 'save'
    showToast(
      scope === 'save'
        ? '已保存食材偏好'
        : scope === 'today'
          ? '已应用到今日餐单'
          : '已应用到后续计划',
    )
    if (scope === 'future' && plan.value.length > 0) {
      plan.value = generateMealPlan(
        params.value,
        schedule.value,
        resolveAvailableFoods(),
        currentEatingWindow(),
        nextPlanSeed(),
      )
      appState.setPlanMeta(plan.value)
      appState.persistPlan()
      dataVersion.value++
    } else if (scope === 'today' && plan.value.length > 0) {
      const idx = appState.todayIndex()
      const day = plan.value[idx]
      if (day) {
        const regenerated = regenerateDay(
          params.value,
          schedule.value,
          resolveAvailableFoods(),
          day,
          { editSource: 'applyFoodPrefs' },
          currentEatingWindow(),
          nextPlanSeed(),
        )
        const nextPlan = [...plan.value]
        nextPlan[idx] = regenerated
        plan.value = nextPlan
        appState.persistPlan()
        dataVersion.value++
      }
    }
    return null
  }

  async function handleCustomFoodSave(updatedPrefs, options = {}) {
    await handleFoodsSave(updatedPrefs, options)
    popPage()
  }

  return {
    handleFoodsSave,
    handleCustomFoodSave,
  }
}
