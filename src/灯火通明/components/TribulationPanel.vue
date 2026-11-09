<template>
  <div class="tribulation-panel">
    <div class="section-header tribulation-header">
      <i class="fa-solid fa-bolt-lightning"></i>
      <span>渡劫中</span>
    </div>

    <!-- 劫难概览 -->
    <div class="tribulation-overview">
      <div class="tribulation-type-badge" :style="{ backgroundColor: getTribulationTypeColor(tribulationState?.劫种 || '无') }">
        <i class="fa-solid fa-bolt-lightning"></i>
        {{ tribulationState?.劫种 || '无' }}
      </div>
      <div class="tribulation-level" :style="{ color: getTribulationLevelColor(tribulationState?.劫难等级 || '小劫') }">
        {{ tribulationState?.劫难等级 || '小劫' }}
      </div>
    </div>

    <!-- 渡劫进度 -->
    <div class="tribulation-progress-section">
      <div class="section-title">
        <i class="fa-solid fa-stairs"></i> 渡劫进度
      </div>
      <div class="tribulation-stages">
        <span class="stage-current">第 {{ tribulationState?.当前阶段 || 0 }} 波</span>
        <span class="stage-divider">/</span>
        <span class="stage-total">共 {{ tribulationState?.总阶段数 || 3 }} 波</span>
      </div>
      <div class="tribulation-progress-bar">
        <div class="tribulation-progress-fill" :style="{
          width: `${((tribulationState?.当前阶段 || 0) / (tribulationState?.总阶段数 || 3)) * 100}%`,
          backgroundColor: getTribulationTypeColor(tribulationState?.劫种 || '无')
        }"></div>
      </div>
    </div>

    <!-- 劫力承受 -->
    <div class="tribulation-endurance-section">
      <div class="section-title">
        <i class="fa-solid fa-shield-halved"></i> 劫力承受
      </div>
      <div class="endurance-bar-container">
        <div class="endurance-bar">
          <div class="endurance-fill" :style="{
            width: `${tribulationState?.劫力承受 || 100}%`,
            backgroundColor: (tribulationState?.劫力承受 || 100) > 50 ? '#44aa44' : (tribulationState?.劫力承受 || 100) > 20 ? '#ffcc00' : '#ff4444'
          }"></div>
        </div>
        <div class="endurance-value">{{ tribulationState?.劫力承受 || 100 }}%</div>
      </div>
    </div>

    <!-- 已用护道 -->
    <div class="protection-section" v-if="(tribulationState?.已用护道?.length ?? 0) > 0">
      <div class="section-title">
        <i class="fa-solid fa-hand-holding-magic"></i> 已用护道
      </div>
      <div class="protection-list">
        <span v-for="item in tribulationState?.已用护道 ?? []" :key="item" class="protection-tag">
          {{ item }}
        </span>
      </div>
    </div>

    <!-- 劫难描述 -->
    <div class="tribulation-desc-section" v-if="tribulationState?.劫难描述">
      <div class="section-title">
        <i class="fa-solid fa-scroll"></i> 劫难详情
      </div>
      <div class="tribulation-desc">
        {{ tribulationState?.劫难描述 }}
      </div>
    </div>

    <!-- 触发原因 -->
    <div class="tribulation-cause-section" v-if="tribulationState?.触发原因">
      <div class="cause-label">触发原因：</div>
      <div class="cause-text">{{ tribulationState?.触发原因 }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TribulationState } from './combat-utils';
import { getTribulationLevelColor, getTribulationTypeColor } from './combat-utils';

defineProps<{
  tribulationState?: TribulationState;
}>();
</script>

<style lang="scss" scoped>
.section-header.tribulation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 15px;
  font-weight: bold;
  color: #8844ff;

  i {
    color: #8844ff;
    animation: lightning-flash 0.5s ease-in-out infinite;
  }
}

.tribulation-overview {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(136, 68, 255, 0.1) 0%, rgba(255, 68, 170, 0.1) 100%);
  border: 2px solid rgba(136, 68, 255, 0.4);
  border-radius: 12px;
  animation: tribulation-glow 2s ease-in-out infinite;

  .tribulation-type-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 25px;
    color: #fff;
    font-size: 18px;
    font-weight: bold;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    animation: badge-pulse 1.5s ease-in-out infinite;

    i {
      font-size: 20px;
      animation: lightning-flash 0.5s ease-in-out infinite;
    }
  }

  .tribulation-level {
    font-size: 16px;
    font-weight: bold;
    padding: 8px 16px;
    background: var(--button-bg);
    border: 1px solid var(--border-color);
    border-radius: 20px;
  }
}

.tribulation-progress-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;

  .section-title {
    font-size: 13px;
    color: var(--text-accent);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      color: #8844ff;
    }
  }

  .tribulation-stages {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 16px;

    .stage-current {
      color: var(--accent-color);
      font-weight: bold;
    }

    .stage-divider {
      color: var(--text-secondary);
    }

    .stage-total {
      color: var(--text-secondary);
    }
  }

  .tribulation-progress-bar {
    height: 10px;
    background: var(--progress-bg);
    border-radius: 5px;
    overflow: hidden;

    .tribulation-progress-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.5s ease;
      box-shadow: 0 0 15px currentColor;
    }
  }
}

.tribulation-endurance-section {
  margin-bottom: 16px;

  .section-title {
    font-size: 13px;
    color: var(--text-accent);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      color: #44aa44;
    }
  }

  .endurance-bar-container {
    display: flex;
    align-items: center;
    gap: 12px;

    .endurance-bar {
      flex: 1;
      height: 14px;
      background: var(--progress-bg);
      border-radius: 7px;
      overflow: hidden;

      .endurance-fill {
        height: 100%;
        border-radius: 7px;
        transition: width 0.5s ease, background-color 0.3s ease;
        box-shadow: 0 0 10px currentColor;
      }
    }

    .endurance-value {
      font-size: 15px;
      font-weight: bold;
      color: var(--text-primary);
      min-width: 55px;
      text-align: right;
    }
  }
}

.protection-section {
  margin-bottom: 16px;

  .section-title {
    font-size: 13px;
    color: var(--text-accent);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      color: #44aaff;
    }
  }

  .protection-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .protection-tag {
      padding: 5px 14px;
      background: rgba(68, 170, 255, 0.15);
      border: 1px solid rgba(68, 170, 255, 0.4);
      border-radius: 15px;
      font-size: 12px;
      color: #44aaff;
    }
  }
}

.tribulation-desc-section {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;

  .section-title {
    font-size: 13px;
    color: var(--text-accent);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      color: #ffc864;
    }
  }

  .tribulation-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    font-style: italic;
  }
}

.tribulation-cause-section {
  padding: 12px 14px;
  background: rgba(136, 68, 255, 0.1);
  border: 1px dashed rgba(136, 68, 255, 0.4);
  border-radius: 8px;
  display: flex;
  gap: 8px;
  align-items: flex-start;

  .cause-label {
    font-size: 12px;
    color: #8844ff;
    font-weight: 500;
    white-space: nowrap;
  }

  .cause-text {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
}

// 动画
@keyframes tribulation-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(136, 68, 255, 0.3); }
  50% { box-shadow: 0 0 40px rgba(136, 68, 255, 0.6); }
}

@keyframes badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes lightning-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .section-header.tribulation-header {
    font-size: 14px;
    margin-bottom: 12px;
    padding-bottom: 10px;
  }

  .tribulation-overview {
    padding: 16px;
    gap: 12px;

    .tribulation-type-badge {
      padding: 8px 14px;
      font-size: 15px;
      i { font-size: 16px; }
    }

    .tribulation-level {
      font-size: 14px;
      padding: 6px 12px;
    }
  }

  .tribulation-progress-section {
    padding: 12px;
    .section-title { font-size: 12px; }
    .tribulation-stages { font-size: 14px; }
    .tribulation-progress-bar { height: 8px; }
  }

  .tribulation-endurance-section {
    .section-title { font-size: 12px; }
    .endurance-bar-container {
      .endurance-bar { height: 12px; }
      .endurance-value { font-size: 13px; min-width: 50px; }
    }
  }

  .protection-section {
    .section-title { font-size: 12px; }
    .protection-list {
      .protection-tag { padding: 4px 10px; font-size: 11px; }
    }
  }

  .tribulation-desc-section {
    padding: 12px;
    .section-title { font-size: 12px; }
    .tribulation-desc { font-size: 12px; }
  }

  .tribulation-cause-section {
    padding: 10px 12px;
    .cause-label { font-size: 11px; }
    .cause-text { font-size: 11px; }
  }
}
</style>