# V0.3 — Clean App Shell + Navigation Refactor

> Branch: `v0.3-clean-app-shell` (clean branch from v0.2.5 tag)
> Preview: https://coffmeteor.github.io/meal-planner-v03-preview/
> Status: Phase 1 in progress

## Strategy

**Current v0.3-app-shell-preview is archived (renamed to v0.3-app-shell-preview-archived).**
It had fundamental issues: dual state sources (App.vue refs + stores), Today actions leaking to MealEditor, and hardcoded UI styles.

**Clean restart** from v0.2.5 stable baseline to avoid accumulated debt.

## Phased Implementation

### Phase 1 — App Shell + Navigation Skeleton

**Goal**: Stable navigation shell with bottom tabs and pageStack, no feature migration.

**Scope**: App.vue skeleton, BottomTabBar, AppTopBar, navigationStore, TodayDashboard placeholder, component wrappers.

### Phase 2+ — Pending user review of Phase 1 skeleton

## Git Discipline

- Branch `v0.3-clean-app-shell` only
- Commit format: `phase<N>: <description>`
- No tag, no release, no merge to main
- Push triggers manual preview deploy
- Old `v0.3-app-shell-preview` branch abandoned
