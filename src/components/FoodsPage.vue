<script setup>
import FoodPreferences from './FoodPreferences.vue'

defineProps({
  foodPreferences: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['save', 'customFood'])

function handleSave(payload, options) {
  emit('save', payload, options)
}
</script>

<template>
  <section class="tab-page-shell foods-page">
    <div class="tab-page-heading">
      <div>
        <p>食材管理</p>
        <h1>食材</h1>
      </div>
      <button type="button" class="ghost-action compact-action" @click="emit('customFood')">
        自定义食材
      </button>
    </div>
    <FoodPreferences
      :food-preferences="foodPreferences"
      mode="manage"
      :show-close="false"
      @save="handleSave"
    />
  </section>
</template>
