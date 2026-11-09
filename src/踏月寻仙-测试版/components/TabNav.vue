<template>
  <div class="tab-nav">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="['tab-btn', { active: activeTab === tab.id }]"
      @click="$emit('update:activeTab', tab.id)"
    >
      <i :class="tab.icon"></i>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
}

defineProps<Props>();

defineEmits<{
  (e: 'update:activeTab', value: string): void;
}>();
</script>

<style lang="scss" scoped>
.tab-nav {
  display: flex;
  padding: 8px 12px;
  gap: 4px;
  background: var(--tab-bg);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex: 1;
    min-width: 60px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: nowrap;

    &:hover {
      background: var(--button-bg);
      color: var(--text-accent);
    }

    &.active {
      background: var(--tab-active);
      border-color: var(--border-active);
      color: var(--text-primary);
    }
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .tab-nav {
    padding: 6px 8px;
    gap: 2px;
    justify-content: center;

    .tab-btn {
      flex: 0 0 auto;
      min-width: auto;
      padding: 6px 10px;
      font-size: 11px;
      gap: 3px;

      i {
        font-size: 12px;
      }
    }
  }
}

// 超小屏幕适配
@media screen and (max-width: 360px) {
  .tab-nav {
    padding: 5px 6px;
    gap: 1px;

    .tab-btn {
      padding: 5px 8px;
      font-size: 10px;

      .tab-label {
        display: none;
      }

      i {
        font-size: 14px;
      }
    }
  }
}
</style>