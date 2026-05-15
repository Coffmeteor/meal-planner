import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  generateMealPlan,
  generateScheduleFromProfile,
  regenerateDay,
  regenerateSingleMeal,
} from './planGenerator.js'

const profile = {
  gender: 'female',
  age: 30,
  height: 165,
  weight: 62,
  targetWeight: 56,
  activity: 'light',
  days: 3,
  targetCalories: 1500,
  wakeTime: '07:00',
  sleepTime: '23:00',
  breakfastHabit: 'skip',
  dietMethod: '14:10',
}

describe('domain/meal-plan/planGenerator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates a multi-day plan with schedule-compatible meals and targets', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T08:00:00.000Z'))

    const schedule = generateScheduleFromProfile(profile, '14:10')
    const plan = generateMealPlan(profile, schedule, null, schedule.eatingWindow, 7)

    expect(plan).toHaveLength(3)
    expect(plan[0]).toMatchObject({
      day: 1,
      date: '2026-05-15',
      targets: expect.objectContaining({ calories: 1500 }),
    })
    expect(plan[1].date).toBe('2026-05-16')
    expect(plan.every((day) => day.meals.length === schedule.mealCount)).toBe(true)
    expect(plan.every((day) => day.totals.calories > 0)).toBe(true)
  })

  it('auto-distributes invalid schedule times into the eating window', () => {
    const plan = generateMealPlan(
      { ...profile, days: 1 },
      {
        mealCount: 3,
        mealNames: ['第一餐', '加餐1', '第二餐'],
        times: ['08:00', '07:00', '23:00'],
        split: [0.45, 0.1, 0.45],
        eatingWindow: { type: '14:10', start: '10:00', end: '20:00', eatingHours: 10 },
      },
      null,
      null,
      1,
    )

    expect(plan[0].meals.map((meal) => meal.time)).toEqual(['10:00', '15:00', '20:00'])
  })

  it('regenerates a single meal without mutating the original plan', () => {
    const original = generateMealPlan(
      { ...profile, days: 1 },
      { mealCount: 3, times: ['10:00', '15:00', '20:00'], split: [0.45, 0.1, 0.45] },
      null,
      { type: '14:10', start: '10:00', end: '20:00', eatingHours: 10 },
      1,
    )
    const beforeMeal = original[0].meals[1]

    const updated = regenerateSingleMeal(
      original,
      0,
      1,
      profile,
      { mealCount: 3, times: ['10:00', '15:00', '20:00'], split: [0.45, 0.1, 0.45] },
      null,
      { type: '14:10', start: '10:00', end: '20:00', eatingHours: 10 },
      99,
    )

    expect(updated).not.toBe(original)
    expect(updated[0].meals[1]).not.toEqual(beforeMeal)
    expect(original[0].meals[1]).toEqual(beforeMeal)
    expect(updated[0].totals.calories).toBeGreaterThan(0)
  })

  it('regenerates a day while preserving date, day number and edit source', () => {
    const [day] = generateMealPlan({ ...profile, days: 1 }, { mealCount: 2 }, null, null, 3)
    const updated = regenerateDay(
      profile,
      { mealCount: 2 },
      null,
      day,
      { editSource: 'test' },
      null,
      4,
    )

    expect(updated).toMatchObject({
      day: day.day,
      date: day.date,
      editSource: 'test',
    })
    expect(updated.meals).toHaveLength(2)
    expect(updated.totals.calories).toBeGreaterThan(0)
  })
})
