<script setup>
defineProps({
  tabs: {
    type: Array,
    required: true,
  },
  activeTab: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['change'])
</script>

<template>
  <nav class="bottom-tab-bar" aria-label="主导航">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="tab-button"
      :class="{ active: activeTab === tab.value, center: tab.value === 'today' }"
      @click="emit('change', tab.value)"
    >
      <strong>{{ tab.label }}</strong>
    </button>
  </nav>
</template>
