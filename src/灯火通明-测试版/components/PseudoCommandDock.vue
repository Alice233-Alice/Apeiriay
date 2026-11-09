<template>
  <section class="command-dock" :class="{ expanded: isExpanded, historical: !isWorkspaceLatest }">
    <div v-if="isWorkspaceLatest" class="command-shell">
      <div v-if="pseudo.selectedTitle" class="selected-intent">
        <span class="intent-tag"><i class="fa-solid fa-compass"></i> 起念</span>
        <strong>{{ pseudo.selectedTitle }}</strong>
        <button type="button" title="清除所选行动" :disabled="pseudo.isGenerating" @click="pseudo.clearDraft">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div v-if="pseudo.view.pendingInput" class="pending-input-alert" role="status">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <div class="pending-input-copy">
          <strong> 发现 {{ pseudo.view.pendingInput.count }} 条已发送但未获回复的输入 </strong>
          <span :title="pseudo.view.pendingInput.text">{{ pseudo.view.pendingInput.text }}</span>
        </div>
        <button
          type="button"
          :disabled="pseudo.isGenerating || pseudo.isRecoveringPendingInput || !pseudo.supportsPendingInputRecovery"
          title="撤销原生聊天中的残留楼层，并把最后一条内容放回输入框"
          @click="pseudo.recoverPendingInput"
        >
          <i v-if="pseudo.isRecoveringPendingInput" class="fa-solid fa-circle-notch fa-spin"></i>
          <i v-else class="fa-solid fa-rotate-left"></i>
          <span>撤回到输入框</span>
        </button>
      </div>

      <div class="command-row">
        <div class="interaction-segments" role="group" aria-label="交互模式">
          <button
            type="button"
            class="active"
            :disabled="pseudo.isGenerating || journeys.seeking || journeys.saving"
            title="普通剧情推演"
            @click="chooseStory"
          >
            <i class="fa-solid fa-feather"></i><span>推演</span>
          </button>
          <button
            type="button"
            :class="{ active: pseudo.dialogueDrawerOpen }"
            :disabled="pseudo.isGenerating || journeys.seeking || journeys.saving"
            title="与角色直接交谈"
            @click="chooseDialogue"
          >
            <i class="fa-solid fa-comments"></i><span>交谈</span>
          </button>
        </div>
        <span
          class="connection-dot"
          :class="pseudo.controllerReady ? 'connected' : 'disconnected'"
          :title="connectionLabel"
        >
          <i class="fa-solid" :class="pseudo.controllerReady ? 'fa-link' : 'fa-link-slash'"></i>
        </span>
        <textarea
          ref="textareaRef"
          v-model="pseudo.draftPrompt"
          rows="1"
          :disabled="pseudo.isGenerating || journeys.seeking || journeys.saving"
          :placeholder="
            journeys.seeking
              ? '正替你寻路，稍候片刻……'
              : pseudo.isGenerating
                ? pseudo.generationWaitingText
                : '写下此刻想做的事……'
          "
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown.ctrl.enter.prevent="submitCurrent"
        ></textarea>
        <span v-if="pseudo.isGenerating" class="generation-label">
          <i class="fa-solid fa-circle-notch fa-spin"></i>{{ pseudo.generationLabel }}
        </span>
        <MobilePortraitButton v-if="showDockPortrait" />
        <button
          v-else
          type="button"
          class="native-input-command"
          :title="pseudo.view.nativeInputCollapsed ? '显示酒馆输入区' : '收起酒馆输入区'"
          @click="pseudo.toggleNativeInput"
        >
          <i class="fa-solid" :class="pseudo.view.nativeInputCollapsed ? 'fa-eye' : 'fa-eye-slash'"></i>
        </button>
        <button
          v-if="pseudo.isGenerating"
          type="button"
          class="primary-command stop"
          :title="pseudo.canStop ? '停止生成，保留已收到的正文' : pseudo.generationLabel"
          :disabled="!pseudo.canStop"
          @click="pseudo.stop"
        >
          <i class="fa-solid" :class="pseudo.canStop ? 'fa-stop' : 'fa-circle-notch fa-spin'"></i>
          <span>{{ pseudo.canStop ? '停止' : pseudo.generationState === 'saving' ? '保存中' : '停止中' }}</span>
        </button>
        <button
          v-else
          type="button"
          class="primary-command"
          :title="primaryTitle"
          :disabled="primaryDisabled"
          @click="runPrimaryAction"
        >
          <i class="fa-solid" :class="primaryIcon"></i>
          <span>{{ primaryLabel }}</span>
        </button>
      </div>

      <div v-if="pseudo.generationError" class="command-error">
        <i class="fa-solid fa-triangle-exclamation"></i><span>{{ pseudo.generationError }}</span>
      </div>
    </div>

    <div v-else class="history-command">
      <span><i class="fa-solid fa-clock-rotate-left"></i> 正在阅览旧正文</span>
      <button type="button" @click="pseudo.returnHistoryLatest('story')">
        <i class="fa-solid fa-forward-step"></i> 返回最新正文
      </button>
    </div>

    <DialogueTargetPicker :visible="showTargetPicker" @close="showTargetPicker = false" />
  </section>
</template>

<script setup lang="ts">
import { useDataStore, usePseudoLayerStore, useThemeStore } from '../store';
import type { ReadingMode } from '../stores/theme-store';
import DialogueTargetPicker from './DialogueTargetPicker.vue';
import MobilePortraitButton from './MobilePortraitButton.vue';
import { useJourneyStore } from '../stores/journey-store';

const props = defineProps<{
  activeView: string;
  mobileLayout?: boolean;
  immersive?: boolean;
  readingMode: ReadingMode;
}>();
const emit = defineEmits<{ (event: 'open-view', view: 'story'): void }>();
const pseudo = usePseudoLayerStore();
const data = useDataStore();
const appearance = useThemeStore();
const journeys = useJourneyStore();
const textareaRef = ref<HTMLTextAreaElement>();
const isFocused = ref(false);
const showTargetPicker = ref(false);
const showDockPortrait = computed(
  () =>
    Boolean(props.mobileLayout) &&
    Boolean(props.immersive) &&
    appearance.preferences.showPortraitRail &&
    data.hasGalleryCards,
);
const isWorkspaceLatest = computed(
  () =>
    pseudo.isGenerating ||
    props.readingMode === 'scroll' ||
    pseudo.view.histories.story.total === 0 ||
    pseudo.view.histories.story.isLatest,
);
const isExpanded = computed(
  () =>
    !pseudo.isGenerating &&
    (isFocused.value ||
      pseudo.dialogueDrawerOpen ||
      Boolean(pseudo.draftPrompt.trim() || pseudo.selectedTitle || pseudo.generationError || pseudo.view.pendingInput)),
);
const connectionLabel = computed(() =>
  pseudo.controllerReady ? pseudo.controllerConnectionDescription : '等待控制脚本',
);
const primaryLabel = '推演';
const primaryTitle = '开始推演';

const primaryIcon = 'fa-paper-plane';
const primaryDisabled = computed(
  () =>
    journeys.seeking ||
    journeys.saving ||
    (props.readingMode === 'scroll' ? !pseudo.canSubmitLatestStory : !pseudo.canSubmitStory),
);

const chooseStory = () => {
  if (pseudo.isGenerating) return;
  if (props.readingMode !== 'scroll') emit('open-view', 'story');
};

const chooseDialogue = () => {
  if (pseudo.isGenerating) return;
  showTargetPicker.value = true;
};

const submitCurrent = () => {
  if (primaryDisabled.value) return;
  textareaRef.value?.blur();
  isFocused.value = false;
  pseudo.submit('story', props.readingMode === 'scroll');
};

const runPrimaryAction = submitCurrent;

watch(
  () => pseudo.focusNonce,
  () => nextTick(() => textareaRef.value?.focus()),
);
</script>

<style lang="scss" scoped>
.command-dock {
  flex-shrink: 0;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--line-strong);
  background: var(--footer-bg);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--gold) 7%, transparent);
}

.command-row {
  min-height: 38px;
  display: flex;
  align-items: stretch;
  gap: 7px;
}
.pending-input-alert {
  min-height: 42px;
  margin: 0 37px 7px;
  padding: 7px 9px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--semantic-warning) 48%, var(--line-subtle));
  border-radius: 6px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--semantic-warning) 10%, var(--surface-inset));
}
.pending-input-alert > i {
  flex: none;
  color: var(--semantic-warning);
}
.pending-input-copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 2px;
}
.pending-input-copy strong {
  color: var(--semantic-warning);
  font-size: 11px;
}
.pending-input-copy span {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pending-input-alert button {
  min-height: 28px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  border: 1px solid color-mix(in srgb, var(--semantic-warning) 42%, var(--line-subtle));
  border-radius: 5px;
  color: var(--gold);
  background: var(--button-active);
  font: inherit;
  font-size: 10px;
  cursor: pointer;
}
.pending-input-alert button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.interaction-segments {
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(44px, 1fr));
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  background: var(--surface-inset);
}
.interaction-segments button {
  min-width: 0;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  border-right: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  background: transparent;
  font-size: 10px;
  cursor: pointer;
}
.interaction-segments button:last-child {
  border-right: 0;
}
.interaction-segments button.active {
  color: var(--gold);
  background: var(--button-active);
}
.interaction-segments button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.connection-dot {
  width: 30px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--text-secondary);
}
.connection-dot.connected {
  color: var(--jade);
}
.connection-dot.disconnected {
  color: var(--semantic-danger);
}

textarea {
  min-width: 0;
  height: 38px;
  min-height: 38px;
  flex: 1;
  resize: none;
  padding: 8px 10px;
  overflow-y: auto;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  outline: none;
  color: var(--text-primary);
  background: var(--surface-inset);
  box-shadow: inset 0 1px 8px color-mix(in srgb, var(--stage-shadow) 24%, transparent);
  font: inherit;
  line-height: 1.55;
  transition:
    height 0.18s ease,
    border-color 0.18s ease;

  &:focus {
    border-color: var(--line-strong);
  }
}

.expanded textarea {
  height: 78px;
}
.selected-intent {
  min-height: 28px;
  margin: 0 0 6px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--gold) 32%, var(--line-subtle));
  border-radius: 6px;
  color: var(--text-accent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--gold) 10%, transparent), transparent 45%),
    color-mix(in srgb, var(--surface-inset) 82%, transparent);
  font-size: 11px;
}
.intent-tag {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 14%, transparent);
  font-size: 10px;
  font-weight: 600;
}
.selected-intent strong {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-intent button {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: var(--gold);
    background: var(--button-hover);
  }
}
.dialogue-intent > i {
  color: var(--jade);
}
.dialogue-intent button:hover:not(:disabled) {
  color: var(--gold);
}
.dialogue-intent button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.native-input-command,
.primary-command,
.history-command button {
  min-width: 38px;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}

.primary-command {
  min-width: 82px;
  border-color: var(--line-strong);
  color: var(--gold);
  background: var(--button-active);
}
.primary-command:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.primary-command.stop {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--semantic-danger) 55%, transparent);
  background: color-mix(in srgb, var(--semantic-danger) 36%, var(--surface-inset));
}
.generation-label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--jade);
  font-size: 10px;
  white-space: nowrap;
}
.command-error {
  margin: 7px 37px 0;
  display: flex;
  gap: 7px;
  color: var(--semantic-danger);
  font-size: 11px;
}
.history-command {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
}
.history-command span i {
  margin-right: 6px;
  color: var(--gold-soft);
}
.history-command button {
  padding: 0 12px;
  color: var(--gold);
}

@media screen and (max-width: 600px) {
  .command-dock {
    padding: 7px 8px max(8px, env(safe-area-inset-bottom));
  }
  .command-row {
    min-height: 44px;
    gap: 6px;
  }
  .interaction-segments {
    grid-template-columns: repeat(2, 30px);
  }
  .interaction-segments button {
    padding: 0;
  }
  .interaction-segments button span {
    display: none;
  }
  .connection-dot {
    width: 24px;
  }
  textarea {
    height: 44px;
    min-height: 44px;
    padding: 9px 10px;
    font-size: 16px;
  }
  .native-input-command,
  .primary-command {
    min-width: 44px;
    min-height: 44px;
  }
  .primary-command span,
  .generation-label {
    display: none;
  }
  .selected-intent,
  .pending-input-alert,
  .command-error {
    margin-right: 0;
    margin-left: 31px;
  }
  .pending-input-alert button span {
    display: none;
  }
}

@media screen and (max-width: 420px) {
  .connection-dot {
    display: none;
  }
}
</style>
