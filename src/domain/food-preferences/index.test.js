import { describe, expect, it } from 'vitest'
import {
  checkCategoryCoverage,
  emptyPreferences,
  getAvailableFoods,
  getFoodLevel,
  isValidLevel,
  setFoodLevel,
} from './index.js'

describe('domain/food-preferences', () => {
  it('creates a stable empty preference shape', () => {
    expect(emptyPreferences()).toEqual({
      selectedFoodIds: [],
      customFoods: [],
      updatedAt: null,
      preferenceLevels: {},
    })
  })

  it('validates and updates preference levels immutably', () => {
    const prefs = { preferenceLevels: { chicken: 'frequent' } }

    expect(isValidLevel('reduce')).toBe(true)
    expect(isValidLevel('love')).toBe(false)
    expect(getFoodLevel(prefs, 'chicken')).toBe('frequent')
    expect(getFoodLevel(prefs, 'rice')).toBe('normal')
    expect(setFoodLevel(prefs, 'chicken', 'normal')).toEqual({})
    expect(setFoodLevel(prefs, 'rice', 'exclude')).toEqual({ chicken: 'frequent', rice: 'exclude' })
  })

  it('returns selected default foods and custom foods while excluding blocked ids', () => {
    const available = getAvailableFoods({
      selectedFoodIds: ['chicken-breast', 'brown-rice'],
      customFoods: [
        { id: 'custom-tofu', name: '自定义豆腐', category: 'protein' },
        { id: 'custom-cake', name: '自定义蛋糕', category: 'snack' },
      ],
      preferenceLevels: {
        'brown-rice': 'exclude',
        'custom-cake': 'exclude',
      },
    })

    expect(available.map((food) => food.id)).toEqual(['chicken-breast', 'custom-tofu'])
  })

  it('counts category coverage for the meal generator', () => {
    expect(
      checkCategoryCoverage([
        { category: 'protein' },
        { category: 'protein' },
        { category: 'carb' },
        { category: 'fruit' },
      ]),
    ).toEqual({ protein: 2, carb: 1, vegetable: 0 })
  })
})
