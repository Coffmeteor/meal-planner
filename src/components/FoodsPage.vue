<script setup>
import { computed, ref } from 'vue'
import FoodPreferences from './FoodPreferences.vue'

const props = defineProps({
  foodPreferences: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['save', 'customFood'])
const preferencesRef = ref(null)
const selectedCount = computed(() => {
  const exposedCount = exposedValue(preferencesRef.value?.selectedCount)
  if (typeof exposedCount === 'number') return exposedCount

  const selectedFoodIds = Array.isArray(props.foodPreferences.selectedFoodIds)
    ? props.foodPreferences.selectedFoodIds
    : []
  const customFoods = Array.isArray(props.foodPreferences.customFoods)
    ? props.foodPreferences.customFoods
    : []
  return selectedFoodIds.length + customFoods.length
})
const hasUnsavedChanges = computed(() => Boolean(exposedValue(preferencesRef.value?.isDirty)))

function handleSave(payload, options) {
  emit('save', payload, options)
}

function saveFromHeader() {
  preferencesRef.value?.savePreferences()
}

function exposedValue(value) {
  return value && typeof value === 'object' && 'value' in value ? value.value : value
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
    <div class="food-save-bar">
      <span>
        已选 {{ selectedCount }} 项
        <em v-if="hasUnsavedChanges">未保存更改</em>
      </span>
      <button type="button" class="primary-action" @click="saveFromHeader">保存</button>
    </div>
    <FoodPreferences
      ref="preferencesRef"
      :food-preferences="foodPreferences"
      mode="manage"
      :show-close="false"
      @save="handleSave"
    />
  </section>
</template>
