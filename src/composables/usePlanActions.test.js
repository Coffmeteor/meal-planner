import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { usePlanActions } from './usePlanActions.js'
import * as mealDomain from '../domain/meal-plan/index.js'
import * as bodyRecordService from '../services/body-records.js'
import * as checkinService from '../services/checkins.js'

vi.mock('../domain/meal-plan/index.js', () => ({
  generateMealPlan: vi.fn(() => []),
  regenerateDay: vi.fn(() => ({})),
}))

vi.mock('../domain/backup/index.js', () => ({
  createBackupPayload: vi.fn((data) => data),
}))

vi.mock('../utils/planSeed.js', () => ({
  nextPlanSeed: vi.fn(() => 12345),
}))

vi.mock('../services/plan.js', () => ({
  saveMeal: vi.fn((plan) => plan),
  refreshPlan: vi.fn(() => []),
  refreshDay: vi.fn(() => ({})),
  replaceMeal: vi.fn(() => []),
  setMealLock: vi.fn((plan) => plan),
  optimizeTodayCalories: vi.fn(() => ({ plan: [], error: null })),
}))

vi.mock('../services/body-records.js', () => ({
  deleteWeight: vi.fn(async () => []),
}))

vi.mock('../services/checkins.js', () => ({
  remove: vi.fn(async () => []),
}))

vi.mock('../services/backup.js', () => ({
  exportData: vi.fn(async () => ({})),
}))

describe('usePlanActions', () => {
  let mockAppState, mockNavigation, mockToast, mockActiveTab, mockFoodSetupMode, mockView

  beforeEach(() => {
    vi.clearAllMocks()

    mockActiveTab = ref('today')
    mockFoodSetupMode = ref(false)
    mockView = ref('shell')

    mockAppState = {
      params: ref({}),
      schedule: ref({}),
      plan: ref([]),
      planMeta: ref(null),
      foodPrefs: ref(null),
      dataVersion: ref(0),
      currentEatingWindow: vi.fn(() => 'threeMeals'),
      resolveAvailableFoods: vi.fn(() => []),
      clampIndex: vi.fn((i) => i),
      persistPlan: vi.fn(),
      setPlanMeta: vi.fn(),
      todayIndex: vi.fn(() => 0),
      saveFoodPrefs: vi.fn(async (prefs) => prefs),
      clearData: vi.fn(async () => {}),
      weightLogs: ref([]),
      checkins: ref([]),
      lsSave: vi.fn(),
      bgSaveProfileAndSchedule: vi.fn(async () => {}),
    }

    mockNavigation = {
      popPage: vi.fn(),
      pushPage: vi.fn(),
    }

    mockToast = {
      showToast: vi.fn(),
    }
  })

  const createActions = () =>
    usePlanActions({
      appState: mockAppState,
      navigation: mockNavigation,
      toast: mockToast,
      activeTab: mockActiveTab,
      foodSetupMode: mockFoodSetupMode,
      view: mockView,
    })

  it('P0-1: activeTab is properly injected and accessible', () => {
    createActions()

    expect(mockActiveTab.value).toBe('today')
  })

  it('P0-2: handleFoodsSave returns a Promise that resolves to "shell" in setup mode', async () => {
    mockFoodSetupMode.value = true

    const actions = createActions()

    const result = await actions.handleFoodsSave({ frequent: [] })

    expect(result).toBe('shell')
  })

  it('P0-3: normal food save does not return "shell" when foodSetupMode is false', async () => {
    mockFoodSetupMode.value = false

    const actions = createActions()

    const result = await actions.handleFoodsSave({ frequent: [] })

    expect(result).toBeNull()
  })

  it('P0-4: handleClearData returns false when user cancels', async () => {
    const originalConfirm = window.confirm
    Object.defineProperty(window, 'confirm', {
      value: vi.fn(() => false),
      configurable: true,
    })

    const actions = createActions()

    const result = await actions.handleClearData()

    expect(result).toBe(false)
    expect(mockAppState.clearData).not.toHaveBeenCalled()

    Object.defineProperty(window, 'confirm', {
      value: originalConfirm,
      configurable: true,
    })
  })

  it('P0-4: handleClearData returns true when user confirms', async () => {
    const originalConfirm = window.confirm
    Object.defineProperty(window, 'confirm', {
      value: vi.fn(() => true),
      configurable: true,
    })

    const actions = createActions()

    const result = await actions.handleClearData()

    expect(result).toBe(true)
    expect(mockAppState.clearData).toHaveBeenCalled()

    Object.defineProperty(window, 'confirm', {
      value: originalConfirm,
      configurable: true,
    })
  })

  it('P0-5: handleDeleteWeightLog updates weightLogs with array from service', async () => {
    const mockResult = [{ id: '1', date: '2024-01-01', weight: 60 }]
    vi.mocked(bodyRecordService.deleteWeight).mockResolvedValueOnce(mockResult)

    const actions = createActions()

    await actions.handleDeleteWeightLog('2')

    expect(bodyRecordService.deleteWeight).toHaveBeenCalledWith('2')
    expect(mockAppState.weightLogs.value).toEqual(mockResult)
  })

  it('P0-5: handleDeleteCheckin updates checkins with array from service', async () => {
    const mockResult = [{ id: '1', date: '2024-01-01', mealCompleted: 'full' }]
    vi.mocked(checkinService.remove).mockResolvedValueOnce(mockResult)

    const actions = createActions()

    await actions.handleDeleteCheckin('2')

    expect(checkinService.remove).toHaveBeenCalledWith('2')
    expect(mockAppState.checkins.value).toEqual(mockResult)
  })

  it('uses a fresh plan seed when applying profile changes from today', async () => {
    mockAppState.todayIndex.mockReturnValue(1)
    mockAppState.params.value = { targetCalories: 1500 }
    mockAppState.schedule.value = { mealCount: 2 }
    mockAppState.plan.value = [
      { day: 1, meals: [{ name: 'old-1' }] },
      { day: 2, meals: [{ name: 'old-2' }] },
      { day: 3, edited: true, meals: [{ name: 'edited' }] },
    ]

    const actions = createActions()

    await actions.handleProfileEditSubmit({ scope: 'today', targetCalories: 1400 })

    expect(mealDomain.regenerateDay).toHaveBeenCalledTimes(1)
    expect(mealDomain.regenerateDay).toHaveBeenCalledWith(
      expect.objectContaining({ targetCalories: 1400 }),
      mockAppState.schedule.value,
      [],
      expect.objectContaining({ day: 2 }),
      { editSource: 'applySettings' },
      'threeMeals',
      12345,
    )
    expect(mockAppState.plan.value[0].day).toBe(1)
    expect(mockAppState.plan.value[2].edited).toBe(true)
  })
})
