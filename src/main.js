import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { navigationStore } from './stores/navigationStore.js'
import { loadFoods } from './stores/foodStore.js'
import { loadPlan } from './stores/planStore.js'
import { loadProgress } from './stores/progressStore.js'

void navigationStore
void Promise.all([loadFoods(), loadPlan(), loadProgress()]).catch((error) => {
  console.warn('Store initialization failed', error)
})

createApp(App).mount('#app')
