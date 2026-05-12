import {
  calculateDailyTargets,
  calculateMacros,
  deriveTimeAfterWake,
  deriveTimeBeforeSleep,
} from '../nutrition/index.js'
import { foods } from '../../utils/foods.js'
import { MEAL_TEMPLATES } from './mealTemplates.js'
import { normalizeMealDisplay } from './mealDisplay.js'
import {
  autoDistributeMeals,
  normalizeDietMethod,
  normalizeEatingWindow,
  validateScheduleTimes,
} from './scheduleUtils.js'

const mealNameMap = {
  2: ['第一餐', '第二餐'],
  3: ['第一餐', '第二餐', '第三餐'],
  4: ['第一餐', '第二餐', '加餐1', '第三餐'],
  5: ['第一餐', '加餐1', '第二餐', '加餐2', '第三餐'],
  6: ['第一餐', '加餐1', '第二餐', '加餐2', '第三餐', '加餐3'],
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

let mealPlanGenerationIndex = 0

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

export function generateScheduleFromProfile(profile, dietMethod, existingEatingWindow = null) {
  dietMethod = normalizeDietMethod(dietMethod)
  const wakeTime = profile?.wakeTime ?? '07:00'
  const sleepTime = profile?.sleepTime ?? '23:00'
  const eatingWindow = normalizeEatingWindow(
    profile,
    dietMethod,
    existingEatingWindow || profile?.eatingWindow,
  )

  if (dietMethod === 'threeMealsPlusSnack') {
    return {
      mealCount: 4,
      mealNames: ['第一餐', '第二餐', '加餐1', '第三餐'],
      times: [
        deriveTimeAfterWake(wakeTime, 0.5),
        '12:00',
        '15:30',
        deriveTimeBeforeSleep(sleepTime, 3),
      ],
      split: [0.24, 0.36, 0.1, 0.3],
      eatingWindow,
    }
  }

  if (dietMethod === '14:10') {
    return autoDistributeMeals({
      mealCount: 3,
      mealNames: ['第一餐', '加餐1', '第二餐'],
      times: ['12:00', '15:30', deriveTimeBeforeSleep(sleepTime, 3)],
      split: [0.45, 0.1, 0.45],
      eatingWindow,
    }, eatingWindow)
  }

  if (dietMethod === '16:8') {
    return autoDistributeMeals({
      mealCount: 2,
      mealNames: ['第一餐', '第二餐'],
      times: ['12:30', deriveTimeBeforeSleep(sleepTime, 2.5)],
      split: [0.5, 0.5],
      eatingWindow,
    }, eatingWindow)
  }

  return {
    mealCount: 3,
    mealNames: ['第一餐', '第二餐', '第三餐'],
    times: [
      deriveTimeAfterWake(wakeTime, 0.5),
      '12:30',
      deriveTimeBeforeSleep(sleepTime, 3.5),
    ],
    split: [0.3, 0.4, 0.3],
    eatingWindow,
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
  return food.mealFit?.includes(category)
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

function buildMainMeal(category, calorieTarget, offset, foodPool, options = {}) {
  const strictFoodPool = options.strictFoodPool === true
  const fallbackPool = strictFoodPool ? [] : mealPool(category, normalizeFoodPool(foods))
  const pool = mealPool(category, foodPool)
  const activePool = pool.length
    ? pool
    : fallbackPool.length
      ? fallbackPool
      : strictFoodPool
        ? foodPool
        : normalizeFoodPool(foods)
  const proteins = withFallback(activePool, fallbackPool, isProtein)
  const staples = withFallback(activePool, fallbackPool, isStaple)
  const vegetables = withFallback(activePool, fallbackPool, isVegetable)
  const protein = proteins[offset % proteins.length] || activePool[offset % activePool.length]
  const staple = staples[(offset + 1) % staples.length] || activePool[(offset + 1) % activePool.length]
  const vegetable =
    vegetables[(offset + 2) % vegetables.length] || activePool[(offset + 2) % activePool.length]
  const base = [protein, staple, vegetable].filter(Boolean)
  if (!base.length && strictFoodPool) {
    base.push(...activePool.slice(0, 3))
  }
  const baseCalories = base.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(2.5, Math.max(0.75, calorieTarget / Math.max(baseCalories, 1)))

  return base.map((food) => scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5))
}

function buildSnackMeal(calorieTarget, offset, foodPool, options = {}) {
  const strictFoodPool = options.strictFoodPool === true
  const fallbackPool = strictFoodPool ? [] : mealPool('snack', normalizeFoodPool(foods))
  const pool = mealPool('snack', foodPool)
  const activePool = pool.length
    ? pool
    : fallbackPool.length
      ? fallbackPool
      : strictFoodPool
        ? foodPool
        : normalizeFoodPool(foods)
  const first = pickByTag(activePool, ['水果', '高蛋白', '植物蛋白'], offset)
  const second = pickByTag(activePool, ['坚果', '低热量', '饱腹'], offset + 2)
  const items = first?.id === second?.id ? [first] : [first, second].filter(Boolean)
  const baseCalories = items.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(2.0, Math.max(0.6, calorieTarget / Math.max(baseCalories, 1)))

  return items.map((food) => scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5))
}

function fillNamePattern(pattern, slotFoods) {
  let result = pattern

  for (const [slotKey, food] of Object.entries(slotFoods)) {
    result = result.replaceAll(`{${slotKey}}`, food?.name ?? '')
  }

  return result.replace(/\{[^}]+\}/g, '')
}

function cleanPatternText(text) {
  return text
    .replaceAll('和即可', '即可')
    .replaceAll('和，', '，')
    .replaceAll('和。', '。')
    .replaceAll('和食用', '食用')
    .replaceAll('和搭配', '搭配')
}

function fillStepPattern(pattern, slotFoods) {
  let result = pattern
  const names = Object.values(slotFoods)
    .filter(Boolean)
    .map((food) => food.name)
  const nameList =
    names.length > 1
      ? `${names.slice(0, -1).join('、')}和${names[names.length - 1]}`
      : names[0] || ''

  result = result.replace('{nameList}', nameList)
  for (const [slotKey, food] of Object.entries(slotFoods)) {
    result = result.replaceAll(`{${slotKey}}`, food?.name ?? '')
  }

  return cleanPatternText(result.replace(/\{[^}]+\}/g, ''))
}

function pickTemplate(mealType, dayIndex, mealIndex, usedTemplateIds) {
  const candidates = MEAL_TEMPLATES.filter((template) => template.mealType === mealType)
  const fresh = candidates.filter((template) => !usedTemplateIds?.has(template.id))
  const pool = fresh.length ? fresh : candidates

  return pool[(dayIndex * 3 + mealIndex) % pool.length] || null
}

function pickFoodForSlot(foodPool, slot, mealCategory, offset, usedFoodIds) {
  const categoryPool = foodPool.filter((food) => food.category === slot.category)
  const mealPool = categoryPool.filter((food) => mealMatches(food, mealCategory))
  let pool = mealPool.length ? mealPool : categoryPool

  if (slot.filter?.length) {
    pool = pool.filter((food) => slot.filter.some((name) => food.name.includes(name)))
  }

  const fresh = pool.filter((food) => !usedFoodIds?.has(food.id))
  const effective = fresh.length ? fresh : pool

  if (!effective.length) return null
  return effective[offset % effective.length]
}

function templateMealType(category) {
  if (category === 'snack') return 'snack'
  if (category === 'breakfast') return 'breakfast'
  return 'main'
}

function createMealWithTemplate({
  time,
  index,
  mealCount,
  calorieTarget,
  dayIndex,
  mealNames,
  foodPool,
  usedFoodIds,
  usedTemplateIds,
  generationSeed = 0,
  strictFoodPool = false,
}) {
  const meta = getMealMeta(mealCount, index, mealNames)
  const offset = generationSeed + dayIndex * mealCount + index

  if (meta.type === 'snack') {
    const items = buildSnackMeal(calorieTarget, offset, foodPool, { strictFoodPool })
    const totals = sumFoods(items)

    return normalizeMealDisplay({
      time,
      name: getMealName(mealCount, index, mealNames),
      portion: items.map((item) => `${item.name}${item.portion}${item.unit}`).join(' + '),
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      foods: items,
      items,
      simpleSteps: '即食，无需烹饪。',
      templateLabel: '轻食',
    })
  }

  const template = pickTemplate(
    templateMealType(meta.category),
    dayIndex + generationSeed,
    index,
    usedTemplateIds,
  )
  if (!template) {
    return createMeal({
      time,
      index,
      mealCount,
      calorieTarget,
      dayIndex,
      mealNames,
      foodPool,
      strictFoodPool,
    })
  }
  usedTemplateIds?.add(template.id)

  const allFoods = foodPool.length ? foodPool : normalizeFoodPool(foods)
  const defaultFoods = normalizeFoodPool(foods)
  const slotFoods = {}

  for (const slot of template.slots) {
    const food = pickFoodForSlot(allFoods, slot, meta.category, offset, usedFoodIds)

    if (food) {
      slotFoods[slot.category] = food
      usedFoodIds?.add(food.id)
      continue
    }

    if (slot.required && !strictFoodPool) {
      const categoryFallback = defaultFoods.filter((item) => item.category === slot.category)
      const mealFallback = categoryFallback.filter((item) => mealMatches(item, meta.category))
      let fallbackPool = mealFallback.length ? mealFallback : categoryFallback

      if (slot.filter?.length) {
        fallbackPool = fallbackPool.filter((item) =>
          slot.filter.some((name) => item.name.includes(name)),
        )
      }
      const fallbackFood = fallbackPool[offset % fallbackPool.length]

      if (fallbackFood) {
        slotFoods[slot.category] = fallbackFood
        usedFoodIds?.add(fallbackFood.id)
      }
    }
  }

  const items = Object.values(slotFoods).filter(Boolean)
  if (!items.length) {
    return createMeal({
      time,
      index,
      mealCount,
      calorieTarget,
      dayIndex,
      mealNames,
      foodPool,
      strictFoodPool,
    })
  }

  const baseCalories = items.reduce(
    (total, food) => total + food.calories * (food.defaultPortion / 100),
    0,
  )
  const scale = Math.min(2.5, Math.max(0.75, calorieTarget / Math.max(baseCalories, 1)))
  const scaledItems = items.map((food) =>
    scaleFood(food, Math.round((food.defaultPortion * scale) / 5) * 5),
  )
  const totals = sumFoods(scaledItems)

  return normalizeMealDisplay({
    time,
    name: fillNamePattern(template.namePattern, slotFoods),
    label: getMealName(mealCount, index, mealNames),
    portion: scaledItems.map((item) => `${item.name}${item.portion}${item.unit}`).join(' + '),
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    foods: scaledItems,
    items: scaledItems,
    simpleSteps: fillStepPattern(template.simpleStepPattern, slotFoods),
    templateLabel: template.tags?.[0] || '自炊',
    templateId: template.id,
  })
}

function createMeal({
  time,
  index,
  mealCount,
  calorieTarget,
  dayIndex,
  mealNames,
  foodPool,
  strictFoodPool = false,
}) {
  const meta = getMealMeta(mealCount, index, mealNames)
  const offset = dayIndex * mealCount + index
  const items =
    meta.type === 'snack'
      ? buildSnackMeal(calorieTarget, offset, foodPool, { strictFoodPool })
      : buildMainMeal(meta.category, calorieTarget, offset, foodPool, { strictFoodPool })
  const totals = sumFoods(items)

  return normalizeMealDisplay({
    time,
    name: getMealName(mealCount, index, mealNames),
    portion: items.map((item) => `${item.name}${item.portion}${item.unit}`).join(' + '),
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    foods: items,
    items,
  })
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function resolveEatingWindow(params = {}, schedule = {}, eatingWindow = null) {
  const rawWindow = eatingWindow || schedule.eatingWindow || params.eatingWindow
  const method =
    rawWindow?.type && rawWindow.type !== 'none'
      ? rawWindow.type
      : params?.dietMethod
  return normalizeEatingWindow(params, method, rawWindow)
}

function resolveScheduleTimes(schedule, mealCount, eatingWindow) {
  const times = schedule.times?.length ? schedule.times : generateSchedule(mealCount)
  if (!eatingWindow?.type || eatingWindow.type === 'none') return times

  const validation = validateScheduleTimes({ ...schedule, times }, eatingWindow)
  if (validation.valid) return times

  return autoDistributeMeals({ ...schedule, times }, eatingWindow).times
}

export function generateMealPlan(params, schedule = {}, availableFoods = null, eatingWindowParam = null) {
  const generationSeed = mealPlanGenerationIndex
  mealPlanGenerationIndex += 1
  const foodPool = normalizeFoodPool(availableFoods?.length ? availableFoods : foods)
  const baseTargets = calculateDailyTargets(params)
  const calories = Number(params.targetCalories) || baseTargets.calories
  const dailyTargets = {
    ...baseTargets,
    calories,
    macros: params.macroTargets || calculateMacros(calories),
  }
  const mealCount = Number(schedule.mealCount) || 4
  const eatingWindow = resolveEatingWindow(params, schedule, eatingWindowParam)
  const times = resolveScheduleTimes(schedule, mealCount, eatingWindow)
  const splits =
    schedule.split?.length === times.length ? schedule.split : splitMap[mealCount] || splitMap[4]
  const mealNames = schedule.mealNames?.length === times.length ? schedule.mealNames : []
  const days = Number(params.days) || 7
  const start = new Date()

  return Array.from({ length: days }, (_, dayIndex) => {
    const date = addDays(start, dayIndex)
    const usedFoodIds = new Set()
    const usedTemplateIds = new Set()
    const meals = times.map((time, index) =>
      createMealWithTemplate({
        time,
        index,
        mealCount,
        calorieTarget: dailyTargets.calories * splits[index],
        dayIndex,
        mealNames,
        foodPool,
        usedFoodIds,
        usedTemplateIds,
        generationSeed,
      }),
    )
    const totals = sumFoods(meals)
    const deviation = totals.calories - dailyTargets.calories
    const calibratedMeals = Math.abs(deviation) > 80
      ? calibrateDayMeals(meals, deviation, dailyTargets.calories, foodPool, dayIndex, mealNames, mealCount)
      : meals
    const calibratedTotals = calibratedMeals !== meals ? sumFoods(calibratedMeals) : totals

    return {
      day: dayIndex + 1,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      targets: {
        calories: dailyTargets.calories,
        ...dailyTargets.macros,
      },
      totals: calibratedTotals,
      meals: calibratedMeals,
    }
  })
}

/**
 * Regenerate a single meal in an existing plan.
 * Returns a new plan array with the replaced meal.
 */
export function regenerateSingleMeal(
  plan,
  dayIndex,
  mealIndex,
  params,
  schedule = {},
  availableFoods = null,
  eatingWindowParam = null,
) {
  const day = plan[dayIndex]
  if (!day || !day.meals?.[mealIndex]) return plan

  const mealCount = Number(schedule.mealCount) || day.meals.length
  const eatingWindow = resolveEatingWindow(params, schedule, eatingWindowParam)
  const fallbackTimes = day.meals.map((meal) => meal.time)
  const times = resolveScheduleTimes(
    { ...schedule, times: schedule.times?.length ? schedule.times : fallbackTimes },
    mealCount,
    eatingWindow,
  )
  const splits =
    schedule.split?.length === times.length
      ? schedule.split
      : day.meals.map(() => 1 / Math.max(mealCount, 1))
  const mealNames =
    schedule.mealNames?.length === times.length
      ? schedule.mealNames
      : day.meals.map((meal) => meal.name)
  const calorieTarget = (Number(params?.targetCalories) || 1500)
    * (splits[mealIndex] || (1 / Math.max(mealCount, 1)))
  const foodPool = normalizeFoodPool(availableFoods?.length ? availableFoods : foods)
  const meal = createMealWithTemplate({
    time: times[mealIndex] || day.meals[mealIndex].time,
    index: mealIndex,
    mealCount,
    calorieTarget: Math.round(calorieTarget),
    dayIndex: dayIndex + (plan.length * 999),
    mealNames,
    foodPool,
    usedFoodIds: new Set(),
    usedTemplateIds: new Set(),
    generationSeed: mealPlanGenerationIndex++,
  })

  const newPlan = plan.map((planDay) => ({ ...planDay, meals: [...planDay.meals] }))
  newPlan[dayIndex].meals[mealIndex] = meal
  newPlan[dayIndex].totals = sumFoods(newPlan[dayIndex].meals)

  return newPlan
}

export function regenerateDay(
  params,
  schedule = {},
  availableFoods = null,
  currentDay = {},
  options = {},
  eatingWindowParam = null,
) {
  if (!currentDay?.meals?.length) return currentDay

  const mealCount = Number(schedule.mealCount) || currentDay.meals.length
  const eatingWindow = resolveEatingWindow(params, schedule, eatingWindowParam)
  const fallbackTimes = currentDay.meals.map((meal) => meal.time)
  const times = resolveScheduleTimes(
    { ...schedule, times: schedule.times?.length ? schedule.times : fallbackTimes },
    mealCount,
    eatingWindow,
  )
  const splits =
    schedule.split?.length === times.length
      ? schedule.split
      : currentDay.meals.map(() => 1 / Math.max(mealCount, 1))
  const mealNames =
    schedule.mealNames?.length === times.length
      ? schedule.mealNames
      : currentDay.meals.map((meal) => meal.name)
  const dailyCalories =
    Number(params?.targetCalories) || Number(currentDay.targets?.calories) || 1500
  const foodPool = normalizeFoodPool(availableFoods?.length ? availableFoods : foods)
  const strictFoodPool = options.strictFoodPool === true && Boolean(availableFoods?.length)
  const usedFoodIds = new Set()
  const usedTemplateIds = new Set()
  const generationSeed = mealPlanGenerationIndex++
  const baseDayIndex = Number(currentDay.day) ? Number(currentDay.day) - 1 : 0

  const meals = currentDay.meals.map((meal, mealIndex) => {
    if (meal?.locked || meal?.edited) return meal

    const calorieTarget = dailyCalories * (splits[mealIndex] || (1 / Math.max(mealCount, 1)))
    return createMealWithTemplate({
      time: times[mealIndex] || meal.time,
      index: mealIndex,
      mealCount,
      calorieTarget: Math.round(calorieTarget),
      dayIndex: baseDayIndex + generationSeed + 1000,
      mealNames,
      foodPool,
      usedFoodIds,
      usedTemplateIds,
      generationSeed,
      strictFoodPool,
    })
  })

  const now = new Date().toISOString()
  const result = {
    ...currentDay,
    meals,
    totals: sumFoods(meals),
    edited: true,
    editSource: options.editSource || currentDay.editSource,
    updatedAt: now,
  }
  const deviation = result.totals.calories - dailyCalories
  if (Math.abs(deviation) > 80) {
    const calibrated = calibrateDayMeals(meals, deviation, dailyCalories, foodPool, baseDayIndex, mealNames, mealCount)
    if (calibrated !== meals) {
      result.meals = calibrated
      result.totals = sumFoods(calibrated)
    }
  }
  return result
}

function calibrateDayMeals(meals, deviation, dailyTargetCalories, foodPool, dayIndex, mealNames, mealCount) {
  const adjustable = meals
    .map((m, i) => ({ meal: m, idx: i }))
    .filter(({ meal }) => !meal.locked && !meal.edited)
  if (!adjustable.length) return meals

  const lockedCals = meals.reduce((s, m) => s + (m.locked || m.edited ? m.calories : 0), 0)
  const adjCals = adjustable.reduce((s, { meal }) => s + meal.calories, 0)
  if (adjCals <= 0) return meals

  const needed = Math.max(50, dailyTargetCalories - lockedCals)
  const ratio = Math.min(2.5, Math.max(0.5, needed / adjCals))

  const newMeals = meals.map((meal) => {
    if (meal.locked || meal.edited) return meal
    if (!meal.foods?.length) return meal
    const scaledFoods = meal.foods.map((f) => {
      const newPortion = Math.round((f.portion * ratio) / 5) * 5
      const pct = newPortion / Math.max(f.portion, 1)
      return { ...f, portion: newPortion, calories: Math.round(f.calories * pct), protein: Math.round(f.protein * pct), carbs: Math.round(f.carbs * pct), fat: Math.round(f.fat * pct) }
    })
    const totals = sumFoods(scaledFoods)
    return {
      ...meal,
      foods: scaledFoods,
      items: scaledFoods,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      portion: scaledFoods.map((f) => `${f.name}${f.portion}${f.unit}`).join(' + '),
    }
  })

  return newMeals
}

export { splitMap }
