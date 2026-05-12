export function calculateWeightTrend(weights, days = 7) {
  const recent = recentByDate(weights, days).filter((entry) => Number(entry.weight) > 0)
  const count = recent.length
  const last = count ? Number(recent[0].weight) : null
  const avg = count
    ? Math.round((recent.reduce((sum, entry) => sum + Number(entry.weight), 0) / count) * 10) / 10
    : null

  let direction = 'stable'
  if (count >= 2) {
    const oldest = Number(recent[count - 1].weight)
    const diff = last - oldest
    if (diff > 0.3) direction = 'up'
    if (diff < -0.3) direction = 'down'
  } else if (count === 0) {
    direction = 'insufficient'
  }

  return { avg, direction, last, count }
}

export function calculateExecutionRate(checkins, days = 7) {
  const recent = recentByDate(checkins, days)
  if (!recent.length) return 0
  const scoreMap = { full: 1, partial: 0.5, missed: 0 }
  const total = recent.reduce((sum, checkin) => {
    if (typeof checkin.completed === 'boolean') return sum + (checkin.completed ? 1 : 0)
    return sum + (scoreMap[checkin.mealCompleted] ?? 0)
  }, 0)
  return Math.round((total / recent.length) * 100) / 100
}

export function calculateStreak(checkins) {
  const dates = new Set(
    (Array.isArray(checkins) ? checkins : [])
      .filter((checkin) => isCompleted(checkin))
      .map((checkin) => checkin.date)
      .filter(Boolean),
  )
  let current = 0
  let cursor = startOfToday()
  while (dates.has(formatYmd(cursor))) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  let longest = 0
  let running = 0
  const sortedDates = [...dates].sort()
  let previous = null
  for (const dateValue of sortedDates) {
    const date = parseYmd(dateValue)
    if (!date) continue
    running = previous && daysBetween(previous, date) === 1 ? running + 1 : 1
    longest = Math.max(longest, running)
    previous = date
  }

  return { current, longest }
}

export function getWeeklySummary(checkins, weights, days = 7) {
  return {
    days,
    weightTrend: calculateWeightTrend(weights, days),
    executionRate: calculateExecutionRate(checkins, days),
    streak: calculateStreak(checkins),
    checkinCount: recentByDate(checkins, days).length,
    weightCount: recentByDate(weights, days).length,
  }
}

function recentByDate(entries, days) {
  const limit = Math.max(1, Number(days) || 7)
  return [...(Array.isArray(entries) ? entries : [])]
    .filter((entry) => entry?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, limit)
}

function isCompleted(checkin) {
  return checkin?.completed === true || checkin?.mealCompleted === 'full'
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function parseYmd(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}
