<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['back'])
</script>

<template>
  <header class="app-top-bar">
    <button type="button" class="top-back-button" aria-label="返回" @click="emit('back')">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
    <h1 class="top-bar-title">{{ title }}</h1>
    <div class="top-bar-spacer" aria-hidden="true"></div>
  </header>
</template>
