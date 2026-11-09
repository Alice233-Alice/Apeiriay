<template>
  <section v-if="!inline || shouldShowInline" class="affairs-actions" :class="{ inline }" aria-label="此刻可为">
    <header v-if="inline" class="inline-heading">
      <span class="heading-rule"></span><span class="heading-title"><i class="fa-solid fa-compass"></i>接下来</span
      ><span class="heading-note">{{ submitMode === 'direct' ? '选择后直接推演' : '选择后填入行动栏' }}</span
      ><span class="heading-rule"></span>
    </header>
    <header v-else class="section-heading">
      <h2><i class="fa-solid fa-compass"></i>{{ inline ? '接下来' : '此刻可为' }}</h2>
      <span class="count">{{ data.启用行动提示 ? `${affairs.actions.length} 项起念` : '自由起念' }}</span>
      <details v-if="!inline" class="preferences">
        <summary><i class="fa-solid fa-sliders"></i> 偏好</summary>
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
            />附于正文末尾</label
          >
          <label
            >选择行动后<select
              :value="submitMode"
              @change="setSubmitMode(($event.target as HTMLSelectElement).value as ActionSubmitMode)"
            >
              <option value="confirm">填入行动栏</option>
              <option value="direct">直接推演</option>
            </select></label
          >
        </div>
      </details>
    </header>
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
        v-for="(action, index) in affairs.actions"
        :key="getActionKey(action, index)"
        class="action-card"
        :class="`type-${action.类型}`"
      >
        <button
          type="button"
          class="action-choice"
          :disabled="affairs.interactionDisabled"
          @click="affairs.selectAction(action)"
        >
          <span class="action-icon"><i :class="getActionIcon(action.类型)"></i></span>
          <span class="action-copy"
            ><strong>{{ action.标题 || action.行动 }}</strong
            ><span v-if="action.标题">{{ action.行动 }}</span
            ><span v-if="action.事件" class="action-event">{{ action.事件 }}</span
            ><small v-if="action.提示">{{ action.提示 }}</small></span
          >
          <span class="action-type">{{ action.类型 }}</span
          ><i class="fa-solid" :class="submitMode === 'direct' ? 'fa-paper-plane' : 'fa-angle-right'"></i>
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
      <p v-if="!affairs.actions.length" class="quiet">眼前尚无明确方向，可继续观察，也可自行起念。</p>
    </div>
    <div v-if="!inline" class="quick-actions">
      <span>{{ submitMode === 'direct' ? '点选后推演' : '点选后填入，可继续修改' }}</span>
      <button type="button" :disabled="affairs.interactionDisabled" @click="affairs.perform('继续', '继续当前剧情。')">
        <i class="fa-solid fa-forward-step"></i>继续
      </button>
      <button
        type="button"
        :disabled="affairs.interactionDisabled"
        @click="affairs.perform('随机', '根据当前处境随机采取一个合理行动。')"
      >
        <i class="fa-solid fa-dice"></i>随机
      </button>
      <button type="button" :disabled="affairs.interactionDisabled" @click="pseudo.performAction('自定', '', false)">
        <i class="fa-solid fa-pen-nib"></i>自定起念
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { getActionIcon, getActionKey } from '../action-feed';
import { useActionPreferences, type ActionSubmitMode } from '../action-preferences';
import { useDataStore, usePseudoLayerStore } from '../store';
import { useAffairsStore } from '../stores/affairs-store';
defineProps<{ inline?: boolean }>();
const data = useDataStore();
const pseudo = usePseudoLayerStore();
const affairs = useAffairsStore();
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
  border-bottom: 1px solid var(--line-subtle);
  padding-bottom: 12px;
  margin-bottom: 14px;
}
h2 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Songti SC', STSong, serif;
}
h2 i {
  color: var(--gold);
  font-size: 16px;
}
.count,
.quick-actions > span {
  color: var(--text-secondary);
  font-size: 12px;
}
.preferences {
  position: relative;
  margin-left: auto;
  font-size: 12px;
}
summary {
  cursor: pointer;
  color: var(--text-secondary);
}
.preferences-body {
  position: absolute;
  z-index: 10;
  right: 0;
  top: 28px;
  width: 230px;
  max-width: calc(100vw - 64px);
  padding: 16px;
  display: grid;
  gap: 14px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: 0 8px 24px var(--stage-shadow);
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
}
select {
  min-width: 0;
  color: var(--text-primary);
  background: var(--surface-inset);
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  padding: 4px;
}
.situation {
  margin: 0 0 12px;
  line-height: 1.8;
  color: var(--text-secondary);
  font-size: 13px;
}
.tracked-label {
  border: 0;
  background: transparent;
  color: var(--gold);
  font-size: 11px;
  padding: 0;
  margin-bottom: 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.turn-changes {
  margin: 0 0 10px;
  padding: 0;
  background: transparent;
}
.turn-changes summary {
  font-size: 11px;
  color: var(--text-secondary);
}
.turn-changes button {
  display: grid;
  gap: 2px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  padding: 7px 0 0;
  cursor: pointer;
  font-size: 11px;
  line-height: 1.6;
}
.turn-changes strong {
  color: var(--text-primary);
  font-weight: 500;
}
.action-list {
  display: grid;
  gap: 7px;
}
.action-card {
  --choice-color: var(--gold);
  background: transparent;
}
.type-探索 {
  --choice-color: var(--jade);
}
.type-交涉 {
  --choice-color: #74aee8;
}
.type-战斗 {
  --choice-color: var(--semantic-danger);
}
.type-修炼 {
  --choice-color: #8dcfd1;
}
.type-整备 {
  --choice-color: var(--gold);
}
.type-亲密 {
  --choice-color: var(--semantic-relation);
}
.action-choice {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto 12px;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 11px;
  text-align: left;
  border: 1px solid color-mix(in srgb, var(--choice-color) 20%, var(--line-subtle));
  border-radius: 9px;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}
.action-choice:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--choice-color) 45%, var(--line-subtle));
  background: color-mix(in srgb, var(--choice-color) 4%, transparent);
}
.action-choice:focus-visible {
  outline: 2px solid var(--choice-color);
  outline-offset: 2px;
}
.action-icon {
  display: grid;
  place-items: center;
  width: 28px;
  aspect-ratio: 1;
  border-radius: 50%;
  color: var(--choice-color);
  background: color-mix(in srgb, var(--choice-color) 14%, transparent);
  font-size: 11px;
}
.action-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
  line-height: 1.52;
  overflow-wrap: anywhere;
}
.action-copy strong {
  font-size: 12px;
  font-weight: 590;
}
.action-copy > span {
  font-size: 10px;
  color: var(--text-secondary);
}
.action-copy > .action-event {
  color: color-mix(in srgb, var(--choice-color) 60%, var(--text-secondary));
}
.action-copy small {
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-secondary);
}
.action-type {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  color: var(--choice-color);
  background: color-mix(in srgb, var(--choice-color) 10%, transparent);
  white-space: nowrap;
}
.action-choice > i {
  color: var(--choice-color);
  font-size: 9px;
}
.action-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 11px 0 50px;
}
.action-sources button {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.quick-actions > span {
  margin-right: auto;
}
.quick-actions button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  color: var(--text-secondary);
  background: transparent;
  padding: 5px 9px;
  font-size: 11px;
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
.quiet {
  font-size: 12px;
  color: var(--text-secondary);
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
  font-family: 'Songti SC', STSong, serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
}
.heading-note {
  font-size: 10px;
  color: var(--text-secondary);
}
@media (max-width: 760px) {
  .action-choice {
    grid-template-columns: 28px minmax(0, 1fr) 12px;
    gap: 8px;
    padding: 9px;
  }
  .action-type {
    grid-column: 2;
    justify-self: start;
  }
  .action-choice > i {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
  .action-sources {
    padding-left: 46px;
  }
  .quick-actions > span {
    width: 100%;
  }
  .inline-heading {
    grid-template-columns: minmax(16px, 1fr) auto minmax(16px, 1fr);
  }
  .heading-note {
    display: none;
  }
}
</style>
