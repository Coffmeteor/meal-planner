import { regenerateDay } from '../../domain/meal-plan/index.js'
import * as planService from '../../services/plan.js'
import { nextPlanSeed } from '../../utils/planSeed.js'

export function useMealActions(ctx) {
  const {
    appState,
    params,
    schedule,
    plan,
    planMeta,
    pushPage,
    popPage,
    showToast,
    currentEatingWindow,
    resolveAvailableFoods,
    clampIndex,
    buildPlanMetadata,
    activeTab,
  } = ctx

  function handleEditMeal({ dayIndex, mealIndex }) {
    pushPage('mealEditor', { dayIndex: clampIndex(dayIndex), mealIndex: Number(mealIndex) || 0 })
  }

  function handleEditDayFood(dayIndex) {
    pushPage('dayFoodEditor', { dayIndex: clampIndex(dayIndex) })
  }

  function handleSaveMeal({ dayIndex, mealIndex, meal }) {
    plan.value = planService.saveMeal(plan.value, dayIndex, mealIndex, meal)
    appState.persistPlan()
    showToast('已保存单餐')
    popPage()
  }

  function handleCancelMealEdit() {
    popPage()
  }

  function handleSaveDayFood({ dayIndex, selectedFoodIds }) {
    const day = plan.value[dayIndex]
    if (!day) return

    const selectedIds = new Set(selectedFoodIds || [])
    const selectedFoods = appState.availableFoodsForEditors.value.filter((food) =>
      selectedIds.has(food.id),
    )
    const regenerated = regenerateDay(
      params.value,
      schedule.value,
      selectedFoods,
      day,
      { strictFoodPool: true, editSource: 'dayFoodPool' },
      currentEatingWindow(),
      nextPlanSeed(),
    )

    const nextPlan = [...plan.value]
    nextPlan[dayIndex] = {
      ...regenerated,
      dayFoodPool: { selectedFoodIds: [...selectedIds] },
    }
    plan.value = nextPlan
    appState.persistPlan()
    showToast('已刷新当天餐单')
    popPage()
  }

  function handleCancelDayFoodEdit() {
    popPage()
  }

  function handleRefreshRecipe() {
    plan.value = planService.refreshPlan(
      params.value,
      schedule.value,
      resolveAvailableFoods(),
      currentEatingWindow(),
    )
    appState.setPlanMeta(plan.value, buildPlanMetadata(true))
    appState.persistPlan()
    showToast('已刷新食谱')
  }

  function handleRefreshDay(dayIndex) {
    const index = clampIndex(dayIndex)
    const day = plan.value[index]
    if (!day) return
    plan.value = plan.value.map((d, i) =>
      i === index
        ? planService.refreshDay(
            params.value,
            schedule.value,
            resolveAvailableFoods(),
            d,
            currentEatingWindow(),
          )
        : d,
    )
    appState.persistPlan()
    showToast('已刷新当天餐单')
  }

  function handleReplaceMeal({ dayIndex, mealIndex }) {
    plan.value = planService.replaceMeal(
      plan.value,
      clampIndex(dayIndex),
      Number(mealIndex) || 0,
      params.value,
      schedule.value,
      resolveAvailableFoods(),
      currentEatingWindow(),
    )
    appState.persistPlan()
    showToast('已更换这一餐')
  }

  function handleLockMeal({ dayIndex, mealIndex }) {
    plan.value = planService.setMealLock(plan.value, clampIndex(dayIndex), mealIndex, true)
    appState.persistPlan()
    showToast('已锁定这一餐')
  }

  function handleUnlockMeal({ dayIndex, mealIndex }) {
    plan.value = planService.setMealLock(plan.value, clampIndex(dayIndex), mealIndex, false)
    appState.persistPlan()
    showToast('已取消锁定')
  }

  function handleTodayOptimize(dayIndex) {
    const index = clampIndex(dayIndex)
    const targetCalories = Number(
      plan.value[index]?.targets?.calories ||
        planMeta.value?.targetCalories ||
        params.value?.targetCalories,
    )
    const { plan: nextPlan, error } = planService.optimizeTodayCalories(
      plan.value,
      index,
      targetCalories,
    )
    if (error) {
      showToast(error)
      return
    }
    plan.value = nextPlan
    appState.persistPlan()
    showToast('已优化今日热量')
  }

  function handleViewTodayPlan() {
    activeTab.value = 'plan'
  }

  return {
    handleEditMeal,
    handleEditDayFood,
    handleSaveMeal,
    handleCancelMealEdit,
    handleSaveDayFood,
    handleCancelDayFoodEdit,
    handleRefreshRecipe,
    handleRefreshDay,
    handleReplaceMeal,
    handleLockMeal,
    handleUnlockMeal,
    handleTodayOptimize,
    handleViewTodayPlan,
  }
}
