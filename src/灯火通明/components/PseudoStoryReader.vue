<template>
  <section class="story-reader" :class="{ streaming: isStoryGenerating }">
    <div v-if="userPrompt" class="turn-context-bar">
      <button
        type="button"
        class="turn-prompt-trigger"
        :aria-expanded="contextPanel === 'prompt'"
        title="查看本回完整起念"
        @click="toggleContext('prompt')"
      >
        <i class="fa-solid fa-feather-pointed"></i>
        <span class="turn-context-label">本回起念</span>
        <span class="turn-prompt-preview">{{ userPromptPreview }}</span>
      </button>
      <button
        v-if="!isStoryGenerating && pseudo.storyFloorUserMessageId >= 0 && storyMessageId >= 0"
        type="button"
        class="turn-prompt-edit"
        title="修改本回输入"
        :disabled="!pseudo.canEditUserMessage || editingInput"
        @click="startInputEdit"
      >
        <i class="fa-solid fa-pen"></i><span>{{ editingInput ? '编辑中' : '修改' }}</span>
      </button>
    </div>

    <InlineInputEditor
      v-if="editingInput && pseudo.storyFloorUserMessageId >= 0 && storyMessageId >= 0"
      :content="userPrompt"
      :user-message-id="pseudo.storyFloorUserMessageId"
      :assistant-message-id="storyMessageId"
      variant="bar"
      @cancel="finishInputEdit"
      @saved="finishInputEdit"
    />

    <button
      v-if="contextPanel === 'prompt'"
      type="button"
      class="context-scrim"
      aria-label="关闭回合脉络"
      @click="contextPanel = null"
    ></button>
    <section v-if="contextPanel === 'prompt'" class="context-popover" role="dialog" :aria-label="contextTitle">
      <header class="context-popover-header">
        <span>
          <i :class="contextIcon"></i>
          {{ contextTitle }}
        </span>
        <button type="button" title="关闭" aria-label="关闭" @click="contextPanel = null">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </header>
      <!-- 酒馆格式化接口已完成与原生楼层相同的 HTML 处理。 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="context-popover-copy" v-html="userPromptHtml"></div>
    </section>

    <div class="story-layout" :class="{ 'with-portrait': showPortrait }">
      <ScenePortraitRail v-if="showPortrait" class="story-portrait" />

      <div class="story-scroll-shell">
        <div
          ref="scrollRef"
          class="story-scroll"
          tabindex="0"
          @scroll="handleStreamScroll"
          @wheel.passive="handleStreamWheel"
          @keydown="handleStreamKeydown"
          @touchstart.passive="handleStoryTouchStart"
          @touchmove.passive="handleStreamTouchMove"
          @touchend.passive="handleStreamTouchEnd"
          @touchcancel.passive="handleStreamTouchEnd"
          @pointerdown.passive="handleStoryPointerDown"
          @pointerup.passive="handleStreamPointerUp"
          @pointercancel.passive="handleStreamPointerUp"
        >
          <div v-if="isStoryGenerating && !pseudo.streamText && !pseudo.liveReasoning" class="story-waiting">
            <i class="fa-solid fa-feather-pointed"></i>
            <span>气机正在汇聚，等待第一缕回响……</span>
          </div>
          <template v-else>
            <section
              v-if="reasoningText && !reasoningUsesOwnDisclosure"
              class="story-inline-context reasoning-inline-context"
            >
              <div class="reasoning-rail">
                <button
                  type="button"
                  class="reasoning-trigger"
                  :aria-expanded="contextPanel === 'reasoning'"
                  title="展开灵台观照"
                  @click="toggleContext('reasoning')"
                >
                  <span class="reasoning-trigger-glyph"><i class="fa-solid fa-fire-flame-curved"></i></span>
                  <span class="reasoning-title">
                    <strong>灵台观照</strong>
                    <small>一念入定 · 照见推演脉络</small>
                  </span>
                  <span class="reasoning-ornament" aria-hidden="true"><i></i><b>◇</b><i></i></span>
                  <span v-if="liveReasoningStreaming" class="reasoning-state">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    观照流转中<span v-if="reasoningTime"> · {{ reasoningTime }}</span>
                  </span>
                  <span v-else class="reasoning-state">观照已成</span>
                  <i class="fa-solid fa-chevron-down context-chevron"></i>
                </button>
              </div>
              <div v-if="contextPanel === 'reasoning'" class="inline-context-detail reasoning-inline-detail">
                <ReasoningDisplay
                  :text="reasoningText"
                  :raw-message="reasoningRawMessage"
                  :message-id="storyMessageId"
                  :streaming="liveReasoningStreaming"
                  :editable="!isStoryGenerating && pseudo.storyFloorReasoningEditable"
                />
              </div>
            </section>

            <section v-else-if="reasoningText" class="inline-preset-reasoning">
              <ReasoningDisplay
                :text="reasoningText"
                :raw-message="reasoningRawMessage"
                :message-id="storyMessageId"
                :open-preset-disclosure="false"
                :streaming="liveReasoningStreaming"
                :editable="!isStoryGenerating && pseudo.storyFloorReasoningEditable"
              />
            </section>

            <!-- eslint-disable-next-line vue/no-v-html -->
            <article v-if="storyHtml" class="story-copy" v-html="storyHtml"></article>
            <GenerationRecoveryPanel
              v-if="!isStoryGenerating && (pseudo.storyFloorNotice || (!storyHtml && !branchChoices.length))"
              :message-id="storyMessageId"
              :raw-message="currentRawMessage"
              :notice="pseudo.storyFloorNotice"
            />
            <BranchChoicePanel v-if="branchChoices.length" :choices="branchChoices" />
            <InlineActionChoices v-if="!isStoryGenerating" :raw-message="currentRawMessage" />

            <section v-if="variableDiagnostics" class="story-inline-context variable-inline-context">
              <button
                type="button"
                class="variable-trigger variable-inline-trigger"
                :class="{ 'has-error': variableDiagnostics.parseError }"
                :aria-expanded="contextPanel === 'variable'"
                title="查看本回变量更新诊断"
                @click="toggleContext('variable')"
              >
                <i class="fa-solid fa-code-branch"></i>
                <span class="variable-label">天道推演</span>
                <span
                  v-if="contextPanel !== 'variable' && variableSummaryPills.length"
                  class="variable-inline-pills"
                >
                  <em v-for="pill in variableSummaryPills" :key="pill" class="variable-inline-pill">{{ pill }}</em>
                </span>
                <span class="variable-count">{{ variableStatusLabel }}</span>
                <i class="fa-solid fa-chevron-down context-chevron"></i>
              </button>
              <VariableDiagnosticsPanel
                v-if="contextPanel === 'variable'"
                class="inline-context-detail variable-inline-detail"
                :diagnostics="variableDiagnostics"
              />
            </section>

            <section v-if="!isStoryGenerating && pseudo.dialogueThreads.length" class="story-interludes">
              <span class="interlude-heading"><i class="fa-solid fa-bookmark"></i> 此回幕间</span>
              <button
                v-for="thread in pseudo.dialogueThreads"
                :key="thread.sessionId"
                type="button"
                @click="pseudo.openDialogueThread(thread)"
              >
                <i
                  class="fa-solid"
                  :class="thread.channel === 'transmission' ? 'fa-feather-pointed' : 'fa-comments'"
                ></i>
                <span>
                  <small>{{ thread.channel === 'transmission' ? '远程传讯' : '当面交谈' }}</small>
                  <strong>与{{ thread.targetName }}交谈 · {{ thread.turnCount }}轮</strong>
                </span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </section>
          </template>
        </div>
        <button
          v-if="isStoryGenerating && !isFollowingStream"
          type="button"
          class="resume-stream-follow"
          title="回到最新生成内容"
          @click="resumeStreamFollow(!appearance.preferences.reduceMotion)"
        >
          <i class="fa-solid fa-arrow-down"></i>
          <span>跟随最新</span>
        </button>
      </div>
    </div>

    <div v-if="isStoryGenerating" class="stream-status">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>{{ generationLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  extractVariableUpdateDiagnostics,
  formatMessageHtml,
  formatNarrativeHtml,
  hasInlineReasoningPresetDisclosure,
  parseMessageContent,
  selectReasoningText,
  stripStructuredBlocks,
  summarizeVariableDiagnostics,
} from '../message-content';
import { useDataStore, usePseudoLayerStore, useThemeStore } from '../store';
import { useStreamFollow } from '../composables/use-stream-follow';
import BranchChoicePanel from './BranchChoicePanel.vue';
import GenerationRecoveryPanel from './GenerationRecoveryPanel.vue';
import InlineActionChoices from './InlineActionChoices.vue';
import InlineInputEditor from './InlineInputEditor.vue';
import ReasoningDisplay from './ReasoningDisplay.vue';
import ScenePortraitRail from './ScenePortraitRail.vue';
import VariableDiagnosticsPanel from './VariableDiagnosticsPanel.vue';

const props = defineProps<{ immersive?: boolean; mobileLayout?: boolean }>();
const pseudo = usePseudoLayerStore();
const data = useDataStore();
const appearance = useThemeStore();
const scrollRef = ref<HTMLElement>();
const {
  isFollowing: isFollowingStream,
  isUserInteracting: isInteractingWithStory,
  handleScroll: handleStreamScroll,
  handleWheel: handleStreamWheel,
  handleKeydown: handleStreamKeydown,
  handleTouchStart: handleStreamTouchStart,
  handleTouchMove: handleStreamTouchMove,
  handleTouchEnd: handleStreamTouchEnd,
  handlePointerDown: handleStreamPointerDown,
  handlePointerUp: handleStreamPointerUp,
  queueFollow: queueStreamFollow,
  resumeFollowing: resumeStreamFollow,
} = useStreamFollow(scrollRef);
type ContextPanel = 'prompt' | 'reasoning' | 'variable';

const contextPanel = ref<ContextPanel | null>(null);
const editingInput = ref(false);
const showPortrait = computed(
  () => !props.immersive && !props.mobileLayout && appearance.preferences.showPortraitRail && data.hasGalleryCards,
);

const storyMessageId = computed(() =>
  pseudo.storyFloorMessageId >= 0 ? pseudo.storyFloorMessageId : pseudo.view.selectedMessageId,
);
const isStoryGenerating = computed(() => pseudo.isGenerating && !pseudo.activeDialogue);
const formatText = (text: string, messageId = storyMessageId.value) => {
  return formatMessageHtml(text, messageId);
};

const displayedStreamText = ref('');
let pendingStreamText = '';
let streamRenderTimer: number | undefined;
let lastStreamRenderAt = 0;

const streamRenderInterval = (length: number) => {
  if (length >= 8000) return 360;
  if (length >= 2000) return 260;
  return 180;
};

const cancelStreamRender = () => {
  if (streamRenderTimer === undefined) return;
  window.clearTimeout(streamRenderTimer);
  streamRenderTimer = undefined;
};

const commitPendingStream = () => {
  streamRenderTimer = undefined;
  if (!isStoryGenerating.value || isInteractingWithStory.value) return;
  if (displayedStreamText.value === pendingStreamText) return;
  displayedStreamText.value = pendingStreamText;
  lastStreamRenderAt = performance.now();
  queueStreamFollow();
};

const scheduleStreamRender = (immediate = false) => {
  if (!isStoryGenerating.value || isInteractingWithStory.value) return;
  if (displayedStreamText.value === pendingStreamText) return;
  if (immediate) {
    cancelStreamRender();
    commitPendingStream();
    return;
  }
  if (streamRenderTimer !== undefined) return;
  const interval = streamRenderInterval(pendingStreamText.length);
  const elapsed = performance.now() - lastStreamRenderAt;
  streamRenderTimer = window.setTimeout(commitPendingStream, Math.max(0, interval - elapsed));
};

const handleStoryTouchStart = (event: TouchEvent) => {
  cancelStreamRender();
  handleStreamTouchStart(event);
};

const handleStoryPointerDown = (event: PointerEvent) => {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') cancelStreamRender();
  handleStreamPointerDown(event);
};

const currentRawMessage = computed(() =>
  isStoryGenerating.value ? displayedStreamText.value : pseudo.storyFloorMessage,
);
const parsedMessage = computed(() => parseMessageContent(currentRawMessage.value));
const storyHtml = computed(() => formatNarrativeHtml(parsedMessage.value.narrative, storyMessageId.value));
const branchChoices = computed(() => parsedMessage.value.choices);
const variableDiagnostics = computed(() => extractVariableUpdateDiagnostics(currentRawMessage.value));
const variableSummaryPills = computed(() => summarizeVariableDiagnostics(variableDiagnostics.value, 3));
const variableStatusLabel = computed(() => {
  const diagnostics = variableDiagnostics.value;
  if (!diagnostics) return '';
  if (!diagnostics.isComplete) return '接收中';
  if (diagnostics.parseError) return '需检错';
  return `${diagnostics.operations.length} 项`;
});
const userPrompt = computed(() =>
  (isStoryGenerating.value ? pseudo.turnUserMessage : pseudo.storyFloorUserMessage).trim(),
);
const userPromptPreview = computed(() =>
  stripStructuredBlocks(userPrompt.value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
);
const userPromptHtml = computed(() => formatText(stripStructuredBlocks(userPrompt.value)));
const inlineStreamReasoning = computed(() =>
  isStoryGenerating.value ? parseMessageContent(displayedStreamText.value).reasoning : null,
);
const liveReasoningStreaming = computed(
  () =>
    isStoryGenerating.value &&
    (pseudo.liveReasoningState === 'thinking' || Boolean(inlineStreamReasoning.value?.isComplete === false)),
);
const reasoningText = computed(() => {
  if (!isStoryGenerating.value) return pseudo.storyFloorReasoning;
  const liveText = selectReasoningText(pseudo.liveReasoning, inlineStreamReasoning.value?.text ?? '');
  return liveText;
});
const reasoningRawMessage = computed(() =>
  isStoryGenerating.value ? displayedStreamText.value : pseudo.storyFloorMessage,
);
const reasoningUsesOwnDisclosure = computed(
  () =>
    appearance.preferences.reasoningAppearance !== 'theme' &&
    hasInlineReasoningPresetDisclosure(reasoningRawMessage.value, storyMessageId.value),
);
const reasoningTime = computed(() => {
  const duration = isStoryGenerating.value ? pseudo.reasoningDuration : pseudo.storyFloorReasoningDuration;
  if (!duration) return '';
  return `${Math.max(1, Math.round(duration / 1000))} 秒`;
});
const contextTitle = computed(() => {
  if (contextPanel.value === 'prompt') return '本回起念';
  if (contextPanel.value === 'variable') return '天道推演';
  return '灵台观照';
});
const contextIcon = computed(() => {
  if (contextPanel.value === 'prompt') return 'fa-solid fa-feather-pointed';
  if (contextPanel.value === 'variable') return 'fa-solid fa-code-branch';
  return 'fa-solid fa-fire-flame-curved';
});

const toggleContext = (panel: ContextPanel) => {
  contextPanel.value = contextPanel.value === panel ? null : panel;
};

const startInputEdit = () => {
  if (pseudo.storyFloorUserMessageId < 0 || storyMessageId.value < 0) return;
  contextPanel.value = null;
  editingInput.value = true;
};
const finishInputEdit = () => {
  editingInput.value = false;
};

const closeContextOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') contextPanel.value = null;
};

const generationLabel = computed(() => pseudo.generationLabel);

watch(
  () => pseudo.liveReasoning,
  () => {
    if (isStoryGenerating.value) queueStreamFollow();
  },
);

watch(
  () => pseudo.streamText,
  text => {
    pendingStreamText = text;
    if (isStoryGenerating.value) scheduleStreamRender(!displayedStreamText.value);
  },
);

watch(isInteractingWithStory, interacting => {
  if (interacting) {
    cancelStreamRender();
    return;
  }
  scheduleStreamRender(true);
});

watch(
  () => pseudo.generationState,
  (next, previous) => {
    if (previous === 'idle' && next !== 'idle') {
      pendingStreamText = '';
      displayedStreamText.value = '';
      lastStreamRenderAt = 0;
      if (contextPanel.value === 'reasoning') contextPanel.value = null;
      if (next === 'preparing' || next === 'generating') resumeStreamFollow(false);
    }
    if (next === 'idle') {
      cancelStreamRender();
      pendingStreamText = '';
      displayedStreamText.value = '';
    }
  },
);

watch(
  () => pseudo.view.selectedMessageId,
  () => {
    contextPanel.value = null;
    editingInput.value = false;
  },
);
watch(reasoningUsesOwnDisclosure, usesOwnDisclosure => {
  if (usesOwnDisclosure && contextPanel.value === 'reasoning') contextPanel.value = null;
});

onMounted(() => window.addEventListener('keydown', closeContextOnEscape));
onBeforeUnmount(() => {
  cancelStreamRender();
  window.removeEventListener('keydown', closeContextOnEscape);
});

defineExpose({ scrollElement: scrollRef });
</script>

<style lang="scss" scoped>
.story-reader {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  background: var(--reading-surface);
  box-shadow: inset 0 0 70px color-mix(in srgb, var(--stage-shadow) 18%, transparent);
}

.story-reader::before,
.story-reader::after {
  content: '';
  position: absolute;
  z-index: 0;
  pointer-events: none;
}
.story-reader::before {
  inset: 0;
  background: var(--reading-material);
  opacity: 0.9;
}
.story-reader::after {
  top: 18px;
  bottom: 18px;
  left: 14px;
  width: 1px;
  background: linear-gradient(transparent, var(--line-strong) 18%, var(--line-subtle) 82%, transparent);
  opacity: 0.46;
}
.story-reader > * {
  position: relative;
  z-index: 1;
}

.turn-context-bar {
  flex-shrink: 0;
  min-width: 0;
  min-height: 36px;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  border-bottom: 1px solid var(--line-subtle);
  background: color-mix(in srgb, var(--surface-inset) 68%, transparent);
}

.reasoning-rail {
  width: 100%;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.story-inline-context,
.inline-preset-reasoning {
  width: min(100%, var(--reading-measure));
  min-width: 0;
  margin-inline: auto;
}

.reasoning-inline-context,
.inline-preset-reasoning {
  margin-bottom: clamp(24px, 4vh, 42px);
}

.inline-context-detail {
  margin-top: 12px;
}

.reasoning-inline-detail {
  min-width: 0;
}

.variable-inline-context {
  margin-top: clamp(28px, 5vh, 52px);
  padding-top: 14px;
  border-top: 1px solid var(--line-subtle);
}

.variable-inline-trigger {
  min-height: 34px !important;
  padding: 4px 12px !important;
  flex-wrap: wrap;
  border: 1px solid var(--line-subtle) !important;
  border-radius: 999px !important;
  background: color-mix(in srgb, var(--surface-inset) 82%, transparent) !important;
}

.variable-inline-pills {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.variable-inline-pill {
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--jade) 34%, var(--line-subtle));
  border-radius: 999px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 10%, var(--surface-inset));
  font-size: 10px;
  font-style: normal;
  font-weight: 550;
  white-space: nowrap;
}

.variable-inline-trigger:hover,
.variable-inline-trigger[aria-expanded='true'] {
  border-color: var(--line-strong) !important;
  background: var(--button-active) !important;
}

.variable-inline-detail {
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-inset) 78%, transparent);
}

.turn-prompt-trigger,
.reasoning-trigger,
.variable-trigger {
  min-width: 0;
  min-height: 36px;
  border: 0;
  border-radius: 0;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.turn-prompt-trigger {
  flex: 1;
  padding: 7px 14px 7px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}

.turn-prompt-edit {
  min-width: 70px;
  padding: 0 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 0;
  border-left: 1px solid var(--line-subtle);
  color: var(--gold-soft);
  background: transparent;
  font-size: 10px;
  cursor: pointer;
}

.turn-prompt-edit:hover:not(:disabled) {
  color: var(--gold);
  background: var(--button-hover);
}

.turn-prompt-edit:disabled {
  opacity: 0.34;
  cursor: not-allowed;
}

.turn-prompt-trigger > i {
  flex: none;
  color: var(--jade);
}
.turn-context-label {
  flex: none;
  color: var(--text-accent);
}
.turn-prompt-preview {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reasoning-trigger,
.variable-trigger {
  flex: none;
  padding: 7px 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-left: 1px solid var(--line-subtle);
}

.reasoning-trigger {
  position: relative;
  width: min(100%, 1120px);
  min-height: 48px;
  padding: 5px 13px 5px 5px;
  gap: 11px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--jade) 42%, var(--line-subtle));
  border-radius: 8px;
  background:
    radial-gradient(circle at 4% 50%, color-mix(in srgb, var(--jade) 16%, transparent), transparent 20%),
    repeating-linear-gradient(90deg, transparent 0 52px, color-mix(in srgb, var(--jade) 3%, transparent) 53px 54px),
    linear-gradient(110deg, color-mix(in srgb, var(--surface-raised) 94%, transparent), var(--surface-inset));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 7%, transparent),
    inset 0 -14px 30px color-mix(in srgb, var(--stage-shadow) 10%, transparent),
    0 7px 22px color-mix(in srgb, var(--stage-shadow) 28%, transparent);
  isolation: isolate;
}
.reasoning-trigger::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 3px;
  border: 1px solid color-mix(in srgb, var(--gold) 12%, transparent);
  border-radius: 5px;
  background: linear-gradient(
    105deg,
    transparent 18%,
    color-mix(in srgb, var(--gold) 8%, transparent),
    transparent 72%
  );
  opacity: 0.72;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.reasoning-trigger::after {
  content: '✦';
  position: absolute;
  right: 54px;
  bottom: -8px;
  color: color-mix(in srgb, var(--gold) 18%, transparent);
  font-size: 25px;
  line-height: 1;
  transform: rotate(22deg);
  pointer-events: none;
}
.reasoning-trigger-glyph {
  position: relative;
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 50%, transparent);
  border-radius: 50%;
  color: var(--jade);
  background: color-mix(in srgb, var(--surface-inset) 76%, transparent);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--jade) 5%, transparent),
    0 0 16px color-mix(in srgb, var(--jade) 13%, transparent);
}
.reasoning-trigger-glyph::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px dashed color-mix(in srgb, var(--jade) 22%, transparent);
  border-radius: 50%;
}
.reasoning-title {
  min-width: 116px;
  display: grid;
  gap: 1px;
  text-align: left;
}
.reasoning-title strong {
  color: var(--text-accent);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.14em;
}
.reasoning-title small {
  color: color-mix(in srgb, var(--text-secondary) 82%, transparent);
  font-size: 8px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.reasoning-ornament {
  min-width: 40px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--gold) 50%, transparent);
}
.reasoning-ornament i {
  height: 1px;
  flex: 1;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--jade) 34%, transparent),
    color-mix(in srgb, var(--gold) 42%, transparent)
  );
}
.reasoning-ornament i:last-child {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--gold) 42%, transparent),
    color-mix(in srgb, var(--jade) 34%, transparent),
    transparent
  );
}
.reasoning-ornament b {
  font-size: 9px;
  font-weight: 400;
}
.variable-trigger > i:first-child {
  color: var(--gold);
}
.variable-count {
  color: var(--gold-soft);
  font-size: 10px;
  white-space: nowrap;
}
.variable-trigger.has-error > i:first-child,
.variable-trigger.has-error .variable-count {
  color: var(--semantic-danger);
}
.turn-prompt-trigger:hover,
.reasoning-trigger:hover,
.variable-trigger:hover,
.turn-prompt-trigger[aria-expanded='true'],
.reasoning-trigger[aria-expanded='true'],
.variable-trigger[aria-expanded='true'] {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--button-hover) 74%, transparent);
}
.reasoning-trigger:hover::before,
.reasoning-trigger[aria-expanded='true']::before {
  opacity: 1;
}
.reasoning-trigger[aria-expanded='true'] {
  border-color: color-mix(in srgb, var(--gold) 52%, var(--line-strong));
  background:
    radial-gradient(circle at 16% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 46%),
    linear-gradient(110deg, color-mix(in srgb, var(--button-active) 84%, transparent), var(--surface-inset));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 10%, transparent),
    0 0 18px color-mix(in srgb, var(--accent-glow) 34%, transparent);
}
.reasoning-trigger[aria-expanded='true'] .reasoning-trigger-glyph {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 52%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent-glow) 42%, transparent);
}

.context-chevron {
  color: var(--text-secondary) !important;
  font-size: 9px;
  transition: transform 0.18s ease;
}
.reasoning-trigger[aria-expanded='true'] .context-chevron,
.variable-trigger[aria-expanded='true'] .context-chevron {
  transform: rotate(180deg);
}

.context-scrim {
  position: absolute !important;
  z-index: 4 !important;
  inset: 36px 0 0;
  width: 100%;
  border: 0;
  background: color-mix(in srgb, var(--stage-shadow) 28%, transparent);
  cursor: default;
}

.context-popover {
  position: absolute !important;
  z-index: 5 !important;
  top: 46px;
  left: clamp(12px, 3vw, 36px);
  right: clamp(12px, 3vw, 36px);
  max-height: min(46vh, 360px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
  box-shadow:
    0 18px 54px var(--stage-shadow),
    inset 0 0 0 1px var(--line-subtle);
}

.context-popover-header {
  min-height: 40px;
  flex: none;
  padding: 0 10px 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--line-subtle);
  color: var(--text-accent);
  font-size: 12px;
}
.context-popover-header > span:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}
.context-popover-header > span:first-child i {
  color: var(--jade);
}
.context-popover-time {
  margin-left: auto;
  color: var(--gold-soft);
  font-size: 10px;
}
.context-popover-header button {
  width: 30px;
  height: 30px;
  margin-left: auto;
  border: 0;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.context-popover-time + button {
  margin-left: 0;
}
.context-popover-header button:hover {
  color: var(--text-primary);
}

.context-popover-copy {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  touch-action: pan-y pinch-zoom;
  -webkit-overflow-scrolling: touch;
  padding: 16px 18px 18px;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: 13px;
  line-height: 1.85;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}
.context-popover-copy :deep(p) {
  margin: 0 0 0.9em;
}
.context-popover-copy :deep(p:last-child) {
  margin-bottom: 0;
}

.variable-popover {
  max-height: min(64vh, 520px);
}
.variable-diagnostics {
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.variable-analysis {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-subtle);
  border-left: 2px solid var(--gold);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
}
.variable-analysis h3 {
  margin: 0 0 9px;
  color: var(--gold-soft);
  font-size: 11px;
  font-weight: 600;
}
.analysis-segments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.analysis-segments span {
  padding: 4px 8px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
  font-size: 11px;
  line-height: 1.45;
}

.variable-overview {
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}
.variable-overview > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-accent);
}
.variable-overview > span:first-child i {
  color: var(--jade);
}
.variable-overview strong {
  color: var(--gold-soft);
  font-weight: 600;
}
.diagnostic-state {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.diagnostic-state.valid {
  color: var(--semantic-success);
}
.diagnostic-state.receiving {
  color: var(--jade);
}
.diagnostic-state.invalid {
  color: var(--semantic-danger);
}

.variable-operation-list {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
  list-style: none;
}
.variable-operation {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line-subtle);
  background: color-mix(in srgb, var(--surface-inset) 58%, transparent);
}
.operation-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.operation-index {
  width: 20px;
  height: 20px;
  flex: none;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 9px;
}
.operation-kind {
  min-width: 34px;
  flex: none;
  color: var(--gold-soft);
  font-size: 10px;
  text-align: center;
}
.operation-kind.op-delta {
  color: var(--jade);
}
.operation-kind.op-remove {
  color: var(--semantic-danger);
}
.operation-kind.op-insert,
.operation-kind.op-add {
  color: var(--semantic-success);
}
.operation-heading code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-family: 'Microsoft YaHei UI', system-ui, sans-serif;
  font-size: 11px;
}
.variable-operation pre,
.raw-patch pre {
  margin: 8px 0 0 28px;
  padding: 8px 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-left: 1px solid var(--line-strong);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
  font:
    11px/1.6 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}
.operation-from,
.operation-empty {
  margin: 7px 0 0 28px;
  color: var(--text-secondary);
  font-size: 10px;
}
.variable-empty {
  padding: 22px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 11px;
}
.diagnostic-error {
  margin-top: 10px;
  padding: 9px 11px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--semantic-danger) 55%, var(--line-subtle));
  color: var(--semantic-danger);
  background: color-mix(in srgb, var(--semantic-danger) 8%, transparent);
  font-size: 11px;
}
.raw-patch {
  margin-top: 10px;
  border-top: 1px solid var(--line-subtle);
}
.raw-patch summary {
  padding: 10px 2px 0;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
}
.raw-patch pre {
  margin-left: 0;
  max-height: 220px;
}

.reasoning-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--jade);
  font-size: 9px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.story-layout {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-areas: 'copy';
  grid-template-columns: minmax(0, 1fr);

  &.with-portrait {
    grid-template-areas: 'copy portrait';
    grid-template-columns: minmax(0, 1fr) clamp(260px, 23vw, 360px);
  }
}

.story-scroll-shell {
  grid-area: copy;
  position: relative;
  min-width: 0;
  min-height: 0;
}

.story-scroll {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: clamp(24px, 4vh, 46px) clamp(24px, 5vw, 72px) 48px;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.resume-stream-follow {
  position: absolute;
  right: 18px;
  bottom: 14px;
  z-index: 2;
  min-height: 32px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  color: var(--text-accent);
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
  box-shadow: 0 10px 28px var(--stage-shadow);
  cursor: pointer;
}
.resume-stream-follow:hover {
  color: var(--gold);
  background: var(--button-hover);
}

.story-portrait {
  grid-area: portrait;
}

.story-copy {
  max-width: var(--reading-measure);
  margin: 0 auto;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: var(--reading-font-size);
  line-height: var(--reading-line-height);
  text-align: justify;
  text-wrap: pretty;

  :deep(p) {
    margin: 0 0 1.2em;
  }
  text-shadow: 0 1px 1px color-mix(in srgb, var(--stage-shadow) 16%, transparent);

  :deep(q) {
    color: var(--text-accent);
    quotes: none;
  }
  :deep(q::before),
  :deep(q::after) {
    content: none;
  }
  :deep(blockquote) {
    margin: 20px 0;
    padding: 4px 0 4px 16px;
    border-left: 2px solid var(--gold);
    color: var(--text-accent);
    background: transparent;
  }
  :deep(em) {
    color: var(--gold-soft);
  }
}

.story-waiting,
.story-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
}

.story-interludes {
  width: min(100%, 820px);
  margin: 24px auto 8px;
  display: grid;
  gap: 7px;
}
.interlude-heading {
  padding: 0 3px 3px;
  color: var(--gold-soft);
  font-size: 9px;
  letter-spacing: 0.12em;
}
.story-interludes button {
  width: 100%;
  min-height: 48px;
  padding: 7px 11px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--jade) 25%, var(--line-subtle));
  border-radius: 6px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 5%, var(--surface-inset));
  text-align: left;
  cursor: pointer;
}
.story-interludes button:hover {
  border-color: var(--line-strong);
  color: var(--gold);
  background: var(--button-hover);
}
.story-interludes button span {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.story-interludes button small {
  color: var(--text-secondary);
  font-size: 8px;
}
.story-interludes button strong {
  overflow: hidden;
  color: var(--text-accent);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-waiting i {
  color: var(--gold);
}

.stream-status {
  min-height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-top: 1px solid var(--line-subtle);
  color: var(--jade);
  background: color-mix(in srgb, var(--surface-inset) 82%, transparent);
  font-size: 11px;
}

@media screen and (max-width: 760px) {
  .story-copy {
    font-size: max(var(--reading-font-size), 17px);
    text-align: left;
  }

  .story-scroll {
    padding: 22px 16px 42px;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }

  .turn-context-bar {
    min-height: 40px;
  }
  .reasoning-rail {
    padding: 0;
  }
  .turn-prompt-trigger,
  .reasoning-trigger,
  .variable-trigger {
    min-height: 40px;
    font-size: 12px;
  }
  .resume-stream-follow {
    right: 10px;
    bottom: 10px;
  }
  .turn-prompt-trigger {
    padding-inline: 10px;
    gap: 6px;
  }
  .turn-prompt-edit {
    min-width: 40px;
    padding: 0 10px;
  }
  .turn-prompt-edit span {
    display: none;
  }
  .reasoning-trigger {
    min-height: 44px;
    padding: 4px 9px 4px 4px;
    gap: 8px;
    border-radius: 7px;
  }
  .variable-trigger {
    padding-inline: 9px;
  }
  .variable-inline-detail {
    padding: 10px;
  }
  .variable-label {
    display: none;
  }
  .reasoning-trigger-glyph {
    width: 32px;
    height: 32px;
  }
  .reasoning-title {
    min-width: 90px;
  }
  .reasoning-title strong {
    font-size: 11px;
  }
  .reasoning-title small,
  .reasoning-ornament {
    display: none;
  }
  .context-popover {
    top: 42px;
    left: 8px;
    right: 8px;
    max-height: min(56vh, 420px);
  }
  .context-popover-copy {
    padding: 14px;
    font-size: 12px;
  }
  .variable-popover {
    max-height: min(66vh, 520px);
  }
  .variable-diagnostics {
    padding: 10px;
  }
  .analysis-segments {
    gap: 5px;
  }
  .analysis-segments span {
    padding: 3px 6px;
    font-size: 10px;
  }
  .operation-heading {
    align-items: flex-start;
  }
  .variable-operation pre,
  .operation-from,
  .operation-empty {
    margin-left: 0;
  }
}
</style>
