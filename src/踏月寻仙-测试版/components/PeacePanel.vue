<template>
  <div class="peace-panel">
    <!-- 状态卡片 -->
    <div class="peace-state-card" :class="{ 'recovery-mode': isInRecovery }">
      <div class="peace-icon-wrapper">
        <i :class="isInRecovery ? recoveryIcon : 'fa-solid fa-dove'"
           class="peace-icon"
           :style="isInRecovery ? { color: iconColor, filter: `drop-shadow(0 0 15px ${iconColor}80)` } : undefined"></i>
        <div class="peace-glow"
             :style="isInRecovery ? { background: `radial-gradient(circle, ${iconColor}4D 0%, transparent 70%)` } : undefined"></div>
      </div>
      <div class="peace-title" :style="isInRecovery ? { color: iconColor, textShadow: `0 0 20px ${iconColor}80` } : undefined">
        {{ isInRecovery ? title : '天下太平' }}
      </div>
      <div class="peace-subtitle">
        {{ isInRecovery ? subtitle : '此刻无风无浪，正是修行良机' }}
      </div>
    </div>

    <!-- 状态一览 -->
    <div class="peace-stats">
      <div class="peace-stat-item">
        <div class="peace-stat-icon" :class="{ 'spirit-low': isInRecovery && spiritValue < 100 }">
          <i class="fa-solid fa-fire-flame-curved"></i>
        </div>
        <div class="peace-stat-content">
          <div class="peace-stat-label">{{ isInRecovery && spiritValue < 100 ? '灵力恢复中' : '灵力充盈' }}</div>
          <div class="peace-stat-bar">
            <div class="peace-stat-fill spirit" :style="{
              width: `${spiritValue}%`,
              background: isInRecovery ? getSpiritGradient(spiritValue) : undefined
            }"></div>
          </div>
          <div class="peace-stat-value">{{ spiritValue }}%</div>
        </div>
      </div>

      <div class="peace-stat-item">
        <div class="peace-stat-icon" :class="{
          health: !isInRecovery || injuryLevel === '无伤',
          [`injury-recovery-${injuryLevel}`]: isInRecovery && injuryLevel !== '无伤'
        }">
          <i :class="getInjuryIcon(injuryLevel)"></i>
        </div>
        <div class="peace-stat-content">
          <div class="peace-stat-label">身体状况</div>
          <div class="peace-stat-status" :class="`status-${injuryLevel}`">
            <i :class="getInjuryIcon(injuryLevel)"></i>
            {{ injuryLevel }}
          </div>
        </div>
      </div>

      <!-- 劫力承受（渡劫余波时） -->
      <div class="peace-stat-item" v-if="isInRecovery && tribEndurance < 100">
        <div class="peace-stat-icon tribulation-recovery">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div class="peace-stat-content">
          <div class="peace-stat-label">劫力承受</div>
          <div class="peace-stat-bar">
            <div class="peace-stat-fill tribulation" :style="{
              width: `${tribEndurance}%`,
              backgroundColor: tribEndurance > 50 ? '#8844ff' : '#ff4444'
            }"></div>
          </div>
          <div class="peace-stat-value">{{ tribEndurance }}%</div>
        </div>
      </div>

      <!-- 综合战力 -->
      <div class="peace-stat-item" v-if="playerCombatPower">
        <div class="peace-stat-icon power">
          <i class="fa-solid fa-fist-raised"></i>
        </div>
        <div class="peace-stat-content">
          <div class="peace-stat-label">综合战力</div>
          <div class="combat-power-value">
            <span class="power-number" style="font-size: 18px;">{{ playerCombatPower }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 已用底牌/护道（恢复期） -->
    <div class="recovery-used-section" v-if="isInRecovery && usedItems.length > 0">
      <div class="recovery-used-header">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>近期动用手段</span>
      </div>
      <div class="recovery-used-list">
        <span v-for="item in usedItems" :key="item" class="recovery-used-tag">
          {{ item }}
        </span>
      </div>
    </div>

    <!-- 残余敌人 -->
    <div class="recovery-enemies-section" v-if="isInRecovery && aliveEnemyCount > 0">
      <div class="recovery-enemies-header">
        <i class="fa-solid fa-eye"></i>
        <span>周围仍有敌意</span>
        <span class="enemy-count">{{ aliveEnemyCount }}</span>
      </div>
      <div class="recovery-enemies-list">
        <div v-for="(enemy, index) in aliveEnemies"
             :key="index"
             class="recovery-enemy-item">
          <span class="recovery-enemy-name">{{ enemy.名称 }}</span>
          <span class="recovery-enemy-realm">{{ enemy.境界 }}</span>
          <span class="recovery-enemy-status" :class="`health-${enemy.状态}`">{{ enemy.状态 }}</span>
        </div>
      </div>
    </div>

    <!-- 渡劫结果 -->
    <div class="tribulation-result-section" v-if="isInRecovery && lastTribResult && lastTribResult !== '无'">
      <div class="tribulation-result-header">
        <i class="fa-solid fa-bolt-lightning"></i>
        <span>渡劫记录</span>
      </div>
      <div class="tribulation-result-content" :class="`result-${lastTribResult}`">
        <i :class="lastTribResult === '成功' ? 'fa-solid fa-check-circle' : 'fa-solid fa-times-circle'"></i>
        <span>{{ lastTribResult === '成功' ? '渡劫成功' : '渡劫失败' }}</span>
      </div>
      <div class="tribulation-penalty" v-if="lastTribResult === '失败' && tribulationState?.失败惩罚记录">
        {{ tribulationState.失败惩罚记录 }}
      </div>
    </div>

    <!-- 提示信息 -->
    <div class="cultivation-tips" :class="{ 'recovery-tips': isInRecovery }">
      <div class="tip-header">
        <i :class="isInRecovery ? 'fa-solid fa-notes-medical' : 'fa-solid fa-lightbulb'"></i>
        <span>{{ isInRecovery ? '恢复建议' : '修行建议' }}</span>
      </div>
      <div class="tip-content">
        {{ tip }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CombatState, EnemyInfo, TribulationState } from './combat-utils';
import { getInjuryIcon, getSpiritGradient } from './combat-utils';

const props = defineProps<{
  combatState?: CombatState;
  currentEnemies?: EnemyInfo[];
  tribulationState?: TribulationState;
  playerCombatPower?: number;
  isInRecovery: boolean;
}>();

// 派生值
const spiritValue = computed(() => props.combatState?.灵力值 ?? 100);
const injuryLevel = computed(() => props.combatState?.伤势等级 ?? '无伤');
const tribEndurance = computed(() => props.tribulationState?.劫力承受 ?? 100);
const lastTribResult = computed(() => props.tribulationState?.上次渡劫结果);

const aliveEnemies = computed(() =>
  props.currentEnemies?.filter(e => e.状态 !== '已死') ?? []
);
const aliveEnemyCount = computed(() => aliveEnemies.value.length);

const usedItems = computed(() => [
  ...(props.combatState?.已用底牌 ?? []),
  ...(props.tribulationState?.已用护道 ?? []),
]);

// 恢复状态标题
const title = computed(() => {
  const injury = injuryLevel.value;
  if (injury === '濒死') return '命悬一线';
  if (injury === '重伤') return '伤势未愈';
  if (injury === '轻伤') return '轻伤调养';
  if (spiritValue.value < 30) return '灵力枯竭';
  if (spiritValue.value < 70) return '灵力不济';
  if (tribEndurance.value < 50) return '劫后余生';
  if (lastTribResult.value === '成功') return '渡劫功成';
  if (lastTribResult.value === '失败') return '劫难余波';
  if (aliveEnemyCount.value > 0) return '暗敌环伺';
  return '战后恢复';
});

// 恢复状态副标题
const subtitle = computed(() => {
  const injury = injuryLevel.value;
  const spirit = spiritValue.value;
  if (injury === '濒死') return '重创在身，急需疗伤保命';
  if (injury === '重伤') return '伤筋动骨，需静养恢复';
  if (injury === '轻伤') return '皮外之伤，稍事休息即可';
  if (spirit < 30) return '灵力将竭，亟需打坐恢复';
  if (spirit < 70) return '灵力不足，暂避锋芒为上';
  if (lastTribResult.value === '成功') return '劫难已过，境界有望精进';
  if (lastTribResult.value === '失败') return '劫难未过，需休养生息';
  if (aliveEnemyCount.value > 0) return '敌人尚存，不可掉以轻心';
  return '此战虽毕，仍需调息恢复';
});

// 恢复状态图标颜色
const iconColor = computed(() => {
  const injury = injuryLevel.value;
  if (injury === '濒死') return '#ff4444';
  if (injury === '重伤') return '#ff8800';
  if (injury === '轻伤') return '#ffcc00';
  if (spiritValue.value < 50) return '#4a9eff';
  if (lastTribResult.value === '成功') return '#44cc88';
  if (lastTribResult.value === '失败') return '#ff6666';
  if (aliveEnemyCount.value > 0) return '#ff8888';
  return '#ffaa44';
});

// 恢复状态图标
const recoveryIcon = computed(() => {
  const injury = injuryLevel.value;
  if (injury === '濒死') return 'fa-solid fa-skull';
  if (injury === '重伤') return 'fa-solid fa-heart-crack';
  if (injury === '轻伤') return 'fa-solid fa-bandage';
  if (spiritValue.value < 50) return 'fa-solid fa-fire-flame-curved';
  if (lastTribResult.value === '成功') return 'fa-solid fa-sun';
  if (lastTribResult.value === '失败') return 'fa-solid fa-cloud-bolt';
  if (aliveEnemyCount.value > 0) return 'fa-solid fa-eye';
  return 'fa-solid fa-heart-pulse';
});

// 提示文案
const tip = computed(() => {
  if (props.isInRecovery) {
    const injury = injuryLevel.value;
    const spirit = spiritValue.value;
    if (injury === '濒死') return '性命攸关，应立即服用疗伤丹药或寻找安全之地疗伤，切勿再战。';
    if (injury === '重伤') return '伤势不轻，建议寻找安全之地闭关疗伤，或服用疗伤丹药加速恢复。';
    if (injury === '轻伤') return '伤势尚轻，打坐调息数个时辰即可恢复，可考虑服用丹药加速。';
    if (spirit < 30) return '灵力将竭，需立即打坐恢复灵力，切忌贸然使用神通。';
    if (spirit < 70) return '灵力不足，建议打坐恢复后再行动，可借助灵石加速恢复。';
    if (lastTribResult.value === '成功') return '渡劫成功，趁热打铁巩固境界，感悟天道，切勿浪费这难得的领悟。';
    if (lastTribResult.value === '失败') return '渡劫失败，需调养身心，待状态恢复至巅峰后再做打算。';
    if (aliveEnemyCount.value > 0) return '周围仍有敌意，需保持警惕，做好再战准备或寻路撤离。';
    return '战斗已毕，建议调息恢复至巅峰状态后再继续前行。';
  }
  const tips = [
    '静心打坐，感悟天地灵气，可提升修为根基。',
    '此时可研读典籍，或向前辈请教功法要诀。',
    '闭关修炼，锤炼神通，方能在险境中保全自身。',
    '游历四方，增长见识，亦是修行的一部分。',
    '寻觅机缘，或可得到意想不到的收获。',
    '炼丹制器，囤积修行资源，有备无患。',
    '与道友切磋，互相印证修行心得。',
    '探索秘境，寻找珍稀灵材与传承。',
  ];
  return tips[Math.floor(Date.now() / 60000) % tips.length];
});
</script>

<style lang="scss" scoped>
// 状态卡片
.peace-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(68, 170, 68, 0.1) 0%, rgba(100, 200, 150, 0.08) 100%);
  border: 1px solid rgba(68, 170, 68, 0.3);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.5s ease;

  &.recovery-mode {
    background: linear-gradient(135deg, rgba(255, 170, 68, 0.1) 0%, rgba(255, 136, 68, 0.08) 100%);
    border-color: rgba(255, 170, 68, 0.35);
    &::before {
      background: radial-gradient(circle, rgba(255, 170, 68, 0.1) 0%, transparent 70%);
    }
  }

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(68, 170, 68, 0.1) 0%, transparent 70%);
    animation: peace-glow 4s ease-in-out infinite;
  }

  .peace-icon-wrapper {
    position: relative;
    margin-bottom: 16px;

    .peace-icon {
      font-size: 48px;
      color: #66cc88;
      filter: drop-shadow(0 0 15px rgba(102, 204, 136, 0.5));
      animation: peace-float 3s ease-in-out infinite;
    }

    .peace-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
      background: radial-gradient(circle, rgba(102, 204, 136, 0.3) 0%, transparent 70%);
      border-radius: 50%;
      animation: peace-pulse 2s ease-in-out infinite;
    }
  }

  .peace-title {
    font-size: 22px;
    font-weight: bold;
    color: #66cc88;
    text-shadow: 0 0 20px rgba(102, 204, 136, 0.5);
    margin-bottom: 8px;
    position: relative;
    z-index: 1;
    transition: color 0.3s ease;
  }

  .peace-subtitle {
    font-size: 13px;
    color: var(--text-secondary);
    font-style: italic;
    position: relative;
    z-index: 1;
  }
}

@keyframes peace-glow {
  0%, 100% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0.5; }
  50% { transform: translate(-50%, -50%) rotate(180deg); opacity: 0.8; }
}
@keyframes peace-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes peace-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
  50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.2; }
}

// 恢复期图标变色
.peace-stat-icon.spirit-low {
  background: rgba(255, 170, 0, 0.15) !important;
  color: #ffaa00 !important;
}

.peace-stat-icon {
  &.injury-recovery-轻伤 { background: rgba(255, 204, 0, 0.15) !important; color: #ffcc00 !important; }
  &.injury-recovery-重伤 { background: rgba(255, 136, 0, 0.15) !important; color: #ff8800 !important; }
  &.injury-recovery-濒死 {
    background: rgba(255, 68, 68, 0.15) !important;
    color: #ff4444 !important;
    animation: pulse-danger 1.5s ease-in-out infinite;
  }
  &.tribulation-recovery { background: rgba(136, 68, 255, 0.15); color: #8844ff; }
  &.power { background: rgba(255, 170, 100, 0.15); color: #ffaa64; }
}

// 状态一览
.peace-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;

  .peace-stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;

    .peace-stat-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(74, 158, 255, 0.15);
      border-radius: 10px;
      color: #4a9eff;
      font-size: 18px;

      &.health {
        background: rgba(102, 204, 136, 0.15);
        color: #66cc88;
      }
    }

    .peace-stat-content {
      flex: 1;

      .peace-stat-label {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 6px;
      }

      .peace-stat-bar {
        height: 8px;
        background: var(--progress-bg);
        border-radius: 4px;
        overflow: hidden;

        .peace-stat-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;

          &.spirit {
            background: linear-gradient(90deg, #4a9eff, #66bbff);
            box-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
          }

          &.tribulation {
            border-radius: 4px;
            transition: width 0.5s ease;
            box-shadow: 0 0 10px rgba(136, 68, 255, 0.4);
          }
        }
      }

      .peace-stat-value {
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
          font-weight: bold;
          color: #ffaa64;
          text-shadow: 0 0 10px rgba(255, 170, 100, 0.4);
        }
      }

      .peace-stat-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;

        i { font-size: 12px; }

        &.status-无伤 { background: rgba(68, 170, 68, 0.15); color: #44aa44; }
        &.status-轻伤 { background: rgba(255, 204, 0, 0.15); color: #ffcc00; }
        &.status-重伤 { background: rgba(255, 136, 0, 0.15); color: #ff8800; }
        &.status-濒死 {
          background: rgba(255, 68, 68, 0.15);
          color: #ff4444;
          animation: pulse-danger 1.5s ease-in-out infinite;
        }
      }
    }
  }
}

// 恢复期已用手段
.recovery-used-section {
  margin-bottom: 16px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(255, 200, 100, 0.08) 0%, rgba(255, 180, 80, 0.05) 100%);
  border: 1px dashed rgba(255, 200, 100, 0.3);
  border-radius: 12px;

  .recovery-used-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #ffc864;
    i { font-size: 14px; }
  }

  .recovery-used-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .recovery-used-tag {
      padding: 5px 14px;
      background: rgba(255, 200, 100, 0.15);
      border: 1px solid rgba(255, 200, 100, 0.4);
      border-radius: 15px;
      font-size: 12px;
      color: #ffc864;
    }
  }
}

// 残余敌人
.recovery-enemies-section {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid rgba(255, 100, 100, 0.25);
  border-radius: 12px;

  .recovery-enemies-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #ff8888;
    i { font-size: 14px; }

    .enemy-count {
      margin-left: auto;
      padding: 2px 10px;
      background: rgba(255, 100, 100, 0.15);
      border-radius: 10px;
      font-size: 12px;
      color: #ff6b6b;
    }
  }

  .recovery-enemies-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .recovery-enemy-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--button-bg);
    border-radius: 8px;
    font-size: 12px;

    .recovery-enemy-name { font-weight: 500; color: #ff8888; }

    .recovery-enemy-realm {
      padding: 2px 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 10px;
      color: var(--text-accent);
    }

    .recovery-enemy-status {
      margin-left: auto;
      font-size: 11px;
      &.health-完好 { color: #44aa44; }
      &.health-轻伤 { color: #ffcc00; }
      &.health-重伤 { color: #ff8800; }
      &.health-濒死 { color: #ff4444; }
    }
  }
}

// 渡劫结果
.tribulation-result-section {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;

  .tribulation-result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #8844ff;
    i { font-size: 14px; }
  }

  .tribulation-result-content {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-radius: 15px;
    font-size: 14px;
    font-weight: 600;

    &.result-成功 { background: rgba(68, 204, 136, 0.15); color: #44cc88; }
    &.result-失败 { background: rgba(255, 68, 68, 0.15); color: #ff6666; }
  }

  .tribulation-penalty {
    margin-top: 10px;
    padding: 10px 12px;
    background: rgba(255, 68, 68, 0.08);
    border: 1px dashed rgba(255, 68, 68, 0.3);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
}

// 提示
.cultivation-tips {
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 200, 100, 0.08) 0%, rgba(255, 180, 80, 0.05) 100%);
  border: 1px dashed rgba(255, 200, 100, 0.3);
  border-radius: 12px;

  &.recovery-tips {
    border-color: rgba(255, 170, 100, 0.3);
    background: linear-gradient(135deg, rgba(255, 170, 100, 0.08) 0%, rgba(255, 136, 68, 0.05) 100%);
    .tip-header { color: #ffaa64; }
  }

  .tip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: #ffc864;
    i { font-size: 14px; }
  }

  .tip-content {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    font-style: italic;
  }
}

@keyframes pulse-danger {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255, 68, 68, 0); }
}
</style>