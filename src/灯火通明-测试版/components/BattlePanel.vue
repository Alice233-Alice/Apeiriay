<template>
  <div class="battle-panel">
    <header class="battle-header">
      <div class="phase-mark"><i class="fa-solid fa-khanda"></i></div>
      <div class="phase-copy">
        <span class="eyebrow">道争进行中</span>
        <strong>{{ combatState.阶段 }}</strong>
        <span>{{ combatState.战局.最近转折 || '气机交锁，胜负仍悬。' }}</span>
      </div>
      <div class="round-seal">
        <small>交锋</small>
        <b>{{ combatState.交锋轮次 }}</b>
      </div>
    </header>

    <section class="momentum-card">
      <div class="section-heading">
        <span><i class="fa-solid fa-scale-balanced"></i> 道势</span>
        <b :class="`momentum-${momentumIndex}`">{{ combatState.战局.态势 }}</b>
      </div>
      <div class="momentum-track" role="img" :aria-label="`当前战局态势：${combatState.战局.态势}`">
        <div
          v-for="(step, index) in momentumSteps"
          :key="step"
          class="momentum-step"
          :class="{ active: index === momentumIndex, passed: index < momentumIndex }"
        >
          <span class="step-dot"></span>
          <small>{{ step }}</small>
        </div>
      </div>
      <div v-if="combatState.战局.态势依据.length" class="evidence-row">
        <span v-for="item in combatState.战局.态势依据" :key="item">{{ item }}</span>
      </div>
    </section>

    <div class="battle-grid">
      <section class="info-card objectives-card">
        <div class="section-heading">
          <span><i class="fa-solid fa-bullseye"></i> 所争为何</span>
        </div>
        <div class="objective-row mine">
          <small>我方</small>
          <span>{{ combatState.战局.我方目的 || '保全自身，伺机而动' }}</span>
        </div>
        <div class="objective-row enemy">
          <small>敌方</small>
          <span>{{ combatState.战局.敌方目的 || '尚未看清其真正所图' }}</span>
        </div>
      </section>

      <section class="info-card burden-card">
        <div class="section-heading">
          <span><i class="fa-solid fa-wave-square"></i> 身心负荷</span>
        </div>
        <div class="burden-list">
          <div v-for="item in burdenItems" :key="item.label" class="burden-item" :class="`tone-${item.tone}`">
            <i :class="item.icon"></i>
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
          </div>
        </div>
      </section>
    </div>

    <section v-if="combatState.战局.战场要素.length" class="scene-strip">
      <span class="strip-title"><i class="fa-solid fa-mountain-sun"></i> 战场</span>
      <span v-for="item in combatState.战局.战场要素" :key="item" class="scene-tag">{{ item }}</span>
    </section>

    <div class="battle-grid tactical-grid">
      <section class="info-card opportunity-card">
        <div class="section-heading">
          <span><i class="fa-solid fa-eye"></i> 可乘战机</span>
        </div>
        <ul v-if="combatState.战局.战机.length">
          <li v-for="item in combatState.战局.战机" :key="item">{{ item }}</li>
        </ul>
        <p v-else class="empty-copy">尚无可一举定势的破绽。</p>
      </section>
      <section class="info-card danger-card">
        <div class="section-heading">
          <span><i class="fa-solid fa-triangle-exclamation"></i> 当前危机</span>
        </div>
        <ul v-if="combatState.战局.危机.length">
          <li v-for="item in combatState.战局.危机" :key="item">{{ item }}</li>
        </ul>
        <p v-else class="empty-copy">暂未显出迫在眉睫的险处。</p>
      </section>
    </div>

    <section class="enemies-section">
      <div class="section-heading">
        <span><i class="fa-solid fa-user-ninja"></i> 对阵之敌</span>
        <small>{{ activeEnemyCount }} 名仍可出手</small>
      </div>
      <div class="enemy-grid">
        <article
          v-for="[name, enemy] in enemyEntries"
          :key="name"
          class="enemy-card"
          :class="{ inactive: !isEnemyActive(enemy) }"
        >
          <div class="enemy-topline">
            <div>
              <strong>{{ name }}</strong>
              <span>{{ enemy.境界描述 }}</span>
            </div>
            <span class="enemy-state"><i :class="getEnemyStateIcon(enemy.状态)"></i>{{ enemy.状态 }}</span>
          </div>
          <div class="standing-badge" :class="`standing-${getRealmStandingTone(getRealmStanding(playerLevel, enemy))}`">
            <i class="fa-solid fa-layer-group"></i>
            {{ getRealmStanding(playerLevel, enemy) }}
          </div>
          <p v-if="enemy.目的" class="enemy-purpose"><small>所图</small>{{ enemy.目的 }}</p>
          <div v-if="enemy.威胁手段.length" class="enemy-detail">
            <small>威胁手段</small>
            <span v-for="item in enemy.威胁手段" :key="item">{{ item }}</span>
          </div>
          <div v-if="enemy.已暴露破绽.length" class="enemy-detail openings">
            <small>已见破绽</small>
            <span v-for="item in enemy.已暴露破绽" :key="item">{{ item }}</span>
          </div>
        </article>
        <div v-if="enemyEntries.length === 0" class="empty-enemies">敌意已显，来者身份却仍藏在暗处。</div>
      </div>
    </section>

    <section v-if="revealedMethods.length" class="methods-strip">
      <span class="strip-title"><i class="fa-solid fa-scroll"></i> 已显手段</span>
      <span v-for="item in revealedMethods" :key="item.text" :class="item.side">{{ item.text }}</span>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CombatState, EnemyRecord } from './combat-utils';
import {
  getBurdenTone,
  getEnemyStateIcon,
  getRealmStanding,
  getRealmStandingTone,
  isEnemyActive,
} from './combat-utils';

const props = defineProps<{
  combatState: CombatState;
  currentEnemies: EnemyRecord;
  playerLevel: number;
}>();

const momentumSteps = ['敌方压制', '敌方占先', '相持', '我方占先', '我方压制'] as const;
const momentumIndex = computed(() => Math.max(0, momentumSteps.indexOf(props.combatState.战局.态势)));
const enemyEntries = computed(() => Object.entries(props.currentEnemies ?? {}));
const activeEnemyCount = computed(() => enemyEntries.value.filter(([, enemy]) => isEnemyActive(enemy)).length);
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
const revealedMethods = computed(() => [
  ...props.combatState.战局.已显手段.我方.map(text => ({ text, side: 'mine' })),
  ...props.combatState.战局.已显手段.敌方.map(text => ({ text, side: 'enemy' })),
]);
</script>

<style lang="scss" scoped>
.battle-panel {
  display: grid;
  gap: 14px;
  color: var(--text-primary);
}
.battle-header,
.momentum-card,
.info-card,
.enemies-section,
.scene-strip,
.methods-strip {
  border: 1px solid var(--line-subtle);
  border-radius: 14px;
  background: color-mix(in srgb, var(--reading-surface) 92%, transparent);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--stage-shadow) 22%, transparent);
}
.battle-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 13px;
  padding: 15px 17px;
}
.phase-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  color: #f3c873;
  background: rgba(192, 75, 55, 0.17);
}
.phase-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.phase-copy strong {
  color: #f0c779;
  font-size: 18px;
}
.phase-copy > span:last-child {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eyebrow {
  color: var(--text-secondary);
  font-size: 10px;
  letter-spacing: 0.14em;
}
.round-seal {
  display: grid;
  place-items: center;
  min-width: 48px;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--gold) 38%, transparent);
  border-radius: 10px;
}
.round-seal small {
  color: var(--text-secondary);
  font-size: 9px;
}
.round-seal b {
  color: var(--gold);
  font-size: 19px;
}
.momentum-card,
.info-card,
.enemies-section {
  padding: 14px 16px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.section-heading > span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
}
.section-heading i {
  color: var(--gold);
}
.section-heading small {
  color: var(--text-secondary);
  font-size: 10px;
}
.section-heading > b {
  color: var(--gold);
  font-size: 12px;
}
.momentum-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.momentum-track::before {
  position: absolute;
  top: 8px;
  right: 8%;
  left: 8%;
  height: 1px;
  content: '';
  background: var(--line-subtle);
}
.momentum-step {
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 6px;
  color: var(--text-secondary);
  text-align: center;
}
.step-dot {
  width: 17px;
  height: 17px;
  border: 3px solid color-mix(in srgb, var(--reading-surface) 85%, #000);
  border-radius: 50%;
  background: var(--line-subtle);
}
.momentum-step.passed .step-dot {
  background: color-mix(in srgb, var(--semantic-danger) 52%, var(--gold));
}
.momentum-step.active {
  color: var(--text-primary);
  font-weight: 700;
}
.momentum-step.active .step-dot {
  background: var(--gold);
  box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 72%, transparent);
}
.momentum-step small {
  font-size: 10px;
}
.evidence-row,
.scene-strip,
.methods-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.evidence-row {
  margin-top: 12px;
}
.evidence-row span,
.scene-tag,
.methods-strip > span:not(.strip-title) {
  padding: 4px 8px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--reading-surface) 76%, var(--line-subtle));
  font-size: 10px;
}
.battle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.objective-row {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 9px;
  padding: 9px 0;
  border-top: 1px solid var(--line-subtle);
}
.objective-row:first-of-type {
  border-top: 0;
}
.objective-row small {
  color: var(--text-secondary);
}
.objective-row.mine small {
  color: var(--jade);
}
.objective-row.enemy small {
  color: var(--semantic-danger);
}
.burden-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.burden-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 7px;
  padding: 9px;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
}
.burden-item i {
  grid-row: 1 / 3;
  align-self: center;
}
.burden-item span {
  color: var(--text-secondary);
  font-size: 10px;
}
.burden-item b {
  font-size: 12px;
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
.scene-strip,
.methods-strip {
  padding: 10px 13px;
}
.strip-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 3px;
  color: var(--text-secondary);
  font-size: 11px;
}
.strip-title i {
  color: var(--gold);
}
.info-card ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.info-card li {
  position: relative;
  padding-left: 14px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}
.info-card li::before {
  position: absolute;
  top: 0.55em;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  content: '';
}
.opportunity-card li::before {
  background: var(--jade);
  box-shadow: 0 0 7px color-mix(in srgb, var(--jade) 70%, transparent);
}
.danger-card li::before {
  background: var(--semantic-danger);
  box-shadow: 0 0 7px color-mix(in srgb, var(--semantic-danger) 70%, transparent);
}
.empty-copy,
.empty-enemies {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  font-style: italic;
}
.enemy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.enemy-card {
  display: grid;
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: color-mix(in srgb, var(--reading-surface) 88%, transparent);
}
.enemy-card.inactive {
  opacity: 0.58;
}
.enemy-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.enemy-topline > div {
  display: grid;
  gap: 2px;
}
.enemy-topline strong {
  font-size: 14px;
}
.enemy-topline > div span {
  color: var(--text-secondary);
  font-size: 10px;
}
.enemy-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 10px;
}
.standing-badge {
  width: fit-content;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 10px;
}
.standing-safe,
.standing-easy {
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 12%, transparent);
}
.standing-equal {
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 12%, transparent);
}
.standing-hard,
.standing-deadly {
  color: var(--semantic-danger);
  background: color-mix(in srgb, var(--semantic-danger) 12%, transparent);
}
.enemy-purpose {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 7px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
}
.enemy-purpose small,
.enemy-detail small {
  color: var(--gold);
}
.enemy-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.enemy-detail small {
  width: 100%;
  font-size: 9px;
}
.enemy-detail span {
  padding: 3px 7px;
  border-radius: 7px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--semantic-danger) 9%, transparent);
  font-size: 9px;
}
.enemy-detail.openings span {
  background: color-mix(in srgb, var(--jade) 9%, transparent);
}
.methods-strip .mine {
  border: 1px solid color-mix(in srgb, var(--jade) 28%, transparent);
}
.methods-strip .enemy {
  border: 1px solid color-mix(in srgb, var(--semantic-danger) 28%, transparent);
}
@media (max-width: 760px) {
  .battle-panel {
    gap: 10px;
  }
  .battle-header,
  .momentum-card,
  .info-card,
  .enemies-section {
    padding: 11px 12px;
    border-radius: 11px;
  }
  .battle-grid,
  .enemy-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .burden-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .burden-item {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }
  .burden-item i {
    grid-row: auto;
  }
  .momentum-step small {
    max-width: 3em;
  }
}
</style>
