import { describe, expect, it } from 'vitest'
import {
  calculateBmr,
  calculateDailyTargets,
  calculateDeficitPercent,
  calculateMacros,
  calculateMacrosV2,
  calculateTargetCalories,
  calculateTargetCaloriesV2,
  calculateTdee,
  deriveTimeAfterWake,
  deriveTimeBeforeSleep,
  suggestDietMethod,
} from './index.js'

describe('domain/nutrition', () => {
  const baseProfile = {
    gender: 'female',
    age: 30,
    height: 165,
    weight: 62,
    targetWeight: 56,
    activity: 'light',
  }

  it('calculates BMR, TDEE and calorie targets with minimum safety floors', () => {
    expect(calculateBmr(baseProfile)).toBe(1340)
    expect(calculateTdee(baseProfile)).toBe(1843)
    expect(calculateTargetCalories(baseProfile)).toBe(1583)

    expect(
      calculateTargetCalories({
        ...baseProfile,
        gender: 'female',
        age: 40,
        height: 155,
        weight: 45,
        targetWeight: 42,
        activity: 'low',
      }),
    ).toBeGreaterThanOrEqual(1200)
  })

  it('calculates macros from calories with stable rounding', () => {
    expect(calculateMacros(1600)).toEqual({
      calories: 1600,
      protein: 120,
      carbs: 160,
      fat: 53,
    })
  })

  it('returns daily targets and respects explicit target calories/macros', () => {
    const explicit = {
      ...baseProfile,
      targetCalories: 1500,
      macroTargets: { calories: 1500, protein: 130, carbs: 120, fat: 60 },
    }

    expect(calculateDailyTargets(explicit)).toMatchObject({
      bmr: 1340,
      tdee: 1843,
      calories: 1500,
      macros: explicit.macroTargets,
    })
  })

  it('suggests diet method from habits and training pattern', () => {
    expect(suggestDietMethod({ breakfastHabit: 'skip' }).method).toBe('14:10')
    expect(
      suggestDietMethod({ breakfastHabit: 'always', exerciseFreq: 4, hasStrength: true }).method,
    ).toBe('threeMealsPlusSnack')
    expect(
      suggestDietMethod({ breakfastHabit: 'always', exerciseFreq: 3, hasStrength: false }).method,
    ).toBe('threeMeals')
  })

  it('calculates deficit percentage options and v2 macro split', () => {
    expect(calculateDeficitPercent({ gender: 'female', weight: 54, targetWeight: 50 })).toEqual({
      recommended: 0.1,
      options: [0.1, 0.15],
      warning: null,
    })

    expect(calculateTargetCaloriesV2(1800, 0.15, 'female')).toBe(1530)
    expect(calculateMacrosV2({ weight: 60, hasStrength: true }, 1600, 0.15)).toEqual({
      calories: 1600,
      protein: 108,
      fat: 48,
      carbs: 184,
      warning: null,
      deficitPercent: 0.15,
    })
  })

  it('derives meal times around midnight safely', () => {
    expect(deriveTimeAfterWake('23:30', 1)).toBe('00:30')
    expect(deriveTimeBeforeSleep('00:30', 1)).toBe('23:30')
  })
})
