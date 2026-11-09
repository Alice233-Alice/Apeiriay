<template>
  <section v-if="journeys.current" class="journey-trail" aria-label="当前行旅">
    <button type="button" class="trail-heading" @click="affairs.navigate('journey', journeys.currentId)">
      <i class="fa-solid fa-book-open"></i><span>{{ journeys.current.名称 }}</span
      ><small>{{ journeys.current.篇章 }} · {{ journeys.current.状态 }}</small
      ><i class="fa-solid fa-angle-right"></i>
    </button>
    <p v-if="['待启程', '进行中'].includes(journeys.current.状态) && journeys.current.下一步">
      {{ journeys.current.下一步 }}
    </p>
    <p v-else-if="journeys.current.状态 === '暂歇'">此行暂歇，牵挂与所得留在手札中。</p>
    <p v-else-if="journeys.current.状态 === '已落幕'">此行已有归处，沿途所得留在手札中。</p>
  </section>
  <section v-else class="journey-trail" aria-label="主动寻途">
    <button
      type="button"
      class="trail-heading"
      @click="
        journeys.panelOpen = true;
        affairs.navigate('journey', '');
      "
    >
      <i class="fa-solid fa-compass"></i><span>寻一段远途</span><small>看看眼前之外，还有什么值得追寻</small
      ><i class="fa-solid fa-angle-right"></i>
    </button>
  </section>
</template>
<script setup lang="ts">
import { useJourneyStore } from '../stores/journey-store';
import { useAffairsStore } from '../stores/affairs-store';
const journeys = useJourneyStore();
const affairs = useAffairsStore();
</script>
<style scoped lang="scss">
.journey-trail {
  margin: 20px 0;
  padding: 12px 0;
  border-block: 1px solid var(--line-subtle);
}
.trail-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gold);
  font: inherit;
  font-size: 13px;
  text-align: start;
  cursor: pointer;
}
.trail-heading > small {
  color: var(--text-secondary);
  font-size: 12px;
}
.trail-heading > i:last-child {
  margin-left: auto;
}
p {
  margin: 7px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.8;
}
</style>
