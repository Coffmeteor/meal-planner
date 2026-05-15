const MINUTES_PER_DAY = 24 * 60
const WINDOW_CONFIG = {
  '14:10': { fastingHours: 14, eatingHours: 10 },
  '16:8': { fastingHours: 16, eatingHours: 8 },
}
const METHOD_ALIASES = {
  tre14_10: '14:10',
  tre16_8: '16:8',
}

export function normalizeDietMethod(dietMethod) {
  return METHOD_ALIASES[dietMethod] || dietMethod
}

export function timeToMinutes(time) {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 0

  const hour = Math.min(23, Math.max(0, Number(match[1]) || 0))
  const minute = Math.min(59, Math.max(0, Number(match[2]) || 0))
  return hour * 60 + minute
}

export function minutesToTime(minutes) {
  const normalized =
    ((Math.round(Number(minutes) || 0) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function addMinutesToTime(time, minutes) {
  return minutesToTime(timeToMinutes(time) + Number(minutes || 0))
}

export function isTimeWithinRange(time, start, end) {
  const value = timeToMinutes(time)
  const startMinutes = timeToMinutes(start)
  const endMinutes = timeToMinutes(end)

  if (startMinutes <= endMinutes) {
    return value >= startMinutes && value <= endMinutes
  }

  return value >= startMinutes || value <= endMinutes
}

export function isIncreasingTimes(times = []) {
  return times.every((time, index) => {
    if (index === 0) return true
    return timeToMinutes(time) > timeToMinutes(times[index - 1])
  })
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function sameDayWindowStart(time, eatingHours) {
  const latestStart = Math.max(0, MINUTES_PER_DAY - 1 - eatingHours * 60)
  return minutesToTime(clamp(timeToMinutes(time), 0, latestStart))
}

function sleepCutoffMinutes(profile, eatingHours) {
  const wake = timeToMinutes(profile?.wakeTime || '07:00')
  let sleep = timeToMinutes(profile?.sleepTime || '23:00')
  if (sleep <= wake) sleep += MINUTES_PER_DAY

  const buffer = eatingHours >= 10 ? 90 : 120
  return Math.min(MINUTES_PER_DAY - 1, sleep - buffer)
}

function defaultStartMinutes(profile, dietMethod) {
  const habit = profile?.breakfastHabit || 'always'
  if (dietMethod === '16:8') {
    if (habit === 'skip') return timeToMinutes('12:00')
    if (habit === 'sometimes') return timeToMinutes('11:00')
    return timeToMinutes('10:30')
  }

  if (habit === 'skip') return timeToMinutes('10:00')
  if (habit === 'sometimes') return timeToMinutes('10:00')
  return timeToMinutes('09:30')
}

export function deriveEatingWindow(profile, dietMethod) {
  dietMethod = normalizeDietMethod(dietMethod)
  const config = WINDOW_CONFIG[dietMethod]
  if (!config) return { type: 'none' }

  const eatingMinutes = config.eatingHours * 60
  const wakeStart = timeToMinutes(profile?.wakeTime || '07:00') + 60
  const latestEnd = sleepCutoffMinutes(profile, config.eatingHours)
  const latestStart = Math.max(0, latestEnd - eatingMinutes)
  const preferredStart = defaultStartMinutes(profile, dietMethod)
  const startMinutes =
    wakeStart > latestStart ? latestStart : clamp(preferredStart, wakeStart, latestStart)
  const start = minutesToTime(startMinutes)

  return {
    type: dietMethod,
    start,
    end: addMinutesToTime(start, eatingMinutes),
    fastingHours: config.fastingHours,
    eatingHours: config.eatingHours,
  }
}

export function normalizeEatingWindow(profile, dietMethod, existingWindow = null) {
  dietMethod = normalizeDietMethod(dietMethod)
  const base = deriveEatingWindow(profile, dietMethod)
  if (base.type === 'none') return base

  const existingType = normalizeDietMethod(existingWindow?.type)
  if (existingType !== dietMethod) return base

  const start = sameDayWindowStart(existingWindow?.start || base.start, base.eatingHours)
  return {
    ...base,
    start,
    end: addMinutesToTime(start, base.eatingHours * 60),
  }
}

export function validateScheduleTimes(schedule = {}, eatingWindow = { type: 'none' }) {
  const times = Array.isArray(schedule.times) ? schedule.times : []
  const errors = []

  if (!isIncreasingTimes(times)) {
    errors.push('当前餐次时间不在递增')
  }

  if (eatingWindow?.type && eatingWindow.type !== 'none') {
    if (timeToMinutes(eatingWindow.end) <= timeToMinutes(eatingWindow.start)) {
      errors.push('进食窗口必须在同一天内')
    }

    const outsideWindow = times.some(
      (time) => !isTimeWithinRange(time, eatingWindow.start, eatingWindow.end),
    )
    if (outsideWindow) {
      errors.push(`餐次时间必须在 ${eatingWindow.start}-${eatingWindow.end} 内`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function autoDistributeMeals(schedule = {}, eatingWindow = { type: 'none' }) {
  const times = Array.isArray(schedule.times) ? schedule.times : []
  if (!times.length || !eatingWindow?.type || eatingWindow.type === 'none') {
    return { ...schedule, times: [...times] }
  }

  const mealCount = times.length
  const start = timeToMinutes(eatingWindow.start)
  const duration = eatingWindow.eatingHours * 60
  const step = mealCount > 1 ? duration / (mealCount - 1) : 0
  const nextTimes = times.map((_, index) => minutesToTime(start + step * index))

  return {
    ...schedule,
    times: nextTimes,
  }
}
