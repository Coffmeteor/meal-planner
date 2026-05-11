import { calculateDailyTargets, calculateMacros } from './calc.js'
import { foods } from './foods.js'

const mealNameMap = {
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
  3: [0.3, 0.4, 0.3],
  4: [0.28, 0.38, 0.1, 0.24],
  5: [0.24, 0.1, 0.32, 0.1, 0.24],
  6: [0.22, 0.09, 0.28, 0.09, 0.24, 0.08],
}

export function generateSchedule(mealCount = 4) {
  const schedules = {
    3: ['08:00', '12:30', '18:30'],
    4: ['08:00', '12:30', '16:00', '18:30'],
    5: ['08:00', '10:30', '12:30', '16:00', '18:30'],
    6: ['08:00', '10:30', '12:30', '16:00', '18:30', '20:30'],
  }

  return schedules[mealCount] || schedules[4]
}

function getMealMeta(mealCount, index) {
  if (mealCount === 3) {
    return [mealProfiles[0], mealProfiles[2], mealProfiles[4]][index]
  }

  if (mealCount === 4) {
    return [mealProfiles[0], mealProfiles[2], mealProfiles[3], mealProfiles[4]][index]
  }

  return mealProfiles[index] || mealProfiles[5]
}

function getMealName(mealCount, index) {
  return mealNameMap[mealCount]?.[index] || '轻食'
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

function pickByTag(pool, tags, offset) {
  const matches = pool.filter((food) => tags.some((tag) => food.tags.includes(tag)))
  return matches[offset % matches.length] || pool[offset % pool.length]
}

function buildMainMeal(category, calorieTarget, offset) {
  const pool = foods.filter((food) => food.category === category)
  const proteins = pool.filter(
    (food) =>
      (food.tags.includes('高蛋白') ||
        food.tags.includes('植物蛋白') ||
        food.tags.includes('优质蛋白')) &&
      !food.tags.includes('主食'),
  )
  const staples = pool.filter((food) => food.tags.includes('主食'))
  const vegetables = pool.filter((food) => food.tags.includes('蔬菜') || food.tags.includes('低热量'))
  const protein = proteins[offset % proteins.length] || pool[offset % pool.length]
  const staple = staples[(offset + 1) % staples.length] || pool[(offset + 1) % pool.length]
  const vegetable = vegetables[(offset + 2) % vegetables.length] || pool[(offset + 2) % pool.length]
  const base = [protein, staple, vegetable].filter(Boolean)
  const baseCalories = base.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(1.7, Math.max(0.75, calorieTarget / Math.max(baseCalories, 1)))

  return base.map((food) => scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5))
}

function buildSnackMeal(calorieTarget, offset) {
  const pool = foods.filter((food) => food.category === 'snack')
  const first = pickByTag(pool, ['水果', '高蛋白', '植物蛋白'], offset)
  const second = pickByTag(pool, ['坚果', '低热量', '饱腹'], offset + 2)
  const items = first.id === second.id ? [first] : [first, second]
  const baseCalories = items.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(1.2, Math.max(0.6, calorieTarget / Math.max(baseCalories, 1)))

  return items.map((food) => scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5))
}

function createMeal({ time, index, mealCount, calorieTarget, dayIndex }) {
  const meta = getMealMeta(mealCount, index)
  const offset = dayIndex * mealCount + index
  const items =
    meta.type === 'snack'
      ? buildSnackMeal(calorieTarget, offset)
      : buildMainMeal(meta.category, calorieTarget, offset)
  const totals = sumFoods(items)

  return {
    time,
    name: getMealName(mealCount, index),
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

export function generateMealPlan(params, schedule = {}) {
  const dailyTargets = calculateDailyTargets(params)
  const mealCount = Number(schedule.mealCount) || 4
  const times = schedule.times?.length ? schedule.times : generateSchedule(mealCount)
  const splits = splitMap[mealCount] || splitMap[4]
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
      }),
    )
    const totals = sumFoods(meals)

    return {
      day: dayIndex + 1,
      date: date.toISOString().slice(0, 10),
      targets: {
        calories: dailyTargets.calories,
        ...calculateMacros(dailyTargets.calories),
      },
      totals,
      meals,
    }
  })
}

export { splitMap }
