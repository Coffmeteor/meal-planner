<script setup>
import ProfileView from './ProfileView.vue'
import { pushPage } from '../stores/navigationStore.js'

defineProps({
  profile: {
    type: Object,
    default: null,
  },
  planMeta: {
    type: Object,
    default: null,
  },
})

defineEmits(['editProfile', 'clearData', 'importData'])
</script>

<template>
  <section class="tab-page">
    <ProfileView
      :profile="profile"
      :plan-meta="planMeta"
    />
    <div class="profile-page-actions">
      <button type="button" class="primary-action" @click="pushPage('profileEdit')">修改资料</button>
      <button type="button" class="ghost-action" @click="pushPage('dataBackup')">数据备份/恢复</button>
      <button type="button" class="danger-action" @click="$emit('clearData')">清空全部数据</button>
    </div>
  </section>
</template>

<style scoped>
.profile-page-actions {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.danger-action {
  min-height: 2.75rem;
  border: 1px solid #f0c8bf;
  border-radius: 0.85rem;
  background: #fff7f5;
  color: #b33b2e;
  font-weight: 900;
}
</style>
