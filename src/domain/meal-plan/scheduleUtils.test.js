import { describe, expect, it } from 'vitest'
import {
  addMinutesToTime,
  autoDistributeMeals,
  deriveEatingWindow,
  isIncreasingTimes,
  isTimeWithinRange,
  minutesToTime,
  normalizeDietMethod,
  normalizeEatingWindow,
  timeToMinutes,
  validateScheduleTimes,
} from './scheduleUtils.js'

describe('domain/meal-plan/scheduleUtils', () => {
  it('normalizes method aliases and clamps time parsing/formatting', () => {
    expect(normalizeDietMethod('tre14_10')).toBe('14:10')
    expect(timeToMinutes('25:88')).toBe(23 * 60 + 59)
    expect(minutesToTime(-30)).toBe('23:30')
    expect(addMinutesToTime('23:30', 90)).toBe('01:00')
  })

  it('handles normal and cross-midnight time ranges', () => {
    expect(isTimeWithinRange('12:30', '10:00', '18:00')).toBe(true)
    expect(isTimeWithinRange('09:59', '10:00', '18:00')).toBe(false)
    expect(isTimeWithinRange('23:30', '22:00', '02:00')).toBe(true)
    expect(isTimeWithinRange('01:30', '22:00', '02:00')).toBe(true)
    expect(isTimeWithinRange('12:00', '22:00', '02:00')).toBe(false)
  })

  it('derives and normalizes same-day eating windows', () => {
    const profile = {
      wakeTime: '07:00',
      sleepTime: '23:00',
      breakfastHabit: 'skip',
    }

    expect(deriveEatingWindow(profile, '14:10')).toMatchObject({
      type: '14:10',
      start: '10:00',
      end: '20:00',
      fastingHours: 14,
      eatingHours: 10,
    })

    expect(normalizeEatingWindow(profile, '16:8', { type: '16:8', start: '20:00' })).toMatchObject({
      type: '16:8',
      start: '15:59',
      end: '23:59',
    })
  })

  it('validates ordered meal times inside eating window', () => {
    expect(isIncreasingTimes(['10:00', '12:00', '18:00'])).toBe(true)
    expect(isIncreasingTimes(['10:00', '09:59'])).toBe(false)

    expect(
      validateScheduleTimes(
        { times: ['10:00', '12:00', '18:00'] },
        { type: '14:10', start: '10:00', end: '20:00' },
      ),
    ).toEqual({ valid: true, errors: [] })

    const invalid = validateScheduleTimes(
      { times: ['12:00', '11:00', '21:00'] },
      { type: '14:10', start: '10:00', end: '20:00' },
    )
    expect(invalid.valid).toBe(false)
    expect(invalid.errors).toEqual(expect.arrayContaining(['当前餐次时间不在递增']))
  })

  it('auto-distributes meals across the eating window', () => {
    expect(
      autoDistributeMeals(
        { mealCount: 3, times: ['08:00', '12:00', '18:00'] },
        { type: '14:10', start: '10:00', eatingHours: 10 },
      ).times,
    ).toEqual(['10:00', '15:00', '20:00'])
  })
})
