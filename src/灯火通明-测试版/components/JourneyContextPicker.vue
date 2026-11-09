<template>
  <section class="journey-reference" aria-label="寻途剧情参考">
    <p class="reference-counts" aria-live="polite">
      <span v-if="journeys.contextLoading"><i class="fa-solid fa-circle-notch fa-spin"></i>正在读取设定与剧情</span>
      <template v-else-if="journeys.contextReady">
        <span>{{ journeys.worldbooks.length }} 本世界书 · {{ journeys.worldEntryCount }} 条载入设定</span>
        <span
          >已选 {{ journeys.selectedHistory.length }} 楼 · 待发送
          {{ journeys.referenceCharacters.toLocaleString() }} 字符</span
        >
      </template>
      <span v-else>设定与剧情尚待载入</span>
    </p>
    <p v-if="journeys.contextError" class="reference-error" role="alert">{{ journeys.contextError }}</p>
    <details class="reference-details">
      <summary>
        <span><i class="fa-solid fa-book-open"></i>剧情参考</span>
        <span class="reference-mode">{{ journeys.historyMode === 'all' ? '全部历史' : '手动选择' }}</span>
      </summary>
      <p class="reference-hint">红颜人设仅随蓝灯载入，其余设定按开启状态载入。</p>
      <p class="reference-hint">按区间载入，再逐楼取舍。已归档的幕间交谈一并承接，普通隐藏楼层可自行勾选。</p>
      <div class="reference-range">
        <label
          >从第
          <input
            v-model.number="journeys.rangeStart"
            type="number"
            min="0"
            :max="journeys.historyLastMessageId"
            :disabled="journeys.seeking || journeys.contextLoading"
            aria-label="寻途开始楼层"
          />
          楼</label
        >
        <label
          >至第
          <input
            v-model.number="journeys.rangeEnd"
            type="number"
            min="0"
            :max="journeys.historyLastMessageId"
            :disabled="journeys.seeking || journeys.contextLoading"
            aria-label="寻途结束楼层"
          />
          楼</label
        >
        <button type="button" :disabled="journeys.seeking || journeys.contextLoading" @click="applyRange">
          应用区间
        </button>
        <button type="button" :disabled="journeys.seeking || journeys.contextLoading" @click="selectAll">
          全部历史
        </button>
        <button type="button" :disabled="journeys.seeking || journeys.contextLoading" @click="journeys.refreshContext">
          重新读取
        </button>
      </div>
      <p v-if="journeys.contextReady && !journeys.selectedHistory.length" class="reference-hint">
        请至少勾选一条剧情或玩家输入。
      </p>
      <ol class="history-list" aria-label="可载入的历史楼层">
        <li
          v-for="row in pageRows"
          :key="row.id"
          class="history-row"
          :class="{ 'row-selected': journeys.selectedMessageIds.includes(row.id) }"
        >
          <label class="history-selector">
            <input
              type="checkbox"
              :checked="journeys.selectedMessageIds.includes(row.id)"
              :disabled="journeys.seeking"
              :aria-label="`载入第${row.id}楼`"
              @change="journeys.toggleHistoryMessage(row.id)"
            />
            <span>第 {{ row.id }} 楼</span>
            <span class="history-name">{{ row.role === 'user' ? '玩家' : row.name }}</span>
            <small>{{ row.kind }}</small>
            <small v-if="row.hidden">{{ row.kind === '交谈' ? '已归档' : '已隐藏' }}</small>
          </label>
          <details class="history-content">
            <summary>
              {{ row.content.replace(/\s+/gu, ' ').slice(0, 96) }}{{ row.content.length > 96 ? '…' : '' }}
            </summary>
            <p>{{ row.content }}</p>
          </details>
        </li>
      </ol>
      <p v-if="!journeys.historyRows.length && !journeys.contextLoading" class="reference-hint">
        当前没有可载入的剧情楼层。
      </p>
      <nav v-if="pageCount > 1" class="history-pages" aria-label="历史楼层分页">
        <button type="button" :disabled="page === 0" @click="page -= 1">上一页</button>
        <span>第 {{ page + 1 }} / {{ pageCount }} 页</span>
        <button type="button" :disabled="page + 1 >= pageCount" @click="page += 1">下一页</button>
      </nav>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useJourneyStore } from '../stores/journey-store';

const journeys = useJourneyStore();
const page = ref(0);
const pageCount = computed(() => Math.max(1, Math.ceil(journeys.historyRows.length / 20)));
const pageRows = computed(() => journeys.historyRows.slice(page.value * 20, (page.value + 1) * 20));
watch(pageCount, count => {
  page.value = Math.min(page.value, count - 1);
});
const applyRange = () => {
  journeys.applyHistoryRange();
  const index = journeys.historyRows.findIndex(row => row.id >= journeys.rangeStart);
  page.value = index < 0 ? 0 : Math.floor(index / 20);
};
const selectAll = () => {
  journeys.selectAllHistory();
  page.value = 0;
};
onMounted(() => {
  void journeys.refreshContext();
});
</script>

<style scoped lang="scss">
.journey-reference {
  margin-top: 16px;
  padding-top: 13px;
  border-top: 1px solid var(--line-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
p {
  margin: 0;
}
.reference-counts,
.reference-range,
.history-selector,
.history-pages,
.reference-details > summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
}
.reference-counts {
  line-height: 1.8;
}
.reference-counts i {
  margin-right: 6px;
}
.reference-details {
  margin-top: 12px;
}
.reference-details > summary {
  justify-content: space-between;
  padding: 8px 0;
  color: var(--text-primary);
  cursor: pointer;
}
.reference-details > summary i {
  margin-right: 8px;
  color: var(--gold-soft);
}
.reference-mode {
  color: var(--gold-soft);
  font-size: 11px;
}
.reference-hint {
  margin: 8px 0 12px;
  line-height: 1.8;
}
.reference-error {
  margin-top: 8px;
  line-height: 1.8;
  color: var(--semantic-danger, var(--danger));
}
.reference-range {
  margin: 12px 0;
  gap: 8px;
}
.reference-range label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
button,
input {
  color: inherit;
  font: inherit;
}
.reference-range input {
  box-sizing: border-box;
  width: 5.5em;
  padding: 7px 5px;
  border: 1px solid var(--line-subtle);
  border-radius: 3px;
  background: var(--surface);
  color: var(--text-primary);
}
button {
  padding: 7px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}
button:hover:not(:disabled) {
  background: var(--button-hover);
  color: var(--gold);
}
button:disabled,
input:disabled {
  cursor: default;
  opacity: 0.45;
}
button:focus-visible,
input:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
.history-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.history-row {
  padding: 11px 10px;
  border-top: 1px solid var(--line-subtle);
}
.history-row.row-selected {
  background: color-mix(in srgb, var(--gold) 3%, transparent);
}
.history-selector {
  gap: 7px 10px;
  cursor: pointer;
  line-height: 1.8;
}
.history-selector input {
  margin: 0;
  accent-color: var(--gold);
}
.history-name {
  color: var(--text-primary);
}
.history-selector small {
  color: var(--gold-soft);
  font-size: 10px;
}
.history-content {
  margin: 6px 0 0 24px;
  line-height: 1.8;
}
.history-content > summary {
  cursor: pointer;
}
.history-content p {
  margin-top: 10px;
  white-space: pre-wrap;
  color: var(--text-primary);
}
.history-pages {
  justify-content: center;
  margin-top: 14px;
}
@media (max-width: 440px) {
  .reference-counts {
    display: grid;
    gap: 2px;
  }
  .history-row {
    padding: 10px 6px;
  }
  .history-content {
    margin-left: 0;
  }
}
@media (pointer: coarse) {
  button,
  .reference-range input,
  .history-selector,
  .reference-details > summary,
  .history-content > summary {
    min-height: 44px;
  }
  .reference-range input {
    font-size: 16px;
  }
}
</style>
