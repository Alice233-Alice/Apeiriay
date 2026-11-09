<template>
  <div class="header">
    <div class="header-left">
      <button class="collapse-btn" @click="$emit('toggle-collapse')" :title="isCollapsed ? '展开状态栏' : '收起状态栏'">
        <i :class="isCollapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'"></i>
      </button>
      <button class="theme-btn" @click="$emit('toggle-theme-selector')" title="切换主题">
        <i class="fa-solid fa-palette"></i>
      </button>
      <button class="preset-btn" @click="$emit('toggle-preset-editor')" title="开局预设">
        <i class="fa-solid fa-sliders"></i>
      </button>
    </div>
    <button class="location-info map-entry" type="button" title="打开行踪地图" @click="$emit('open-map')">
      <div class="danger-badge" :style="{ backgroundColor: dangerColor }">
        危险度 {{ store.本尊.行踪.危险度 ?? 10 }}
      </div>
      <div class="location" :style="{ color: locationColor }">
        <i class="fa-solid fa-location-dot"></i>
        <span class="location-hierarchy">
          <!-- 只在上级地域存在且与当前区域不同时才显示上级 -->
          <template v-if="showParentRegion">
            <span class="location-parent">{{ parentRegion }}</span>
            <span class="location-separator">·</span>
          </template>
          <span class="location-current">{{ store.本尊.行踪.当前区域 }}</span>
        </span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDataStore } from '../store';

const store = useDataStore();

interface Props {
  isCollapsed: boolean;
  parentRegion: string;
  dangerColor: string;
  locationColor: string;
}

const props = defineProps<Props>();

const showParentRegion = computed(() => {
  const parent = String(props.parentRegion || '').trim();
  const current = String(store.本尊.行踪.当前区域 || '').trim();

  if (!parent || !current || parent === current) {
    return false;
  }

  return !current.startsWith(`${parent}·`) && !current.startsWith(`${parent}.`);
});

defineEmits<{
  (e: 'toggle-collapse'): void;
  (e: 'toggle-theme-selector'): void;
  (e: 'toggle-preset-editor'): void;
  (e: 'open-map'): void;
}>();
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 16px 12px 16px;
  min-height: 80px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border-color);

  .header-left {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .collapse-btn,
  .theme-btn,
  .preset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--button-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-accent);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--button-hover);
      color: var(--text-primary);
      border-color: var(--border-active);
    }

    i {
      font-size: 12px;
    }
  }

  .location-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    margin-left: auto;
    padding: 5px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition:
      background 0.2s,
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.2s;

    &:hover {
      background: var(--button-bg);
      border-color: var(--border-color);
      box-shadow: 0 0 16px rgba(255, 255, 255, 0.04);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }

    .danger-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      color: #fff;
    }

    .location {
      display: flex;
      align-items: center;
      gap: 8px;
      text-align: right;

      .location-hierarchy {
        display: flex;
        align-items: center;
        gap: 4px;

        .location-parent {
          font-size: 11px;
          opacity: 0.7;
        }

        .location-separator {
          font-size: 11px;
          opacity: 0.5;
        }

        .location-current {
          font-size: 13px;
          font-weight: 500;
        }
      }
    }
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .header {
    padding: 16px 12px 10px 12px;
    min-height: 65px;

    .header-left {
      gap: 6px;
    }

    .collapse-btn,
    .theme-btn,
    .preset-btn {
      width: 26px;
      height: 26px;

      i {
        font-size: 11px;
      }
    }

    .location-info {
      padding: 4px 6px;

      .danger-badge {
        font-size: 9px;
        padding: 2px 5px;
      }

      .location {
        gap: 6px;

        .location-hierarchy {
          .location-parent {
            font-size: 10px;
          }

          .location-current {
            font-size: 12px;
          }
        }
      }
    }
  }
}
</style>
