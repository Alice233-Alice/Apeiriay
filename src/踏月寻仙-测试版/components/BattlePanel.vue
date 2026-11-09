<template>
  <div class="battle-panel">
    <!-- 战斗状态头部 -->
    <div class="combat-header">
      <div class="combat-status-left">
        <div class="combat-status-indicator" :class="`status-${displayStatus}`">
          <span class="crossed-swords-icon">⚔</span>
        </div>
        <div class="combat-status-text">
          <span class="combat-status-label" :class="`status-${displayStatus}`">
            {{ displayStatus }}
          </span>
          <span class="combat-status-desc">{{ subtitle }}</span>
        </div>
      </div>
      <div class="combat-round-info" v-if="combatState?.战斗回合">
        <span class="round-label">回合</span>
        <span class="round-number">{{ combatState.战斗回合 }}</span>
      </div>
    </div>

    <!-- 状态一览 -->
    <div class="combat-stats">
      <div class="combat-stat-item">
        <div class="combat-stat-icon spirit">
          <i class="fa-solid fa-fire-flame-curved"></i>
        </div>
        <div class="combat-stat-content">
          <div class="combat-stat-label">灵力值</div>
          <div class="combat-stat-bar">
            <div class="combat-stat-fill spirit" :style="{
              width: `${combatState?.灵力值 ?? 100}%`,
              background: getSpiritGradient(combatState?.灵力值 ?? 100)
            }"></div>
          </div>
          <div class="combat-stat-value">{{ combatState?.灵力值 ?? 100 }}%</div>
        </div>
      </div>

      <div class="combat-stat-item">
        <div class="combat-stat-icon" :class="`injury-icon-${combatState?.伤势等级 ?? '无伤'}`">
          <i :class="getInjuryIcon(combatState?.伤势等级 ?? '无伤')"></i>
        </div>
        <div class="combat-stat-content">
          <div class="combat-stat-label">身体状况</div>
          <div class="combat-stat-status" :class="`status-${combatState?.伤势等级 ?? '无伤'}`">
            <i :class="getInjuryIcon(combatState?.伤势等级 ?? '无伤')"></i>
            {{ combatState?.伤势等级 ?? '无伤' }}
          </div>
        </div>
      </div>

      <!-- 战力值 -->
      <div class="combat-stat-item" v-if="playerCombatPower">
        <div class="combat-stat-icon power">
          <i class="fa-solid fa-fist-raised"></i>
        </div>
        <div class="combat-stat-content">
          <div class="combat-stat-label">综合战力</div>
          <div class="combat-power-value">
            <span class="power-number">{{ playerCombatPower }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 已用底牌 -->
    <div class="trump-cards-section" v-if="(combatState?.已用底牌?.length ?? 0) > 0">
      <div class="trump-header">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>已动用底牌</span>
      </div>
      <div class="trump-cards-list">
        <span v-for="card in combatState?.已用底牌 ?? []" :key="card" class="trump-card-tag">
          {{ card }}
        </span>
      </div>
    </div>

    <!-- 当前敌人 -->
    <div class="enemies-section">
      <div class="enemies-header">
        <i class="fa-solid fa-skull"></i>
        <span>当前敌人</span>
        <span class="enemy-count" v-if="(currentEnemies?.length ?? 0) > 0">
          {{ currentEnemies?.filter(e => e.状态 !== '已死').length ?? 0 }}
        </span>
      </div>
      <div class="enemies-list">
        <template v-if="(currentEnemies?.length ?? 0) > 0">
          <div
            v-for="(enemy, index) in currentEnemies ?? []"
            :key="index"
            class="enemy-card"
            :class="{ 'enemy-dead': enemy.状态 === '已死' }"
          >
            <div class="enemy-avatar" :class="`threat-${getThreatLevel(getCalculatedPowerEval(enemy, playerCombatPower))}`">
              <i class="fa-solid fa-ghost"></i>
            </div>
            <div class="enemy-info">
              <div class="enemy-header-row">
                <span class="enemy-name">{{ enemy.名称 }}</span>
                <span class="enemy-realm">{{ enemy.境界 }}</span>
              </div>
              <div class="enemy-status-row">
                <span class="enemy-power" :class="`power-${getThreatLevel(getCalculatedPowerEval(enemy, playerCombatPower))}`">
                  <i class="fa-solid fa-scale-balanced"></i>
                  {{ getCalculatedPowerEval(enemy, playerCombatPower) }}
                  <span class="enemy-power-value" v-if="getEnemyPowerValue(enemy) > 0">
                    ({{ getEnemyPowerValue(enemy) }})
                  </span>
                </span>
                <span class="enemy-health" :class="`health-${enemy.状态}`">
                  <i :class="getEnemyHealthIcon(enemy.状态)"></i>
                  {{ enemy.状态 }}
                </span>
              </div>
              <div class="enemy-trait" v-if="enemy.特点">
                <i class="fa-solid fa-star"></i>
                {{ enemy.特点 }}
              </div>
            </div>
          </div>
        </template>
        <div v-else class="empty-hint">
          <i class="fa-solid fa-peace"></i>
          <span>四周暂无敌意</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CombatState, EnemyInfo } from './combat-utils';
import {
    getCalculatedPowerEval,
    getEnemyHealthIcon,
    getEnemyPowerValue,
    getInjuryIcon, getSpiritGradient, getThreatLevel,
} from './combat-utils';

const props = defineProps<{
  combatState?: CombatState;
  currentEnemies?: EnemyInfo[];
  playerCombatPower?: number;
}>();

// 战斗状态显示文字
const displayStatus = computed(() => {
  const cs = props.combatState;
  if (cs?.正在战斗 && cs?.当前状态 === '非战斗') return '战斗中';
  return cs?.当前状态 || '非战斗';
});

// 战斗副标题
const subtitle = computed(() => {
  const status = displayStatus.value;
  const round = props.combatState?.战斗回合 ?? 0;
  const enemyCount = props.currentEnemies?.filter(e => e.状态 !== '已死').length ?? 0;

  if (round > 0) {
    return `第 ${round} 回合 · ${enemyCount > 1 ? `${enemyCount}敌环伺` : '一对一决斗'}`;
  }

  const subtitles: Record<string, string[]> = {
    '激战': ['剑光交错，杀机四伏', '生死一线，全力以赴', '刀光剑影，血战正酣'],
    '对峙': ['山雨欲来，剑拔弩张', '暗流涌动，一触即发', '杀意凛然，蓄势待发'],
    '战斗中': ['战鼓雷鸣，硝烟弥漫', '兵刃相接，胜负未分', '风起云涌，战意昂扬'],
    '重伤': ['身负重创，殊死一搏', '血染战袍，绝境求生', '伤痕累累，死战不退'],
    '濒死': ['命悬一线，背水一战', '生死关头，孤注一掷', '大限将至，拼死一击'],
  };

  const options = subtitles[status] || subtitles['战斗中'];
  return options[Math.floor(Date.now() / 60000) % options.length];
});
</script>

<style lang="scss" scoped>
// 战斗状态头部
.combat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, rgba(255, 100, 100, 0.12) 0%, rgba(200, 80, 80, 0.08) 100%);
  border: 1px solid rgba(255, 100, 100, 0.35);
  border-radius: 12px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #ff6b6b 0%, #ff8888 50%, #ff6b6b 100%);
    border-radius: 4px 0 0 4px;
  }

  .combat-status-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .combat-status-indicator {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    font-size: 18px;

    &.status-激战, &.status-战斗中 {
      background: rgba(255, 100, 100, 0.2);
      color: #ff6b6b;
    }
    &.status-对峙 {
      background: rgba(255, 180, 60, 0.2);
      color: #ffb43c;
    }
    &.status-重伤 {
      background: rgba(255, 136, 0, 0.2);
      color: #ff8800;
    }
    &.status-濒死 {
      background: rgba(200, 50, 50, 0.25);
      color: #cc3333;
    }

    .crossed-swords-icon {
      font-size: 20px;
      line-height: 1;
    }
  }

  .combat-status-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .combat-status-label {
    font-size: 17px;
    font-weight: bold;

    &.status-激战, &.status-战斗中 { color: #ff6b6b; }
    &.status-对峙 { color: #ffb43c; }
    &.status-重伤 { color: #ff8800; }
    &.status-濒死 { color: #cc3333; }
  }

  .combat-status-desc {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 180px;
  }

  .combat-round-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 14px;
    background: rgba(255, 100, 100, 0.1);
    border: 1px solid rgba(255, 100, 100, 0.25);
    border-radius: 10px;

    .round-label {
      font-size: 10px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .round-number {
      font-size: 20px;
      font-weight: bold;
      color: #ff6b6b;
      line-height: 1.1;
    }
  }
}

// 状态一览
.combat-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;

  .combat-stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;

    .combat-stat-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-size: 18px;

      &.spirit {
        background: rgba(74, 158, 255, 0.15);
        color: #4a9eff;
      }
      &.power {
        background: rgba(255, 170, 100, 0.15);
        color: #ffaa64;
      }
      &.injury-icon-无伤 {
        background: rgba(102, 204, 136, 0.15);
        color: #66cc88;
      }
      &.injury-icon-轻伤 {
        background: rgba(255, 204, 0, 0.15);
        color: #ffcc00;
      }
      &.injury-icon-重伤 {
        background: rgba(255, 136, 0, 0.15);
        color: #ff8800;
      }
      &.injury-icon-濒死 {
        background: rgba(255, 68, 68, 0.15);
        color: #ff4444;
        animation: pulse-danger 1.5s ease-in-out infinite;
      }
    }

    .combat-stat-content {
      flex: 1;

      .combat-stat-label {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }

      .combat-stat-bar {
        height: 8px;
        background: var(--progress-bg);
        border-radius: 4px;
        overflow: hidden;

        .combat-stat-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;

          &.spirit {
            box-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
          }
        }
      }

      .combat-stat-value {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-accent);
        margin-top: 4px;
      }

      .combat-power-value {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;

        .power-number {
          font-size: 22px;
          font-weight: bold;
          color: #ffaa64;
          text-shadow: 0 0 10px rgba(255, 170, 100, 0.4);
        }
      }

      .combat-stat-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;

        i { font-size: 12px; }

        &.status-无伤 {
          background: rgba(68, 170, 68, 0.15);
          color: #44aa44;
        }
        &.status-轻伤 {
          background: rgba(255, 204, 0, 0.15);
          color: #ffcc00;
        }
        &.status-重伤 {
          background: rgba(255, 136, 0, 0.15);
          color: #ff8800;
        }
        &.status-濒死 {
          background: rgba(255, 68, 68, 0.15);
          color: #ff4444;
          animation: pulse-danger 1.5s ease-in-out infinite;
        }
      }
    }
  }
}

// 已用底牌
.trump-cards-section {
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 200, 100, 0.08) 0%, rgba(255, 180, 80, 0.05) 100%);
  border: 1px dashed rgba(255, 200, 100, 0.3);
  border-radius: 12px;

  .trump-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #ffc864;
    i { font-size: 14px; }
  }

  .trump-cards-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .trump-card-tag {
      padding: 5px 14px;
      background: rgba(255, 200, 100, 0.15);
      border: 1px solid rgba(255, 200, 100, 0.4);
      border-radius: 15px;
      font-size: 12px;
      color: #ffc864;
    }
  }
}

// 敌人区块
.enemies-section {
  .enemies-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-accent);

    i { font-size: 14px; color: #ff6b6b; }

    .enemy-count {
      margin-left: auto;
      padding: 2px 10px;
      background: rgba(255, 100, 100, 0.15);
      border-radius: 10px;
      font-size: 12px;
      color: #ff6b6b;
    }
  }

  .enemies-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .enemy-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    transition: all 0.3s ease;

    &:hover { border-color: rgba(255, 100, 100, 0.4); }

    &.enemy-dead {
      opacity: 0.5;
      .enemy-name { text-decoration: line-through; color: var(--text-secondary); }
      .enemy-avatar { background: rgba(102, 102, 102, 0.15) !important; color: #666 !important; }
    }

    .enemy-avatar {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-size: 20px;
      flex-shrink: 0;

      &.threat-safe { background: rgba(68, 170, 68, 0.15); color: #44aa44; }
      &.threat-easy { background: rgba(136, 204, 68, 0.15); color: #88cc44; }
      &.threat-equal { background: rgba(255, 204, 0, 0.15); color: #ffcc00; }
      &.threat-hard { background: rgba(255, 136, 0, 0.15); color: #ff8800; }
      &.threat-deadly {
        background: rgba(255, 68, 68, 0.15);
        color: #ff4444;
        animation: pulse-danger 1.5s ease-in-out infinite;
      }
    }

    .enemy-info { flex: 1; min-width: 0; }

    .enemy-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;

      .enemy-name { font-size: 15px; font-weight: 600; color: #ff8888; }

      .enemy-realm {
        padding: 2px 10px;
        background: var(--button-bg);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-size: 11px;
        color: var(--text-accent);
        flex-shrink: 0;
      }
    }

    .enemy-status-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 6px;

      .enemy-power, .enemy-health {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        i { font-size: 11px; }
      }

      .enemy-power {
        &.power-safe { color: #44aa44; }
        &.power-easy { color: #88cc44; }
        &.power-equal { color: #ffcc00; }
        &.power-hard { color: #ff8800; }
        &.power-deadly { color: #ff4444; }

        .enemy-power-value { font-size: 10px; opacity: 0.8; margin-left: 2px; }
      }

      .enemy-health {
        &.health-完好 { color: #44aa44; }
        &.health-轻伤 { color: #ffcc00; }
        &.health-重伤 { color: #ff8800; }
        &.health-濒死 { color: #ff4444; }
        &.health-已死 { color: #666666; }
      }
    }

    .enemy-trait {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-top: 8px;
      border-top: 1px dashed var(--border-color);
      font-size: 12px;
      color: var(--text-secondary);
      i { font-size: 10px; color: #ffc864; }
    }
  }

  .empty-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30px 20px;
    background: var(--bg-secondary);
    border: 1px dashed var(--border-color);
    border-radius: 12px;
    color: var(--text-secondary);

    i { font-size: 28px; color: #66aa88; }
    span { font-size: 13px; font-style: italic; }
  }
}

@keyframes pulse-danger {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255, 68, 68, 0); }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .trump-cards-section {
    .trump-cards-list {
      .trump-card-tag { padding: 5px 12px; font-size: 11px; }
    }
  }

  .enemies-section {
    .enemy-card {
      padding: 12px 12px 12px 16px;
      .enemy-header-row {
        .enemy-name { font-size: 13px; }
        .enemy-realm { padding: 2px 8px; font-size: 10px; }
      }
      .enemy-status-row {
        gap: 12px;
        .enemy-power, .enemy-health { font-size: 11px; i { font-size: 10px; } }
      }
      .enemy-trait { font-size: 10px; }
    }

    .empty-hint {
      padding: 24px 16px;
      i { font-size: 24px; }
      span { font-size: 12px; }
    }
  }
}
</style>