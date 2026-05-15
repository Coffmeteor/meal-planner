<script setup>
import { reactive, watch } from 'vue'
import { ACTIVITY_LEVELS } from '../domain/nutrition/index.js'

const props = defineProps({
  initialData: {
    type: Object,
    default: null,
  },
  editMode: {
    type: Boolean,
    default: false,
  },
  section: {
    type: String,
    default: 'all',
  },
})

const emit = defineEmits(['submit', 'cancel'])

const form = reactive({
  gender: 'female',
  age: 28,
  height: 165,
  weight: 62,
  targetWeight: 56,
  activity: 'light',
  days: 7,
  wakeTime: '07:00',
  sleepTime: '23:00',
  breakfastHabit: 'always',
  dietScenario: 'mixed',
  exerciseFreq: 1,
  hasStrength: false,
  hasCardio: false,
  dietMethod: null,
  deficitPercent: null,
  scope: 'settings',
})

watch(
  () => props.initialData,
  (initialData) => {
    if (!initialData) return
    Object.assign(form, {
      gender: initialData.gender ?? form.gender,
      age: initialData.age ?? form.age,
      height: initialData.height ?? form.height,
      weight: initialData.weight ?? form.weight,
      targetWeight: initialData.targetWeight ?? form.targetWeight,
      activity: initialData.activity ?? initialData.activityLevel ?? form.activity,
      days: initialData.days ?? form.days,
      wakeTime: initialData.wakeTime ?? '07:00',
      sleepTime: initialData.sleepTime ?? '23:00',
      breakfastHabit: initialData.breakfastHabit ?? 'always',
      dietScenario: initialData.dietScenario ?? 'mixed',
      exerciseFreq: initialData.exerciseFreq ?? 1,
      hasStrength: initialData.hasStrength ?? false,
      hasCardio: initialData.hasCardio ?? false,
      dietMethod: initialData.dietMethod ?? null,
      deficitPercent: initialData.deficitPercent ?? null,
    })
  },
  { immediate: true },
)

function submitForm() {
  emit('submit', {
    ...form,
    age: Number(form.age),
    height: Number(form.height),
    weight: Number(form.weight),
    targetWeight: Number(form.targetWeight),
    days: Number(form.days),
    wakeTime: form.wakeTime,
    sleepTime: form.sleepTime,
    breakfastHabit: form.breakfastHabit,
    dietScenario: form.dietScenario,
    exerciseFreq: Number(form.exerciseFreq),
    hasStrength: Boolean(form.hasStrength),
    hasCardio: Boolean(form.hasCardio),
    dietMethod: form.dietMethod,
    deficitPercent: form.deficitPercent,
    scope: form.scope,
  })
}
</script>

<template>
  <form class="panel form-stack" @submit.prevent="submitForm">
    <div class="section-title">
      <template v-if="section === 'body'">
        <p>个人资料</p>
        <h2>身体基础信息</h2>
      </template>
      <template v-else-if="section === 'lifestyle'">
        <p>生活习惯</p>
        <h2>作息与饮食场景</h2>
      </template>
      <template v-else-if="section === 'plan'">
        <p>饮食计划</p>
        <h2>进食方案与热量设置</h2>
      </template>
      <template v-else>
        <p>资料</p>
        <h2>填写身体数据</h2>
      </template>
    </div>

    <!-- Body section -->
    <template v-if="section === 'all' || section === 'body'">
      <div class="field-group">
        <span class="field-label">性别</span>
        <div class="segmented">
          <button
            type="button"
            :class="{ active: form.gender === 'female' }"
            @click="form.gender = 'female'"
          >
            女性
          </button>
          <button
            type="button"
            :class="{ active: form.gender === 'male' }"
            @click="form.gender = 'male'"
          >
            男性
          </button>
        </div>
      </div>
      <div class="input-grid">
        <label class="field-card"
          ><span>年龄</span
          ><input v-model.number="form.age" type="number" min="12" max="90" inputmode="numeric"
        /></label>
        <label class="field-card"
          ><span>身高 cm</span
          ><input
            v-model.number="form.height"
            type="number"
            min="120"
            max="220"
            inputmode="numeric"
        /></label>
        <label class="field-card"
          ><span>当前 kg</span
          ><input v-model.number="form.weight" type="number" min="35" max="180" step="0.1"
        /></label>
        <label class="field-card"
          ><span>目标 kg</span
          ><input v-model.number="form.targetWeight" type="number" min="35" max="180" step="0.1"
        /></label>
      </div>
      <label class="field-group">
        <span class="field-label">日常活动</span>
        <select v-model="form.activity">
          <option v-for="(item, key) in ACTIVITY_LEVELS" :key="key" :value="key">
            {{ item.label }}
          </option>
        </select>
      </label>
      <div class="field-group">
        <span class="field-label">计划天数</span>
        <div class="segmented">
          <button
            v-for="day in [3, 7, 14]"
            :key="day"
            type="button"
            :class="{ active: form.days === day }"
            @click="form.days = day"
          >
            {{ day }}天
          </button>
        </div>
      </div>
    </template>

    <!-- Lifestyle section -->
    <template v-if="section === 'all' || section === 'lifestyle'">
      <div class="form-section">
        <div class="section-title compact">
          <p>作息习惯</p>
          <h2>起床与早餐</h2>
        </div>
        <div class="input-grid">
          <label class="field-card"
            ><span>起床时间</span><input v-model="form.wakeTime" class="time-input" type="time"
          /></label>
          <label class="field-card"
            ><span>睡觉时间</span><input v-model="form.sleepTime" class="time-input" type="time"
          /></label>
        </div>
        <div class="field-group">
          <span class="field-label">早餐习惯</span>
          <div class="segmented three-wide">
            <button
              type="button"
              :class="{ active: form.breakfastHabit === 'always' }"
              @click="form.breakfastHabit = 'always'"
            >
              每天都吃
            </button>
            <button
              type="button"
              :class="{ active: form.breakfastHabit === 'sometimes' }"
              @click="form.breakfastHabit = 'sometimes'"
            >
              偶尔不吃
            </button>
            <button
              type="button"
              :class="{ active: form.breakfastHabit === 'skip' }"
              @click="form.breakfastHabit = 'skip'"
            >
              基本不吃
            </button>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="section-title compact">
          <p>日常饮食</p>
          <h2>主要用餐场景</h2>
        </div>
        <label class="field-group">
          <span class="field-label">饮食场景</span>
          <select v-model="form.dietScenario">
            <option value="home">自炊</option>
            <option value="takeout">外卖</option>
            <option value="canteen">食堂</option>
            <option value="convenience">便利店</option>
            <option value="mixed">混合</option>
          </select>
        </label>
      </div>
      <div class="form-section">
        <div class="section-title compact">
          <p>运动情况</p>
          <h2>频率与类型</h2>
        </div>
        <div class="field-group">
          <span class="field-label">每周运动</span>
          <div class="segmented">
            <button
              v-for="item in [
                { label: '0', value: 0 },
                { label: '1-2', value: 1 },
                { label: '3-4', value: 3 },
                { label: '5+', value: 5 },
              ]"
              :key="item.value"
              type="button"
              :class="{ active: form.exerciseFreq === item.value }"
              @click="form.exerciseFreq = item.value"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <label class="toggle-row"
          ><span>包含力量训练</span><input v-model="form.hasStrength" type="checkbox"
        /></label>
        <label class="toggle-row"
          ><span>包含有氧运动</span><input v-model="form.hasCardio" type="checkbox"
        /></label>
      </div>
    </template>

    <!-- Plan section -->
    <template v-if="section === 'all' || section === 'plan'">
      <div class="field-group">
        <span class="field-label">进食方案</span>
        <div class="segmented">
          <button
            type="button"
            :class="{ active: !form.dietMethod || form.dietMethod === 'threeMeals' }"
            @click="form.dietMethod = 'threeMeals'"
          >
            正常三餐
          </button>
          <button
            type="button"
            :class="{ active: form.dietMethod === 'threeMealsPlusSnack' }"
            @click="form.dietMethod = 'threeMealsPlusSnack'"
          >
            三餐+加餐
          </button>
          <button
            type="button"
            :class="{ active: form.dietMethod === '14:10' }"
            @click="form.dietMethod = '14:10'"
          >
            14:10
          </button>
          <button
            type="button"
            :class="{ active: form.dietMethod === '16:8' }"
            @click="form.dietMethod = '16:8'"
          >
            16:8
          </button>
        </div>
      </div>
      <div class="field-group">
        <span class="field-label">热量缺口</span>
        <div class="segmented">
          <button
            v-for="pct in [10, 15, 20]"
            :key="pct"
            type="button"
            :class="{ active: form.deficitPercent === pct }"
            @click="form.deficitPercent = pct"
          >
            {{ pct }}%
          </button>
        </div>
      </div>
    </template>

    <!-- Apply scope (plan section only) -->
    <div v-if="editMode && section === 'plan'" class="field-group">
      <span class="field-label">应用范围</span>
      <div class="segmented">
        <button
          type="button"
          :class="{ active: form.scope === 'settings' }"
          @click="form.scope = 'settings'"
        >
          仅更新设置
        </button>
        <button
          type="button"
          :class="{ active: form.scope === 'today' }"
          @click="form.scope = 'today'"
        >
          从今天开始应用
        </button>
        <button
          type="button"
          :class="{ active: form.scope === 'restart' }"
          @click="form.scope = 'restart'"
        >
          重新开始计划
        </button>
      </div>
    </div>

    <div v-if="editMode" class="action-row">
      <button type="button" class="ghost-action" @click="emit('cancel')">放弃修改</button>
      <button class="primary-action" type="submit">保存</button>
    </div>
    <button v-else class="primary-action" type="submit">生成推荐方案</button>
  </form>
</template>

<style scoped>
input,
select,
textarea {
  font-size: max(1rem, 16px);
}
</style>
