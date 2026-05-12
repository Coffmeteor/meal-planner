import { COMMON_PORTIONS } from '../core/commonPortions.js'
import { searchFoods } from '../core/foods.js'
import { foods as defaultFoods } from '../utils/foods.js'

const SUPPORTED_UNITS = ['毫升', '个', '碗', '杯', '盒', '根', '片', '勺', '把', '只', '块', '克']
const UNIT_PATTERN = SUPPORTED_UNITS.join('|')
const DEFAULT_SERVING_GRAMS = 100
const QUANTITY_WORDS = {
  零: 0,
  半: 0.5,
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

export function localTextParser(input) {
  const text = String(input || '').trim()
  if (!text) return []

  return splitFoodText(text)
    .map(parseSegment)
    .filter(Boolean)
}

export function parseFoodImage(imageData) {
  void imageData
  return { error: 'notSupported' }
}

export function parseFoodVoice(audioData) {
  void audioData
  return { error: 'notSupported' }
}

function splitFoodText(text) {
  return text
    .replace(/\s+/g, '')
    .split(/(?:[，,、；;]|以及|和|与)/)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function parseSegment(segment) {
  const quantityPattern = String.raw`(?<quantity>\d+(?:\.\d+)?|半|一|两|二|三|四|五|六|七|八|九|十)`
  const nameFirst = new RegExp(String.raw`^(?<name>.+?)${quantityPattern}\s*(?<unit>${UNIT_PATTERN})$`)
  const quantityFirst = new RegExp(String.raw`^${quantityPattern}\s*(?<unit>${UNIT_PATTERN})\s*(?<name>.+)$`)
  const unitOnly = new RegExp(String.raw`^(?<name>.+?)(?<unit>${UNIT_PATTERN})$`)

  const match = segment.match(nameFirst) || segment.match(quantityFirst) || segment.match(unitOnly)
  if (!match?.groups) {
    return buildResult(segment, 1, null)
  }

  return buildResult(
    cleanFoodName(match.groups.name),
    parseQuantity(match.groups.quantity),
    match.groups.unit,
  )
}

function cleanFoodName(name) {
  return String(name || '').replace(/[约大概左右]/g, '').trim()
}

function parseQuantity(value) {
  if (value === undefined || value === null || value === '') return 1
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return Math.max(0, numeric)
  return QUANTITY_WORDS[value] ?? 1
}

function buildResult(rawName, quantity, unit) {
  const foodName = cleanFoodName(rawName)
  if (!foodName) return null

  const food = findFood(foodName)
  const estimate = estimateLocalGrams(foodName, quantity, unit)

  return {
    foodId: food?.id ?? null,
    foodName,
    estimatedGrams: estimate.grams,
    confidence: estimate.confidence,
    source: 'localTextParser',
  }
}

function estimateLocalGrams(foodName, quantity, unit) {
  const amount = Math.max(0, Number(quantity) || 1)
  if (unit === '克') {
    return { grams: Math.round(amount), confidence: 'high' }
  }

  if (unit === '毫升') {
    return { grams: Math.round(amount), confidence: 'high' }
  }

  const unitMap = COMMON_PORTIONS[unit]
  const matchedKey = unitMap
    ? Object.keys(unitMap).find((key) => key !== '_default' && foodName.includes(key))
    : null
  const gramsPerUnit = matchedKey ? unitMap[matchedKey] : unitMap?._default

  if (gramsPerUnit) {
    return {
      grams: Math.round(amount * gramsPerUnit),
      confidence: amount < 1 ? 'low' : matchedKey === '鸡蛋' || matchedKey === '蛋' ? 'high' : 'medium',
    }
  }

  return {
    grams: Math.round(amount * DEFAULT_SERVING_GRAMS),
    confidence: 'low',
  }
}

function findFood(foodName) {
  const exact = defaultFoods.find((food) => String(food?.name || '') === foodName)
  if (exact) return exact

  if (foodName.length <= 1) {
    return defaultFoods.find((food) => String(food?.name || '').endsWith(foodName)) || null
  }

  return searchFoods(defaultFoods, foodName)[0] || null
}
