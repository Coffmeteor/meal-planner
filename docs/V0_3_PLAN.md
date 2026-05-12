# V0.3 — App-like UX + Architecture Refactor + Local Smart Input

> Branch: `v0.3-app-shell-preview`
> Base: v0.2.5 (tag on main)
> Preview: https://coffmeteor.github.io/meal-planner-v03-preview/

## Overview

Transform the H5 from a "long-page tool" into an "App-like H5" with bottom tab navigation, hierarchical page stack, cleaned architecture, and local smart food parsing. Pure frontend, zero backend, zero AI API.

## Phased Implementation

### Phase 1 — App Shell + Navigation + Today Dashboard (Core UX)

**Goal**: Establish the new app shell, pageStack, tab navigation, and Today home page.

**Components to create/modify**:

**Core Infrastructure:**
- `src/stores/navigationStore.js` — pageStack API (pushPage, popPage, replacePage, clearPageStack). Simple reactive store, no Pinia dependency.
- `src/core/appState.js` — app-level state (currentDay, dayNumber, activeTab, etc.). Pure functions + a tiny reactive wrapper.

**App Shell (App.vue):**
- Rewrite to: TopBar + `<component :is>` page renderer + BottomTabBar
- Tab definitions: `today`, `plan`, `foods`, `progress`, `profile`
- When a sub-page is active (pageStack depth > 0): hide BottomTabBar, show unified TopBar with back button + title
- Tab icons: use inline SVG or simple unicode. No icon library dependency.

**Today Dashboard:**
- `src/components/TodayDashboard.vue` — new component, shown when tab=today
- Sections:
  1. Day header: "今天是计划第 N 天"
  2. Calorie card: target kcal / current plan kcal / deviation
  3. Today meals summary card: list meals with time windows
  4. Today todos card: record weight, check first meal, complete check-in, optimize calories
  5. Quick actions: edit today, optimize heat, swap a meal, today check-in
- Task rules (computed from data):
  - No weight record today → "记录今日体重"
  - No check-in today → "完成今日打卡"
  - Today deviation > 100 kcal → "优化今日餐单"
  - No plan for today → "生成/刷新今日餐单"
  - Low 7-day execution rate → lightweight reminder

**Tab Page Components:**
- `PlanPage.vue` — wraps existing PlanCalendar logic, shows multi-day plan with day focus
- `FoodsPage.vue` — wraps existing food search + preferences
- `ProgressPage.vue` — wraps WeightProgress + CheckinProgress summaries
- `ProfilePage.vue` — wraps ProfileView

**Existing tab page migration:**
- `WelcomeHome.vue` → repurpose or integrate as first-time flow
- `RecommendView.vue`, `ScheduleConfirm.vue`, `InputForm.vue` → integrate into Today flow or keep as sub-pages

**Files to touch:**
- `src/App.vue` — rewrite (major)
- `src/main.js` — minor (import new stores)
- `src/stores/navigationStore.js` — create
- `src/components/TodayDashboard.vue` — create
- `src/components/PlanPage.vue` — create (wraps PlanCalendar)
- `src/components/FoodsPage.vue` — create (wraps FoodPreferences + search)
- `src/components/ProgressPage.vue` — create (wraps CheckinProgress + WeightProgress)
- `src/components/ProfilePage.vue` — create (wraps ProfileView)

### Phase 2 — Sub-page Stack Migration

**Goal**: Convert 6+ full-screen components into pageStack sub-pages with unified top bar + back navigation.

**Sub-pages to migrate:**
- MealEditor → sub-page, called from PlanPage or Today. When closed, returns to caller with updated data.
- DayFoodEditor → sub-page. Same pattern.
- CheckinProgress form → sub-page for today's check-in. History/summary stays in Today or Progress.
- WeightProgress add weight → sub-page or inline card.
- ProfileView import/export → sub-page.
- FoodPreferences custom food → sub-page.

**pageStack API (navigationStore.js):**
```js
pushPage(name, params)  // name = component name, params = data
popPage()               // go back
replacePage(name, params) // replace current top
clearPageStack()        // reset to tab page
```

**Vue approach**: Render `<component :is="currentPageComponent" v-bind="currentPageParams" @done="popPage" />`. No Vue Router needed.

**Files to create/modify:**
- `src/components/MealEditor.vue` — refactor to accept params via props, emit done/cancel
- `src/components/DayFoodEditor.vue` — same
- `src/components/CheckinForm.vue` — extract from CheckinProgress as sub-page
- `src/components/WeightEntry.vue` — extract from WeightProgress as sub-page
- `src/components/DataBackup.vue` — extract from ProfileView as sub-page
- `src/components/CustomFood.vue` — extract from FoodPreferences as sub-page
- `src/components/ProfileEdit.vue` — create for editing user profile

### Phase 3 — Software Architecture Layers

**Goal**: Extract pure logic into core/, organize app actions into services/, platform adapters into adapters/.

**Structure:**

```
src/core/
  nutrition.js      — calorie math, macro ratios, deviations (pure functions)
  mealPlan.js        — plan generation, day calculations
  foods.js           — food DB operations, search, categorization
  progress.js        — weight trends, execution rates, streak calc
  checkins.js        — check-in logic, daily score

src/services/
  planService.js      — orchestrate meal plan actions
  todayService.js     — today's dashboard data assembly
  mealEditService.js  — single-meal and day-level editing
  backupService.js    — import/export logic
  parserService.js    — local text food parser (bridge to recognitionAdapter)

src/adapters/
  storageAdapter.js   — wraps storage/db.js, localStorage
  fileAdapter.js      — file download/upload for backup
  recognitionAdapter.js — localTextParser(), parseFoodImage()→notSupported, parseFoodVoice()→notSupported
  syncAdapter.js      — placeholder for future sync (stub methods)

src/stores/
  appStore.js         — global app state (dayNumber, phase, etc.)
  navigationStore.js  — pageStack (from Phase 1)
  planStore.js        — meal plan state
  foodStore.js        — food data state
  progressStore.js    — progress and weight state
```

**Constraints:**
- core/ modules are pure functions (no Vue, no DOM, no localStorage, no window/document). Testable independently.
- services/ import from core/ and adapters/.
- adapters/ encapsulate platform APIs.
- stores/ use Vue reactivity (reactive/ref/computed).
- Do NOT rewrite all existing utils/. Extract incrementally — move only what's needed for the new components.
- Keep storage/db.js untouched. storageAdapter wraps it.
- Keep backup schema compatible.

### Phase 4 — Local Smart Food Text Parser

**Goal**: Users type natural language food descriptions and get structured food items for confirmation.

**Parser (src/adapters/recognitionAdapter.js):**
```js
recognitionAdapter.localTextParser(input: string) → [{ foodId, name, estimatedGrams, confidence, source: 'localTextParser' }]
```

**Common portion rules (src/core/commonPortions.js):**
```
鸡蛋 1 个 ≈ 50g
米饭 1 碗 ≈ 150g
牛奶/豆浆 1 杯 ≈ 250g
酸奶 1 盒 ≈ 150g
香蕉 1 根 ≈ 100g
苹果 1 个 ≈ 180g
油 1 勺 ≈ 10g
坚果 1 把 ≈ 20g
```

**Interaction flow:**
1. In MealEditor, add "文本添加食材" button
2. Opens a text input sub-page (FoodTextInput.vue)
3. User types: "鸡蛋2个，米饭一碗，牛奶一杯"
4. System parses → shows confirmation list with grams and confidence
5. User can edit grams, remove items
6. Confirm → items added to current meal
7. Cancel → back with no changes

**Components:**
- `src/components/FoodTextInput.vue` — text input + parse result confirmation page
- `src/core/commonPortions.js` — portion estimation rules
- `src/core/foodParser.js` — parser logic (NLP-ish, regex-based)

**Recognition adapter API (future-ready):**
```js
recognitionAdapter.localTextParser(input) → items       // ✅ Phase 4
recognitionAdapter.parseFoodImage(imageData) → notSupported  // placeholder
recognitionAdapter.parseFoodVoice(audioData) → notSupported  // placeholder
```

### Phase 5 — UI Design System Unification

**Goal**: Consistent card-based, mobile-first design language across all pages.

**Design tokens (src/style.css):**
- Card border-radius: 12px
- Spacing scale: 4, 8, 12, 16, 20, 24
- Primary green: `#22c55e` or similar
- Background: `#f8fafc` (light gray)
- Card: white, subtle shadow
- Danger: red `#ef4444`
- Text hierarchy: title (16-18px semibold), body (14px regular), caption (12px secondary)

**Component style conventions:**
1. Each main page: max 1-2 primary actions
2. Primary: solid green button
3. Secondary: outlined or text button
4. Danger: red, requires confirmation
5. Empty states: icon + message + action CTA
6. Top bar: consistent height, back button left, title center
7. Bottom tab: active state, badge support
8. Sub-page bottom button: safe-area padding

**Files:**
- `src/style.css` — refactor with design tokens + CSS variables
- All components — apply consistent card pattern

### Phase 6 — Compatibility + Verification

**Must preserve:**
- v0.1.1 date fix (UTC date bug)
- v0.2 single-meal editing
- v0.2 day-level editing
- v0.2.1 export/import
- v0.2.3 eating window + meal time editing
- v0.2.4 food search + scrollTop fix
- v0.2.5 calorie calibration + unified meal naming
- MealEditor gram input UX

**Verification checklist:**
1. `pnpm build` passes
2. v0.2.5 data opens without white screen
3. First-time wizard works with no data
4. Default entry = Today dashboard when plan exists
5. Bottom tabs: 今日 / 餐单 / 食材 / 进度 / 我的
6. Meal editor = sub-page, no bottom tab, back works
7. Day editor = sub-page
8. Check-in form = sub-page or clear form
9. Weight add = sub-page or clear form
10. Export/import works
11. Food search works
12. Eating window + meal time editing works
13. Calorie calibration works
14. Gram input works (no rounding jank)
15. Today task logic correct
16. Text parser: "鸡蛋2个，米饭一碗，牛奶一杯" → confirmable items
17. Mobile width: no horizontal scroll on iPhone
18. Page transitions: no bottom gap, no jank
19. Preview deploy: https://coffmeteor.github.io/meal-planner-v03-preview/
20. main untouched

## Git Strategy

- All work on `v0.3-app-shell-preview` branch
- Each phase = one or more commits
- Commit format: `phase<N>: <description>`
- No tag, no release, no merge to main
- Push triggers preview auto-deploy

## Files NOT to touch

- public/ — static files
- .github/workflows/deploy.yml — main repo workflow (no change)
- storage/db.js — unless absolutely necessary
- Backup schema — keep compatible
- .git/ — git internals
