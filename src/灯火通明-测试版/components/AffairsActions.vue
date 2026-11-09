<template>
  <section v-if="!inline || shouldShowInline" class="affairs-actions" :class="{ inline }" aria-label="此刻可为">
    <header v-if="inline" class="inline-heading">
      <span class="heading-rule"></span><span class="heading-title"><i class="fa-solid fa-compass"></i>接下来</span
      ><span class="heading-note">{{ submitMode === 'direct' ? '点选后直接推演' : '先填入行动栏，改好再发' }}</span
      ><span class="heading-rule"></span>
    </header>
    <header v-else class="section-heading">
      <h2><i class="fa-solid fa-compass"></i>{{ inline ? '接下来' : '此刻可为' }}</h2>
      <span class="count">{{ data.启用行动提示 ? `${affairs.actions.length} 项起念` : '自由起念' }}</span>
    </header>
    <p v-if="!inline" class="submit-mode-note" :class="{ 'is-direct': submitMode === 'direct' }">
      <i class="fa-solid" :class="submitMode === 'direct' ? 'fa-paper-plane' : 'fa-pen-nib'" aria-hidden="true"></i>
      {{ submitMode === 'direct' ? '点选后直接推演' : '点选后先填入行动栏，改好再发' }}
    </p>
    <p v-if="!inline && data.当前处境" class="situation">{{ data.当前处境 }}</p>
    <button
      v-if="!inline && affairs.trackedTask"
      type="button"
      class="tracked-label"
      @click="affairs.navigate('task', affairs.trackedTaskId)"
    >
      <i class="fa-solid fa-bookmark"></i>正在追踪 · {{ affairs.trackedTask.名称
      }}<i class="fa-solid fa-angle-right"></i>
    </button>
    <details v-if="affairs.changes.length" class="turn-changes">
      <summary>
        本回回响 <span>{{ affairs.changes.length }}</span>
      </summary>
      <button
        v-for="change in affairs.changes"
        :key="`${change.kind}:${change.id}`"
        type="button"
        @click="affairs.navigate(change.kind === 'event' ? 'event' : 'task', change.id)"
      >
        <strong>{{ change.title }}</strong
        ><span>{{ change.detail }}</span>
      </button>
    </details>
    <div v-if="data.启用行动提示" class="action-list">
      <article
        v-for="{ action, key, copy } in actionCards"
        :key="key"
        class="action-card"
        :class="`type-${action.类型}`"
      >
        <button
          type="button"
          class="action-choice"
          :disabled="affairs.interactionDisabled"
          @click="affairs.selectAction(action)"
        >
          <span v-if="inline" class="action-icon" aria-hidden="true"
            ><i :class="getActionIcon(action.类型)"></i
          ></span>
          <span class="action-copy"
            ><strong>{{ copy.title }}</strong
            ><span v-if="copy.description">{{ copy.description }}</span
            ><span v-if="copy.event" class="action-event">{{ copy.event }}</span
            ><small v-if="copy.hint">{{ copy.hint }}</small></span
          >
          <span class="action-type">{{ action.类型 }}</span
          ><i
            v-if="inline"
            class="fa-solid"
            :class="submitMode === 'direct' ? 'fa-paper-plane' : 'fa-angle-right'"
            aria-hidden="true"
          ></i>
        </button>
        <div v-if="action.关联任务ID || action.关联事件ID" class="action-sources">
          <button
            v-if="action.关联任务ID && data.任务列表[action.关联任务ID]"
            type="button"
            @click="affairs.navigate('task', action.关联任务ID)"
          >
            任务 · {{ data.任务列表[action.关联任务ID].名称 }}
          </button>
          <button
            v-if="action.关联事件ID && data.世界图志[action.关联事件ID]"
            type="button"
            @click="affairs.navigate('event', action.关联事件ID)"
          >
            世闻 · {{ action.关联事件ID }}
          </button>
        </div>
      </article>
      <p v-if="!affairs.actions.length" class="quiet">眼下暂无紧要动静，不妨四下走走，或自己定个去处。</p>
    </div>
    <div v-if="!inline" class="quick-actions">
      <button
        type="button"
        :disabled="affairs.interactionDisabled"
        @click="affairs.perform('继续', '顺着眼下的话头与局势继续往下走。')"
      >
        <i class="fa-solid fa-forward-step"></i>继续
      </button>
      <button
        type="button"
        :disabled="affairs.interactionDisabled"
        @click="affairs.perform('随机', '顺着眼下境遇，随心走一步看看。')"
      >
        <i class="fa-solid fa-dice"></i>随机
      </button>
      <button type="button" :disabled="affairs.interactionDisabled" @click="pseudo.performAction('自定', '', false)">
        <i class="fa-solid fa-pen-nib"></i>自定起念
      </button>
    </div>
    <details v-if="!inline" class="preferences">
      <summary><i class="fa-solid fa-sliders"></i> 起念偏好</summary>
      <div class="preferences-body">
        <label
          ><input
            type="checkbox"
            :checked="data.启用行动提示"
            :disabled="affairs.interactionDisabled"
            @change="data.toggleActionPrompt"
          />显示行动提示</label
        >
        <label v-if="!pseudo.isDetachedMode"
          ><input
            v-model="inlineActionsEnabled"
            type="checkbox"
            @change="setInlineActionsEnabled(inlineActionsEnabled)"
          />也显示在正文后</label
        >
        <label
          >选择行动后<select
            :value="submitMode"
            @change="setSubmitMode(($event.target as HTMLSelectElement).value as ActionSubmitMode)"
          >
            <option value="confirm">先填入行动栏</option>
            <option value="direct">直接推演</option>
          </select></label
        >
      </div>
    </details>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { getActionCopy, getActionIcon, getActionKey } from '../action-feed';
import { useActionPreferences, type ActionSubmitMode } from '../action-preferences';
import { useDataStore, usePseudoLayerStore } from '../store';
import { useAffairsStore } from '../stores/affairs-store';
defineProps<{ inline?: boolean }>();
const data = useDataStore();
const pseudo = usePseudoLayerStore();
const affairs = useAffairsStore();
const actionCards = computed(() =>
  affairs.actions.map((action, index) => ({
    action,
    key: getActionKey(action, index),
    copy: getActionCopy(action),
  })),
);
const { submitMode, inlineActionsEnabled, setSubmitMode, setInlineActionsEnabled } = useActionPreferences();
const shouldShowInline = computed(
  () =>
    inlineActionsEnabled.value &&
    !pseudo.isDetachedMode &&
    pseudo.isStoryHistoryLatest &&
    !pseudo.isGenerating &&
    (affairs.actions.length > 0 || affairs.changes.length > 0),
);
</script>
<style scoped lang="scss">
.affairs-actions {
  color: var(--text-primary);
  margin-bottom: 28px;
}
.section-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-subtle);
}
h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--text-accent);
  font:
    600 18px 'Noto Serif SC',
    'Songti SC',
    STSong,
    serif;
  letter-spacing: 0.06em;
}
h2 i {
  color: var(--gold);
  font-size: 15px;
}
.count {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 12px;
}
.submit-mode-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.submit-mode-note.is-direct {
  color: var(--gold);
}
.submit-mode-note i {
  font-size: 11px;
}
.preferences {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--line-subtle) 70%, transparent);
  font-size: 12px;
}
summary {
  cursor: pointer;
  color: var(--text-secondary);
}
.preferences > summary {
  color: var(--gold);
}
.preferences-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 10px;
  padding: 13px;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  background: color-mix(in srgb, var(--surface-inset) 55%, transparent);
}
.preferences-body label:last-child {
  grid-column: 1 / -1;
}
label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  line-height: 1.7;
}
input[type='checkbox'] {
  accent-color: var(--gold);
}
select {
  min-width: 0;
  padding: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 3px;
  background: var(--surface-inset);
  color: var(--text-primary);
  font: inherit;
}
.situation {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.85;
}
.tracked-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 13px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--gold);
  font-size: 12px;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
}
.turn-changes {
  margin: 0 0 12px;
  padding: 0;
  background: transparent;
}
.turn-changes summary {
  font-size: 12px;
}
.turn-changes button {
  display: grid;
  gap: 3px;
  width: 100%;
  padding: 8px 0 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
  text-align: left;
  cursor: pointer;
}
.turn-changes strong {
  color: var(--text-primary);
  font-weight: 500;
}
.action-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}
.action-card {
  --choice-color: var(--gold);
  min-width: 0;
  background: transparent;
}
.type-探索 {
  --choice-color: var(--jade);
}
.type-交涉 {
  --choice-color: var(--gold);
}
.type-战斗 {
  --choice-color: var(--semantic-danger);
}
.type-修炼 {
  --choice-color: var(--semantic-info);
}
.type-整备 {
  --choice-color: var(--gold);
}
.type-亲密 {
  --choice-color: var(--semantic-relation);
}
.action-choice {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  padding: 14px 18px;
  border: 1px solid color-mix(in srgb, var(--choice-color) 24%, var(--line-subtle));
  border-radius: 6px;
  background: linear-gradient(110deg, color-mix(in srgb, var(--surface-inset) 65%, transparent), transparent);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    background 180ms ease;
}
.action-choice:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--choice-color) 52%, var(--line-subtle));
  background: color-mix(in srgb, var(--choice-color) 5%, var(--surface-inset));
}
.action-choice:focus-visible {
  outline: 2px solid var(--choice-color);
  outline-offset: 3px;
}
.action-icon {
  display: grid;
  place-items: center;
  width: 26px;
  aspect-ratio: 0.82;
  border: 1px solid color-mix(in srgb, var(--choice-color) 45%, transparent);
  border-radius: 2px;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--choice-color) 5%, transparent);
  background: color-mix(in srgb, var(--choice-color) 5%, transparent);
  color: var(--choice-color);
  font:
    500 16px 'Noto Serif SC',
    'Songti SC',
    STSong,
    serif;
}
.action-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.action-copy strong {
  color: var(--text-primary);
  font:
    600 15px 'Noto Serif SC',
    'Songti SC',
    STSong,
    serif;
  line-height: 1.65;
  letter-spacing: 0.035em;
}
.action-copy > span {
  color: var(--text-secondary);
  font-size: 13px;
}
.action-copy > .action-event {
  color: color-mix(in srgb, var(--choice-color) 65%, var(--text-primary));
}
.action-copy small {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.action-type {
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--choice-color) 23%, transparent);
  border-radius: 2px;
  color: var(--choice-color);
  font-size: 11px;
  line-height: 1.6;
  white-space: nowrap;
}
.action-choice > i {
  color: var(--choice-color);
  font-size: 10px;
}
.action-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  padding: 6px 18px 0;
}
.action-sources button {
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
}
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  margin-top: 14px;
}
.quick-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  cursor: pointer;
}
.quick-actions button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--gold) 40%, var(--line-subtle));
  color: var(--gold);
}
button:focus-visible,
summary:focus-visible,
select:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
.quiet {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.9;
}
.inline {
  width: min(100%, var(--reading-measure));
  margin: 28px auto 8px;
}
.inline-heading {
  display: grid;
  grid-template-columns: minmax(20px, 1fr) auto auto minmax(20px, 1fr);
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.heading-rule {
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--gold) 42%, var(--line-subtle)));
}
.heading-rule:last-child {
  transform: rotate(180deg);
}
.heading-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--gold);
  font:
    600 13px 'Noto Serif SC',
    'Songti SC',
    STSong,
    serif;
  letter-spacing: 0.12em;
}
.heading-note {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
}
.inline .action-list {
  gap: 7px;
}
.inline .action-choice {
  grid-template-columns: 20px minmax(0, 1fr) auto 12px;
  gap: 9px;
  padding: 9px 11px;
  background: transparent;
  border-color: color-mix(in srgb, var(--choice-color) 16%, var(--line-subtle));
}
.inline .action-icon {
  width: 20px;
  aspect-ratio: 1;
  border: 0;
  box-shadow: none;
  background: transparent;
  font-size: 11px;
}
.inline .action-copy {
  gap: 3px;
  line-height: 1.65;
}
.inline .action-copy strong {
  font-size: 13px;
}
.inline .action-copy > span,
.inline .action-copy small {
  font-size: 12px;
}
.inline .action-type {
  font-size: 10px;
}
.inline .action-sources {
  padding-left: 40px;
}
@media (max-width: 760px) {
  .action-choice {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 10px;
    padding: 12px 14px;
  }
  .action-type {
    justify-self: end;
  }
  .action-sources {
    padding-left: 14px;
  }
  .preferences-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .inline .action-choice {
    grid-template-columns: 20px minmax(0, 1fr) 12px;
    padding: 9px;
  }
  .inline .action-choice > i {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
  .inline .action-sources {
    padding-left: 39px;
  }
  .inline-heading {
    grid-template-columns: minmax(16px, 1fr) auto minmax(16px, 1fr);
    gap: 7px;
  }
  .heading-note {
    grid-column: 1 / -1;
    grid-row: 2;
    text-align: center;
  }
}
</style>
