export const ACTIVITY_LEVELS = {
  low: { label: '久坐少动', factor: 1.2 },
  light: { label: '轻度活动', factor: 1.375 },
  moderate: { label: '中等活动', factor: 1.55 },
  high: { label: '高活动量', factor: 1.725 },
}

export function calculateBmr({ gender, age, height, weight }) {
  const base = 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age)
  return Math.round(gender === 'female' ? base - 161 : base + 5)
}

export function calculateTdee(params) {
  const bmr = calculateBmr(params)
  const factor = ACTIVITY_LEVELS[params.activity]?.factor || ACTIVITY_LEVELS.light.factor
  return Math.round(bmr * factor)
}

export function calculateTargetCalories(params) {
  const bmr = calculateBmr(params)
  const tdee = calculateTdee(params)
  const currentWeight = Number(params.weight)
  const targetWeight = Number(params.targetWeight)
  const deficit = targetWeight < currentWeight ? 260 : 220
  const minCalories = params.gender === 'female' ? 1200 : 1400

  return Math.round(Math.max(minCalories, bmr * 1.05, tdee - deficit))
}

export function calculateMacros(calories) {
  const targetCalories = Number(calories)

  return {
    calories: Math.round(targetCalories),
    protein: Math.round((targetCalories * 0.3) / 4),
    carbs: Math.round((targetCalories * 0.4) / 4),
    fat: Math.round((targetCalories * 0.3) / 9),
  }
}

export function calculateDailyTargets(params) {
  const bmr = calculateBmr(params)
  const tdee = calculateTdee(params)
  const calories = calculateTargetCalories(params)

  return {
    bmr,
    tdee,
    calories,
    macros: calculateMacros(calories),
  }
}
