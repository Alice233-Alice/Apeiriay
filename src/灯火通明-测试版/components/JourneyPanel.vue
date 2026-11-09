<template>
  <section class="journey-panel" data-affairs-section="journeys" :data-affairs-id="journeys.currentId" tabindex="-1">
    <header class="journey-heading">
      <div>
        <span class="eyebrow">山河未尽，去处由心</span>
        <h2><i class="fa-solid fa-compass"></i>寻途与行旅</h2>
      </div>
      <button
        type="button"
        class="quiet-button"
        :disabled="journeys.disabled"
        @click="journeys.panelOpen = !journeys.panelOpen"
      >
        <i class="fa-solid fa-feather-pointed"></i>{{ journeys.panelOpen ? '收起寻途' : '寻一段远途' }}
      </button>
    </header>
    <p v-if="!journeys.current && !journeys.panelOpen" class="journey-intro">
      山河还长，挑一段想走的路，也可写下心里的念头。
    </p>
    <p v-if="journeys.error" class="journey-error" role="alert">{{ journeys.error }}</p>

    <div v-if="journeys.panelOpen" class="journey-picker">
      <nav class="picker-tabs" aria-label="寻途方式">
        <button type="button" :aria-pressed="pickerTab === 'free'" @click="pickerTab = 'free'">随心寻途</button>
        <button type="button" :aria-pressed="pickerTab === 'cloud'" @click="pickerTab = 'cloud'">云端故事</button>
      </nav>
      <div v-if="pickerTab === 'free'" class="seeking-surface">
        <label class="field-label"
          >想往何处，想经历什么
          <textarea
            v-model="journeys.preference"
            rows="2"
            maxlength="600"
            :disabled="journeys.seeking"
            placeholder="例如：想去远海走走，或陪某位故人了却一桩旧愿……"
          ></textarea>
        </label>
        <JourneyContextPicker />
        <div class="seeking-controls">
          <label
            >取意<select v-model="journeys.inspiration" :disabled="journeys.seeking">
              <option value="">自由构想</option>
              <option v-for="kind in ['远游', '问道', '立业', '旧愿']" :key="kind" :value="kind">{{ kind }}</option>
            </select></label
          >
          <button v-if="journeys.seeking" type="button" class="quiet-button" @click="journeys.cancel">停止寻途</button>
          <button
            v-else
            type="button"
            class="journey-button"
            :disabled="
              journeys.disabled || journeys.contextLoading || !journeys.contextReady || !journeys.selectedHistory.length
            "
            @click="journeys.seek"
          >
            {{ journeys.proposals.length ? '再寻三条去路' : '看看远方' }}
          </button>
        </div>
        <p v-if="journeys.seeking" class="seeking-note" role="status">
          <i class="fa-solid fa-circle-notch fa-spin"></i>正替你寻三条去路……
        </p>
        <p v-if="journeys.proposalsStale" class="seeking-note">这是先前寻得的去路，眼下已有变化，重新寻一回再挑吧。</p>
        <div v-if="journeys.proposals.length" class="proposal-grid">
          <article v-for="proposal in journeys.proposals" :key="proposal.name" class="proposal">
            <span class="eyebrow">风传一处去路</span>
            <h3>{{ proposal.name }}</h3>
            <p>{{ proposal.lead }}</p>
            <p class="proposal-goal"><span>远望</span>{{ proposal.goal }}</p>
            <p><span class="field-caption">入手</span>{{ proposal.step }}</p>
            <button
              type="button"
              class="journey-button"
              :disabled="journeys.disabled || journeys.proposalsStale"
              @click="journeys.choose(proposal)"
            >
              由此启程<i class="fa-solid fa-angle-right"></i>
            </button>
          </article>
        </div>
      </div>

      <CloudStoriesPanel v-else />
    </div>

    <article v-if="journeys.current" class="current-journey">
      <header class="current-heading">
        <div>
          <span class="eyebrow">{{ journeys.current.篇章 }}</span>
          <h3>{{ journeys.current.名称 }}</h3>
        </div>
        <span class="journey-state">{{ journeys.current.状态 }}</span>
      </header>
      <p class="longing">{{ journeys.current.所求 }}</p>
      <details class="origin">
        <summary>此行缘起</summary>
        <p>{{ journeys.current.缘起 }}</p>
      </details>
      <p v-if="journeys.current.进展" class="journey-progress">
        <span class="journey-field-label">近来所得</span
        ><span class="journey-field-copy">{{ journeys.current.进展 }}</span>
      </p>
      <p v-if="journeys.current.下一步" class="journey-next">
        <span class="journey-field-label">可循去处</span
        ><span class="journey-field-copy">{{ journeys.current.下一步 }}</span>
      </p>
      <div class="journey-links">
        <button
          v-for="id in journeys.current.关联任务.filter(id => data.任务列表[id] || data.rawData?._近期任务结果[id])"
          :key="id"
          type="button"
          @click="affairs.navigate('task', id)"
        >
          任务 · {{ data.任务列表[id]?.名称 || data.rawData?._近期任务结果[id]?.名称 }}
        </button>
        <button
          v-for="id in journeys.current.关联世闻.filter(id => data.世界图志[id])"
          :key="id"
          type="button"
          @click="affairs.navigate('event', id)"
        >
          世闻 · {{ id }}
        </button>
      </div>
      <div class="journey-controls">
        <button
          v-if="journeys.current.状态 !== '已落幕'"
          type="button"
          class="journey-button"
          :disabled="journeys.disabled"
          @click="journeys.resume"
        >
          {{
            journeys.current.状态 === '暂歇' ? '重拾此行' : journeys.current.状态 === '待启程' ? '就此启程' : '循线前行'
          }}
        </button>
        <button
          v-if="journeys.current.状态 === '进行中' || journeys.current.状态 === '待启程'"
          type="button"
          class="quiet-button"
          :disabled="journeys.disabled"
          @click="journeys.pause"
        >
          暂歇此行
        </button>
        <button type="button" class="quiet-button" :disabled="journeys.disabled" @click="journeys.untrack">
          结束追踪
        </button>
      </div>

      <div class="journal">
        <nav class="journal-tabs" aria-label="行旅手札">
          <button
            v-for="tab in ['线索', '纪事', '猜想'] as const"
            :key="tab"
            type="button"
            :aria-pressed="journalTab === tab"
            @click="journalTab = tab"
          >
            {{ tab }}<span>{{ Object.keys(journeys.current[tab]).length }}</span>
          </button>
        </nav>
        <div v-if="journalTab === '线索'" class="journal-entries">
          <article v-for="[id, entry] in Object.entries(journeys.current.线索)" :key="id" class="journal-entry">
            <label class="clue-selector"
              ><input v-model="selectedClues" type="checkbox" :value="id" /><strong>{{ id }}</strong></label
            >
            <p>{{ entry.内容 }}</p>
            <details v-if="entry.依据 || entry.时地">
              <summary>回看依据</summary>
              <p>{{ entry.依据 }}</p>
              <small>{{ entry.时地 }}</small>
            </details>
          </article>
          <p v-if="!Object.keys(journeys.current.线索).length" class="journal-empty">
            沿途看见、问清的事，会记在这里。
          </p>
          <button v-if="selectedClues.length" type="button" class="quiet-button" @click="journalTab = '猜想'">
            带着 {{ selectedClues.length }} 条线索记一笔
          </button>
        </div>
        <div v-else-if="journalTab === '纪事'" class="journal-entries">
          <article
            v-for="[id, entry] in Object.entries(journeys.current.纪事)"
            :key="id"
            class="journal-entry memory-entry"
          >
            <strong>{{ id }}</strong>
            <p>{{ entry.内容 }}</p>
            <small>{{ entry.时地 }}</small>
            <p v-if="entry.依据" class="entry-source">{{ entry.依据 }}</p>
          </article>
          <p v-if="!Object.keys(journeys.current.纪事).length" class="journal-empty">
            重要的抉择、成果与重逢，留在这段行旅里。
          </p>
        </div>
        <div v-else class="journal-entries">
          <form class="guess-form" @submit.prevent="saveGuess">
            <label class="field-label"
              >我的想法<textarea
                v-model="guess"
                maxlength="600"
                rows="2"
                :disabled="journeys.disabled"
                placeholder="记下心头的猜测，待日后寻机印证……"
              ></textarea>
            </label>
            <span v-if="selectedClues.length" class="field-caption">关联：{{ selectedClues.join('、') }}</span>
            <button type="submit" class="quiet-button" :disabled="journeys.disabled || !guess.trim()">记入手札</button>
          </form>
          <article v-for="[id, entry] in Object.entries(journeys.current.猜想)" :key="id" class="journal-entry">
            <span class="guess-state">{{ entry.状态 }}</span>
            <p>{{ entry.内容 }}</p>
            <div v-if="entry.关联线索.length" class="clue-tags">
              <span v-for="clue in entry.关联线索" :key="clue">{{ clue }}</span>
            </div>
            <p v-if="entry.依据" class="entry-source">{{ entry.依据 }}</p>
            <button type="button" class="quiet-button" :disabled="journeys.disabled" @click="journeys.verifyGuess(id)">
              循此核实
            </button>
          </article>
        </div>
      </div>
    </article>
    <details v-if="Object.keys(journeys.archive.旅程).length" class="saved-journeys" :open="!journeys.current">
      <summary>走过与未竟的行旅 · {{ Object.keys(journeys.archive.旅程).length }}</summary>
      <p class="saved-hint">结束追踪会保留记录，可在这里翻看或清理。</p>
      <div v-for="[id, entry] in Object.entries(journeys.archive.旅程).reverse()" :key="id" class="saved-journey">
        <div class="saved-journey-row">
          <span
            ><strong>{{ entry.名称 }}</strong
            ><small>{{ entry.状态 }}</small></span
          >
          <div class="saved-journey-actions">
            <button
              type="button"
              class="quiet-button"
              :disabled="journeys.disabled || id === journeys.currentId"
              @click="journeys.track(id)"
            >
              {{ id === journeys.currentId ? '当前追踪' : '翻开此行' }}
            </button>
            <button
              type="button"
              class="quiet-button clear-record"
              :disabled="journeys.disabled"
              :aria-expanded="cleanupId === id"
              @click="cleanupId = cleanupId === id ? '' : id"
            >
              清理记录
            </button>
          </div>
        </div>
        <div
          v-if="cleanupId === id"
          class="cleanup-confirm"
          role="group"
          aria-label="清理行旅确认"
          @keydown.esc="cleanupId = ''"
        >
          <p>确认清理「{{ entry.名称 }}」？这段行旅、线索、纪事、猜想与剧情构思会从当前存档移除。</p>
          <p>既有正文、任务与世闻继续保留；回看旧楼层仍可见当时的行旅记录。</p>
          <div class="journey-controls">
            <button
              type="button"
              class="quiet-button clear-record"
              :disabled="journeys.disabled"
              @click="clearSavedJourney(id)"
            >
              确认清理
            </button>
            <button type="button" class="quiet-button" :disabled="journeys.saving" @click="cleanupId = ''">
              保留记录
            </button>
          </div>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import CloudStoriesPanel from './CloudStoriesPanel.vue';
import JourneyContextPicker from './JourneyContextPicker.vue';
import { useJourneyStore } from '../stores/journey-store';
import { useAffairsStore } from '../stores/affairs-store';
import { useDataStore } from '../store';
const journeys = useJourneyStore();
const pickerTab = ref<'free' | 'cloud'>('free');
const affairs = useAffairsStore();
const data = useDataStore();
const journalTab = ref<'线索' | '纪事' | '猜想'>('线索');
const selectedClues = ref<string[]>([]);
const guess = ref('');
const cleanupId = ref('');
watch([() => journeys.currentId, () => data.viewedMessageId], () => {
  selectedClues.value = [];
  guess.value = '';
  cleanupId.value = '';
});
const saveGuess = async () => {
  if (await journeys.addGuess(guess.value, selectedClues.value)) {
    guess.value = '';
    selectedClues.value = [];
  }
};
const clearSavedJourney = async (id: string) => {
  if (await journeys.removeJourney(id)) cleanupId.value = '';
};
</script>

<style scoped lang="scss">
.journey-panel {
  margin: 0 0 28px;
  padding: 4px 0 24px;
  border-bottom: 1px solid var(--line-subtle);
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
.journey-heading {
  padding-bottom: 13px;
  border-bottom: 1px solid var(--line-subtle);
}
.journey-picker {
  margin-top: 16px;
}
.picker-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  border-bottom: 1px solid var(--line-subtle);
}
.picker-tabs button {
  padding: 10px 4px;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-family: 'Noto Serif SC', 'Songti SC', STSong, serif;
  cursor: pointer;
}
.picker-tabs button[aria-pressed='true'] {
  color: var(--gold);
  border-bottom-color: var(--gold-soft);
}
.journey-heading,
.current-heading,
.seeking-controls,
.saved-journey-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 7px;
  font:
    600 18px 'Noto Serif SC',
    STSong,
    serif;
}
h2 i,
.eyebrow,
.field-caption,
.journey-field-label {
  color: var(--gold-soft);
}
h3 {
  font:
    600 17px 'Noto Serif SC',
    STSong,
    serif;
  line-height: 1.6;
  letter-spacing: 0.035em;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.12em;
}
.journey-intro,
.journal-empty {
  margin-top: 14px;
  color: var(--text-secondary);
  line-height: 1.9;
  font-size: 13px;
}
button,
select,
textarea {
  font: inherit;
  color: inherit;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.45;
}
.quiet-button,
.journey-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 13px;
  border: 1px solid var(--line-subtle);
  border-radius: 3px;
  background: transparent;
  font-size: 12px;
  line-height: 1.5;
}
.journey-button {
  border-color: color-mix(in srgb, var(--gold) 40%, var(--line-subtle));
  background: color-mix(in srgb, var(--gold) 4%, transparent);
  color: var(--gold);
}
button:hover:not(:disabled) {
  background: var(--button-hover);
}
button:focus-visible,
summary:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
.seeking-surface {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-inset) 65%, transparent);
}
.field-label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text-primary);
  resize: vertical;
  line-height: 1.8;
}
.seeking-controls {
  margin-top: 12px;
  font-size: 12px;
}
.seeking-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
}
select {
  padding: 7px;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  background: var(--surface-raised);
}
.seeking-note,
.journey-error {
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.8;
}
.seeking-note {
  color: var(--text-secondary);
}
.journey-error {
  color: var(--semantic-danger);
}
.proposal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.proposal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--surface-inset) 65%, transparent), transparent);
  overflow-wrap: anywhere;
}
.proposal .eyebrow {
  font-size: 11px;
}
.proposal p {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text-secondary);
}
.proposal .proposal-goal {
  color: var(--text-primary);
}
.proposal-goal span,
.field-caption {
  margin-right: 8px;
  font-size: 12px;
}
.proposal > button {
  margin-top: auto;
}
.current-journey {
  margin-top: 20px;
  padding: 22px 18px;
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--gold) 4%, var(--surface-inset)),
    color-mix(in srgb, var(--surface-inset) 55%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--gold) 20%, var(--line-subtle));
  border-radius: 6px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--gold) 8%, transparent);
}
.current-heading h3 {
  margin-top: 7px;
  color: var(--gold);
  font-size: 21px;
}
.journey-state,
.guess-state {
  font-size: 12px;
  color: var(--gold);
}
.journey-state {
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--gold) 25%, transparent);
  border-radius: 2px;
}
.longing {
  margin-top: 16px;
  line-height: 1.9;
  font-size: 14px;
}
.origin {
  margin-top: 12px;
  padding-left: 12px;
  border-left: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.9;
}
summary {
  cursor: pointer;
}
.origin p {
  margin-top: 7px;
}
.journey-progress,
.journey-next {
  display: grid;
  grid-template-columns: 4em minmax(0, 1fr);
  gap: 12px;
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.9;
}
.journey-field-label {
  font-size: 12px;
  white-space: nowrap;
}
.journey-field-copy {
  min-width: 0;
}
.journey-next {
  padding-left: 12px;
  border-left: 2px solid color-mix(in srgb, var(--gold) 35%, transparent);
}
.journey-progress {
  color: var(--text-secondary);
}
.journey-controls,
.journey-links,
.clue-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.journey-controls {
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line-subtle) 60%, transparent);
}
.journey-links button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 3px 0;
  font-size: 12px;
}
.journal {
  margin-top: 22px;
  border-top: 1px solid var(--line-subtle);
}
.journal-tabs {
  display: flex;
  gap: 22px;
  padding-top: 10px;
}
.journal-tabs button {
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: 'Noto Serif SC', 'Songti SC', STSong, serif;
}
.journal-tabs button[aria-pressed='true'] {
  color: var(--gold);
  border-bottom-color: var(--gold-soft);
}
.journal-tabs button > span {
  margin-left: 7px;
  font-size: 11px;
}
.journal-entry {
  padding: 16px 0;
  border-bottom: 1px solid var(--line-subtle);
  font-size: 13px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.journal-entry p {
  margin-top: 6px;
}
.journal-entry details,
.journal-entry small,
.entry-source {
  color: var(--text-secondary);
  font-size: 12px;
}
.clue-selector {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
}
input[type='checkbox'] {
  accent-color: var(--gold);
}
.guess-form {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.guess-form > button {
  justify-self: start;
}
.clue-tags {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.clue-tags > span {
  border-bottom: 1px dotted var(--line-strong);
}
.journal-entry > button {
  margin-top: 10px;
}
.saved-journeys {
  margin-top: 18px;
  font-size: 12px;
  color: var(--text-secondary);
}
.saved-journeys > summary {
  padding: 8px 0;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', 'Songti SC', STSong, serif;
}
.saved-journey {
  margin-top: 12px;
  padding: 12px;
  border-left: 1px solid var(--line-subtle);
  background: linear-gradient(90deg, color-mix(in srgb, var(--surface-inset) 40%, transparent), transparent);
}
.saved-journey strong {
  color: var(--text-primary);
  font-weight: 500;
  font-family: 'Noto Serif SC', 'Songti SC', STSong, serif;
  font-size: 14px;
}
.saved-journey small {
  margin-left: 10px;
}
.saved-hint {
  margin-top: 12px;
  line-height: 1.8;
}
.saved-journey-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.clear-record {
  color: var(--semantic-danger);
}
.cleanup-confirm {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--semantic-danger) 35%, var(--line-subtle));
  border-radius: 5px;
  background: var(--surface-inset);
  line-height: 1.9;
}
.cleanup-confirm p + p {
  margin-top: 6px;
}
@media (max-width: 850px) {
  .proposal-grid {
    grid-template-columns: 1fr;
  }
}
@media (pointer: coarse) {
  textarea {
    font-size: 16px;
  }
  button,
  select,
  .clue-selector {
    min-height: 44px;
  }
}
@media (max-width: 440px) {
  .current-journey,
  .seeking-surface {
    padding: 16px 12px;
  }
  .journey-heading {
    align-items: flex-start;
  }
}
</style>
