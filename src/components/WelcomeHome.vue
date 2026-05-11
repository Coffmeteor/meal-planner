<script setup>
const emit = defineEmits(['continue', 'modify', 'regenerate', 'clear'])
</script>

<template>
  <section class="panel form-stack">
    <div class="section-title">
      <p>欢迎回来</p>
      <h2>继续你的减脂餐计划</h2>
    </div>

    <button type="button" class="primary-action" @click="emit('continue')">继续查看计划</button>
    <button type="button" class="ghost-action" @click="emit('modify')">修改资料</button>
    <button type="button" class="ghost-action" @click="emit('regenerate')">重新生成</button>
    <button type="button" class="ghost-action" @click="emit('clear')">清空数据</button>
  </section>
</template>
