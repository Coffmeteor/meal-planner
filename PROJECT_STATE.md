# Project State

## Current Capabilities

- Vue 3 + Vite SPA without vue-router; App.vue controls the wizard and app shell state.
- Initial setup remains a wizard: InputForm -> RecommendView -> ScheduleConfirm -> FoodPreferences -> PlanCalendar.
- After a meal plan exists, the app enters a fixed-bottom tab shell with five tabs: 餐单、食材、进度、打卡、我的.
- Meal plan tab supports day selection, plan summary, meal locking, single-meal replacement, and full recipe refresh near the top of the page.
- Food tab manages selected/default ingredients and custom ingredients, and can save or refresh recipes with the current food pool.
- Progress tab supports weight logs, 7-day average, SVG trend chart, dynamic advice, and check-in review after enough check-ins.
- Check-in tab supports today’s execution record, recent 7-day summary, review advice, record list, and confirmed deletion.
- Profile tab summarizes local profile data, starts profile editing, explains browser-only storage, and clears all local data with double confirmation.
- Local persistence uses IndexedDB and localStorage fallback; no account or cloud sync exists.

## Next Steps

- Manual H5 testing on iPhone-width viewports for tab scrolling, safe-area padding, and tap targets.
- Verify edit-profile regeneration flow with existing plans and food preferences.
- Review copy and visual hierarchy after real-device testing.
- Wait for manual validation before tagging or creating a v0.1 release.
