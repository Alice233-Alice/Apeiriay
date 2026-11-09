<template>
  <SharedBattlePanel :combat-state="combatState" :current-enemies="currentEnemies" :player-level="playerLevel" />
</template>

<script setup lang="ts">
import SharedBattlePanel from '../../灯火通明/components/BattlePanel.vue';
import type { CombatState, EnemyRecord } from './combat-utils';

defineProps<{
  combatState: CombatState;
  currentEnemies: EnemyRecord;
  playerLevel: number;
}>();
</script>
