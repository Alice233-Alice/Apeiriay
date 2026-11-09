<template>
  <div
    class="tab-nav"
    :class="{ 'compact-layout': compactLayout, 'ultra-compact-layout': ultraCompactLayout }"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      :class="['tab-btn', { active: activeTab === tab.id }]"
      :title="tab.label"
      :aria-label="tab.label"
      :aria-pressed="activeTab === tab.id"
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
  compactLayout?: boolean;
  ultraCompactLayout?: boolean;
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

// 窄屏状态栏：保持单行横滑，但必须从左侧起排，避免首项落到负坐标而无法触达
@media screen and (max-width: 520px) {
  .tab-nav {
    padding: 6px 8px;
    gap: 2px;
    justify-content: flex-start;
    overflow-x: auto;
    scroll-padding-inline: 8px;
    scroll-snap-type: x proximity;
    touch-action: pan-x;

    .tab-btn {
      flex: 0 0 auto;
      min-width: 52px;
      padding: 6px 8px;
      font-size: 11px;
      gap: 3px;
      scroll-snap-align: nearest;

      i {
        font-size: 12px;
      }
    }
  }
}

.tab-nav.compact-layout {
  padding: 6px 8px;
  gap: 2px;
  justify-content: flex-start;
  overflow-x: auto;
  scroll-padding-inline: 8px;
  scroll-snap-type: x proximity;
  touch-action: pan-x;

  .tab-btn {
    flex: 0 0 auto;
    min-width: 52px;
    padding: 6px 8px;
    font-size: 11px;
    gap: 3px;
    scroll-snap-align: nearest;

    i {
      font-size: 12px;
    }
  }
}

// 超小屏幕适配
@media screen and (max-width: 360px) {
  .tab-nav {
    padding: 5px 6px 6px;
    gap: 1px;

    .tab-btn {
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      padding: 5px 3px;
      flex-direction: row;
      gap: 0;

      .tab-label {
        display: none;
      }

      i {
        font-size: 14px;
      }
    }
  }
}

.tab-nav.ultra-compact-layout {
  padding: 5px 6px 6px;
  gap: 1px;

  .tab-btn {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    padding: 5px 3px;
    flex-direction: row;
    gap: 0;

    .tab-label {
      display: none;
    }

    i {
      font-size: 14px;
    }
  }
}
</style>
