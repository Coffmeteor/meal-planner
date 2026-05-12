<script setup>
import FoodPreferences from './FoodPreferences.vue'
import { pushPage } from '../stores/navigationStore.js'

defineProps({
  foodPreferences: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['save'])

function handleSave(payload, options) {
  emit('save', payload, options)
}
</script>

<template>
  <section class="tab-page">
    <div class="foods-page-actions">
      <button type="button" class="primary-action" @click="pushPage('customFood')">自定义食材</button>
    </div>
    <FoodPreferences
      :food-preferences="foodPreferences"
      mode="manage"
      :show-close="false"
      @save="handleSave"
    />
  </section>
</template>

<style scoped>
.foods-page-actions {
  margin-bottom: 1rem;
}
</style>
