<template>
  <div ref="inventoryRoot" class="panel inventory-panel">
    <section v-for="section in sections" :key="section.key" class="inventory-section">
      <div class="section-header">
        <div class="section-title"><i :class="section.icon"></i> {{ section.title }}</div>
      </div>
      <div v-if="section.items.length" class="items-list">
        <div
          v-for="item in section.items"
          :key="item.uid"
          class="item-strip"
          :data-item-name="item.name"
          tabindex="-1"
          :class="`tier-${item.tier}`"
        >
          <div class="item-topline">
            <div class="item-title-group">
              <span class="item-name">{{ item.name }}</span
              ><span class="item-rank">{{ item.rankLabel }}</span>
            </div>
            <span v-if="section.key !== 'treasure' || item.count > 1" class="item-count">×{{ item.count }}</span>
          </div>
          <div class="item-desc">{{ item.description }}</div>
        </div>
      </div>
      <div v-else class="empty-hint">空空如也</div>
    </section>
    <section class="inventory-section" data-item-name="灵石" tabindex="-1">
      <details class="spirit-stone-valuation">
        <summary class="section-header spirit-stone-summary" :title="'折算说明：' + stoneRateText">
          <span class="section-title"><i class="fa-solid fa-coins" aria-hidden="true"></i> 灵石</span>
          <span class="spirit-stone-tag">
            <span class="spirit-stone-valuation-label">折合下品</span>
            <strong>{{ formatNumber(getSpiritStoneTotal(store.本尊.灵石)) }}</strong>
            <svg class="spirit-stone-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </span>
        </summary>
        <div class="spirit-stone-conversion">
          <p class="spirit-stone-rate">
            <template v-for="(rate, index) in stoneRates" :key="rate.grade">
              <span v-if="index" class="spirit-stone-equals">＝</span>
              <span>{{ formatNumber(rate.count) }} {{ rate.grade }}</span>
            </template>
          </p>
          <p class="spirit-stone-note">四品按实际枚数分别持有，百进制用于估值，兑换随剧情结算。</p>
        </div>
      </details>
      <div class="spirit-stone-grid">
        <div
          v-for="grade in SPIRIT_STONE_GRADES"
          :key="grade"
          class="spirit-stone-balance"
          :class="{ 'is-empty': store.本尊.灵石[grade] === 0 }"
          :data-grade="grade"
          :data-item-name="grade"
          tabindex="-1"
        >
          <div class="spirit-stone-caption">
            <span class="spirit-stone-emblem" aria-hidden="true">
              <svg viewBox="0 0 28 28" focusable="false">
                <path class="crystal-face" d="m14 3 10 8-10 14L4 11Z" />
                <path class="crystal-facets" d="M4 11h20M14 3l-5 8 5 14 5-14Z" />
              </svg>
            </span>
            <span class="spirit-stone-name">{{ grade }}</span>
          </div>
          <div class="spirit-stone-value">
            <span class="spirit-stone-count">{{ formatNumber(store.本尊.灵石[grade]) }}</span>
            <span class="spirit-stone-unit">枚</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useDataStore } from '../store';
import { getSpiritStoneTotal, SPIRIT_STONE_GRADES, SPIRIT_STONE_WEIGHTS } from '../schema';
import { focusStageElement } from '../affairs';

const props = defineProps<{ focusName?: string; focusNonce?: number }>();
const inventoryRoot = ref<HTMLElement>();

type ItemTier = 'heaven' | 'earth' | 'mystic' | 'yellow' | 'mortal';

interface ParsedInventoryItem {
  uid: string;
  name: string;
  description: string;
  rankLabel: string;
  count: number;
  tier: ItemTier;
}

const store = useDataStore();
const stoneRates = [...SPIRIT_STONE_GRADES].reverse().map(grade => ({
  grade,
  count: SPIRIT_STONE_WEIGHTS.极品灵石 / SPIRIT_STONE_WEIGHTS[grade],
}));
const stoneRateText = stoneRates.map(rate => `${formatNumber(rate.count)} ${rate.grade}`).join(' = ');

function resolveItemTier(rankRaw: string, isTreasure: boolean): ItemTier {
  const text = rankRaw.trim();
  if (/道器|圣|仙|天|先天|神|帝|至尊|极品/u.test(text)) return 'heaven';
  if (/灵宝|法宝|地|上品|珍/u.test(text)) return 'earth';
  if (/灵器|玄|中品/u.test(text)) return 'mystic';
  if (/法器|黄|下品/u.test(text)) return 'yellow';
  return isTreasure ? 'mystic' : 'mortal';
}

function extractSectionItems(
  record: Record<string, any> | undefined,
  category: 'treasure' | 'ring' | 'misc',
): ParsedInventoryItem[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([key]) => Boolean(key && String(key).trim()))
    .map(([key, raw]) => {
      const name = String(raw?.名称 || key).trim();
      const description = String(raw?.描述 || '暂无描述').trim();
      const rankRaw = String(raw?.品阶 || '凡').trim();
      const count = Math.max(1, Number(raw?.数量 ?? 1) || 1);
      return {
        uid: `${category}:${key}`,
        name,
        description,
        rankLabel: rankRaw || '凡',
        count,
        tier: resolveItemTier(rankRaw, category === 'treasure'),
      };
    });
}

const sections = computed(() => [
  { key: 'treasure', title: '法宝', icon: 'fa-solid fa-gem', items: extractSectionItems(store.本尊.法宝, 'treasure') },
  { key: 'ring', title: '储物戒', icon: 'fa-solid fa-ring', items: extractSectionItems(store.本尊.背包, 'ring') },
  {
    key: 'misc',
    title: '杂物袋',
    icon: 'fa-solid fa-bag-shopping',
    items: extractSectionItems(store.本尊.杂物袋, 'misc'),
  },
]);
watch(
  [() => props.focusName, () => props.focusNonce],
  async () => {
    if (!props.focusName) return;
    await nextTick();
    focusStageElement(
      Array.from(inventoryRoot.value?.querySelectorAll<HTMLElement>('[data-item-name]') ?? []).find(
        element => element.dataset.itemName === props.focusName,
      ),
    );
  },
  { immediate: true, flush: 'post' },
);

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}
</script>

<style lang="scss" scoped>
.inventory-panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
  color: var(--text-primary);
}

.inventory-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-accent);

  i {
    color: var(--gold);
  }
}

.spirit-stone-valuation {
  min-width: 0;
}

.spirit-stone-summary {
  padding: 2px 0;
  border-radius: 5px;
  list-style: none;
  cursor: pointer;

  &::-webkit-details-marker {
    display: none;
  }

  &:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 4px;
  }

  .section-title {
    flex: none;
  }
}

.spirit-stone-tag {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--gold) 28%, transparent);
  border-radius: 6px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--gold) 7%, transparent), transparent);
  color: var(--gold);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  transition: border-color 160ms ease;

  strong {
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
}

.spirit-stone-valuation-label {
  white-space: nowrap;
}

.spirit-stone-chevron {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 160ms ease;
}

.spirit-stone-valuation[open] {
  .spirit-stone-tag {
    border-color: color-mix(in srgb, var(--gold) 55%, transparent);
  }

  .spirit-stone-chevron {
    transform: rotate(180deg);
  }
}

.spirit-stone-conversion {
  margin-top: 10px;
  padding: 10px 13px;
  border: 1px solid color-mix(in srgb, var(--gold) 19%, transparent);
  border-radius: 6px;
  background: linear-gradient(100deg, color-mix(in srgb, var(--gold) 4%, transparent), transparent);
}

.spirit-stone-rate {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 7px;
  margin: 0;
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.7;

  > span:not(.spirit-stone-equals) {
    white-space: nowrap;
  }
}

.spirit-stone-equals {
  color: var(--gold);
}

.spirit-stone-note {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.7;
}

.spirit-stone-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.spirit-stone-balance {
  --stone-color: var(--jade-soft);
  --stone-tint: 8%;
  --stone-rim: 34%;

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 17px;
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--stone-color) var(--stone-rim), transparent);
  border-radius: 7px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--stone-color) var(--stone-tint), transparent), transparent 65%),
    linear-gradient(0deg, color-mix(in srgb, var(--surface-inset) 18%, transparent), transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--stone-color) 13%, transparent);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;

  &::before,
  &::after {
    position: absolute;
    z-index: -1;
    pointer-events: none;
    content: '';
  }

  &::before {
    right: -21px;
    bottom: -39px;
    width: 100px;
    aspect-ratio: 1;
    border: 1px solid color-mix(in srgb, var(--stone-color) 14%, transparent);
    background: linear-gradient(40deg, color-mix(in srgb, var(--stone-color) 3%, transparent), transparent 70%);
    transform: rotate(34deg);
  }

  &::after {
    top: 5px;
    left: 5px;
    width: 8px;
    height: 8px;
    border-top: 1px solid color-mix(in srgb, var(--stone-color) 40%, transparent);
    border-left: 1px solid color-mix(in srgb, var(--stone-color) 40%, transparent);
  }

  &[data-grade='中品灵石'] {
    --stone-color: var(--jade);
  }

  &[data-grade='上品灵石'] {
    --stone-color: color-mix(in srgb, #b39ad8 80%, var(--text-primary));
  }

  &[data-grade='极品灵石'] {
    --stone-color: var(--gold);
  }

  &.is-empty {
    --stone-tint: 3%;
    --stone-rim: 17%;

    box-shadow: none;

    &::before,
    &::after {
      opacity: 0.45;
    }

    .spirit-stone-emblem {
      background: color-mix(in srgb, var(--stone-color) 4%, transparent);
    }

    .spirit-stone-name,
    .spirit-stone-count {
      color: var(--text-secondary);
    }

    .spirit-stone-count {
      text-shadow: none;
    }
  }

  &:focus {
    outline: 2px solid var(--stone-color);
    outline-offset: 3px;
  }
}

.light-theme .spirit-stone-balance[data-grade='上品灵石'] {
  --stone-color: #77558f;
}

.spirit-stone-caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.spirit-stone-emblem {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid color-mix(in srgb, var(--stone-color) 21%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--stone-color) 9%, transparent);
  color: var(--stone-color);

  svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 1.1;
    stroke-linejoin: round;
  }

  .crystal-face {
    fill: currentColor;
    fill-opacity: 0.12;
  }

  .crystal-facets {
    fill: none;
  }
}

.spirit-stone-name {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.spirit-stone-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.spirit-stone-count {
  min-width: 0;
  color: var(--stone-color);
  font-size: 25px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 20px color-mix(in srgb, var(--stone-color) 18%, transparent);
  overflow-wrap: anywhere;
}

.spirit-stone-unit {
  flex: none;
  color: var(--text-secondary);
  font-size: 11px;
}

@media (hover: hover) {
  .spirit-stone-summary:hover .spirit-stone-tag {
    border-color: color-mix(in srgb, var(--gold) 55%, transparent);
  }

  .spirit-stone-balance:not(.is-empty):hover {
    border-color: color-mix(in srgb, var(--stone-color) 58%, transparent);
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--stone-color) 24%, transparent);
  }
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-strip {
  --tier-color: var(--text-secondary);

  padding: 11px 14px;
  border: 1px solid color-mix(in srgb, var(--line-subtle) 55%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--tier-color) 48%, transparent);
  border-radius: 5px;
  background:
    linear-gradient(100deg, color-mix(in srgb, var(--tier-color) 4%, transparent), transparent 44%),
    linear-gradient(90deg, color-mix(in srgb, var(--surface-inset) 24%, transparent), transparent);
  &:focus {
    outline: 1px solid var(--gold);
    outline-offset: 3px;
  }

  &.tier-heaven {
    --tier-color: var(--gold);
  }
  &.tier-earth {
    --tier-color: var(--jade);
  }
  &.tier-mystic {
    --tier-color: var(--semantic-info);
  }
  &.tier-yellow {
    --tier-color: var(--semantic-warning);
  }
  &.tier-mortal {
    --tier-color: var(--text-secondary);
  }
}

.item-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.item-title-group {
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-rank {
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  color: var(--tier-color);
  background: color-mix(in srgb, var(--tier-color) 8%, transparent);
}

.item-count {
  flex: none;
  font-size: 12px;
  color: var(--gold-soft);
  font-variant-numeric: tabular-nums;
}

.item-desc {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.empty-hint {
  padding: 16px 0;
  text-align: center;
  font-size: 12px;
  font-style: italic;
  color: var(--text-secondary);
  opacity: 0.65;
}

@media screen and (max-width: 480px) {
  .spirit-stone-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .spirit-stone-balance {
    gap: 14px;
  }

  .spirit-stone-count {
    font-size: 23px;
  }
  .inventory-panel {
    gap: 18px;
  }

  .item-strip {
    padding: 9px 12px;
  }

  .item-name {
    font-size: 13px;
  }

  .item-desc {
    font-size: 11.5px;
  }
}
</style>
