<template>
  <div class="panel cultivation-panel">
    <div class="identity-section">
      <div class="identity-name">{{ store.本尊.身份.姓名 }}</div>
      <div class="identity-info">
        <span>{{ store.本尊.身份.宗门 }}</span>
        <span class="divider">·</span>
        <span>{{ store.本尊.身份.出身 }}</span>
      </div>
    </div>

    <div class="realm-section">
      <div class="realm-title" :style="{ color: realmColor }">
        <i class="fa-solid fa-yin-yang"></i>
        {{ store.本尊.境界描述 }}
      </div>
      <div class="realm-status">{{ store.本尊.状态 }}</div>
    </div>

    <div class="progress-section">
      <div class="progress-label">
        <span>修为进度</span>
        <span>{{ store.本尊.修为 }} / {{ store.本尊.突破阈值 }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: store.本尊.进度, backgroundColor: realmColor }"></div>
      </div>
      <div class="progress-percent">{{ store.本尊.进度 }}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-label">灵根</div>
        <div class="stat-value" :style="{ color: rootColor }">{{ store.本尊.灵根 }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">体质</div>
        <div class="stat-value">{{ store.本尊.体质 }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">功法</div>
        <div class="stat-value">{{ store.本尊.功法 }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">本命兵器</div>
        <div class="stat-value">{{ store.本尊.本命兵器 }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">灵石</div>
        <div class="stat-value gold">{{ store.本尊.灵石 }}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">寿元</div>
        <div class="stat-value">{{ store.本尊.寿元状态 }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getRealmColor, getRootColor } from '../schema';
import { useDataStore } from '../store';

const store = useDataStore();

const realmColor = computed(() => getRealmColor(store.本尊.等级));
const rootColor = computed(() => getRootColor(store.本尊.灵根));
</script>

<style lang="scss" scoped>
.cultivation-panel {
  padding: 16px;

  .identity-section {
    text-align: center;
    margin-bottom: 16px;

    .identity-name {
      font-size: 20px;
      font-weight: bold;
      color: var(--text-primary);
      text-shadow: 0 0 10px var(--accent-glow);
    }

    .identity-info {
      color: var(--text-secondary);
      font-size: 12px;
      margin-top: 4px;

      .divider {
        margin: 0 6px;
        opacity: 0.5;
      }
    }
  }

  .realm-section {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .realm-title {
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;

      i {
        animation: spin 10s linear infinite;
      }
    }

    .realm-status {
      font-size: 12px;
      padding: 3px 8px;
      background: var(--button-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--accent-color);
    }
  }

  .progress-section {
    margin-bottom: 20px;

    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .progress-bar {
      height: 8px;
      background: var(--progress-bg);
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.5s ease;
        box-shadow: 0 0 10px currentColor;
      }
    }

    .progress-percent {
      text-align: right;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;

    .stat-item {
      text-align: center;
      padding: 10px 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;

      .stat-label {
        font-size: 11px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);

        &.gold {
          color: #ffd700;
        }
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .cultivation-panel {
    padding: 12px;

    .identity-section {
      margin-bottom: 12px;

      .identity-name {
        font-size: 18px;
      }

      .identity-info {
        font-size: 11px;
      }
    }

    .realm-section {
      gap: 10px;
      margin-bottom: 12px;

      .realm-title {
        font-size: 16px;
      }

      .realm-status {
        font-size: 11px;
        padding: 2px 6px;
      }
    }

    .progress-section {
      margin-bottom: 16px;

      .progress-label {
        font-size: 11px;
      }

      .progress-bar {
        height: 6px;
      }

      .progress-percent {
        font-size: 10px;
      }
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;

      .stat-item {
        padding: 8px 6px;

        .stat-label {
          font-size: 10px;
        }

        .stat-value {
          font-size: 12px;
        }
      }
    }
  }
}
</style>
