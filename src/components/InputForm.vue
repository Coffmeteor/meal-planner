<script setup>
import { reactive, watch } from 'vue'
import { ACTIVITY_LEVELS } from '../utils/calc.js'

const props = defineProps({
  initialData: {
    type: Object,
    default: null,
  },
  editMode: {
    type: Boolean,
    default: false,
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
})

watch(
  () => props.initialData,
  (initialData) => {
    if (!initialData) {
      return
    }

    Object.assign(form, {
      gender: initialData.gender ?? form.gender,
      age: initialData.age ?? form.age,
      height: initialData.height ?? form.height,
      weight: initialData.weight ?? form.weight,
      targetWeight: initialData.targetWeight ?? form.targetWeight,
      activity: initialData.activity ?? form.activity,
      days: initialData.days ?? form.days,
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
  })
}
</script>

<template>
  <form class="panel form-stack" @submit.prevent="submitForm">
    <div class="section-title">
      <p>第一步</p>
      <h2>填写身体数据</h2>
    </div>

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
      <label class="field-card">
        <span>年龄</span>
        <input v-model.number="form.age" type="number" min="12" max="90" inputmode="numeric" />
      </label>
      <label class="field-card">
        <span>身高 cm</span>
        <input v-model.number="form.height" type="number" min="120" max="220" inputmode="numeric" />
      </label>
      <label class="field-card">
        <span>当前 kg</span>
        <input v-model.number="form.weight" type="number" min="35" max="180" step="0.1" />
      </label>
      <label class="field-card">
        <span>目标 kg</span>
        <input v-model.number="form.targetWeight" type="number" min="35" max="180" step="0.1" />
      </label>
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

    <div v-if="editMode" class="action-row">
      <button type="button" class="ghost-action" @click="emit('cancel')">放弃修改</button>
      <button class="primary-action" type="submit">保存并重新生成计划</button>
    </div>
    <button v-else class="primary-action" type="submit">生成作息建议</button>
  </form>
</template>
