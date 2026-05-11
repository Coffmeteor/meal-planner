<script setup>
import { computed } from 'vue'
import { ACTIVITY_LEVELS } from '../utils/calc.js'

const props = defineProps({
  profile: {
    type: Object,
    default: null,
  },
  planMeta: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['editProfile', 'clearData'])

const genderLabels = {
  female: '女性',
  male: '男性',
}

const profileRows = computed(() => {
  const profile = props.profile || {}
  return [
    { label: '性别', value: genderLabels[profile.gender] || '--' },
    { label: '年龄', value: formatValue(profile.age, '岁') },
    { label: '身高', value: formatValue(profile.height, 'cm') },
    { label: '当前体重', value: formatValue(profile.weight, 'kg') },
    { label: '目标体重', value: formatValue(profile.targetWeight, 'kg') },
    { label: '日常活动', value: ACTIVITY_LEVELS[profile.activity]?.label || '--' },
    { label: '计划天数', value: formatValue(props.planMeta?.days || profile.days, '天') },
  ]
})

function formatValue(value, unit) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  return `${number}${unit}`
}
</script>

<template>
  <section class="profile-view">
    <div class="section-title compact">
      <p>个人设置</p>
      <h2>我的</h2>
    </div>

    <div class="profile-panel">
      <div class="profile-grid">
        <div v-for="row in profileRows" :key="row.label" class="profile-item">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
        </div>
      </div>
      <button type="button" class="primary-action" @click="emit('editProfile')">
        修改资料
      </button>
    </div>

    <div class="profile-panel note-panel">
      <strong>本地存储</strong>
      <p>资料、餐单、食材、体重和打卡记录仅保存在当前浏览器。</p>
    </div>

    <div class="profile-panel settings-panel">
      <button type="button" class="danger-action" @click="emit('clearData')">
        清空全部数据
      </button>
      <span>v0.1 准备版</span>
    </div>
  </section>
</template>

<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-panel {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 0.8rem;
  background: #fff;
  box-shadow: 0 8px 24px rgba(43, 54, 45, 0.08);
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.profile-item {
  min-width: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: #f6f8f4;
}

.profile-item span,
.settings-panel span {
  display: block;
  color: #68736b;
  font-size: 0.78rem;
  font-weight: 800;
}

.profile-item strong {
  display: block;
  margin-top: 0.2rem;
  color: #223026;
  font-size: 0.98rem;
  line-height: 1.25;
}

.note-panel strong {
  color: #223026;
}

.note-panel p {
  margin: 0;
  color: #68736b;
  font-size: 0.9rem;
  line-height: 1.55;
}

.danger-action {
  min-height: 2.75rem;
  border: 1px solid #f0c8bf;
  border-radius: 0.85rem;
  background: #fff7f5;
  color: #b33b2e;
  font-weight: 900;
}

.settings-panel {
  text-align: center;
}

@media (max-width: 360px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
