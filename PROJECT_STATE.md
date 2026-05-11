# Project State

## Current Version

**v0.1.0** — Commit: `611743c`

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
- Profile tab: profile summary, edit profile, browser-only storage notice, clear all data (double confirmation)
- Navigation: wizard mode (no tabs) → app shell mode (bottom tabs)

## Data

- **Storage:** IndexedDB + localStorage fallback
- **Scope:** Browser-local only
- **No accounts, no cloud sync, no import/export**

## Known Limitations

- No user accounts or authentication
- No cloud sync across devices
- No import/export of data
- Food nutrition data is product-grade estimation, not laboratory precision
- Not medical advice — does not constitute health or nutrition diagnosis

## Next Steps

- v0.1.x bugfix cycle (UI polish, edge cases)
- Data export/import
- Ingredient database refinement
- More detailed review suggestions
