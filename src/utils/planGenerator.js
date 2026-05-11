import {
  calculateDailyTargets,
  calculateMacros,
  deriveTimeAfterWake,
  deriveTimeBeforeSleep,
} from './calc.js'
import { foods } from './foods.js'

const mealNameMap = {
  2: ['午餐', '晚餐'],
  3: ['早餐', '午餐', '晚餐'],
  4: ['早餐', '午餐', '下午加餐', '晚餐'],
  5: ['早餐', '上午加餐', '午餐', '下午加餐', '晚餐'],
  6: ['早餐', '上午加餐', '午餐', '下午加餐', '晚餐', '晚间轻食'],
}

const mealProfiles = [
  { category: 'breakfast', type: 'main' },
  { category: 'snack', type: 'snack' },
  { category: 'lunch', type: 'main' },
  { category: 'snack', type: 'snack' },
  { category: 'dinner', type: 'main' },
  { category: 'snack', type: 'snack' },
]

const splitMap = {
  2: [0.5, 0.5],
  3: [0.3, 0.4, 0.3],
  4: [0.28, 0.38, 0.1, 0.24],
  5: [0.24, 0.1, 0.32, 0.1, 0.24],
  6: [0.22, 0.09, 0.28, 0.09, 0.24, 0.08],
}

export function generateSchedule(mealCount = 4) {
  const schedules = {
    2: ['12:30', '18:30'],
    3: ['08:00', '12:30', '18:30'],
    4: ['08:00', '12:30', '16:00', '18:30'],
    5: ['08:00', '10:30', '12:30', '16:00', '18:30'],
    6: ['08:00', '10:30', '12:30', '16:00', '18:30', '20:30'],
  }

  return schedules[mealCount] || schedules[4]
}

export function generateScheduleFromProfile(profile, dietMethod) {
  const wakeTime = profile?.wakeTime ?? '07:00'
  const sleepTime = profile?.sleepTime ?? '23:00'

  if (dietMethod === 'threeMealsPlusSnack') {
    return {
      mealCount: 4,
      mealNames: ['早餐', '午餐', '下午加餐', '晚餐'],
      times: [
        deriveTimeAfterWake(wakeTime, 0.5),
        '12:00',
        '15:30',
        deriveTimeBeforeSleep(sleepTime, 3),
      ],
      split: [0.24, 0.36, 0.1, 0.3],
    }
  }

  if (dietMethod === '14:10') {
    return {
      mealCount: 3,
      mealNames: ['午餐', '下午加餐', '晚餐'],
      times: ['12:00', '15:30', deriveTimeBeforeSleep(sleepTime, 3)],
      split: [0.45, 0.1, 0.45],
    }
  }

  if (dietMethod === '16:8') {
    return {
      mealCount: 2,
      mealNames: ['午餐', '晚餐'],
      times: ['12:30', deriveTimeBeforeSleep(sleepTime, 2.5)],
      split: [0.5, 0.5],
    }
  }

  return {
    mealCount: 3,
    mealNames: ['早餐', '午餐', '晚餐'],
    times: [
      deriveTimeAfterWake(wakeTime, 0.5),
      '12:30',
      deriveTimeBeforeSleep(sleepTime, 3.5),
    ],
    split: [0.3, 0.4, 0.3],
  }
}

function getMealMetaByName(name) {
  if (name?.includes('加餐')) return { category: 'snack', type: 'snack' }
  if (name?.includes('午餐')) return { category: 'lunch', type: 'main' }
  if (name?.includes('晚餐')) return { category: 'dinner', type: 'main' }
  if (name?.includes('早餐')) return { category: 'breakfast', type: 'main' }
  return null
}

function getMealMeta(mealCount, index, mealNames = []) {
  const customMeta = getMealMetaByName(mealNames[index])
  if (customMeta) return customMeta

  if (mealCount === 2) {
    return [mealProfiles[2], mealProfiles[4]][index]
  }

  if (mealCount === 3) {
    return [mealProfiles[0], mealProfiles[2], mealProfiles[4]][index]
  }

  if (mealCount === 4) {
    return [mealProfiles[0], mealProfiles[2], mealProfiles[3], mealProfiles[4]][index]
  }

  return mealProfiles[index] || mealProfiles[5]
}

function getMealName(mealCount, index, customNames = []) {
  return customNames[index] || mealNameMap[mealCount]?.[index] || '轻食'
}

function scaleFood(food, portion) {
  const ratio = portion / 100
  return {
    ...food,
    portion,
    calories: Math.round(food.calories * ratio),
    protein: Math.round(food.protein * ratio),
    carbs: Math.round(food.carbs * ratio),
    fat: Math.round(food.fat * ratio),
  }
}

function sumFoods(items) {
  return items.reduce(
    (total, item) => ({
      calories: total.calories + item.calories,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function normalizeFood(food) {
  return {
    ...food,
    calories: Number(food.calories ?? food.per100g?.calories ?? 0),
    protein: Number(food.protein ?? food.per100g?.protein ?? 0),
    carbs: Number(food.carbs ?? food.per100g?.carbs ?? 0),
    fat: Number(food.fat ?? food.per100g?.fat ?? 0),
    unit: food.unit || 'g',
    defaultPortion: Number(food.defaultPortion) || 100,
    tags: Array.isArray(food.tags) ? food.tags : [],
    mealFit: Array.isArray(food.mealFit) ? food.mealFit : null,
  }
}

function normalizeFoodPool(pool) {
  return pool.map(normalizeFood)
}

function mealMatches(food, category) {
  const inferredMealFit = {
    protein: ['breakfast', 'lunch', 'dinner', 'snack'],
    carb: ['breakfast', 'lunch', 'dinner'],
    vegetable: ['lunch', 'dinner', 'snack'],
    fat: ['snack'],
    fruit: ['snack'],
    dairy: ['breakfast', 'snack'],
  }

  if (food.mealFit) {
    return food.mealFit.includes(category) || food.category === category
  }

  return food.category === category || inferredMealFit[food.category]?.includes(category)
}

function mealPool(category, foodPool) {
  return foodPool.filter((food) => mealMatches(food, category))
}

function isProtein(food) {
  return (
    food.category === 'protein' ||
    ((food.tags.includes('高蛋白') ||
      food.tags.includes('植物蛋白') ||
      food.tags.includes('优质蛋白')) &&
      !food.tags.includes('主食'))
  )
}

function isStaple(food) {
  return food.category === 'carb' || food.tags.includes('主食')
}

function isVegetable(food) {
  return food.category === 'vegetable' || food.tags.includes('蔬菜') || food.tags.includes('低热量')
}

function pickByTag(pool, tags, offset) {
  if (!pool.length) return null
  const matches = pool.filter((food) => tags.some((tag) => food.tags.includes(tag)))
  return matches[offset % matches.length] || pool[offset % pool.length]
}

function withFallback(primary, fallback, matcher) {
  const matches = primary.filter(matcher)
  return matches.length ? matches : fallback.filter(matcher)
}

function buildMainMeal(category, calorieTarget, offset, foodPool) {
  const fallbackPool = mealPool(category, normalizeFoodPool(foods))
  const pool = mealPool(category, foodPool)
  const activePool = pool.length ? pool : fallbackPool
  const proteins = withFallback(activePool, fallbackPool, isProtein)
  const staples = withFallback(activePool, fallbackPool, isStaple)
  const vegetables = withFallback(activePool, fallbackPool, isVegetable)
  const protein = proteins[offset % proteins.length] || activePool[offset % activePool.length]
  const staple = staples[(offset + 1) % staples.length] || activePool[(offset + 1) % activePool.length]
  const vegetable =
    vegetables[(offset + 2) % vegetables.length] || activePool[(offset + 2) % activePool.length]
  const base = [protein, staple, vegetable].filter(Boolean)
  const baseCalories = base.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(1.7, Math.max(0.75, calorieTarget / Math.max(baseCalories, 1)))

  return base.map((food) => scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5))
}

function buildSnackMeal(calorieTarget, offset, foodPool) {
  const fallbackPool = mealPool('snack', normalizeFoodPool(foods))
  const pool = mealPool('snack', foodPool)
  const activePool = pool.length ? pool : fallbackPool
  const first = pickByTag(activePool, ['水果', '高蛋白', '植物蛋白'], offset)
  const second = pickByTag(activePool, ['坚果', '低热量', '饱腹'], offset + 2)
  const items = first?.id === second?.id ? [first] : [first, second].filter(Boolean)
  const baseCalories = items.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(1.2, Math.max(0.6, calorieTarget / Math.max(baseCalories, 1)))

  return items.map((food) => scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5))
}

function createMeal({ time, index, mealCount, calorieTarget, dayIndex, mealNames, foodPool }) {
  const meta = getMealMeta(mealCount, index, mealNames)
  const offset = dayIndex * mealCount + index
  const items =
    meta.type === 'snack'
      ? buildSnackMeal(calorieTarget, offset, foodPool)
      : buildMainMeal(meta.category, calorieTarget, offset, foodPool)
  const totals = sumFoods(items)

  return {
    time,
    name: getMealName(mealCount, index, mealNames),
    portion: items.map((item) => `${item.name}${item.portion}${item.unit}`).join(' + '),
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    items,
  }
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function generateMealPlan(params, schedule = {}, availableFoods = null) {
  const foodPool = normalizeFoodPool(availableFoods?.length ? availableFoods : foods)
  const baseTargets = calculateDailyTargets(params)
  const calories = Number(params.targetCalories) || baseTargets.calories
  const dailyTargets = {
    ...baseTargets,
    calories,
    macros: params.macroTargets || calculateMacros(calories),
  }
  const mealCount = Number(schedule.mealCount) || 4
  const times = schedule.times?.length ? schedule.times : generateSchedule(mealCount)
  const splits =
    schedule.split?.length === times.length ? schedule.split : splitMap[mealCount] || splitMap[4]
  const mealNames = schedule.mealNames?.length === times.length ? schedule.mealNames : []
  const days = Number(params.days) || 7
  const start = new Date()

  return Array.from({ length: days }, (_, dayIndex) => {
    const date = addDays(start, dayIndex)
    const meals = times.map((time, index) =>
      createMeal({
        time,
        index,
        mealCount,
        calorieTarget: dailyTargets.calories * splits[index],
        dayIndex,
        mealNames,
        foodPool,
      }),
    )
    const totals = sumFoods(meals)

    return {
      day: dayIndex + 1,
      date: date.toISOString().slice(0, 10),
      targets: {
        calories: dailyTargets.calories,
        ...dailyTargets.macros,
      },
      totals,
      meals,
    }
  })
}

export { splitMap }
