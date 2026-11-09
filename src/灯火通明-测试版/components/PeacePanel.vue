<template>
  <div class="peace-panel">
    <section class="state-card" :class="{ recovery: isInRecovery }">
      <div class="state-icon" :class="stateTone"><i :class="stateIcon"></i></div>
      <div class="state-copy">
        <span>{{ isInRecovery ? '劫后观身' : '道心澄明' }}</span>
        <strong>{{ title }}</strong>
        <p>{{ subtitle }}</p>
      </div>
    </section>

    <section class="burden-section">
      <div class="section-heading">
        <span><i class="fa-solid fa-wave-square"></i> 身心状态</span>
      </div>
      <div class="burden-grid">
        <div v-for="item in burdenItems" :key="item.label" class="burden-card" :class="`tone-${item.tone}`">
          <i :class="item.icon"></i>
          <div>
            <small>{{ item.label }}</small
            ><b>{{ item.value }}</b>
          </div>
        </div>
      </div>
    </section>

    <section v-if="showBattleResult" class="result-section" :class="`result-${battleResult.结果}`">
      <div class="section-heading">
        <span><i class="fa-solid fa-scroll"></i> 最近战果</span>
        <b>{{ battleResult.结果 }}</b>
      </div>
      <p v-if="battleResult.对手.length"><small>对手</small>{{ battleResult.对手.join('、') }}</p>
      <p v-if="battleResult.达成"><small>所成</small>{{ battleResult.达成 }}</p>
      <div v-if="battleResult.代价.length" class="result-list costs">
        <small>代价</small><span v-for="item in battleResult.代价" :key="item">{{ item }}</span>
      </div>
      <div v-if="battleResult.后患.length" class="result-list aftermath">
        <small>后患</small><span v-for="item in battleResult.后患" :key="item">{{ item }}</span>
      </div>
    </section>

    <section v-if="activeEnemies.length" class="residual-section">
      <div class="section-heading">
        <span><i class="fa-solid fa-eye"></i> 敌意未消</span>
      </div>
      <div class="residual-list">
        <span v-for="[name, enemy] in activeEnemies" :key="name"
          ><b>{{ name }}</b
          >{{ enemy.境界描述 }} · {{ enemy.状态 }}</span
        >
      </div>
    </section>

    <section v-if="showTribulationResult" class="tribulation-result">
      <div class="section-heading">
        <span><i class="fa-solid fa-bolt-lightning"></i> 渡劫记录</span>
      </div>
      <strong>{{ tribulationState?.上次渡劫结果 === '成功' ? '劫云已散，道途更进' : '此劫未过，尚需调养' }}</strong>
      <p v-if="tribulationState?.失败惩罚记录">{{ tribulationState.失败惩罚记录 }}</p>
    </section>

    <section class="advice-card">
      <span><i class="fa-solid fa-compass"></i>{{ isInRecovery ? '调息建议' : '修行建议' }}</span>
      <p>{{ advice }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CombatState, EnemyRecord, TribulationState } from './combat-utils';
import { getBurdenTone, isEnemyActive } from './combat-utils';

const props = defineProps<{
  combatState: CombatState;
  currentEnemies: EnemyRecord;
  tribulationState?: TribulationState;
  isInRecovery: boolean;
}>();

const battleResult = computed(() => props.combatState.最近战果);
const showBattleResult = computed(() => props.combatState.阶段 === '余波' && battleResult.value.结果 !== '无');
const showTribulationResult = computed(
  () => !!props.tribulationState?.上次渡劫结果 && props.tribulationState.上次渡劫结果 !== '无',
);
const activeEnemies = computed(() =>
  Object.entries(props.currentEnemies ?? {}).filter(([, enemy]) => isEnemyActive(enemy)),
);
const burdenItems = computed(() => [
  {
    label: '真元',
    value: props.combatState.负荷.真元,
    icon: 'fa-solid fa-fire-flame-curved',
    tone: getBurdenTone(props.combatState.负荷.真元),
  },
  {
    label: '神识',
    value: props.combatState.负荷.神识,
    icon: 'fa-solid fa-eye',
    tone: getBurdenTone(props.combatState.负荷.神识),
  },
  {
    label: '肉身',
    value: props.combatState.负荷.肉身,
    icon: 'fa-solid fa-heart-pulse',
    tone: getBurdenTone(props.combatState.负荷.肉身),
  },
]);
const burdenTones = computed(() => ({
  真元: getBurdenTone(props.combatState.负荷.真元),
  神识: getBurdenTone(props.combatState.负荷.神识),
  肉身: getBurdenTone(props.combatState.负荷.肉身),
}));

const title = computed(() => {
  const burden = props.combatState.负荷;
  if (burdenTones.value.肉身 === 'critical') return '命悬一线';
  if (burdenTones.value.肉身 === 'strained') return burden.肉身 === '重创' ? '肉身重创' : '肉身受损';
  if (burdenTones.value.神识 === 'critical') return '识海受创';
  if (burdenTones.value.真元 === 'critical') return '真元枯竭';
  if (showBattleResult.value) {
    const titles = {
      胜: '此战已定',
      负: '败而得生',
      脱身: '已脱杀局',
      议和: '干戈暂止',
      中止: '道争中止',
      无: '天下太平',
    } as const;
    return titles[battleResult.value.结果];
  }
  if (showTribulationResult.value) return props.tribulationState?.上次渡劫结果 === '成功' ? '渡劫功成' : '劫后余波';
  return '天下太平';
});

const subtitle = computed(() => {
  if (showBattleResult.value && battleResult.value.达成) return battleResult.value.达成;
  if (burdenTones.value.肉身 !== 'clear') return '伤势未复，不宜再争一时锋芒。';
  if (burdenTones.value.神识 !== 'clear') return '识海尚有余震，宜静守灵台。';
  if (burdenTones.value.真元 !== 'clear') return '气海未满，先行吐纳调息。';
  return '此刻无风无浪，正是修行良机。';
});

const stateTone = computed(() => {
  if (Object.values(burdenTones.value).includes('critical'))
    return 'critical';
  if (props.isInRecovery) return 'recovery';
  return 'peace';
});
const stateIcon = computed(() =>
  stateTone.value === 'critical'
    ? 'fa-solid fa-heart-crack'
    : stateTone.value === 'recovery'
      ? 'fa-solid fa-hand-holding-medical'
      : 'fa-solid fa-dove',
);

const advice = computed(() => {
  if (burdenTones.value.肉身 === 'critical')
    return '先保命脉，再论得失；疗伤、求援或寻找安全之地皆优先于继续斗法。';
  if (burdenTones.value.肉身 === 'strained')
    return '静养肉身并查清暗伤，强行运功可能令战后代价进一步加深。';
  if (burdenTones.value.肉身 === 'steady') return '运气温养伤处，待气血平复后再继续涉险。';
  if (burdenTones.value.神识 === 'critical' || burdenTones.value.神识 === 'strained')
    return '收束神念、稳守识海，暂避搜魂、幻术与高强度御器。';
  if (burdenTones.value.真元 === 'critical' || burdenTones.value.真元 === 'strained')
    return '先恢复真元再涉险地；丹药与灵石只能加快恢复，不能抹去已有反噬。';
  if (battleResult.value.后患.length) return `此战未尽之事：${battleResult.value.后患[0]}`;
  return '可打坐温养气机、参悟所得，或为下一段道途预作准备。';
});
</script>

<style lang="scss" scoped>
.peace-panel {
  display: grid;
  gap: 14px;
  color: var(--text-primary);
}
.state-card,
.burden-section,
.result-section,
.residual-section,
.tribulation-result,
.advice-card {
  border: 1px solid var(--line-subtle);
  border-radius: 14px;
  background: color-mix(in srgb, var(--reading-surface) 92%, transparent);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--stage-shadow) 22%, transparent);
}
.state-card {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 15px;
  padding: 20px;
}
.state-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 13%, transparent);
  font-size: 22px;
}
.state-icon.recovery {
  color: #e6b867;
  background: rgba(230, 184, 103, 0.13);
}
.state-icon.critical {
  color: var(--semantic-danger);
  background: color-mix(in srgb, var(--semantic-danger) 13%, transparent);
}
.state-copy {
  display: grid;
  gap: 3px;
}
.state-copy > span {
  color: var(--text-secondary);
  font-size: 10px;
  letter-spacing: 0.13em;
}
.state-copy strong {
  color: var(--jade);
  font-size: 21px;
}
.state-card.recovery .state-copy strong {
  color: #e6b867;
}
.state-copy p,
.advice-card p,
.tribulation-result p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.burden-section,
.result-section,
.residual-section,
.tribulation-result,
.advice-card {
  padding: 14px 16px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 11px;
}
.section-heading span,
.advice-card > span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
}
.section-heading i,
.advice-card i {
  color: var(--gold);
}
.section-heading b {
  color: var(--gold);
}
.burden-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}
.burden-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 11px;
}
.burden-card > i {
  font-size: 17px;
}
.burden-card > div {
  display: grid;
  gap: 2px;
}
.burden-card small {
  color: var(--text-secondary);
  font-size: 9px;
}
.burden-card b {
  font-size: 13px;
}
.tone-clear i,
.tone-clear b {
  color: var(--jade);
}
.tone-steady i,
.tone-steady b {
  color: var(--semantic-info);
}
.tone-strained i,
.tone-strained b {
  color: #e8a84c;
}
.tone-critical i,
.tone-critical b {
  color: var(--semantic-danger);
}
.result-section {
  border-color: color-mix(in srgb, var(--gold) 34%, var(--line-subtle));
}
.result-section > p {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 8px;
  margin: 7px 0;
  color: var(--text-secondary);
  font-size: 12px;
}
.result-section > p small,
.result-list > small {
  color: var(--gold);
}
.result-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
}
.result-list > small {
  margin-right: 4px;
}
.result-list span {
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--semantic-danger) 9%, transparent);
  font-size: 10px;
}
.result-list.aftermath span {
  background: color-mix(in srgb, var(--gold) 9%, transparent);
}
.residual-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.residual-list span {
  display: inline-flex;
  gap: 7px;
  padding: 6px 9px;
  border-radius: 8px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--semantic-danger) 9%, transparent);
  font-size: 10px;
}
.residual-list b {
  color: var(--text-primary);
}
.tribulation-result {
  display: grid;
  gap: 5px;
}
.advice-card {
  display: grid;
  gap: 8px;
  border-style: dashed;
}
@media (max-width: 760px) {
  .peace-panel {
    gap: 10px;
  }
  .state-card,
  .burden-section,
  .result-section,
  .residual-section,
  .tribulation-result,
  .advice-card {
    padding: 12px;
    border-radius: 11px;
  }
  .burden-card {
    display: grid;
    justify-items: center;
    gap: 5px;
    padding: 10px 5px;
    text-align: center;
  }
}
</style>
