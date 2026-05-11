/**
 * Calculate recent 7-entry average weight and compare the latest 3 entries
 * against the previous 3 entries.
 */
export function analyzeWeightTrend(logs) {
  const valid = logs.filter((log) => log.weight != null && Number(log.weight) > 0)
  if (valid.length < 3) {
    return { avg7: null, count: valid.length, trend: 'insufficient' }
  }

  const sorted = [...valid].sort((a, b) => b.date.localeCompare(a.date))
  const recent7 = sorted.slice(0, Math.min(7, sorted.length))
  const avg7 = Math.round(
    (recent7.reduce((sum, log) => sum + Number(log.weight), 0) / recent7.length) * 10,
  ) / 10

  const latest3 = sorted.slice(0, 3)
  const prev3 = sorted.slice(3, 6)
  if (prev3.length < 2) {
    return { avg7, count: valid.length, trend: 'stable' }
  }

  const avgLatest = latest3.reduce((sum, log) => sum + Number(log.weight), 0) / latest3.length
  const avgPrev = prev3.reduce((sum, log) => sum + Number(log.weight), 0) / prev3.length
  const diff = avgPrev - avgLatest

  let trend = 'stable'
  if (diff > 0.5) trend = 'down'
  else if (diff < -0.3) trend = 'up'

  return {
    avg7,
    count: valid.length,
    trend,
    avgLatest: Math.round(avgLatest * 10) / 10,
    avgPrev: Math.round(avgPrev * 10) / 10,
  }
}

export function generateAdvice(logs, profile = null) {
  const trend = analyzeWeightTrend(logs)
  const valid = logs.filter((log) => log.weight != null)
  const targetWeight = Number(profile?.targetWeight)

  if (trend.count < 3) {
    return `记录还太少（当前只有 ${trend.count} 条），继续记录几天后再判断趋势。`
  }

  const hungerLogs = logs.filter((log) => log.hungerLevel != null)
  const adherenceLogs = logs.filter((log) => log.adherenceLevel != null)
  const avgHunger = hungerLogs.reduce((sum, log) => sum + Number(log.hungerLevel), 0)
    / Math.max(hungerLogs.length, 1)
  const avgAdherence = adherenceLogs.reduce((sum, log) => sum + Number(log.adherenceLevel), 0)
    / Math.max(adherenceLogs.length, 1)

  const advice = []

  if (trend.trend === 'down' && Math.abs(trend.avgLatest - trend.avgPrev) > 1) {
    advice.push(
      `下降偏快 (${Math.round(Math.abs(trend.avgLatest - trend.avgPrev) * 10) / 10}kg)，建议优先保证蛋白和睡眠，必要时增加 100-150 kcal。`,
    )
  }

  if (trend.trend === 'stable' && valid.length >= 5) {
    const times = valid.map((log) => new Date(log.date).getTime()).filter(Number.isFinite)
    if (times.length >= 2) {
      const daysCovered = Math.max(...times) - Math.min(...times)
      if (daysCovered > 10 * 86400000) {
        advice.push('近 10 天以上体重无明显变化，可能进入平台。建议先检查执行度；如果执行稳定，可减少约 100 kcal 或增加日常活动。')
      }
    }
  }

  if (avgHunger >= 4) {
    advice.push(`饥饿感偏高（平均${Math.round(avgHunger * 10) / 10}/5），建议优先增加蔬菜体积、蛋白质或调整餐次，不建议继续加大缺口。`)
  }

  if (avgAdherence <= 3 && avgAdherence > 0) {
    advice.push(`执行度偏低（平均${Math.round(avgAdherence * 10) / 10}/5），建议降低计划难度，选择更容易执行的餐单。`)
  }

  if (trend.trend === 'stable' && advice.length === 0 && valid.length >= 3) {
    advice.push('当前体重趋势正常，继续执行即可。')
  }

  if (trend.trend === 'down' && advice.length === 0) {
    advice.push('体重呈缓慢下降趋势，节奏良好，继续坚持。')
  }

  if (trend.trend === 'up' && advice.length === 0) {
    advice.push(
      Number.isFinite(targetWeight)
        ? '体重近期有上升，先检查盐分、睡眠和执行度；如果连续两周仍上升，再考虑小幅调整热量。'
        : '体重近期有上升，先检查盐分、睡眠和执行度，再决定是否调整热量。',
    )
  }

  if (advice.length === 0) {
    advice.push('当前趋势正常，继续执行即可。')
  }

  return advice[0]
}

export function getTargetCurve(profile, days) {
  if (!profile) return null
  const startWeight = Number(profile.weight) || 60
  const targetWeight = Number(profile.targetWeight) || startWeight
  const planDays = Number(days) || 7

  return {
    startWeight,
    targetWeight,
    planDays,
    weeklyRate: Math.round(((startWeight - targetWeight) / Math.max(planDays / 7, 1)) * 10) / 10,
  }
}
