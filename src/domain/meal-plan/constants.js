// Shared constants for the meal-plan domain
// Single source of truth — import from here, do not duplicate.

// ── Meal configuration ──────────────────────────────────────────

export const mealNameMap = {
  2: ['第一餐', '第二餐'],
  3: ['第一餐', '第二餐', '第三餐'],
  4: ['第一餐', '第二餐', '加餐1', '第三餐'],
  5: ['第一餐', '加餐1', '第二餐', '加餐2', '第三餐'],
  6: ['第一餐', '加餐1', '第二餐', '加餐2', '第三餐', '加餐3'],
}

export const mealProfiles = [
  { category: 'breakfast', type: 'main' },
  { category: 'snack', type: 'snack' },
  { category: 'lunch', type: 'main' },
  { category: 'snack', type: 'snack' },
  { category: 'dinner', type: 'main' },
  { category: 'snack', type: 'snack' },
]

export const splitMap = {
  2: [0.5, 0.5],
  3: [0.3, 0.4, 0.3],
  4: [0.28, 0.38, 0.1, 0.24],
  5: [0.24, 0.1, 0.32, 0.1, 0.24],
  6: [0.22, 0.09, 0.28, 0.09, 0.24, 0.08],
}

// ── Nutrition thresholds ────────────────────────────────────────

/** Minimum daily calories for women (kcal) */
export const MIN_CALORIES_FEMALE = 1200
/** Minimum daily calories for men (kcal) */
export const MIN_CALORIES_MALE = 1400

// ── Calorie deviation thresholds (kcal) ────────────────────────

/** Deviation within this range is considered "on target" */
export const CALORIE_DEVIATION_MINOR = 50
/** Deviation within this range is considered "slightly off" */
export const CALORIE_DEVIATION_MODERATE = 100
/** Deviation within this range is considered "noticeably off" */
export const CALORIE_DEVIATION_MAJOR = 150
/** Deviation above this triggers meal recalibration during generation */
export const CALORIE_CALIBRATION_THRESHOLD = 80

// ── Portion scaling bounds ──────────────────────────────────────

/** Minimum portion scale factor */
export const PORTION_SCALE_MIN = 0.75
/** Maximum portion scale factor */
export const PORTION_SCALE_MAX = 2.5
/** Minimum portion scale factor for recalibration */
export const PORTION_RECALIBRATION_MIN = 0.5
/** Portion rounding step (grams) */
export const PORTION_STEP = 5
