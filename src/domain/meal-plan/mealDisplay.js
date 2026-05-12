const DEFAULT_STEPS = '按当前食材简单烹饪或组合即可。'

export function mealFoods(meal) {
  if (Array.isArray(meal?.foods) && meal.foods.length) return meal.foods
  if (Array.isArray(meal?.items) && meal.items.length) return meal.items
  return []
}

export function normalizeMealFood(food) {
  const portion = Math.max(0, Number(food?.portion ?? food?.defaultPortion ?? 100) || 0)
  const per100g = normalizePer100g(food, portion)
  const ratio = portion / 100

  return {
    ...food,
    category: food?.category || 'snack',
    unit: food?.unit || 'g',
    portion,
    per100g,
    calories: Math.round(per100g.calories * ratio),
    protein: roundMacro(per100g.protein * ratio),
    carbs: roundMacro(per100g.carbs * ratio),
    fat: roundMacro(per100g.fat * ratio),
  }
}

export function mealTotals(foods) {
  return foods.reduce(
    (sum, food) => ({
      calories: sum.calories + Number(food.calories || 0),
      protein: sum.protein + Number(food.protein || 0),
      carbs: sum.carbs + Number(food.carbs || 0),
      fat: sum.fat + Number(food.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function normalizeEditedMeal(meal, foods, options = {}) {
  const normalizedFoods = (Array.isArray(foods) ? foods : []).map(normalizeMealFood)
  const totals = mealTotals(normalizedFoods)
  const now = options.updatedAt || new Date().toISOString()

  return normalizeMealDisplay({
    ...meal,
    name: options.name || buildEditedMealName(normalizedFoods),
    foods: normalizedFoods,
    items: normalizedFoods,
    portion: formatMealPortion(normalizedFoods),
    calories: Math.round(totals.calories),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat),
    simpleSteps: meal?.simpleSteps || DEFAULT_STEPS,
    edited: true,
    editSource: options.editSource || 'manual',
    updatedAt: now,
  })
}

export function normalizeMealDisplay(meal) {
  const normalizedFoods = mealFoods(meal).map(normalizeMealFood)
  if (!normalizedFoods.length) {
    return {
      ...meal,
      simpleSteps: meal?.simpleSteps || DEFAULT_STEPS,
    }
  }

  const totals = mealTotals(normalizedFoods)
  return {
    ...meal,
    foods: normalizedFoods,
    items: normalizedFoods,
    portion: meal?.portion || formatMealPortion(normalizedFoods),
    calories: Math.round(totals.calories),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat),
    simpleSteps: meal?.simpleSteps || DEFAULT_STEPS,
  }
}

export function calculateDayTotals(meals) {
  return meals.reduce(
    (sum, meal) => ({
      calories: sum.calories + Number(meal.calories || 0),
      protein: sum.protein + Number(meal.protein || 0),
      carbs: sum.carbs + Number(meal.carbs || 0),
      fat: sum.fat + Number(meal.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function formatMealPortion(foods) {
  return foods.map((food) => `${food.name}${Math.round(food.portion || 0)}${food.unit || 'g'}`).join(' + ')
}

function buildEditedMealName(foods) {
  const names = foods
    .map((food) => food?.name)
    .filter(Boolean)
    .slice(0, 3)

  if (!names.length) return '已编辑餐点'
  if (names.length === 1) return `${names[0]}餐`
  return `${names.join(' + ')}`
}

function normalizePer100g(food, portion) {
  if (food?.per100g) {
    return {
      calories: Number(food.per100g.calories || 0),
      protein: Number(food.per100g.protein || 0),
      carbs: Number(food.per100g.carbs || 0),
      fat: Number(food.per100g.fat || 0),
    }
  }

  const ratio = portion > 0 ? 100 / portion : 1
  return {
    calories: Number(food?.calories || 0) * ratio,
    protein: Number(food?.protein || 0) * ratio,
    carbs: Number(food?.carbs || 0) * ratio,
    fat: Number(food?.fat || 0) * ratio,
  }
}

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10
}
