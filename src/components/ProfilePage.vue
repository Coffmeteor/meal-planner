<script setup>
import ProfileView from './ProfileView.vue'

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

const emit = defineEmits(['profileEdit', 'dataBackup', 'clearData', 'importData'])
</script>

<template>
  <section class="tab-page-shell profile-page">
    <div class="quick-action-grid">
      <button type="button" class="primary-action" @click="emit('profileEdit')">修改资料</button>
      <button type="button" class="ghost-action" @click="emit('dataBackup')">数据备份/恢复</button>
    </div>
    <ProfileView
      :profile="profile"
      :plan-meta="planMeta"
      @edit-profile="emit('profileEdit')"
      @clear-data="emit('clearData')"
      @import-data="emit('importData', $event)"
    />
  </section>
</template>
