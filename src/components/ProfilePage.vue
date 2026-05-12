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

defineEmits(['editProfile', 'clearData', 'importData'])
</script>

<template>
  <section class="tab-page">
    <ProfileView
      :profile="profile"
      :plan-meta="planMeta"
      @edit-profile="$emit('editProfile')"
      @clear-data="$emit('clearData')"
      @import-data="$emit('importData', $event)"
    />
  </section>
</template>
