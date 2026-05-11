# meal-planner Implementation Plan

> **For Codex:** Implement this plan round by round.

**Goal:** A mobile H5 app for small-base-weight-loss meal planning. Input body parameters → propose eating schedule → user confirms → generate full day-by-day food plan.

**Architecture:** Pure client-side Vue 3 app. All calculations in JavaScript. No backend, no API.

**Tech Stack:** Vue 3 + Vite + JavaScript + plain CSS (mobile-first)

---

## Round 1: Core Logic Layer

### Task 1: Create calculation module `src/utils/calc.js`

**BMR formula (Mifflin-St Jeor):**
- Male: 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5
- Female: 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161

**TDEE = BMR × activity multiplier:**
- Sedentary: 1.2
- Light: 1.375
- Moderate: 1.55
- Heavy: 1.725

**Target calories = TDEE - deficit:**
- Small base deficit: 200-300 kcal (never below BMR)
- Based on current vs target weight difference

**Macro split:**
- Protein: 30% (1.6-2.0g/kg body weight)
- Carbs: 40%
- Fat: 30%

Export: `calcBMR()`, `calcTDEE()`, `calcTargetCalories()`, `calcMacros()`

### Task 2: Create food data module `src/utils/foods.js`

Define food templates as structured data. NOT a recipe database — these are standard food items with nutritional info per 100g.

Structure:
```js
{
  id: 'oatmeal',
  name: '燕麦',
  category: 'breakfast', // breakfast, lunch, dinner, snack
  calories: 377,        // per 100g
  protein: 13.5,
  carbs: 66.3,
  fat: 6.7,
  unit: 'g',
  defaultPortion: 50,   // grams typical serving
  tags: ['low-glycemic', 'fiber']
}
```

Cover 30-40 items covering:
- Breakfast: oatmeal, whole wheat bread, eggs, milk, yogurt, etc.
- Lunch/dinner: brown rice, quinoa, chicken breast, salmon, tofu, lean beef, shrimp, various vegetables
- Snacks: apple, banana, nuts, yogurt

### Task 3: Create plan generator `src/utils/planGenerator.js`

**Input:** user params + confirmed schedule (meal count, intervals)
**Output:** array of day plans

Generator logic:
1. Calculate target daily calories + macros
2. Split calories across meals based on schedule
3. For each meal slot, select appropriate food items matching the calorie/macro target
4. Rotate items across days to avoid repetition
5. Return structured plan data

### Task 4: Create Vue app skeleton

- Replace HelloWorld.vue content
- Set up 3 views (placeholder pages for now): InputView, ConfirmView, PlanView
- Basic mobile layout with viewport meta

---

## Round 2: UI + Interaction

### Task 5: InputView - Parameter form

Styled mobile form with:
- Gender toggle (male/female)
- Number inputs: age, height, weight, target weight
- Activity level selector (4 levels with descriptions)
- Days selector (3/7/14)
- Clean, modern card-style layout

### Task 6: Schedule proposal + confirmation

After user submits params, calculate and show:
- BMR, TDEE, target daily calories
- Proposed schedule: "建议每天 5 餐，时间间隔为..." with visual timeline
- Editable: user can adjust meal count (3/4/5/6) and see timing auto-adjust
- Confirm button to generate full plan

### Task 7: PlanCalendar - Calendar view

- Horizontal scrollable day cards showing day number, date, daily calories
- Current day highlighted
- Tap to view day detail

### Task 8: DayDetail - Single day view

Shows:
- Timeline of meals with time, food name, portion in grams
- Per-meal calorie breakdown
- Daily macro pie chart (simple CSS or canvas)
- Swipe left/right to switch days

### Task 9: Polish

- Smooth transitions between views
- Loading states during calculation
- Share/save plan as image (nice to have)
- Dark mode friendly colors (optional)
