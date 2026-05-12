// Domain: Checkins — daily check-in analysis, adherence, advice
// Pure functions only. No DOM, Vue, localStorage, IndexedDB dependencies.

export function analyzeRecentCheckins(checkins) {
  const valid = checkins.filter((log) => log.mealCompleted != null)
  if (valid.length < 1) {
    return {
      count: 0,
      adherenceRate: null,
      avgHunger: null,
      avgAdherence: null,
      ateOutCount: 0,
      exerciseCount: 0,
      avgSleep: null,
    }
  }

  const sorted = [...valid].sort((a, b) => b.date.localeCompare(a.date))
  const recent7 = sorted.slice(0, 7)
  const adherenceMap = { full: 1, partial: 0.5, missed: 0 }
  const adherenceRate = Math.round(
    (recent7.reduce((sum, log) => sum + (adherenceMap[log.mealCompleted] ?? 0), 0)
      / recent7.length)
      * 100,
  ) / 100

  const hungerLogs = recent7.filter((log) => log.hungerLevel != null)
  const adherenceLogs = recent7.filter((log) => log.adherenceLevel != null)
  const sleepLogs = recent7.filter((log) => log.sleepQuality != null)

  return {
    count: recent7.length,
    adherenceRate,
    avgHunger: hungerLogs.length
      ? Math.round(
        (hungerLogs.reduce((sum, log) => sum + log.hungerLevel, 0) / hungerLogs.length) * 10,
      ) / 10
      : null,
    avgAdherence: adherenceLogs.length
      ? Math.round(
        (adherenceLogs.reduce((sum, log) => sum + log.adherenceLevel, 0)
          / adherenceLogs.length)
          * 10,
      ) / 10
      : null,
    ateOutCount: recent7.filter((log) => log.ateOut).length,
    exerciseCount: recent7.filter((log) => log.exerciseDone).length,
    avgSleep: sleepLogs.length
      ? Math.round(
        (sleepLogs.reduce((sum, log) => sum + log.sleepQuality, 0) / sleepLogs.length) * 10,
      ) / 10
      : null,
  }
}

export function generateCheckinAdvice(checkins, weightTrend) {
  void weightTrend
  const analysis = analyzeRecentCheckins(checkins)

  if (analysis.count < 3) {
    return `记录还太少（当前仅 ${analysis.count} 天），先连续记录几天再判断执行状态。`
  }

  const advice = []

  if (analysis.adherenceRate < 0.6) {
    advice.push('执行率偏低，优先降低计划难度，比如选择更简单的餐点或减少需要烹饪的餐次。')
  }

  if (analysis.avgHunger != null && analysis.avgHunger >= 4) {
    advice.push(
      `饥饿感偏高（平均${analysis.avgHunger}/5），建议优先增加蔬菜体积、蛋白质或调整餐次，不建议继续加大热量缺口。`,
    )
  }

  if (analysis.ateOutCount >= 3) {
    advice.push(`外食较多（${analysis.ateOutCount}天/周），建议给外食日预留更简单的餐单，不要用全自炊标准硬套。`)
  }

  if (analysis.exerciseCount <= 1) {
    advice.push(`运动记录偏少（${analysis.exerciseCount}次/周），可以先增加日常步行或低门槛活动，不必一开始追求高强度训练。`)
  }

  if (analysis.avgSleep != null && analysis.avgSleep <= 2.5) {
    advice.push(`睡眠偏弱（平均${analysis.avgSleep}/5），体重波动可能更大，建议先稳定作息再判断是否需要调热量。`)
  }

  if (advice.length === 0) {
    advice.push('执行状态基本稳定，继续按当前计划观察体重趋势。')
  }

  return advice[0]
}
