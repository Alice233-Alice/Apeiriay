<template>
  <section
    class="dialogue-stage"
    :class="{ historical: pseudo.dialogueReadOnly, transmitting: context?.channel === 'transmission' }"
    :style="portraitAtmosphereStyle"
  >
    <header class="dialogue-header">
      <div class="speaker-heading">
        <span class="channel-mark" :class="{ portrait: Boolean(portraitUrl) }">
          <img v-if="portraitUrl" :src="portraitUrl" :alt="context?.targetName || ''" />
          <i
            v-else
            class="fa-solid"
            :class="context?.channel === 'transmission' ? 'fa-feather-pointed' : 'fa-comments'"
          ></i>
        </span>
        <span class="speaker-copy">
          <small>{{ dialogueKicker }}</small>
          <span class="speaker-name-line">
            <strong>{{ context?.targetName || '尚未择定' }}</strong>
            <span v-if="favorValue !== null" class="speaker-favor-pill" :title="`好感度 ${favorValue}`">
              <i class="fa-solid fa-heart"></i> {{ favorValue }}
            </span>
            <em v-if="relationLabel" class="speaker-mood-pill">{{ relationLabel }}</em>
          </span>
        </span>
      </div>

      <div v-if="!pseudo.dialogueReadOnly" class="dialogue-actions">
        <button type="button" title="更换交谈对象" :disabled="pseudo.isGenerating" @click="showPicker = true">
          <i class="fa-solid fa-user-group"></i><span>换人</span>
        </button>
        <button
          v-if="!pseudo.isDialogueActive && context"
          type="button"
          class="continue-button"
          :disabled="pseudo.isGenerating"
          @click="pseudo.continueDialogue"
        >
          <i class="fa-solid fa-comment-dots"></i><span>继续交谈</span>
        </button>
        <button
          v-if="context && pseudo.dialogueTurns.length > 0"
          type="button"
          class="reset-button"
          title="保留玩家发言，重新生成角色回应"
          :disabled="pseudo.isGenerating"
          @click="rerollLatest"
        >
          <i class="fa-solid fa-rotate"></i><span>重答</span>
        </button>
        <button
          v-if="context && pseudo.dialogueTurns.length > 0"
          type="button"
          class="end-button"
          title="删除最新一轮"
          :disabled="pseudo.isGenerating || pseudo.isDeleting"
          @click="deleteLatest"
        >
          <i class="fa-solid fa-trash-can"></i><span>删轮</span>
        </button>
      </div>
      <span v-else class="history-badge"><i class="fa-solid fa-lock"></i> 随正文归档 · 只读</span>
    </header>

    <div class="dialogue-layout" :class="{ 'with-portrait': Boolean(portraitUrl) }">
      <div class="dialogue-scroll-shell">
        <div class="conversation-watermark" aria-hidden="true">
          <span>{{ targetInitial }}</span>
          <i></i>
          <small>{{ context?.channel === 'transmission' ? '鸿雁寄语' : '一席私语' }}</small>
        </div>
        <div
          ref="scrollRef"
          class="dialogue-scroll"
          tabindex="0"
          @scroll="handleStreamScroll"
          @wheel.passive="handleStreamWheel"
          @keydown="handleStreamKeydown"
          @touchstart.passive="handleStreamTouchStart"
          @touchmove.passive="handleStreamTouchMove"
          @touchend.passive="handleStreamTouchEnd"
          @touchcancel.passive="handleStreamTouchEnd"
          @pointerdown.passive="handleStreamPointerDown"
          @pointerup.passive="handleStreamPointerUp"
          @pointercancel.passive="handleStreamPointerUp"
        >
          <div v-if="visibleTurns.length === 0 && !pseudo.isGenerating" class="dialogue-empty">
            <div class="empty-crest" aria-hidden="true">
              <span>{{ targetInitial }}</span>
              <i
                class="fa-solid"
                :class="context?.channel === 'transmission' ? 'fa-feather-pointed' : 'fa-comment-dots'"
              ></i>
            </div>
            <small>{{ context?.channel === 'transmission' ? '尺素越千山' : '灯影照知心' }}</small>
            <strong>{{ context?.targetName ? `与${context.targetName}的交谈尚未开始` : '请选择交谈对象' }}</strong>
            <p>{{ emptyVerse }}</p>
            <span>{{
              !pseudo.dialogueReadOnly ? '点选下方话头，或直接写下想说的话。' : '此历史节点没有可显示的交谈记录。'
            }}</span>
            <div
              v-if="!pseudo.dialogueReadOnly && context"
              class="dialogue-starter-pills"
              role="group"
              aria-label="快捷话头"
            >
              <button
                v-for="starter in dialogueStarterTopics"
                :key="starter.label"
                type="button"
                class="starter-pill"
                @click="pickStarterTopic(starter.prompt)"
              >
                <i :class="starter.icon"></i>
                <span>{{ starter.label }}</span>
              </button>
            </div>
            <button
              v-if="!pseudo.dialogueReadOnly && !context"
              type="button"
              class="choose-speaker-button"
              @click="showPicker = true"
            >
              <i class="fa-solid fa-user-group"></i><span>选择角色</span>
            </button>
          </div>

          <template v-for="turn in visibleTurns" :key="turn.assistantMessageId">
            <article v-if="turn.userText" class="dialogue-turn user-turn">
              <div class="user-bubble-heading">
                <span class="bubble-speaker">你</span>
                <button
                  v-if="turn.userMessageId !== null"
                  type="button"
                  title="修改这轮输入"
                  :disabled="pseudo.dialogueReadOnly || !pseudo.canEditUserMessage || editingInputId !== null"
                  @click="startInputEdit(turn.userMessageId)"
                >
                  <i class="fa-solid fa-pen"></i>
                  <span>{{ editingInputId === turn.userMessageId ? '编辑中' : '修改' }}</span>
                </button>
              </div>
              <InlineInputEditor
                v-if="editingInputId === turn.userMessageId && turn.userMessageId !== null"
                :content="turn.userText"
                :user-message-id="turn.userMessageId"
                :assistant-message-id="turn.assistantMessageId"
                variant="dialogue"
                @cancel="finishInputEdit"
                @saved="finishInputEdit"
              />
              <div v-else class="dialogue-bubble">{{ turn.userText }}</div>
            </article>

            <article class="dialogue-turn character-turn">
              <div class="bubble-heading">
                <span>{{ context?.targetName }}</span>
                <small v-if="turn.tokenCount !== null" class="reply-token-count" title="本层回复 Token">
                  {{ turn.tokenCount }}t
                </small>
                <small v-if="turn.responseDuration !== null" class="reply-response-time" title="AI 回复总耗时">
                  <i class="fa-regular fa-clock"></i>
                  {{ formatDuration(turn.responseDuration) }}
                </small>
                <button
                  v-if="turn.reasoning && !turnUsesOwnDisclosure(turn)"
                  type="button"
                  class="reasoning-mini-trigger"
                  :class="{ active: expandedReasoningId === turn.assistantMessageId }"
                  :aria-expanded="expandedReasoningId === turn.assistantMessageId"
                  :title="expandedReasoningId === turn.assistantMessageId ? '收起灵台观照' : '展开灵台观照'"
                  @click="toggleReasoning(turn.assistantMessageId)"
                >
                  <i class="fa-solid fa-fire-flame-curved"></i>
                  <span>观照</span>
                  <span v-if="turn.reasoningDuration" class="reasoning-mini-time">
                    {{ formatDuration(turn.reasoningDuration) }}
                  </span>
                </button>
              </div>
              <p v-if="turn.reaction" class="dialogue-reaction">{{ turn.reaction }}</p>
              <RenderedMessageHtml
                class="dialogue-bubble formatted"
                :html="formatReply(turn.replyText, turn.assistantMessageId)"
                :message-id="turn.assistantMessageId"
              />
              <span v-if="effectLabel(turn)" class="variable-effect-note">
                <i class="fa-solid fa-heart-pulse"></i>{{ effectLabel(turn) }}
              </span>
              <div v-if="turn.reasoning && turnUsesOwnDisclosure(turn)" class="turn-reasoning">
                <ReasoningDisplay
                  :text="turn.reasoning"
                  :raw-message="turn.rawMessage"
                  :message-id="turn.assistantMessageId"
                  :open-preset-disclosure="false"
                  :editable="turn.reasoningEditable"
                />
              </div>
              <div v-else-if="expandedReasoningId === turn.assistantMessageId" class="turn-reasoning">
                <ReasoningDisplay
                  :text="turn.reasoning"
                  :raw-message="turn.rawMessage"
                  :message-id="turn.assistantMessageId"
                  :editable="turn.reasoningEditable"
                />
              </div>
            </article>
          </template>

          <article v-if="pseudo.isGenerating && pendingUserText" class="dialogue-turn user-turn pending">
            <span class="bubble-speaker">你</span>
            <div class="dialogue-bubble">{{ pendingUserText }}</div>
          </article>

          <article v-if="pseudo.isGenerating" class="dialogue-turn character-turn live-turn">
            <div class="bubble-heading">
              <span>{{ context?.targetName }}</span>
              <span class="live-status"><i class="fa-solid fa-circle-notch fa-spin"></i>{{ liveStatus }}</span>
            </div>
            <p v-if="pseudo.streamReaction" class="dialogue-reaction live">{{ pseudo.streamReaction }}</p>
            <RenderedMessageHtml
              v-if="liveReplyHtml"
              class="dialogue-bubble formatted"
              :html="liveReplyHtml"
              :message-id="pseudo.view.selectedMessageId"
            />
            <div v-else class="dialogue-bubble waiting-dots" aria-label="等待回应"><i></i><i></i><i></i></div>
            <div v-if="liveReasoningText && liveUsesOwnDisclosure" class="turn-reasoning">
              <ReasoningDisplay
                :text="liveReasoningText"
                :raw-message="pseudo.streamText"
                :message-id="pseudo.view.selectedMessageId"
                :open-preset-disclosure="false"
                :streaming="liveReasoningStreaming"
              />
            </div>
            <details v-else-if="liveReasoningText" class="live-reasoning">
              <summary>
                <span class="live-reasoning-glyph"><i class="fa-solid fa-fire-flame-curved"></i></span>
                <strong>灵台观照</strong>
                <small v-if="liveReasoningStreaming">
                  推演中<span v-if="pseudo.reasoningDuration"> · {{ formatDuration(pseudo.reasoningDuration) }}</span>
                </small>
                <small v-else-if="pseudo.reasoningDuration">{{ formatDuration(pseudo.reasoningDuration) }}</small>
                <i class="fa-solid fa-chevron-down"></i>
              </summary>
              <ReasoningDisplay
                :text="liveReasoningText"
                :raw-message="pseudo.streamText"
                :message-id="pseudo.view.selectedMessageId"
                :streaming="liveReasoningStreaming"
              />
            </details>
          </article>
        </div>

        <button
          v-if="pseudo.isGenerating && !isFollowingStream"
          type="button"
          class="resume-stream-follow"
          title="回到最新对话"
          @click="resumeStreamFollow(!appearance.preferences.reduceMotion)"
        >
          <i class="fa-solid fa-arrow-down"></i>
          <span>跟随最新</span>
        </button>
      </div>

      <aside v-if="portraitUrl" class="dialogue-portrait" aria-label="交谈对象立绘">
        <div class="portrait-echo" aria-hidden="true"></div>
        <div class="portrait-frame">
          <img :src="portraitUrl" :alt="context?.targetName || ''" />
          <span class="portrait-channel-mark">
            <i
              class="fa-solid"
              :class="context?.channel === 'transmission' ? 'fa-feather-pointed' : 'fa-location-dot'"
            ></i>
            {{ context?.channel === 'transmission' ? '心象传讯' : '当面相谈' }}
          </span>
        </div>
        <div class="portrait-meta">
          <span class="portrait-identity">
            <small>{{ context?.channel === 'transmission' ? '传讯彼端' : '此刻在场' }}</small>
            <strong>{{ context?.targetName }}</strong>
          </span>
          <dl v-if="relation || emotion">
            <div v-if="relation">
              <dt>关系</dt>
              <dd>{{ relation }}</dd>
            </div>
            <div v-if="emotion">
              <dt>心绪</dt>
              <dd>{{ emotion }}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>

    <div v-if="pseudo.dialogueReadOnly" class="dialogue-readonly-note">
      <i class="fa-solid fa-lock"></i>
      <span>这段交谈挂靠在旧正文下，仅供回看。</span>
    </div>
    <form v-else class="dialogue-composer" @submit.prevent="submitDialogue">
      <div class="composer-field">
        <span class="composer-glyph" aria-hidden="true">
          <i class="fa-solid" :class="context?.channel === 'transmission' ? 'fa-feather-pointed' : 'fa-quote-left'"></i>
        </span>
        <textarea
          ref="inputRef"
          v-model="pseudo.dialogueDraftPrompt"
          rows="2"
          :disabled="pseudo.isGenerating || !context"
          :placeholder="composerPlaceholder"
          @keydown.ctrl.enter.prevent="submitDialogue"
        ></textarea>
        <small>此言只入心境，不推动世界时间 · Ctrl + Enter</small>
      </div>
      <button v-if="pseudo.isGenerating" type="button" class="stop" :disabled="!pseudo.canStop" @click="pseudo.stop">
        <i class="fa-solid" :class="pseudo.canStop ? 'fa-stop' : 'fa-circle-notch fa-spin'"></i>
        <span
          ><strong>{{ pseudo.canStop ? '停止' : pseudo.generationLabel }}</strong
          ><small>收束回应</small></span
        >
      </button>
      <button v-else type="submit" :disabled="!pseudo.canSubmitDialogue">
        <i class="fa-solid" :class="context?.channel === 'transmission' ? 'fa-feather-pointed' : 'fa-paper-plane'"></i>
        <span>
          <strong>{{ context?.channel === 'transmission' ? '传讯' : '交谈' }}</strong>
          <small>{{ context?.channel === 'transmission' ? '寄出尺素' : '送出此言' }}</small>
        </span>
      </button>
    </form>
    <div v-if="pseudo.generationError" class="dialogue-error">
      <i class="fa-solid fa-triangle-exclamation"></i>{{ pseudo.generationError }}
    </div>

    <DialogueTargetPicker :visible="showPicker" @close="showPicker = false" />
  </section>
</template>

<script setup lang="ts">
import { getCharacterImageCandidates } from '../character-assets';
import { useStreamFollow } from '../composables/use-stream-follow';
import {
  formatMessageHtml,
  hasInlineReasoningPresetDisclosure,
  parseMessageContent,
  selectReasoningText,
} from '../message-content';
import { useDataStore, usePseudoLayerStore, useThemeStore } from '../store';
import type { DialogueTurn } from '../store';
import { extractGalleryCardsFromContent, type GalleryCard } from '../stores/gallery-cards';
import DialogueTargetPicker from './DialogueTargetPicker.vue';
import InlineInputEditor from './InlineInputEditor.vue';
import ReasoningDisplay from './ReasoningDisplay.vue';
import RenderedMessageHtml from './RenderedMessageHtml.vue';

const pseudo = usePseudoLayerStore();
const data = useDataStore();
const appearance = useThemeStore();
const scrollRef = ref<HTMLElement>();
const {
  isFollowing: isFollowingStream,
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
const expandedReasoningId = ref<number | null>(null);
const showPicker = ref(false);
const editingInputId = ref<number | null>(null);
const inputRef = ref<HTMLTextAreaElement>();

const context = computed(() => pseudo.dialogueContext);
const companion = computed(() => {
  const canonicalName = context.value?.canonicalName;
  return canonicalName ? (data.红颜 as Record<string, any>)[canonicalName] : undefined;
});
const relation = computed(() => String(companion.value?.关系 ?? '').trim());
const emotion = computed(() => String(companion.value?.关系上下文?.当前情绪 ?? '').trim());
const favorValue = computed<number | null>(() => {
  const raw = companion.value?.好感度;
  const num = Number(raw);
  return Number.isFinite(num) ? Math.round(num) : null;
});
const relationLabel = computed(() => [relation.value, emotion.value].filter(Boolean).join(' · '));
const dialogueStarterTopics = computed(() => {
  const name = context.value?.targetName || '对方';
  const location = String(data.本尊?.行踪?.当前区域 || '此地').trim();
  const isTransmission = context.value?.channel === 'transmission';
  return [
    {
      label: '询问近况',
      icon: 'fa-solid fa-feather-pointed',
      prompt: isTransmission
        ? `传音问候${name}，随口问问她近来在哪儿落脚，修行与心绪如何。`
        : `看向${name}，随口问问她近日修行与心绪如何。`,
    },
    {
      label: '商议眼下处境',
      icon: 'fa-solid fa-compass',
      prompt: `和${name}聊聊眼下在「${location}」的局面，听听她怎么看。`,
    },
    {
      label: '闲话家常',
      icon: 'fa-solid fa-mug-hot',
      prompt: isTransmission
        ? `借着传音，与${name}闲聊几句近日见闻，也说说彼此还记着的旧事。`
        : `暂时放下手头诸事，与${name}闲坐片刻，聊聊近日见闻与旧事。`,
    },
  ];
});
const pickStarterTopic = (prompt: string) => {
  pseudo.dialogueDraftPrompt = prompt;
  nextTick(() => inputRef.value?.focus());
};
const dialogueKicker = computed(() => {
  if (pseudo.dialogueReadOnly) return '旧正文 · 幕间回响';
  if (!pseudo.isDialogueActive) return '最近交谈';
  return context.value?.channel === 'transmission' ? '传讯往来' : '此刻相谈';
});

const turnGalleryCards = computed<GalleryCard[]>(() => {
  const value = context.value;
  if (!value) return [];
  const portraitTurns = pseudo.isRerolling ? pseudo.dialogueTurns.slice(0, -1) : pseudo.dialogueTurns;
  const latestTurn = portraitTurns[portraitTurns.length - 1];
  if (!latestTurn) return [];
  const config = (data.红颜角色库 as Record<string, any>)[value.canonicalName]?.自定义立绘 ?? {};
  const override = {
    front: String(config.正面 ?? '').trim(),
    back: String(config.背面 ?? '').trim(),
  };
  const rawCards = extractGalleryCardsFromContent(latestTurn.rawMessage, {
    [value.targetName]: override,
    [value.canonicalName]: override,
  });
  if (rawCards.length > 0) return rawCards;
  const fallbackCard = latestTurn.visualCard ?? { name: value.targetName, img_code: 'normal', back_text: '' };
  return extractGalleryCardsFromContent(
    `<visual_cards>${JSON.stringify([{ ...fallbackCard, name: value.targetName }])}</visual_cards>`,
    { [value.targetName]: override, [value.canonicalName]: override },
  );
});

const portraitUrl = computed(() => {
  const value = context.value;
  if (!value) return '';
  const dialogueCard = turnGalleryCards.value[0];
  if (dialogueCard) {
    if (dialogueCard.backName === value.targetName) return dialogueCard.back;
    return dialogueCard.front;
  }
  const currentCard = data.galleryCards.find(card => {
    const canonical = card.name === '虞汐' || card.name === '虞颜' ? '虞汐颜' : card.name;
    return canonical === value.canonicalName;
  });
  if (currentCard) {
    if (currentCard.frontName === value.targetName) return currentCard.front;
    if (currentCard.backName === value.targetName) return currentCard.back;
    return currentCard.front;
  }
  const custom = (data.红颜角色库 as Record<string, any>)[value.canonicalName]?.自定义立绘?.正面;
  return (
    String(custom ?? '').trim() ||
    String(getCharacterImageCandidates(value.targetName, 'front', value.targetName)[0] ?? '')
  );
});
const targetInitial = computed(() => context.value?.targetName.trim().slice(0, 1) || '语');
const emptyVerse = computed(() =>
  context.value?.channel === 'transmission' ? '山海有距，尺素可抵心间。' : '正文暂歇，此刻只听彼此。',
);
const portraitAtmosphereStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {};
  if (!portraitUrl.value) return style;
  const safeUrl = portraitUrl.value.replace(/(["\\])/g, '\\$1');
  style['--dialogue-portrait-image'] = `url("${safeUrl}")`;
  return style;
});

const visibleTurns = computed<DialogueTurn[]>(() => {
  const sessionId = context.value?.sessionId;
  if (!sessionId) return [];
  return pseudo.isRerolling ? pseudo.dialogueTurns.slice(0, -1) : pseudo.dialogueTurns;
});
const pendingUserText = computed(() => pseudo.generationUserMessage.trim() || pseudo.dialogueDraftPrompt.trim());
const composerPlaceholder = computed(() => {
  if (!context.value) return '先选择一位交谈对象……';
  return context.value.channel === 'transmission'
    ? `向${context.value.targetName}传讯……`
    : `对${context.value.targetName}说……`;
});
const liveReplyHtml = computed(() => formatMessageHtml(pseudo.streamText, pseudo.view.selectedMessageId));
const liveInlineReasoning = computed(() =>
  pseudo.isGenerating ? parseMessageContent(pseudo.streamText).reasoning : null,
);
const liveReasoningText = computed(() =>
  selectReasoningText(pseudo.liveReasoning, liveInlineReasoning.value?.text ?? ''),
);
const liveReasoningStreaming = computed(
  () =>
    pseudo.isGenerating &&
    (pseudo.liveReasoningState === 'thinking' || Boolean(liveInlineReasoning.value?.isComplete === false)),
);
const liveStatus = computed(() => pseudo.generationLabel);

const formatReply = (text: string, messageId: number) => formatMessageHtml(text, messageId);
const formatDuration = (duration: number) => `${Math.max(1, Math.round(duration / 1000))} 秒`;
const messageUsesOwnDisclosure = (rawMessage: string, messageId: number) =>
  appearance.preferences.reasoningAppearance !== 'theme' && hasInlineReasoningPresetDisclosure(rawMessage, messageId);
const turnUsesOwnDisclosure = (turn: DialogueTurn) =>
  messageUsesOwnDisclosure(turn.rawMessage, turn.assistantMessageId);
const liveUsesOwnDisclosure = computed(() =>
  messageUsesOwnDisclosure(pseudo.streamText, pseudo.view.selectedMessageId),
);
const toggleReasoning = (messageId: number) => {
  expandedReasoningId.value = expandedReasoningId.value === messageId ? null : messageId;
};
const startInputEdit = (userMessageId: number) => {
  if (!pseudo.canEditUserMessage || editingInputId.value !== null) return;
  pseudo.clearEditError();
  editingInputId.value = userMessageId;
};
const finishInputEdit = () => {
  editingInputId.value = null;
};
const effectLabel = (turn: DialogueTurn) => {
  const effects = turn.variableEffects;
  if (!effects) return '';
  const labels: string[] = [];
  if (effects.favor || effects.relationship || effects.relationContext) labels.push('心境已更新');
  if (effects.chronicle) labels.push('羁绊已记');
  return labels.join(' · ');
};
const submitDialogue = () => pseudo.submit('dialogue', true);
const rerollLatest = () => {
  const turn = pseudo.dialogueTurns[pseudo.dialogueTurns.length - 1];
  if (turn) pseudo.reroll(turn.assistantMessageId);
};
const deleteLatest = () => {
  const turn = pseudo.dialogueTurns[pseudo.dialogueTurns.length - 1];
  if (!turn || !window.confirm('删除最新一轮交谈并回退到上一轮心境快照？')) return;
  pseudo.deleteCurrent(turn.assistantMessageId);
};

watch(
  [() => pseudo.streamText, () => pseudo.streamReaction, () => pseudo.liveReasoning, () => pseudo.dialogueTurns.length],
  queueStreamFollow,
);
watch(
  turnGalleryCards,
  cards => {
    if (cards.length > 0) data.showTransientGalleryCards(cards);
    else data.parseCurrentMessageCards(pseudo.view.selectedMessageId);
  },
  { immediate: true },
);
watch(
  () => context.value?.sessionId,
  () => resumeStreamFollow(false),
);
onBeforeUnmount(() => data.parseCurrentMessageCards(pseudo.view.selectedMessageId));
watch(
  () => pseudo.generationState,
  (next, previous) => {
    if (previous === 'idle' && next !== 'idle') resumeStreamFollow(false);
    if (next === 'idle') nextTick(() => inputRef.value?.focus());
  },
);
watch(
  () => pseudo.dialogueFocusNonce,
  () => nextTick(() => inputRef.value?.focus()),
);
watch(
  () => pseudo.view.selectedMessageId,
  () => {
    expandedReasoningId.value = null;
    editingInputId.value = null;
    resumeStreamFollow(false);
  },
);
</script>

<style lang="scss" scoped>
.dialogue-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  background:
    radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--jade) 7%, transparent), transparent 30%),
    var(--reading-surface), var(--stage-canvas);
  isolation: isolate;
}
.dialogue-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--reading-material);
  opacity: 0.64;
  pointer-events: none;
}
.dialogue-stage::after {
  content: '';
  position: absolute;
  z-index: 0;
  inset: 0;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--stage-canvas) 96%, transparent) 0 46%, transparent 78%),
    var(--dialogue-portrait-image) right center / 50% 100% no-repeat;
  filter: blur(18px) saturate(0.7);
  opacity: 0.075;
  transform: scale(1.05);
  pointer-events: none;
}
.dialogue-stage > * {
  position: relative;
  z-index: 1;
}

.dialogue-composer {
  flex: none;
  min-height: 92px;
  padding: 11px 14px 13px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 94px;
  gap: 10px;
  border-top: 1px solid color-mix(in srgb, var(--gold) 26%, var(--line-strong));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--gold) 4%, transparent), transparent 30%),
    linear-gradient(var(--surface-inset), var(--surface-inset)), var(--stage-canvas);
  box-shadow: 0 -14px 38px color-mix(in srgb, var(--stage-shadow) 28%, transparent);
}
.composer-field {
  position: relative;
  min-width: 0;
  display: grid;
}
.composer-glyph {
  position: absolute;
  z-index: 2;
  top: 12px;
  left: 14px;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  color: var(--jade);
  font-size: 10px;
  pointer-events: none;
}
.dialogue-composer textarea {
  width: 100%;
  min-height: 66px;
  max-height: 132px;
  resize: vertical;
  padding: 10px 12px 24px 43px;
  border: 1px solid color-mix(in srgb, var(--jade) 20%, var(--line-subtle));
  border-radius: 9px;
  outline: 0;
  color: var(--text-primary);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 4%, transparent), transparent 32%),
    linear-gradient(var(--surface-raised), var(--surface-raised)), var(--stage-canvas);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 4%, transparent),
    inset 0 12px 30px color-mix(in srgb, var(--stage-shadow) 12%, transparent);
  font: inherit;
  line-height: 1.55;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}
.dialogue-composer textarea:focus {
  border-color: color-mix(in srgb, var(--jade) 54%, var(--line-strong));
  background: color-mix(in srgb, var(--surface-raised) 95%, transparent);
  box-shadow:
    0 0 0 2px var(--focus-ring),
    0 0 24px color-mix(in srgb, var(--accent-glow) 10%, transparent);
}
.composer-field > small {
  position: absolute;
  right: 11px;
  bottom: 6px;
  color: color-mix(in srgb, var(--text-secondary) 76%, transparent);
  font-size: 8px;
  letter-spacing: 0.03em;
  pointer-events: none;
}
.dialogue-composer button {
  min-width: 0;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--gold) 48%, var(--line-strong));
  border-radius: 9px;
  color: var(--gold);
  background:
    radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--gold) 13%, transparent), transparent 56%),
    var(--button-active);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 7%, transparent),
    0 8px 22px color-mix(in srgb, var(--stage-shadow) 32%, transparent);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    filter 0.18s ease;
}
.dialogue-composer button > i {
  font-size: 14px;
}
.dialogue-composer button > span {
  display: grid;
  gap: 2px;
  text-align: left;
}
.dialogue-composer button strong {
  font-family: 'Songti SC', STSong, serif;
  font-size: 13px;
  letter-spacing: 0.08em;
}
.dialogue-composer button small {
  color: var(--text-secondary);
  font-size: 8px;
  white-space: nowrap;
}
.dialogue-composer button:hover:not(:disabled) {
  border-color: var(--gold);
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.dialogue-composer button.stop {
  color: var(--semantic-danger);
  border-color: color-mix(in srgb, var(--semantic-danger) 45%, var(--line-strong));
}
.dialogue-composer button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
  filter: saturate(0.4);
}
.dialogue-readonly-note,
.dialogue-error {
  min-height: 38px;
  flex: none;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-top: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  background: var(--surface-inset);
  font-size: 10px;
}
.dialogue-error {
  min-height: 30px;
  color: var(--semantic-danger);
}
.variable-effect-note {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--jade);
  font-size: 9px;
}

.choose-speaker-button {
  min-height: 34px;
  margin-top: 8px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  color: var(--gold);
  background: var(--button-bg);
  cursor: pointer;
}
.choose-speaker-button:hover {
  background: var(--button-hover);
}

.dialogue-header {
  min-height: 68px;
  flex: none;
  padding: 10px 58px 9px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--gold) 24%, var(--line-subtle));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 8%, transparent), transparent 38%),
    linear-gradient(var(--surface-inset), var(--surface-inset)), var(--stage-canvas);
  box-shadow: 0 9px 30px color-mix(in srgb, var(--stage-shadow) 20%, transparent);
  backdrop-filter: blur(14px);
}
.speaker-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
}
.channel-mark {
  width: 42px;
  height: 42px;
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--jade) 36%, var(--line-subtle));
  border-radius: 9px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 8%, var(--surface-inset));
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--surface-inset) 74%, transparent),
    0 7px 20px color-mix(in srgb, var(--stage-shadow) 36%, transparent);
  transform: rotate(-2deg);
}
.channel-mark img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 18%;
}
.transmitting .channel-mark {
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 8%, var(--surface-inset));
}
.speaker-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}
.speaker-copy small {
  color: var(--gold-soft);
  font-size: 9px;
  letter-spacing: 0.12em;
}
.speaker-name-line {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}
.speaker-name-line strong {
  overflow: hidden;
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 18px;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.speaker-favor-pill {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--semantic-relation) 36%, var(--line-subtle));
  border-radius: 999px;
  color: var(--semantic-relation);
  background: color-mix(in srgb, var(--semantic-relation) 10%, var(--surface-inset));
  font-size: 10px;
  font-weight: 600;
}
.speaker-name-line em.speaker-mood-pill {
  max-width: min(280px, 24vw);
  padding: 2px 8px;
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 76%, transparent);
  font-size: 10px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-badge {
  flex: none;
  padding: 3px 7px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 9px;
}
.dialogue-actions {
  display: flex;
  gap: 5px;
}
.dialogue-actions button,
.history-resume-button {
  min-height: 31px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--line-subtle);
  border-radius: 7px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
  cursor: pointer;
}
.dialogue-actions button:hover:not(:disabled),
.history-resume-button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--gold);
}
.dialogue-actions button:disabled,
.history-resume-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dialogue-actions .continue-button {
  color: var(--jade);
}
.dialogue-actions .end-button {
  color: var(--gold-soft);
}
.history-resume-button {
  flex: none;
  color: var(--jade);
}

.dialogue-layout {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
}
.dialogue-layout.with-portrait {
  grid-template-columns: minmax(360px, 1fr) clamp(250px, 35%, 320px);
}
.dialogue-scroll-shell {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(90deg, transparent 0 98%, color-mix(in srgb, var(--gold) 8%, transparent)),
    radial-gradient(circle at 32% 42%, color-mix(in srgb, var(--jade) 5%, transparent), transparent 48%),
    var(--reading-surface), var(--stage-canvas);
}
.conversation-watermark {
  position: absolute;
  z-index: 0;
  top: 22px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--gold-soft);
  opacity: 0.3;
  pointer-events: none;
}
.conversation-watermark > span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  font-family: 'Songti SC', STSong, serif;
  font-size: 11px;
  transform: rotate(45deg);
}
.conversation-watermark > span::first-letter {
  transform: rotate(-45deg);
}
.conversation-watermark > i {
  width: 34px;
  height: 1px;
  background: linear-gradient(90deg, currentColor, transparent);
}
.conversation-watermark > small {
  font-family: 'Songti SC', STSong, serif;
  font-size: 8px;
  letter-spacing: 0.24em;
}
.dialogue-scroll {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: clamp(62px, 7%, 78px) clamp(22px, 6%, 52px) 48px;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}
.resume-stream-follow {
  position: absolute;
  right: 16px;
  bottom: 12px;
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
.dialogue-empty {
  height: 100%;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-secondary);
  text-align: center;
}
.empty-crest {
  position: relative;
  width: 74px;
  height: 74px;
  margin-bottom: 10px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 42%, var(--line-subtle));
  border-radius: 50%;
  color: var(--text-accent);
  background:
    radial-gradient(circle, color-mix(in srgb, var(--jade) 12%, transparent), transparent 68%),
    color-mix(in srgb, var(--surface-inset) 64%, transparent);
  box-shadow:
    0 0 0 7px color-mix(in srgb, var(--jade) 3%, transparent),
    0 0 34px color-mix(in srgb, var(--accent-glow) 16%, transparent);
}
.empty-crest::before,
.empty-crest::after {
  content: '';
  position: absolute;
  width: 7px;
  height: 7px;
  border: 1px solid var(--gold-soft);
  background: var(--surface-inset);
  transform: rotate(45deg);
}
.empty-crest::before {
  top: -4px;
}
.empty-crest::after {
  bottom: -4px;
}
.empty-crest span {
  font-family: 'Songti SC', STSong, serif;
  font-size: 27px;
  opacity: 0.72;
}
.empty-crest i {
  position: absolute;
  right: -4px;
  bottom: 4px;
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--jade);
  background: var(--surface-raised);
  font-size: 10px;
}
.dialogue-empty > small {
  color: var(--gold-soft);
  font-size: 9px;
  letter-spacing: 0.24em;
}
.dialogue-empty strong {
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.08em;
}
.dialogue-empty p {
  margin: 3px 0 4px;
  color: color-mix(in srgb, var(--jade) 68%, var(--text-secondary));
  font-family: 'Noto Serif SC', 'Songti SC', STSong, serif;
  font-size: 11px;
  font-style: italic;
  letter-spacing: 0.05em;
}
.dialogue-empty span {
  font-size: 10px;
}

.dialogue-starter-pills {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.starter-pill {
  min-height: 30px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--jade) 36%, var(--line-subtle));
  border-radius: 999px;
  color: var(--text-accent);
  background: color-mix(in srgb, var(--surface-inset) 84%, transparent);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.18s ease;

  i {
    color: var(--jade);
    font-size: 10px;
  }

  &:hover {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--button-active);
    transform: translateY(-1px);

    i {
      color: var(--gold);
    }
  }
}

.dialogue-turn {
  width: min(88%, 680px);
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
}
.user-turn {
  margin-left: auto;
  align-items: flex-end;
}
.character-turn {
  margin-right: auto;
  align-items: flex-start;
}
.bubble-speaker,
.bubble-heading {
  margin-bottom: 7px;
  color: var(--text-secondary);
  font-size: 9px;
  letter-spacing: 0.08em;
}
.user-bubble-heading {
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}
.user-bubble-heading .bubble-speaker {
  margin-bottom: 0;
}
.user-bubble-heading button {
  min-height: 21px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--gold) 24%, var(--line-subtle));
  border-radius: 999px;
  color: var(--gold-soft);
  background: color-mix(in srgb, var(--gold) 6%, var(--surface-inset));
  font-size: 9px;
  cursor: pointer;
}
.user-bubble-heading button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--gold) 48%, var(--line-strong));
  color: var(--gold);
  background: var(--button-hover);
}
.user-bubble-heading button:disabled {
  opacity: 0.34;
  cursor: not-allowed;
}
.bubble-heading {
  width: 100%;
  min-height: 21px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.bubble-heading > span:first-child {
  padding: 2px 8px;
  border-left: 2px solid var(--jade);
  color: var(--text-accent);
  font-family: 'Songti SC', STSong, serif;
  font-size: 11px;
}
.reply-token-count,
.reply-response-time {
  color: var(--text-secondary);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 9px;
}

.reply-response-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: inherit;
}
.bubble-heading button {
  min-height: 21px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 70%, transparent);
  font-size: 9px;
  cursor: pointer;
}
.bubble-heading button:hover {
  color: var(--jade);
}
.bubble-heading button.reasoning-mini-trigger {
  min-height: 25px;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--jade) 28%, var(--line-subtle));
  border-radius: 999px;
  color: var(--jade);
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--jade) 13%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-inset) 82%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 4%, transparent);
}
.bubble-heading button.reasoning-mini-trigger:hover,
.bubble-heading button.reasoning-mini-trigger.active {
  border-color: color-mix(in srgb, var(--gold) 46%, var(--line-strong));
  color: var(--gold);
  background: color-mix(in srgb, var(--button-active) 82%, var(--surface-inset));
  box-shadow: 0 0 13px color-mix(in srgb, var(--accent-glow) 24%, transparent);
}
.reasoning-mini-time {
  padding-left: 5px;
  border-left: 1px solid color-mix(in srgb, var(--gold) 22%, transparent);
  color: var(--gold-soft);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}
.dialogue-bubble {
  position: relative;
  padding: 13px 16px;
  border: 1px solid var(--line-subtle);
  border-radius: 4px 14px 14px 14px;
  color: var(--text-primary);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--jade) 5%, transparent), transparent 45%),
    linear-gradient(var(--surface-raised), var(--surface-raised)), var(--stage-canvas);
  box-shadow:
    0 10px 28px color-mix(in srgb, var(--stage-shadow) 22%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--jade) 3%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: var(--reading-font-size);
  line-height: min(var(--reading-line-height), 2);
}
.user-turn .dialogue-bubble {
  border-color: color-mix(in srgb, var(--gold) 28%, var(--line-subtle));
  border-radius: 14px 4px 14px 14px;
  background:
    linear-gradient(225deg, color-mix(in srgb, var(--gold) 10%, transparent), transparent 48%),
    linear-gradient(
      color-mix(in srgb, var(--gold) 7%, var(--surface-inset)),
      color-mix(in srgb, var(--gold) 7%, var(--surface-inset))
    ),
    var(--stage-canvas);
}
.character-turn .dialogue-bubble {
  border-color: color-mix(in srgb, var(--jade) 30%, var(--line-subtle));
}
.dialogue-reaction {
  max-width: 92%;
  margin: 0 0 7px 3px;
  padding: 6px 10px;
  border-left: 2px solid color-mix(in srgb, var(--jade) 48%, var(--line-subtle));
  border-radius: 0 7px 7px 0;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--jade) 4%, transparent);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: 11px;
  font-style: italic;
  line-height: 1.65;
}
.dialogue-reaction.live {
  color: color-mix(in srgb, var(--jade) 72%, var(--text-secondary));
}
.formatted :deep(p) {
  margin: 0 0 0.72em;
}
.formatted :deep(p:last-child) {
  margin-bottom: 0;
}
.formatted :deep(q) {
  quotes: none;
}
.formatted :deep(q::before),
.formatted :deep(q::after) {
  content: none;
}
.turn-reasoning,
.live-reasoning {
  width: 100%;
  margin-top: 6px;
  padding: 9px 11px;
  border-left: 2px solid var(--jade);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
  font-size: 11px;
  line-height: 1.7;
}

/* Preset cards provide their own surface; keep the dialogue shell from
 * creating a second dark frame around them. */
.turn-reasoning:has(.reasoning-presentation:is([data-presentation='preset'], [data-presentation='theme'])) {
  padding: 0;
  border-left: 0;
  color: inherit;
  background: transparent;
}

.live-reasoning:has(.reasoning-presentation[data-presentation='theme']) {
  padding: 0;
  border-left: 0;
  background: transparent;
}
.live-reasoning summary {
  min-height: 34px;
  padding: 4px 9px 4px 4px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--jade) 30%, var(--line-subtle));
  border-radius: 999px;
  color: var(--text-accent);
  background:
    radial-gradient(circle at 16% 0%, color-mix(in srgb, var(--jade) 14%, transparent), transparent 46%),
    linear-gradient(110deg, color-mix(in srgb, var(--surface-raised) 90%, transparent), var(--surface-inset));
  cursor: pointer;
  list-style: none;
}
.live-reasoning summary::-webkit-details-marker {
  display: none;
}
.live-reasoning summary > .live-reasoning-glyph {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 40%, transparent);
  border-radius: 50%;
  color: var(--jade);
}
.live-reasoning summary strong {
  font-family: 'Songti SC', STSong, serif;
  font-size: 10px;
  letter-spacing: 0.1em;
}
.live-reasoning summary small {
  padding-left: 7px;
  border-left: 1px solid color-mix(in srgb, var(--gold) 24%, transparent);
  color: var(--gold-soft);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}
.live-reasoning summary > i:last-child {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 8px;
  transition: transform 0.2s ease;
}
.live-reasoning[open] summary {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 52%, var(--line-strong));
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent-glow) 28%, transparent);
}
.live-reasoning[open] summary > i:last-child {
  transform: rotate(180deg);
}
.live-status {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--jade) !important;
}
.waiting-dots {
  min-width: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.waiting-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--jade);
  animation: dialogue-pulse 1.1s ease-in-out infinite;
}
.waiting-dots i:nth-child(2) {
  animation-delay: 0.14s;
}
.waiting-dots i:nth-child(3) {
  animation-delay: 0.28s;
}

.dialogue-portrait {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
  border-left: 1px solid color-mix(in srgb, var(--gold) 25%, var(--line-subtle));
  background: var(--stage-canvas);
  box-shadow: -18px 0 46px color-mix(in srgb, var(--stage-shadow) 30%, transparent);
}
.portrait-echo {
  position: absolute;
  z-index: 0;
  inset: -24px;
  background: var(--dialogue-portrait-image) center / cover no-repeat;
  filter: blur(28px) saturate(0.72) brightness(0.54);
  opacity: 0.68;
  transform: scale(1.12);
}
.portrait-frame {
  position: relative;
  z-index: 1;
  grid-row: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--stage-canvas) 34%, transparent);
}
.portrait-frame::before {
  content: '';
  position: absolute;
  z-index: 2;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--stage-canvas) 26%, transparent),
      transparent 22% 78%,
      color-mix(in srgb, var(--stage-canvas) 22%, transparent)
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--stage-shadow) 24%, transparent),
      transparent 18% 82%,
      color-mix(in srgb, var(--stage-canvas) 38%, transparent)
    );
  pointer-events: none;
}
.portrait-frame::after {
  content: '';
  position: absolute;
  z-index: 3;
  inset: 10px;
  border: 1px solid color-mix(in srgb, var(--gold) 22%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--stage-shadow) 32%, transparent);
  pointer-events: none;
}
.portrait-frame img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  object-position: center;
  filter: saturate(0.96) contrast(1.02) drop-shadow(0 18px 30px rgba(0, 0, 0, 0.22));
}
.portrait-frame > .portrait-channel-mark {
  position: absolute;
  z-index: 5;
  top: 22px;
  right: auto;
  bottom: auto;
  left: 20px;
  width: auto;
  padding: 5px 9px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, #e4bd75 36%, transparent);
  border-radius: 999px;
  color: #e9d2a1;
  background: rgba(3, 16, 22, 0.56);
  font-size: 9px;
  letter-spacing: 0.08em;
  backdrop-filter: blur(8px);
}
.portrait-meta {
  position: relative;
  z-index: 4;
  grid-row: 2;
  min-width: 0;
  padding: 13px 15px 15px;
  display: grid;
  gap: 9px;
  border-top: 1px solid color-mix(in srgb, var(--gold) 22%, var(--line-subtle));
  color: var(--text-primary);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--gold) 4%, transparent), transparent 55%),
    linear-gradient(var(--surface-inset), var(--surface-inset)), var(--stage-canvas);
  box-shadow: 0 -14px 34px color-mix(in srgb, var(--stage-shadow) 38%, transparent);
}
.portrait-identity {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.portrait-identity small {
  color: var(--gold-soft);
  font-size: 9px;
  letter-spacing: 0.14em;
}
.portrait-identity strong {
  overflow: hidden;
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 21px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.portrait-meta dl {
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--line-subtle);
}
.portrait-meta dl div {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 7px;
  padding: 3px 0;
  font-size: 10px;
}
.portrait-meta dt {
  color: var(--gold-soft);
}
.portrait-meta dd {
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary);
  line-height: 1.5;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
}

@keyframes dialogue-pulse {
  0%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@media screen and (max-width: 760px) {
  .dialogue-header {
    min-height: 54px;
    padding: 6px 48px 6px 10px;
    align-items: center;
    gap: 8px;
    background: linear-gradient(var(--surface-inset), var(--surface-inset)), var(--stage-canvas);
    box-shadow: none;
  }
  .channel-mark {
    width: 34px;
    height: 34px;
    border-radius: 7px;
    transform: none;
  }
  .speaker-name-line strong {
    font-size: 15px;
  }
  .speaker-name-line em {
    display: none;
  }
  .dialogue-actions button span {
    display: none;
  }
  .dialogue-actions button {
    width: 31px;
    min-height: 31px;
    padding: 0;
  }
  .history-resume-button span {
    display: none;
  }
  .history-resume-button {
    width: 31px;
    padding: 0;
  }
  .dialogue-layout.with-portrait {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 112px minmax(0, 1fr);
  }
  .dialogue-portrait {
    grid-row: 1;
    padding: 0;
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    grid-template-rows: 112px;
    border-bottom: 1px solid color-mix(in srgb, var(--gold) 25%, var(--line-subtle));
    border-left: 0;
    box-shadow: none;
  }
  .portrait-frame {
    grid-row: 1;
    grid-column: 1;
    min-height: 112px;
    border-right: 1px solid var(--line-subtle);
  }
  .portrait-frame img {
    position: relative;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
  }
  .portrait-frame::before {
    background:
      linear-gradient(90deg, transparent 62%, color-mix(in srgb, var(--stage-canvas) 28%, transparent)),
      linear-gradient(180deg, color-mix(in srgb, var(--stage-shadow) 12%, transparent), transparent 68%);
  }
  .portrait-frame::after {
    inset: 6px;
    border-color: color-mix(in srgb, var(--gold) 14%, transparent);
  }
  .portrait-frame > .portrait-channel-mark {
    display: none;
  }
  .portrait-meta {
    grid-row: 1;
    grid-column: 2;
    padding: 10px 12px;
    align-content: center;
    gap: 5px;
    border-top: 0;
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--jade) 4%, transparent), transparent 62%),
      linear-gradient(var(--surface-inset), var(--surface-inset)), var(--stage-canvas);
    box-shadow: none;
  }
  .portrait-identity small {
    font-size: 8px;
  }
  .portrait-identity strong {
    font-size: 15px;
  }
  .portrait-meta dl {
    padding-top: 4px;
  }
  .portrait-meta dl div {
    grid-template-columns: 29px minmax(0, 1fr);
    padding: 1px 0;
    font-size: 9px;
  }
  .portrait-meta dd {
    line-clamp: 1;
    -webkit-line-clamp: 1;
  }
  .dialogue-scroll-shell {
    grid-row: 2;
  }
  .conversation-watermark {
    display: none;
  }
  .dialogue-scroll {
    padding: 19px 12px 28px;
  }
  .resume-stream-follow {
    right: 9px;
    bottom: 9px;
  }
  .dialogue-turn {
    width: 94%;
    margin-bottom: 17px;
  }
  .dialogue-bubble {
    padding: 10px 12px;
    border-radius: 3px 12px 12px 12px;
  }
  .user-turn .dialogue-bubble {
    border-radius: 12px 3px 12px 12px;
  }
  .empty-crest {
    width: 34px;
    height: 34px;
    margin-bottom: 5px;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .empty-crest::before,
  .empty-crest::after {
    display: none;
  }
  .empty-crest span {
    display: none;
  }
  .empty-crest i {
    position: static;
    width: auto;
    height: auto;
    border: 0;
    background: transparent;
    font-size: 17px;
  }
  .dialogue-empty strong {
    font-size: 13px;
  }
  .dialogue-empty > small,
  .dialogue-empty p {
    display: none;
  }
  .dialogue-composer {
    min-height: 68px;
    padding: 7px 8px 8px;
    grid-template-columns: minmax(0, 1fr) 58px;
    gap: 7px;
    box-shadow: none;
  }
  .dialogue-composer textarea {
    min-height: 52px;
    padding: 8px 8px 8px 34px;
    border-radius: 7px;
  }
  .composer-glyph {
    top: 9px;
    left: 7px;
  }
  .composer-field > small,
  .dialogue-composer button small {
    display: none;
  }
  .dialogue-composer button {
    padding: 0 7px;
    flex-direction: column;
    gap: 5px;
    border-radius: 7px;
  }
  .dialogue-composer button > span {
    display: block;
    text-align: center;
  }
}

.historical .dialogue-scroll {
  padding-bottom: 28px;
}
</style>
