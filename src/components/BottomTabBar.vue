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

const iconPaths = {
  foods: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v4M10 1v4M14 1v4',
  plan: 'M3 4h18v16H3zM16 2v4M8 2v4M3 10h18',
  today: 'M12 8v4l3 3M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2',
  progress: 'M12 20V10M18 20V4M6 20v-4',
  profile:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM4 20c0-4.42 3.58-8 8-8s8 3.58 8 8',
}
</script>

<template>
  <nav class="bottom-tab-bar" aria-label="主导航">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="tab-button"
      :class="{ active: activeTab === tab.value }"
      :aria-current="activeTab === tab.value ? 'page' : undefined"
      @click="emit('change', tab.value)"
    >
      <svg
        class="tab-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path :d="iconPaths[tab.value]" />
      </svg>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-height: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom));
  padding: 0 max(0.25rem, env(safe-area-inset-left)) env(safe-area-inset-bottom)
    max(0.25rem, env(safe-area-inset-right));
  border-top: 0.5px solid rgba(60, 60, 67, 0.29);
  background: rgba(249, 249, 249, 0.96);
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  min-height: var(--bottom-nav-h);
  padding: 0.25rem 0.15rem;
  border-radius: 0;
  color: #8e8e93;
  background: transparent;
  transition: color 0.1s ease;
}

.tab-button:active {
  opacity: 0.7;
}

.tab-icon {
  display: block;
  width: 24px;
  height: 24px;
}

.tab-label {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(0.58rem, 2.4vw, 0.68rem);
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-button.active {
  color: #34c759;
}
</style>
