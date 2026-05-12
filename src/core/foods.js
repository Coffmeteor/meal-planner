export function searchFoods(foodsDb, query) {
  const foods = normalizeFoods(foodsDb)
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return foods

  return foods
    .map((food) => ({
      food,
      score: scoreFood(food, normalizedQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.food.name).localeCompare(String(b.food.name)))
    .map((item) => item.food)
}

export function getFoodById(foodsDb, id) {
  if (!id) return null
  return normalizeFoods(foodsDb).find((food) => String(food.id) === String(id)) || null
}

export function getFoodsByCategory(foodsDb, category) {
  if (!category) return []
  return normalizeFoods(foodsDb).filter((food) => food.category === category)
}

export function getRecentFoods(foodsDb, count = 20) {
  return [...normalizeFoods(foodsDb)]
    .sort((a, b) => {
      const aTime = toTime(a.lastUsed || a.lastUsedAt || a.updatedAt)
      const bTime = toTime(b.lastUsed || b.lastUsedAt || b.updatedAt)
      return bTime - aTime
    })
    .slice(0, Math.max(0, Number(count) || 20))
}

function normalizeFoods(foodsDb) {
  return Array.isArray(foodsDb) ? foodsDb.filter(Boolean) : []
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function scoreFood(food, query) {
  const name = normalizeText(food?.name)
  const id = normalizeText(food?.id)
  const tags = Array.isArray(food?.tags) ? food.tags.map(normalizeText).join(' ') : ''
  const haystack = `${name} ${id} ${tags}`

  if (name === query || id === query) return 100
  if (name.startsWith(query)) return 80
  if (name.includes(query)) return 60
  if (haystack.includes(query)) return 40
  return fuzzyIncludes(name, query) ? 20 : 0
}

function fuzzyIncludes(value, query) {
  if (!value || !query) return false
  let cursor = 0
  for (const char of value) {
    if (char === query[cursor]) cursor += 1
    if (cursor >= query.length) return true
  }
  return false
}

function toTime(value) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}
