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
  const calories = Number(params.targetCalories) || calculateTargetCalories(params)

  return {
    bmr,
    tdee,
    calories,
    macros: params.macroTargets || calculateMacros(calories),
  }
}

export function suggestDietMethod(profile) {
  const wakeTime = profile?.wakeTime ?? '07:00'
  const breakfastHabit = profile?.breakfastHabit ?? 'always'
  const exerciseFreq = Number(profile?.exerciseFreq ?? 1)
  const hasStrength = Boolean(profile?.hasStrength)

  if (breakfastHabit === 'skip') {
    return {
      method: '14:10',
      reason: '你平时基本不吃早餐，14:10 可以保留午餐、加餐和晚餐，执行成本更低。',
    }
  }

  if (breakfastHabit === 'sometimes' && wakeTime >= '08:30') {
    return {
      method: '14:10',
      reason: '你起床较晚且早餐不固定，压缩进食窗口更贴近日常节奏。',
    }
  }

  if (exerciseFreq >= 4 && hasStrength) {
    return {
      method: 'threeMealsPlusSnack',
      reason: '运动频率高且包含力量训练，三餐加一次加餐更利于分配蛋白质和训练后补给。',
    }
  }

  if (exerciseFreq >= 3 && exerciseFreq <= 4 && !hasStrength) {
    return {
      method: 'threeMeals',
      reason: '你的运动频率中等，稳定三餐更容易控制总热量和饱腹感。',
    }
  }

  return {
    method: 'threeMeals',
    reason: '正常三餐适合多数日常节奏，餐次简单，执行稳定。',
  }
}

export function calculateDeficitPercent(profile) {
  const gender = profile?.gender ?? 'female'
  const weight = Number(profile?.weight ?? 0)
  const targetWeight = Number(profile?.targetWeight ?? weight)
  const isLightWeight = (gender === 'female' && weight <= 55) || (gender === 'male' && weight <= 65)
  const isNearTarget = Math.abs(weight - targetWeight) <= 3

  if (isLightWeight || isNearTarget) {
    return {
      recommended: 0.1,
      options: [0.1, 0.15],
      warning: null,
    }
  }

  return {
    recommended: 0.15,
    options: [0.1, 0.15, 0.2],
    warning: '偏激进，建议短周期观察执行状态',
  }
}

export function calculateTargetCaloriesV2(tdee, deficitPercent, gender) {
  const deficit = Math.round(tdee * deficitPercent)
  const minCalories = gender === 'female' ? 1200 : 1400
  return Math.round(Math.max(minCalories, tdee - deficit))
}

export function calculateMacrosV2(params, calories, deficitPercent) {
  const weight = Number(params?.weight ?? 0)
  const targetCalories = Math.round(Number(calories) || 0)
  const proteinPerKg = params?.hasStrength ? 1.8 : 1.5
  const protein = Math.round(weight * proteinPerKg)
  const minFatByWeight = weight * 0.8
  const minFatByCalories = (targetCalories * 0.2) / 9
  const fat = Math.round(Math.max(minFatByWeight, minFatByCalories))
  const proteinCal = protein * 4
  const fatCal = fat * 9

  if (proteinCal + fatCal >= targetCalories) {
    return {
      calories: targetCalories,
      protein,
      fat,
      carbs: 0,
      warning: '已接近安全下限，建议优先保证蛋白和作息',
      deficitPercent,
    }
  }

  return {
    calories: targetCalories,
    protein,
    fat,
    carbs: Math.round((targetCalories - proteinCal - fatCal) / 4),
    warning: null,
    deficitPercent,
  }
}

function parseTimeToMinutes(time) {
  const [hour = '0', minute = '0'] = String(time || '00:00').split(':')
  return Number(hour) * 60 + Number(minute)
}

function formatMinutes(totalMinutes) {
  const minutesInDay = 24 * 60
  const normalized = ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay
  const hour = Math.floor(normalized / 60)
  const minute = normalized % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function deriveTimeAfterWake(wakeTime, hoursAfter) {
  return formatMinutes(parseTimeToMinutes(wakeTime) + Number(hoursAfter) * 60)
}

export function deriveTimeBeforeSleep(sleepTime, hoursBefore) {
  return formatMinutes(parseTimeToMinutes(sleepTime) - Number(hoursBefore) * 60)
}

export { deriveEatingWindow } from './scheduleUtils.js'
