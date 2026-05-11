# Codex Task

# v0.2.3: Diet Method Semantics + Editable Eating Window + Editable Meal Times

## Context

Meal-planner at `/mnt/d/ai_lab/meal-planner`. Current v0.2.2 at commit `619c2f8`.

Current state:
- v0.2: MealEditor, day-level food editor, per-meal editing
- v0.2.1: meal display sync, DayFoodEditor, export/import
- v0.2.2: fixed DayFoodEditor blank page + iOS import picker

## Problems to Fix

### 1. RecommendView: Diet method labels and collapsed state

Current RecommendView shows diet methods as named options like "12:00" or "10:00" for 14:10/16:8. These should be labelled as eating window schemes, not time points.

**Fix:**
- Rename diet method values: `tre14_10` → label "14:10 进食窗口", `tre16_8` → label "16:8 进食窗口"
- Add description text per method
- When the "切换方案" section is collapsed (not showing options), MUST still show the current selected method's name and description
- Options when expanded: 正常三餐, 三餐+加餐, 14:10 进食窗口, 16:8 进食窗口

### 2. Eating window data model

Add `eatingWindow` to the recommendation/schedule data:

```js
// normalThreeMeals / threeMealsSnack:
eatingWindow = { type: 'none' }

// 14:10:
eatingWindow = { type: '14:10', start: '10:00', end: '20:00', fastingHours: 14, eatingHours: 10 }

// 16:8:
eatingWindow = { type: '16:8', start: '12:00', end: '20:00', fastingHours: 16, eatingHours: 8 }
```

`end` auto-calculates from `start + eatingHours`. User edits `start`, `end` updates automatically.

Default `start` should consider user's `wakeTime`, `sleepTime`, `breakfastHabit`:
- If never eats breakfast: start later (10:00-11:00 for 14:10, 12:00 for 16:8)
- start should be at least 1h after wakeTime
- end should be at least 1-2h before sleepTime

### 3. New time utility module

Create `src/utils/timeUtils.js` or `src/utils/scheduleUtils.js` with:

- `timeToMinutes('HH:mm')` → number
- `minutesToTime(minutes)` → 'HH:mm'
- `addMinutesToTime(time, minutes)` → 'HH:mm'
- `isTimeWithinRange(time, start, end)` → boolean
- `isIncreasingTimes(times[])` → boolean (each subsequent > previous)
- `deriveEatingWindow(profile, dietMethod)` → eatingWindow object
- `validateScheduleTimes(schedule, eatingWindow)` → { valid, errors[] }
- `autoDistributeMeals(schedule, eatingWindow)` → schedule with times evenly spaced in window

Handle sleepTime > wakeTime (next day) gracefully but eating windows stay within same day.

### 4. ScheduleConfirm: back button + edible meal times + eating window editor

**Back button:** Add back to RecommendView button at top. On back, preserve selected dietMethod, deficitPercent, eatingWindow, macros.

**Meal times editable:** Each meal row shows a time input that the user can change. On change, update schedule data. NormalThreeMeals: 3 meals times. threeMealsSnack: 4 meals times. 14:10/16:8: 2-4 meals times.

**Eating window editor (only for 14:10/16:8):**
- Show "进食窗口" section
- Window start: editable time input
- Window end: auto-calculated, read-only display
- Fasting hours: read-only display
- "按窗口自动分配餐次" button

**Validation on confirm:**
- Times must be increasing
- For 14:10/16:8: ALL meals (including snacks) must be within eatingWindow
- If invalid: show error, disable confirm button
- Error examples: "餐次时间必须在 12:00-20:00 内", "当前餐次时间不在递增"

### 5. App.vue changes

- Pass eatingWindow data through the flow: RecommendView → ScheduleConfirm → plan generation
- In `handleConfirm`: save eatingWindow to params/schedule/latestPlan
- In plan generation (`handleFoodsSetup` or `handleFoodsSave`): pass eatingWindow constraints if applicable
- In PlanCalendar: pass eatingWindow for display
- Import ProfileView version update

### 6. PlanCalendar display

In the plan summary section, show eating window info:
- normalThreeMeals: "进食方案：正常三餐"
- threeMealsSnack: "进食方案：三餐+加餐"
- 14:10: "14:10 进食窗口 10:00-20:00" (using actual saved values, not defaults)
- 16:8: "16:8 进食窗口 12:00-20:00"

### 7. planGenerator.js

When generating meal plan:
- For 14:10/16:8: ensure all generated meal times fall within eatingWindow
- Use the schedule times and eatingWindow to place meals
- Existing `generateMealPlan` should accept eatingWindow parameter
- Regenerate day/meal functions should also be aware

### 8. Version and docs

- Update `src/utils/appVersion.js` to `v0.2.3`
- Update README.md and PROJECT_STATE.md

## Allowed Files

- `src/components/RecommendView.vue` — diet method labels, collapsed summary, eating window default logic
- `src/components/ScheduleConfirm.vue` — back button, meal time editing, eating window editor, validation
- `src/components/PlanCalendar.vue` — eating window in summary
- `src/App.vue` — pass eatingWindow through flow
- `src/utils/calc.js` — minimal: export deriveEatingWindow or related constants
- `src/utils/planGenerator.js` — accept eatingWindow in plan generation
- `src/utils/appVersion.js` — update to v0.2.3
- `src/style.css` — eating window editor, time input styles
- `README.md`
- `PROJECT_STATE.md`
- **NEW** `src/utils/scheduleUtils.js` — time utilities + validation + auto-distribute

## DO NOT MODIFY

- `src/storage/db.js`
- `src/storage/index.js`
- `src/components/MealEditor.vue`
- `src/components/DayFoodEditor.vue`
- `src/components/FoodPreferences.vue`
- `src/components/WeightProgress.vue`
- `src/components/CheckinProgress.vue`
- `src/utils/foods.js`
- `src/utils/mealTemplates.js`
- `src/utils/backup.js`
- `src/components/ProfileView.vue`
- `src/components/InputForm.vue`

## Verification

1. RecommendView collapsed shows current method summary
2. 14:10/16:8 labels show "进食窗口" not just times
3. ScheduleConfirm has back button
4. Meal times editable in ScheduleConfirm
5. 14:10/16:8 shows eating window start editor
6. Window end auto-calculates
7. Validation catches out-of-window and non-increasing times
8. Auto-distribute places all meals (including snacks) in window
9. PlanCalendar shows eating window in summary
10. Build passes
11. Existing features intact (meal edit, day edit, export/import, weight, checkin)

## Scope

Scope mode: guided
Guided scope: keep inspection minimal and avoid denied paths. Any denied-path modification will be rejected.

Allowed files:
- none

Allowed directories:
- none

Denied paths:
- .git/
- .env
- secrets/
- reports/
- samples/
- context/hermes-source/
- context/hermes-runtime/
- __pycache__/
- *.pyc
- *.log
- *.db
- *.sqlite
- state.db

## Operating Rules

- Use small targeted changes.
- Do not push, merge, delete branches, prune worktrees, or deploy.
- Do not use danger-full-access or bypass sandbox/approval controls.
- Keep output concise.

## Reference Source

The Hermes Agent runtime source is available at:
`/mnt/d/ai_lab/hermes-agent-source/` (symlink, auto-synced)

READ-ONLY for architecture understanding. Do NOT write to this path.
For edits, use the allowed files/directories in this repo.
