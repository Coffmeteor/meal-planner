// Service: Today — aggregates today's dashboard state
import { analyzeWeightTrend } from '../../domain/body-records/index.js'
import { analyzeRecentCheckins } from '../../domain/checkins/index.js'

/**
 * Generate today's dashboard state from current plan, body records, and checkins.
 */
export function getTodayStatus({ plan, planMeta, weightLogs, checkins, todayYmd }) {
  const todayIndex = plan.findIndex((day) => day?.date === todayYmd)
  const todayPlan = todayIndex >= 0 ? plan[todayIndex] : null

  const weightTrend = analyzeWeightTrend(weightLogs)
  const checkinSummary = analyzeRecentCheckins(checkins)

  return {
    todayPlan,
    todayIndex: todayIndex >= 0 ? todayIndex : 0,
    hasPlan: !!todayPlan,
    weightTrend,
    checkinSummary,
    startDate: planMeta?.startDate || null,
    eatingWindow: planMeta?.eatingWindow || null,
    targetCalories: planMeta?.targetCalories || null,
  }
}

/**
 * Generate today's todo list.
 */
export function getTodayTodos({ plan, todayYmd, checkins }) {
  const todayIndex = plan.findIndex((day) => day?.date === todayYmd)
  const hasCheckedToday = checkins.some((c) => c?.date === todayYmd)

  const todos = []
  if (todayIndex < 0) {
    todos.push({ id: 'no-plan', label: '今日尚无餐单', action: 'view-plan' })
  }
  if (!hasCheckedToday && todayIndex >= 0) {
    todos.push({ id: 'checkin', label: '今日打卡', action: 'checkin' })
  }
  return todos
}

/**
 * Generate shortcut entries for the Today page.
 */
export function getTodayShortcuts({ weightLogs, checkins, todayYmd }) {
  const hasCheckedToday = checkins.some((c) => c?.date === todayYmd)
  return {
    checkin: !hasCheckedToday,
    recordWeight: true,
    viewPlan: true,
  }
}
