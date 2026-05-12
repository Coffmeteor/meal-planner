<script setup>
import FoodPreferences from './FoodPreferences.vue'

defineProps({
  foodPreferences: {
    type: Object,
    required: true,
  },
})

defineEmits(['save'])
</script>

<template>
  <section class="tab-page">
    <FoodPreferences
      :food-preferences="foodPreferences"
      mode="manage"
      :show-close="false"
      @save="$emit('save', $event)"
    />
  </section>
</template>
