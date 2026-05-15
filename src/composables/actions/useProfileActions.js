import { generateMealPlan, regenerateDay } from '../../domain/meal-plan/index.js'
import { nextPlanSeed } from '../../utils/planSeed.js'

export function useProfileActions(ctx) {
  const {
    appState,
    params,
    schedule,
    plan,
    dataVersion,
    popPage,
    showToast,
    currentEatingWindow,
    resolveAvailableFoods,
  } = ctx

  function applyProfileUpdate(updatedProfile) {
    params.value = { ...params.value, ...updatedProfile }
    appState.lsSave('profile', params.value)
    return appState.bgSaveProfileAndSchedule(params.value, schedule.value)
  }

  async function handleProfileRestart() {
    if (!plan.value.length) return
    plan.value = generateMealPlan(
      params.value,
      schedule.value,
      resolveAvailableFoods(),
      currentEatingWindow(),
      nextPlanSeed(),
    )
    appState.setPlanMeta(plan.value)
    appState.persistPlan()
    showToast('已重新开始计划')
  }

  async function handleProfileApplyFromToday() {
    if (!plan.value.length) return
    const idx = appState.todayIndex()
    for (let i = idx; i < plan.value.length; i++) {
      const day = plan.value[i]
      plan.value[i] =
        day?.locked || day?.edited
          ? day
          : regenerateDay(
              params.value,
              schedule.value,
              resolveAvailableFoods(),
              day,
              { editSource: 'applySettings' },
              currentEatingWindow(),
              nextPlanSeed(),
            )
    }
    appState.setPlanMeta(plan.value)
    appState.persistPlan()
    showToast('已从今天开始应用')
  }

  function handleProfileSaveSettingsOnly() {
    showToast('已保存设置')
  }

  async function handleProfileEditSubmit(updatedProfile) {
    const scope = updatedProfile.scope || 'settings'
    await applyProfileUpdate(updatedProfile)

    if (scope === 'restart') {
      await handleProfileRestart()
    } else if (scope === 'today') {
      await handleProfileApplyFromToday()
    } else {
      handleProfileSaveSettingsOnly()
    }
    dataVersion.value++
    popPage()
  }

  return {
    handleProfileEditSubmit,
  }
}
