// Composable: useSubPages — sub-page routing, props, and event dispatch
// Manages pageStack, title/component maps, prop resolution, and save/done/cancel dispatch.
import { computed } from 'vue'
import { clearPageStack, pageStack, popPage, pushPage } from '../stores/navigationStore.js'

const titleMap = {
  mealEditor: '编辑单餐',
  dayFoodEditor: '编辑今日菜单',
  weightEntry: '身体记录',
  checkinForm: '今日打卡',
  dataBackup: '数据备份/恢复',
  profileEdit: '修改资料',
  lifestyleEdit: '生活习惯',
  planSettings: '饮食计划',
  customFood: '食材偏好',
}

export function useSubPages(appState) {
  const {
    params,
    plan,
    planMeta,
    schedule,
    foodPrefs,
    weightLogs,
    checkins,
    defaultFoodPreferences,
    startDate,
  } = appState

  const activePage = computed(() => pageStack[pageStack.length - 1] || null)
  const activePageTitle = computed(() => titleMap[activePage.value?.name] || '详情')
  const hasSubPage = computed(() => pageStack.length > 0)

  function clampIndex(index) {
    return appState.clampIndex(index)
  }

  function subPageProps(page) {
    const name = page?.name
    const pageParams = page?.params || {}
    const dayIndex = clampIndex(pageParams.dayIndex)
    const mealIndex = Number(pageParams.mealIndex) || 0
    const day = plan.value[dayIndex] || null
    const meal = day?.meals?.[mealIndex] || null
    const splits = schedule.value?.split?.length ? schedule.value.split : []

    if (name === 'mealEditor') {
      return {
        meal,
        dayIndex,
        mealIndex,
        mealTargetCalories:
          Number(day?.targets?.calories || planMeta.value?.targetCalories || 0) *
          (splits[mealIndex] || 1 / Math.max(day?.meals?.length || 1, 1)),
        availableFoods: appState.availableFoodsForEditors.value,
      }
    }
    if (name === 'dayFoodEditor') {
      return { day, dayIndex, availableFoods: appState.availableFoodsForEditors.value }
    }
    if (name === 'weightEntry') {
      return {
        weightLogs: weightLogs.value,
        profile: params.value,
        checkins: checkins.value,
        planDays: plan.value.length || Number(planMeta.value?.days) || 7,
        startDate: startDate.value,
        showClose: true,
      }
    }
    if (name === 'checkinForm') {
      return { checkins: checkins.value, showClose: true }
    }
    if (name === 'dataBackup') {
      return { profile: params.value, planMeta: planMeta.value }
    }
    if (name === 'profileEdit') {
      return { initialData: params.value, editMode: true, section: 'body' }
    }
    if (name === 'lifestyleEdit') {
      return { initialData: params.value, editMode: true, section: 'lifestyle' }
    }
    if (name === 'planSettings') {
      return { initialData: params.value, editMode: true, section: 'plan' }
    }
    if (name === 'customFood') {
      return {
        foodPreferences: foodPrefs.value || defaultFoodPreferences,
        mode: 'manage',
        showClose: true,
      }
    }
    return {}
  }

  function handleSubPageSave(payload, options, handlers) {
    const pageName = activePage.value?.name
    if (pageName === 'dayFoodEditor') handlers.handleSaveDayFood(payload)
    if (pageName === 'weightEntry') handlers.handleWeightLogsSave(payload)
    if (pageName === 'checkinForm') handlers.handleCheckinSave(payload)
    if (pageName === 'customFood') handlers.handleCustomFoodSave(payload, options)
    if (pageName === 'profileEdit' || pageName === 'lifestyleEdit' || pageName === 'planSettings')
      handlers.handleProfileEditSubmit(payload)
  }

  function handleSubPageDone(payload, handlers) {
    if (activePage.value?.name === 'weightEntry') handlers.handleWeightLogsSave(payload)
    else if (activePage.value?.name === 'checkinForm') handlers.handleCheckinSave(payload)
    else popPage()
  }

  function handleSubPageCancel() {
    popPage()
  }

  function handleBack() {
    popPage()
  }

  return {
    pageStack,
    activePage,
    activePageTitle,
    hasSubPage,
    subPageProps,
    pushPage,
    popPage,
    clearPageStack,
    handleSubPageSave,
    handleSubPageDone,
    handleSubPageCancel,
    handleBack,
    titleMap,
  }
}
