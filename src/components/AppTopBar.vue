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
      ‹
    </button>
    <h1>{{ title }}</h1>
    <div class="top-bar-spacer" aria-hidden="true"></div>
  </header>
</template>
