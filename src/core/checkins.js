export function calculateDailyScore(checkin) {
  if (!checkin) return 0
  let score = 0

  if (checkin.mealCompleted === 'full' || checkin.completed === true) score += 45
  else if (checkin.mealCompleted === 'partial') score += 25

  if (checkin.exerciseDone) score += 20
  if (!checkin.ateOut) score += 10

  const adherence = Number(checkin.adherenceLevel)
  if (Number.isFinite(adherence)) score += Math.max(0, Math.min(15, adherence * 3))

  const sleep = Number(checkin.sleepQuality)
  if (Number.isFinite(sleep)) score += Math.max(0, Math.min(10, sleep * 2))

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function isCheckedInToday(checkins) {
  return Boolean(getTodayCheckin(checkins))
}

export function getTodayCheckin(checkins) {
  const today = formatYmd(new Date())
  return (Array.isArray(checkins) ? checkins : []).find((checkin) => checkin?.date === today) || null
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
