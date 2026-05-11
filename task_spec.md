# Codex Task

# v0.2.4: Three UX Improvements

## Context
Meal-planner at `/mnt/d/ai_lab/meal-planner`. Current v0.2.3 at commit `188849b`.

## What to implement

### 1. RecommendView: Back to InputForm
Add a back button/top-left arrow in RecommendView that returns to InputForm while preserving the filled profile data. InputForm must re-populate all fields (gender, age, height, weight, targetWeight, activityLevel, dietMethod, days, wakeTime, sleepTime, breakfastHabit, deficitPercent). After user modifies profile and re-submits, trigger a new recommendation. Do not break the existing "接受推荐，设置餐次安排" flow to ScheduleConfirm, and do not break ScheduleConfirm's existing "返回推荐" button.

### 2. Food Search in FoodPreferences & DayFoodEditor
Add a search input field to FoodPreferences.vue and DayFoodEditor.vue with placeholder "搜索食材".

Search behavior:
- Real-time filtering as user types (no submit button needed)
- Search scope: defaultFoods + customFoods (FoodPreferences); dayFoodPool (DayFoodEditor)
- Match fields: name, category (Chinese name or English value), tags (if present)
- Results grouped by category, or at least show category label per item
- Preserved selected state: checked food IDs, customFoods, dayFoodPool unchanged
- When search yields no results: show "没有找到相关食材"
- Clearing search restores full categorized list
- Do NOT change food data structures, do NOT affect export/import

Search box position:
- FoodPreferences: above the category tabs or between tabs and food list, visible on mobile
- DayFoodEditor: above the food item list

### 3. Scroll Reset on Page/Tab Transitions
Fix the H5 issue where view transitions leave the new page at the previous scroll position.

Implementation:
- Create a helper function `scrollToPageTop()` that runs:
  window.scrollTo({ top: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
- Use nextTick + requestAnimationFrame to ensure it runs after DOM rendering
- Apply in App.vue when view or activeTab changes

Required transition scenes (MUST all be covered):
- InputForm → RecommendView
- RecommendView → ScheduleConfirm
- ScheduleConfirm → FoodPreferences
- FoodPreferences → PlanCalendar
- PlanCalendar → MealEditor
- PlanCalendar → DayFoodEditor
- Back from MealEditor/DayFoodEditor to PlanCalendar
- Bottom Tab switches: 餐单 / 食材 / 进度 / 打卡 / 我的
- After import → PlanCalendar
- After data clear → InputForm

Do NOT scroll on:
- Search input changes (user typing)
- Food item checkbox toggles
- Weight input changes
- Day tab switches in PlanCalendar (keep current behavior)

### Files to change
- src/components/RecommendView.vue — back button to InputForm
- src/components/FoodPreferences.vue — search input + filtering
- src/components/DayFoodEditor.vue — search input + filtering
- src/App.vue — scrollToPageTop on view/tab changes, handle RecommendView back event
- src/utils/appVersion.js — v0.2.4
- src/style.css — search input styles
- README.md — update
- PROJECT_STATE.md — update

### DO NOT change
- src/storage/db.js, src/storage/index.js
- src/components/ScheduleConfirm.vue, src/components/PlanCalendar.vue
- src/components/MealEditor.vue, src/components/WeightProgress.vue, src/components/CheckinProgress.vue
- src/utils/calc.js, src/utils/planGenerator.js, src/utils/foods.js, src/utils/mealTemplates.js, src/utils/backup.js

### Verification
1. RecommendView back to InputForm preserves data
2. FoodPreferences search filters by name/category/tags, results grouped
3. DayFoodEditor search works
4. Search preserves selected state
5. Empty search shows "没有找到相关食材"
6. Clear search restores full list
7. All transition scenes scroll to top
8. Does NOT scroll on search typing or checkbox toggles
9. Build passes (npm run build)
10. Existing v0.2.3 features intact

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
