# Project State

## Current Version

**v0.2.1** — Patch: meal edit display sync, day-level food editor, local export/import backup

## Patch (v0.2.1)

- Added `APP_VERSION` single source and updated profile display to `v0.2.1`.
- Fixed manual meal edits so `name`, `foods/items`, `portion`, calories, macros, edit flags, and fallback `simpleSteps` are normalized together and persist across reloads.
- Added day-level food editing: a selected day can store `dayFoodPool`, regenerate only unlocked/unedited meals from selected ingredients, and leave other days unchanged.
- Added browser-local JSON export/import with schema validation, import summary, overwrite confirmation, partial data handling, and restore attempt on failed import.

## Bugfix (v0.1.1)

- Fix plan date offset by 1 day in China timezone (UTC+8) due to `toISOString()` using UTC.
- `planGenerator.js`: replaced `date.toISOString().slice(0, 10)` with local-time `getFullYear/getMonth/getDate`.
- `App.vue`: replaced `now.toISOString().slice(0, 10)` fallback with `formatDateYmd(now)`.
- Plan dates now correctly use local time.

## Completed Rounds

| Round | Description |
|-------|-------------|
| Round 1 | MVP 主流程：InputForm → RecommendView → ScheduleConfirm → PlanCalendar |
| Round 2 | 本地持久化（IndexedDB + localStorage）、App 式恢复 |
| Round 3 | 小基数推荐、热量缺口、宏量营养素、计划摘要 |
| Round 4 | 个人食材池、食材选择前置、刷新食谱、餐型模板/真实餐点、锁定餐点、单餐刷新 |
| Round 5 | 体重记录、7 日均重、动态建议、SVG 体重趋势图 |
| Round 6 | 每日执行打卡、7 天复盘 |
| Round 7 | App Shell 底部 Tab 导航：餐单 / 食材 / 进度 / 打卡 / 我的 |
| Round 8 | 单餐编辑、当天食材池、导出/导入、本地版本标识 |

## Core Capabilities (v0.1.0)

- 5-step setup wizard: 资料 → 推荐 → 餐次 → 食材 → 餐单
- Recommendation: diet method, calorie deficit (10%/15%/20%), macros (protein g/kg, fat floor, carb remainder)
- Personal food pool: default + custom ingredients, toggle selection
- Multi-day meal plan: calendar view, meal locking, single-meal replace, full refresh
- App shell after plan creation with fixed bottom tab bar
- Meal plan tab: day selector, plan summary, meal cards, lock/replace/refresh
- Food tab: manage ingredients, add/delete custom, refresh recipes
- Progress tab: weight logging, 7-day average, SVG trend chart, dynamic advice
- Check-in tab: today's execution, 7-day review, record list with delete confirmation
- Profile tab: profile summary, edit profile, browser-only storage notice, export/import backup, clear all data (double confirmation)
- Navigation: wizard mode (no tabs) → app shell mode (bottom tabs)

## Data

- **Storage:** IndexedDB + localStorage fallback
- **Scope:** Browser-local only
- **No accounts or cloud sync; import/export is local JSON only**

## Known Limitations

- No user accounts or authentication
- No cloud sync across devices
- Import/export is manual JSON backup only; no automatic sync
- Food nutrition data is product-grade estimation, not laboratory precision
- Not medical advice — does not constitute health or nutrition diagnosis

## Next Steps

- v0.2.x bugfix cycle (UI polish, edge cases)
- Ingredient database refinement
- More detailed review suggestions
