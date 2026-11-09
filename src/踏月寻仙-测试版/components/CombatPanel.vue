<template>
  <!-- 渡劫状态 -->
  <TribulationPanel
    v-if="isInTribulation"
    :tribulation-state="tribulationState"
  />

  <!-- 战斗状态 -->
  <BattlePanel
    v-else-if="isInCombat"
    :combat-state="combatState"
    :current-enemies="currentEnemies"
    :player-combat-power="playerCombatPower"
  />

  <!-- 和平/恢复状态 -->
  <PeacePanel
    v-else
    :combat-state="combatState"
    :current-enemies="currentEnemies"
    :tribulation-state="tribulationState"
    :player-combat-power="playerCombatPower"
    :is-in-recovery="isInRecovery"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BattlePanel from './BattlePanel.vue';
import type { CombatState, EnemyInfo, TribulationState } from './combat-utils';
import PeacePanel from './PeacePanel.vue';
import TribulationPanel from './TribulationPanel.vue';

const props = defineProps<{
  combatState?: CombatState;
  currentEnemies?: EnemyInfo[];
  tribulationState?: TribulationState;
  playerCombatPower?: number;
}>();

// 是否正在渡劫：显式标志优先。只有标志缺失时才兼容极少量旧数据。
const isInTribulation = computed(() => {
  if (props.tribulationState?.正在渡劫 === true) return true;
  if (props.tribulationState?.正在渡劫 === false) return false;
  if (props.tribulationState?.上次渡劫结果 && props.tribulationState.上次渡劫结果 !== '无') return false;

  // 回退检测：仅在缺失显式标志时，允许旧数据依靠进度字段显示渡劫面板
  if (
    props.tribulationState?.劫种 && props.tribulationState.劫种 !== '无'
    && (props.tribulationState?.当前阶段 ?? 0) > 0
  ) {
    return true;
  }
  return false;
});

// 是否正在战斗（增强检测）
const isInCombat = computed(() => {
  if (props.combatState?.正在战斗) return true;
  if (props.combatState?.当前状态 && props.combatState.当前状态 !== '非战斗') return true;
  // 回退检测：有活着的敌人 + 战斗回合 > 0
  if (
    (props.combatState?.战斗回合 ?? 0) > 0
    && (props.currentEnemies?.filter(e => e.状态 !== '已死').length ?? 0) > 0
  ) {
    return true;
  }
  return false;
});

// 是否处于战后恢复状态
const isInRecovery = computed(() => {
  if (isInTribulation.value || isInCombat.value) return false;

  const injured = props.combatState?.伤势等级 != null && props.combatState.伤势等级 !== '无伤';
  const depleted = (props.combatState?.灵力值 ?? 100) < 100;
  const usedTrumps = (props.combatState?.已用底牌?.length ?? 0) > 0;
  const tribAftermath = (props.tribulationState?.劫力承受 ?? 100) < 100;
  const usedProtection = (props.tribulationState?.已用护道?.length ?? 0) > 0;
  const recentTribResult = props.tribulationState?.上次渡劫结果 != null && props.tribulationState.上次渡劫结果 !== '无';
  const hasActiveEnemies = (props.currentEnemies?.filter(e => e.状态 !== '已死').length ?? 0) > 0;

  return !!(injured || depleted || usedTrumps || tribAftermath || usedProtection || recentTribResult || hasActiveEnemies);
});
</script>
