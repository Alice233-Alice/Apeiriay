<template>
  <div class="footer">
    <!-- 左侧：行动提示按钮（原灵石/选项位置） -->
    <div class="footer-left">
      <button class="footer-item action-btn" @click="$emit('open-actions')" title="查看可选行动">
        <i class="fa-solid fa-compass"></i>
        <span>行动</span>
        <span v-if="store.可选行动数 > 0" class="action-badge">{{ store.可选行动数 }}</span>
      </button>
    </div>

    <!-- 中间：世界时钟 -->
    <div class="footer-center world-time">
      <i :class="timeIconClass"></i>
      <span>{{ store.世界时钟.纪元 }} · 第{{ store.世界时钟.年份 }}年 · {{ dayNightLabel }}</span>
    </div>

    <!-- 右侧：难度模块 -->
    <div class="footer-right difficulty-widget">
      <div class="difficulty-row-1">
        <span class="difficulty-badge" :class="store.难度感应">{{ store.难度感应 }}</span>
        <span class="difficulty-level" :class="store.难度档位">{{ store.难度档位 }}</span>
        <span class="difficulty-trend" :class="store.难度趋势">
          <i v-if="store.难度趋势 === 'up'" class="fa-solid fa-arrow-up"></i>
          <i v-else-if="store.难度趋势 === 'down'" class="fa-solid fa-arrow-down"></i>
          <i v-else class="fa-solid fa-minus"></i>
        </span>
      </div>
      <div class="difficulty-row-2 difficulty-warning" :title="store.难度警告">
        {{ store.难度警告 }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';

const store = useDataStore();

const dayNightLabel = computed(() => {
  const shichen = String(store.世界时钟.时辰 || '');
  if (!shichen) return '未知时段';

  if (shichen.includes('夜') || shichen.includes('晚')) return '夜';
  if (shichen.includes('日') || shichen.includes('昼')) return '昼';

  const nightShichen = ['子', '丑', '寅', '卯', '酉', '戌', '亥'];
  if (nightShichen.some(token => shichen.includes(token))) return '夜';

  const dayShichen = ['辰', '巳', '午', '未', '申'];
  if (dayShichen.some(token => shichen.includes(token))) return '昼';

  return '未知时段';
});

const timeIconClass = computed(() => {
  const baseClass = 'time-icon';
  if (dayNightLabel.value === '昼') return `${baseClass} fa-solid fa-sun`;
  return `${baseClass} fa-solid fa-moon`;
});

defineEmits<{
  (e: 'open-actions'): void;
}>();
</script>

<style lang="scss" scoped>
.footer {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--footer-bg);
  border-top: 1px solid var(--border-color);

  .footer-left {
    display: flex;
    justify-content: flex-start;
    z-index: 1;
  }

  .footer-right {
    display: flex;
    justify-content: flex-end;
    z-index: 1;
  }

  .footer-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    transition: all 0.2s;

    i {
      color: var(--accent-color);
      transition: transform 0.3s;
    }

    &:hover {
      background: var(--button-bg);
      color: var(--text-primary);

      i {
        transform: rotate(90deg);
      }
    }

    &:active {
      background: var(--button-active);
    }
  }

  .action-btn {
    font-weight: 500;
    position: relative;

    .action-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: var(--accent-color);
      color: #fff;
      font-size: 10px;
      font-weight: bold;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: badge-pulse 2s infinite;
    }
  }

  @keyframes badge-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .footer-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--text-accent);
    white-space: nowrap;
    z-index: 0;

    .time-icon {
      animation: moon-twinkle 3s ease-in-out infinite;
    }
  }

  .difficulty-widget {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    max-width: 150px;

    .difficulty-row-1 {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: bold;
    }

    .difficulty-badge {
      padding: 2px 6px;
      border-radius: 10px;
      color: #fff;
      
      &.顺遂 { background-color: #4caf50; }
      &.平稳 { background-color: #607d8b; }
      &.受挫 { background-color: #ff9800; }
    }

    .difficulty-level {
      padding: 2px 6px;
      border-radius: 4px;
      background-color: rgba(255, 255, 255, 0.1);
      
      &.低压 { color: #81c784; }
      &.常态 { color: #e0e0e0; }
      &.高压 { color: #ffb74d; }
      &.极压 { color: #e57373; }
    }

    .difficulty-trend {
      &.up { color: #e57373; }
      &.flat { color: #9e9e9e; }
      &.down { color: #81c784; }
    }

    .difficulty-warning {
      font-size: 10px;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
  }
}

@keyframes moon-twinkle {
  0%,
  100% {
    opacity: 1;
    filter: drop-shadow(0 0 2px var(--accent-color));
  }

  50% {
    opacity: 0.4;
    filter: drop-shadow(0 0 8px var(--accent-color));
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .footer {
    padding: 8px 12px;

    .footer-item {
      font-size: 11px;
      gap: 4px;
      padding: 5px 8px;
    }

    .footer-center {
      font-size: 11px;
      gap: 4px;
    }

    .difficulty-widget {
      max-width: 100px;
      
      .difficulty-row-1 {
        font-size: 10px;
        gap: 4px;
      }
      
      .difficulty-badge, .difficulty-level {
        padding: 1px 4px;
      }
    }
  }
}
</style>
