# Round 2: Local Personal Database Implementation Plan

> **For Hermes:** Dispatch Codex to implement this plan task-by-task.

**Goal:** Add IndexedDB-based local persistence so the H5 app saves and restores user state across page loads — no login, no cloud, no backend.

**Architecture:** Pure client-side IndexedDB via native API, wrapped in `src/storage/` module. App.vue gets minimal view-layer changes: one new view case ('home'), an `onMounted` init, and auto-save hooks. No large refactors of Round 1 code.

**Constraint 1 — Minimal App.vue changes:** Do NOT rewrite App.vue. Add an `onMounted` init function, one new view case for WelcomeHome, and auto-save calls after each step. Preserve all existing 3-view flow (input → confirm → plan).

**Constraint 2 — WelcomeHome is lightweight:** It's a simple entry hub with 4 action buttons — no dashboard, no history, no weight tracking, no PIN.

**Tech Stack:** Vue 3 + Vite + JavaScript + native IndexedDB (no external library)

---

## Task 1: Create IndexedDB storage layer `src/storage/db.js`

**Objective:** Low-level IndexedDB wrapper with schema versioning, open/close/read/write/delete/clear operations.

**Files:**
- Create: `src/storage/db.js`

**Details:**

```js
const DB_NAME = 'meal-planner'
const DB_VERSION = 1
const STORE_NAME = 'userData'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function dbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null)
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function dbSet(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ key, value })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbDelete(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbClear() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
  })
}
```

Schema version 1 — single store `userData` with key-value pairs. Keys: `profile`, `schedule`, `latestPlan`. This is intentionally flat and simple because we need nothing more.

**Store keys and value shapes:**

| key | value shape |
|-----|-------------|
| `profile` | `{ gender, age, height, weight, targetWeight, activity, days, updatedAt }` |
| `schedule` | `{ mealCount, times, updatedAt }` |
| `latestPlan` | `{ generatedAt, params, schedule, days, summary: { totalCalories, avgCalories, macros }, plan }` |

---

## Task 2: Create convenience API `src/storage/index.js`

**Objective:** High-level CRUD functions that App.vue imports. All functions are best-effort — errors are caught silently (console.warn only), never thrown.

**Files:**
- Create: `src/storage/index.js`

**Functions to export:**

```js
export async function loadProfile()
export async function loadSchedule()
export async function loadLatestPlan()
export async function saveProfile(data)
export async function saveSchedule(data)
export async function saveLatestPlan(planData, params, schedule)
export async function clearAllData()
export async function getAppState()
```

`getAppState()` returns a summary of what exists in storage:
```js
// Returns: { hasProfile: bool, hasLatestPlan: bool, profile: object|null }
```

Every function wraps IndexedDB calls in try/catch. On error, `console.warn` and return null/default. **Never throw.**

---

## Task 3: Create WelcomeHome component `src/components/WelcomeHome.vue`

**Objective:** A lightweight landing page shown to returning users with data in IndexedDB.

**Files:**
- Create: `src/components/WelcomeHome.vue`

**Design:**

```
┌──────────────────────────────┐
│        减脂餐计划              │
│                              │
│   欢迎回来！上次生成于 X月X日    │
│   Profile 摘要: 女/28岁/165cm │
│                              │
│  ┌────────────────────────┐  │
│  │ 继续查看上次计划         │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 修改个人资料             │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 重新生成餐单             │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 清空本地数据             │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Props:**
- `profile` — current saved profile
- `planDate` — ISO date string of when plan was generated

**Events:**
- `view-plan` — user clicked "继续查看上次计划"
- `edit-profile` — user clicked "修改个人资料"
- `regenerate` — user clicked "重新生成餐单"
- `clear-data` — user clicked "清空本地数据"

**No state management in this component.** It's purely presentational — emits events up to App.vue.

**Style:** Use same design tokens as existing CSS (--bg, --panel, --green, etc.). No new CSS framework.

---

## Task 4: Minimal InputForm changes — support initial data prefill

**Objective:** Allow InputForm to receive existing profile data so returning users can edit their info without retyping.

**Files:**
- Modify: `src/components/InputForm.vue`

**Changes:**

1. Add optional prop:
```js
const props = defineProps({
  initialData: {
    type: Object,
    default: null
  }
})
```

2. In the reactive form init, check if `props.initialData` is provided and merge:
```js
const form = reactive({
  gender: props.initialData?.gender || 'female',
  age: props.initialData?.age || 28,
  height: props.initialData?.height || 165,
  weight: props.initialData?.weight || 62,
  targetWeight: props.initialData?.targetWeight || 56,
  activity: props.initialData?.activity || 'light',
  days: props.initialData?.days || 7,
})
```

3. When `initialData` prop changes (user navigates back from home), the form should react. But since `reactive` is set once on creation, this will work because the component is recreated by Vue's key/Transition. No need for a watcher.

---

## Task 5: Minimal App.vue changes — init, home view, auto-save

**Objective:** Add IndexedDB init on mount, one new view case, auto-save hooks, and clear-data handler. Preserve all existing 3-view flow.

**Files:**
- Modify: `src/App.vue`

**Changes — step by step:**

### 5.1 Add imports

```js
import { onMounted } from 'vue'
import WelcomeHome from './components/WelcomeHome.vue'
import { getAppState, saveProfile, saveSchedule, saveLatestPlan, clearAllData, loadLatestPlan, loadSchedule } from './storage/index.js'
```

### 5.2 Add state refs

```js
const savedPlan = ref(null)     // for resuming from storage
const savedSchedule = ref(null) // for resuming schedule
const homeProfile = ref(null)   // for WelcomeHome display
```

### 5.3 Add init function in onMounted

```js
onMounted(async () => {
  try {
    const state = await getAppState()
    if (state.hasProfile && state.hasLatestPlan) {
      homeProfile.value = state.profile
      savedPlan.value = await loadLatestPlan()
      savedSchedule.value = await loadSchedule()
      view.value = 'home'
    } else if (state.hasProfile) {
      homeProfile.value = state.profile
      // Pre-fill profile — pass initialData to InputForm
      view.value = 'input'
    }
    // else: no data → stay on 'input' (first time)
  } catch (e) {
    console.warn('Failed to load saved data, starting fresh:', e)
    view.value = 'input'
  }
})
```

### 5.4 Add handlers

```js
function handleViewPlan() {
  // Load saved plan data for display
  if (savedPlan.value) {
    plan.value = savedPlan.value.plan  // the day array
    params.value = savedPlan.value.params
  }
  view.value = 'plan'
}

function handleEditProfile() {
  params.value = homeProfile.value
  savedPlan.value = null
  view.value = 'input'
}

function handleRegenerate() {
  params.value = homeProfile.value
  savedPlan.value = null
  view.value = 'input'
}

async function handleClearData() {
  await clearAllData()
  savedPlan.value = null
  savedSchedule.value = null
  homeProfile.value = null
  params.value = null
  plan.value = []
  view.value = 'input'
}
```

### 5.5 Modify `handleInputSubmit` — add auto-save

Replace existing handler:
```js
function handleInputSubmit(nextParams) {
  params.value = nextParams
  saveProfile(nextParams) // fire-and-forget, best-effort
  view.value = 'confirm'
}
```

**Important:** `onMounted` sets `params.value = homeProfile.value` for edit/regenerate flows. So when the user submits InputForm with initialData pre-filled, `handleInputSubmit` gets the (possibly modified) data.

**ALSO important:** The existing `handleInputSubmit` just takes `nextParams` and sets `params.value = nextParams`. Since InputForm now supports `initialData` prop, we need to pass it. In the template, change:

```html
<InputForm v-if="view === 'input'" key="input" @submit="handleInputSubmit" />
```
to:
```html
<InputForm v-if="view === 'input'" key="input" :initialData="(savedPlan.value && view === 'input') ? null : params" @submit="handleInputSubmit" />
```

Wait, this is getting complicated. Let me think about when params should be used as initialData.

The two cases for showing InputForm:
1. **First time or "重新填写"** — params is null, no initial data needed
2. **Edit profile** — params contains saved profile, should prefill form
3. **Regenerate** — same as edit profile

The simplest approach: InputForm already shows default values when no initialData. If `params.value` has data (from saved profile), pass it as `initialData`:

```html
<InputForm v-if="view === 'input'" key="input" :initialData="params" @submit="handleInputSubmit" />
```

When `params` is null (first time), InputForm uses its own defaults. When `params` has data (from home→edit/regenerate), the form is pre-filled. No conditional needed.

### 5.6 Modify `handleConfirm` — add auto-save

```js
function handleConfirm({ params: confirmedParams, schedule }) {
  params.value = confirmedParams
  plan.value = generateMealPlan(confirmedParams, schedule)
  saveSchedule(schedule) // fire-and-forget
  saveLatestPlan(plan.value, confirmedParams, schedule) // fire-and-forget
  view.value = 'plan'
}
```

### 5.7 Add WelcomeHome view case in template

Add before the InputForm case:
```html
<WelcomeHome
  v-if="view === 'home'"
  key="home"
  :profile="homeProfile"
  :planDate="savedPlan?.generatedAt"
  @view-plan="handleViewPlan"
  @edit-profile="handleEditProfile"
  @regenerate="handleRegenerate"
  @clear-data="handleClearData"
/>
```

### 5.8 Add clear-data button to plan view

The existing plan view has a "重新填写" button. Below it, add a "清空数据" button:

```html
<section v-else key="plan" class="result-stack">
  <PlanCalendar :plan="plan" />
  <button type="button" class="ghost-action full-width" @click="restart">重新填写</button>
  <button type="button" class="ghost-action full-width danger" @click="handleClearData" style="color: var(--orange); border-color: rgba(240, 162, 74, 0.4);">清空所有数据</button>
</section>
```

Actually, to avoid inline styles, better to add a CSS class. But the user said "不要做UI大改". Let me just use the existing `ghost-action` class and a subtle color via style attribute. Minimal enough.

---

## Task 6: Build verification and push

**Objective:** Ensure `pnpm build` passes, then commit and push.

**Files:**
- No code changes

**Steps:**

1. Run `pnpm build` and verify exit code 0
2. If build fails, fix issues and rebuild
3. `git add src/storage/db.js src/storage/index.js src/components/WelcomeHome.vue src/components/InputForm.vue src/App.vue`
4. `git commit -m "feat: add IndexedDB local persistence (Round 2)"`
5. `git push`
6. Verify Pages deployment at `https://<owner>.github.io/meal-planner/`

---

## Error handling strategy

Every DB operation is wrapped in try/catch. If IndexedDB is unavailable (private browsing, old browser), the app degrades gracefully to the original no-storage behavior — forms default, no persistence, no crash.

**Edge cases:**
- IndexedDB not supported → `dbGet/dbSet` return null → `getAppState()` returns `{ hasProfile: false }` → first-time flow
- Data corrupted (wrong schema version, unexpected fields) → `try/catch` catches parse errors → returns null
- DB open fails → `onerror` rejects → caller catches → default behavior
- Race condition on concurrent tabs → last-write-wins, acceptable for personal use

---

## Files changed summary

| Action | File | Lines |
|--------|------|-------|
| Create | `src/storage/db.js` | ~85 |
| Create | `src/storage/index.js` | ~90 |
| Create | `src/components/WelcomeHome.vue` | ~90 |
| Modify | `src/components/InputForm.vue` | +5-7 |
| Modify | `src/App.vue` | +50-60 |
