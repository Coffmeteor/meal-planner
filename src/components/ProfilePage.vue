<script setup>
import { APP_VERSION } from '../utils/appVersion.js'

defineProps({
  profile: {
    type: Object,
    default: null,
  },
  planMeta: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'profileEdit',
  'lifestyleEdit',
  'planSettings',
  'customFood',
  'dataBackup',
  'clearData',
  'importData',
  'importDataPrompt',
  'recordWeight',
  'viewPlan',
])
</script>

<template>
  <section class="tab-page-shell settings-page">
    <div class="tab-page-heading">
      <div>
        <p>设置</p>
        <h1>我的</h1>
      </div>
    </div>

    <section class="settings-group">
      <div
        class="settings-item"
        role="button"
        tabindex="0"
        @click="emit('profileEdit')"
        @keydown.enter="emit('profileEdit')"
      >
        <div class="settings-item-icon" style="background: #007aff">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>个人资料</strong>
          <span>性别、年龄、身高、体重、活动量</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">生活习惯</div>
      <div
        class="settings-item"
        role="button"
        tabindex="0"
        @click="emit('lifestyleEdit')"
        @keydown.enter="emit('lifestyleEdit')"
      >
        <div class="settings-item-icon" style="background: #5856d6">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>生活习惯</strong>
          <span>作息、早餐习惯、运动频率</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">饮食计划</div>
      <div
        class="settings-item"
        role="button"
        tabindex="0"
        @click="emit('planSettings')"
        @keydown.enter="emit('planSettings')"
      >
        <div class="settings-item-icon" style="background: #ff9500">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>饮食计划</strong>
          <span>查看当前计划和热量目标</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
      <div
        class="settings-item settings-item-border"
        role="button"
        tabindex="0"
        @click="emit('customFood')"
        @keydown.enter="emit('customFood')"
      >
        <div class="settings-item-icon" style="background: #34c759">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>食材偏好</strong>
          <span>常用食材、偏好等级</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">记录</div>
      <div
        class="settings-item"
        role="button"
        tabindex="0"
        @click="emit('recordWeight')"
        @keydown.enter="emit('recordWeight')"
      >
        <div class="settings-item-icon" style="background: #5856d6">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 20V10" />
            <path d="M18 20V4" />
            <path d="M6 20v-4" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>身体记录</strong>
          <span>体重、围度、体脂率</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-label">数据</div>
      <div
        class="settings-item"
        role="button"
        tabindex="0"
        @click="emit('dataBackup')"
        @keydown.enter="emit('dataBackup')"
      >
        <div class="settings-item-icon" style="background: #5ac8fa">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>数据备份</strong>
          <span>导出/导入 JSON 备份</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
      <div
        class="settings-item settings-item-border"
        role="button"
        tabindex="0"
        @click="emit('importDataPrompt')"
        @keydown.enter="emit('importDataPrompt')"
      >
        <div class="settings-item-icon" style="background: #34aadc">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div class="settings-item-content">
          <strong>导入数据</strong>
          <span>从备份文件恢复</span>
        </div>
        <div class="settings-item-arrow" aria-hidden="true">›</div>
      </div>
    </section>

    <section class="settings-group">
      <div
        class="settings-item danger-item"
        role="button"
        tabindex="0"
        @click="emit('clearData')"
        @keydown.enter="emit('clearData')"
      >
        <div class="settings-item-content">
          <strong>清空全部数据</strong>
        </div>
      </div>
    </section>

    <p class="settings-footer">{{ APP_VERSION }}</p>
  </section>
</template>

<style scoped>
.settings-page {
  padding-bottom: 0.5rem;
}

.settings-group {
  background: var(--color-card);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.settings-group-label {
  padding: 0.5rem 1rem 0.35rem;
  color: var(--color-muted);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.settings-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.85rem;
  padding: 0.65rem 1rem;
  background: var(--color-card);
  cursor: pointer;
  transition: background 0.12s ease;
}

.settings-item:active {
  background: rgba(60, 60, 67, 0.06);
}

.settings-item-border {
  border-top: 0.5px solid var(--color-separator);
}

.settings-item-icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.45rem;
  color: #fff;
}

.settings-item-content {
  flex: 1 1 auto;
  min-width: 0;
}

.settings-item-content strong {
  display: block;
  color: var(--color-text);
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.3;
}

.settings-item-content span {
  display: block;
  color: var(--color-muted);
  font-size: 0.76rem;
  line-height: 1.3;
}

.settings-item-arrow {
  flex: 0 0 auto;
  color: #c7c7cc;
  font-size: 1.3rem;
  font-weight: 300;
  line-height: 1;
}

.danger-item {
  justify-content: center;
  padding: 0.85rem 1rem;
}

.danger-item .settings-item-content strong {
  color: var(--color-danger);
  text-align: center;
  font-size: 0.92rem;
}

.settings-footer {
  margin: 1rem 0 0;
  color: var(--color-muted);
  font-size: 0.72rem;
  text-align: center;
}
</style>
