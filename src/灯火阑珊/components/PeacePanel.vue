<template>
  <SharedPeacePanel
    :combat-state="combatState"
    :current-enemies="currentEnemies"
    :tribulation-state="tribulationState"
    :is-in-recovery="isInRecovery"
  />
</template>

<script setup lang="ts">
import SharedPeacePanel from '../../灯火通明/components/PeacePanel.vue';
import type { CombatState, EnemyRecord, TribulationState } from './combat-utils';

defineProps<{
  combatState: CombatState;
  currentEnemies: EnemyRecord;
  tribulationState?: TribulationState;
  isInRecovery: boolean;
}>();
</script>
