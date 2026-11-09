<template>
  <transition name="theme-selector-fade">
    <div v-if="visible" class="theme-selector-overlay" @click="$emit('close')">
      <div class="theme-selector" @click.stop>
        <div class="theme-selector-header">
          <h3><i class="fa-solid fa-palette"></i> 选择主题</h3>
          <button class="close-btn" @click="$emit('close')">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        <div class="theme-list">
          <div
            v-for="theme in themeStore.availableThemes"
            :key="theme.id"
            class="theme-item"
            :class="{ active: theme.id === themeStore.currentThemeId }"
            @click="selectTheme(theme.id)"
          >
            <div class="theme-preview" :style="{ background: theme.colors.bgPrimary }">
              <div class="theme-preview-border" :style="{ borderColor: theme.colors.border }"></div>
            </div>
            <div class="theme-info">
              <div class="theme-name">{{ theme.name }}</div>
              <div class="theme-desc">{{ theme.description }}</div>
            </div>
            <i v-if="theme.id === themeStore.currentThemeId" class="fa-solid fa-check theme-check"></i>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useThemeStore } from '../store';

const themeStore = useThemeStore();

interface Props {
  visible: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', themeId: string): void;
}>();

const selectTheme = (themeId: string) => {
  emit('select', themeId);
};
</script>

<style lang="scss" scoped>
.theme-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.theme-selector {
  background: var(--bg-primary);
  border: 2px solid var(--border-active);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

  .theme-selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--header-bg);
    border-bottom: 1px solid var(--border-color);

    h3 {
      margin: 0;
      font-size: 16px;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: var(--accent-color);
      }
    }

    .close-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--button-hover);
        color: var(--text-primary);
        border-color: var(--border-active);
      }
    }
  }

  .theme-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--button-bg);
      border-radius: 3px;

      &:hover {
        background: var(--button-hover);
      }
    }
  }

  .theme-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--bg-secondary);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;

    &:hover {
      background: var(--button-bg);
      border-color: var(--border-color);
    }

    &.active {
      border-color: var(--border-active);
      background: var(--button-active);
    }

    .theme-preview {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .theme-preview-border {
        width: 40px;
        height: 40px;
        border: 2px solid;
        border-radius: 6px;
      }
    }

    .theme-info {
      flex: 1;

      .theme-name {
        font-size: 14px;
        font-weight: bold;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .theme-desc {
        font-size: 12px;
        color: var(--text-secondary);
      }
    }

    .theme-check {
      color: var(--accent-color);
      font-size: 18px;
    }
  }
}

.theme-selector-fade-enter-active,
.theme-selector-fade-leave-active {
  transition: opacity 0.3s;
}

.theme-selector-fade-enter-from,
.theme-selector-fade-leave-to {
  opacity: 0;
}
</style>