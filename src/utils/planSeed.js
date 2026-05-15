// Utility: Plan Seed — monotonically increasing counter for meal plan variety
// Ensures successive generations produce different results.

let _planSeed = Date.now()

export function nextPlanSeed() {
  return _planSeed++
}
