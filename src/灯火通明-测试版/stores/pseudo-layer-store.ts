import { readPlayerInput } from '../player-input';
import {
  PSEUDO_LAYER_CHANNEL,
  PSEUDO_LAYER_DETACHED_VERSION,
  PSEUDO_LAYER_DIALOGUE_DRAWER_VERSION,
  PSEUDO_LAYER_MESSAGE_EDITING_VERSION,
  PSEUDO_LAYER_PENDING_INPUT_RECOVERY_VERSION,
  PSEUDO_LAYER_REASONING_EDITING_VERSION,
  PSEUDO_LAYER_REASONING_ISOLATION_VERSION,
  PSEUDO_LAYER_SUPPORTED_VERSIONS,
  PSEUDO_LAYER_TIMELINE_PAGING_VERSION,
  PSEUDO_LAYER_USER_MESSAGE_EDITING_VERSION,
  PSEUDO_LAYER_VERSION,
  isPseudoLayerResponse,
} from '../pseudo-layer-protocol';
import {
  extractDialogueContent,
  extractInlineReasoning,
  parseMessageContent,
  sanitizeReasoningText,
  selectReasoningText,
} from '../message-content';
import type {
  DialogueChannel,
  DialogueContext,
  DialogueVariableEffects,
  DialogueVisualCard,
  InteractionMode,
  PseudoLayerGenerationOperation,
  PseudoLayerGenerationState,
  PseudoLayerDialogueThread,
  PseudoLayerHistoryKind,
  PseudoLayerHistoryState,
  PseudoLayerInteraction,
  PseudoLayerInteractionMetadata,
  PseudoLayerReasoningState,
  PseudoLayerRequest,
  PseudoLayerTimelineDirection,
  PseudoLayerTimelineEntry,
  PseudoLayerView,
} from '../pseudo-layer-protocol';

export type DialogueTurn = {
  assistantMessageId: number;
  userMessageId: number | null;
  userText: string;
  reaction: string;
  replyText: string;
  reasoning: string;
  rawMessage: string;
  reasoningDuration: number | null;
  reasoningEditable: boolean;
  responseDuration: number | null;
  tokenCount: number | null;
  visualCard?: DialogueVisualCard;
  variableEffects?: DialogueVariableEffects;
};

export type DialogueTarget = {
  targetName: string;
  canonicalName: string;
  channel: DialogueChannel;
};

const INTERACTION_KEY = 'dhl_pseudo_interaction';
const STORY_INTERACTION = { mode: 'story' } as const;
const EMPTY_HISTORY = {
  selectedMessageId: -1,
  latestMessageId: -1,
  index: 0,
  total: 0,
  isLatest: true,
} as const;
const EMPTY_VIEW: PseudoLayerView = {
  hostMessageId: -1,
  revision: 0,
  selectedMessageId: -1,
  latestMessageId: -1,
  index: 0,
  total: 0,
  isLatest: true,
  nativeInputCollapsed: false,
  detached: false,
  stage: { kind: 'story' },
  histories: {
    story: { ...EMPTY_HISTORY },
    dialogue: { ...EMPTY_HISTORY },
  },
  activeInteraction: STORY_INTERACTION,
};
const finiteNumberOr = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const normalizeHistoryState = (
  value: Partial<PseudoLayerHistoryState> | undefined,
  fallback: PseudoLayerHistoryState,
): PseudoLayerHistoryState => {
  const previousMessageId = Number(value?.previousMessageId);
  const nextMessageId = Number(value?.nextMessageId);
  return {
    selectedMessageId: finiteNumberOr(value?.selectedMessageId, fallback.selectedMessageId),
    latestMessageId: finiteNumberOr(value?.latestMessageId, fallback.latestMessageId),
    index: finiteNumberOr(value?.index, fallback.index),
    total: finiteNumberOr(value?.total, fallback.total),
    ...(Number.isFinite(previousMessageId) ? { previousMessageId } : {}),
    ...(Number.isFinite(nextMessageId) ? { nextMessageId } : {}),
    isLatest: typeof value?.isLatest === 'boolean' ? value.isLatest : fallback.isLatest,
  };
};
const normalizePendingInput = (value: PseudoLayerView['pendingInput']): PseudoLayerView['pendingInput'] => {
  if (!value || typeof value !== 'object') return undefined;
  const messageIds = [...new Set((Array.isArray(value.messageIds) ? value.messageIds : []).map(Number))]
    .filter(messageId => Number.isInteger(messageId) && messageId >= 0)
    .sort((left, right) => left - right);
  const latestMessageId = Number(value.latestMessageId);
  const text = String(value.text ?? '').trim();
  if (messageIds.length === 0 || !messageIds.includes(latestMessageId) || !text) return undefined;
  return {
    messageIds,
    latestMessageId,
    text,
    count: messageIds.length,
  };
};
const normalizePseudoLayerView = (value: PseudoLayerView): PseudoLayerView => {
  const raw = value as Partial<PseudoLayerView> & {
    histories?: Partial<Record<PseudoLayerHistoryKind, Partial<PseudoLayerHistoryState>>>;
  };
  const stage = raw.stage ?? ({ kind: 'story' } as const);
  const legacyHistory = normalizeHistoryState(raw, EMPTY_HISTORY);
  const emptyHistory = { ...EMPTY_HISTORY };
  const storyFallback = stage.kind === 'story' ? legacyHistory : emptyHistory;
  const dialogueFallback = stage.kind === 'dialogue' ? legacyHistory : emptyHistory;
  const tokenCount = Number(raw.tokenCount);
  const pendingInput = normalizePendingInput(raw.pendingInput);
  return {
    hostMessageId: finiteNumberOr(raw.hostMessageId, -1),
    revision: finiteNumberOr(raw.revision, 0),
    selectedMessageId: legacyHistory.selectedMessageId,
    latestMessageId: legacyHistory.latestMessageId,
    index: legacyHistory.index,
    total: legacyHistory.total,
    ...(legacyHistory.previousMessageId !== undefined ? { previousMessageId: legacyHistory.previousMessageId } : {}),
    ...(legacyHistory.nextMessageId !== undefined ? { nextMessageId: legacyHistory.nextMessageId } : {}),
    isLatest: legacyHistory.isLatest,
    nativeInputCollapsed: Boolean(raw.nativeInputCollapsed),
    detached: Boolean(raw.detached),
    ...(pendingInput ? { pendingInput } : {}),
    ...(Number.isFinite(tokenCount) ? { tokenCount } : {}),
    stage,
    histories: {
      story: normalizeHistoryState(raw.histories?.story, storyFallback),
      dialogue: normalizeHistoryState(raw.histories?.dialogue, dialogueFallback),
    },
    activeInteraction: raw.activeInteraction ?? STORY_INTERACTION,
    ...(Number.isFinite(Number(raw.latestStoryMessageId))
      ? { latestStoryMessageId: Number(raw.latestStoryMessageId) }
      : {}),
    ...(Number.isFinite(Number(raw.latestStateMessageId))
      ? { latestStateMessageId: Number(raw.latestStateMessageId) }
      : {}),
    ...(Array.isArray(raw.dialogueThreads) ? { dialogueThreads: raw.dialogueThreads } : {}),
  };
};
const cleanStoredReaction = (value: unknown) =>
  String(value ?? '')
    .replace(/<正文(?=[\s/>])[\s\S]*$/i, '')
    .replace(/<\/?(?:反应|正文|会话状态)(?=[\s/>])[^>]*>/gi, '')
    .replace(/<[^>]*$/g, '')
    .trim();
const readMetadata = (message: ChatMessage | undefined): PseudoLayerInteractionMetadata | null => {
  if (!message) return null;
  const value = (message.extra?.[INTERACTION_KEY] ?? message.extra?.extra?.[INTERACTION_KEY]) as
    Partial<PseudoLayerInteractionMetadata> | undefined;
  if (
    !value ||
    (value.version !== 1 && value.version !== 2 && value.version !== 3) ||
    value.kind !== 'dialogue' ||
    (value.channel !== 'present' && value.channel !== 'transmission')
  ) {
    return null;
  }
  const sessionId = String(value.sessionId ?? '').trim();
  const targetName = String(value.targetName ?? '').trim();
  const canonicalName = String(value.canonicalName ?? '').trim();
  if (!sessionId || !targetName || !canonicalName) return null;
  const userMessageId = Number(value.userMessageId);
  const reaction = cleanStoredReaction(value.reaction);
  return {
    ...value,
    version: value.version,
    kind: 'dialogue',
    sessionId,
    targetName,
    canonicalName,
    channel: value.channel,
    ...(typeof value.rawUserText === 'string' ? { rawUserText: value.rawUserText } : {}),
    ...(Number.isFinite(userMessageId) ? { userMessageId } : {}),
    ...(reaction ? { reaction } : {}),
  } as PseudoLayerInteractionMetadata;
};
const readReasoning = (message: ChatMessage | undefined) => {
  const direct = message?.extra ?? {};
  const nested = direct.extra && typeof direct.extra === 'object' ? direct.extra : {};
  const nativeText = String(direct.reasoning ?? nested.reasoning ?? '').trim();
  const inlineReasoning = extractInlineReasoning(String(message?.message ?? ''));
  const text = selectReasoningText(nativeText, inlineReasoning?.text ?? '');
  const rawDuration = Number(direct.reasoning_duration ?? nested.reasoning_duration);
  return {
    text,
    duration: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null,
    editable: Boolean(nativeText),
  };
};
const readResponseDuration = (message: ChatMessage | undefined) => {
  const direct = message?.extra ?? {};
  const nested = direct.extra && typeof direct.extra === 'object' ? direct.extra : {};
  const startedAt = new Date(direct.gen_started ?? nested.gen_started ?? '').getTime();
  const finishedAt = new Date(direct.gen_finished ?? nested.gen_finished ?? '').getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) return null;
  return Math.round(finishedAt - startedAt);
};
const readTokenCount = (message: ChatMessage | undefined) => {
  const direct = message?.extra ?? {};
  const nested = direct.extra && typeof direct.extra === 'object' ? direct.extra : {};
  const value = Number(direct.token_count ?? nested.token_count);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
};
const rawUserText = (message: ChatMessage | undefined) => {
  if (!message) return '';
  const metadata = readMetadata(message);
  return readPlayerInput(message, metadata?.rawUserText);
};
export const usePseudoLayerStore = defineStore('pseudo_layer', () => {
  const parkedMessageId = Number((window.frameElement as HTMLIFrameElement | null)?.dataset.dhlMessageId);
  const frameMessageId = Number(window.frameElement?.closest('.mes')?.getAttribute('mesid') ?? NaN);
  const rawMessageId = Number.isFinite(parkedMessageId)
    ? parkedMessageId
    : Number.isFinite(frameMessageId)
      ? frameMessageId
      : getCurrentMessageId();
  const messageId = Number(rawMessageId);
  const controllerReady = ref(false);
  const controllerProtocolVersion = ref<number | null>(null);
  const view = ref<PseudoLayerView>({ ...EMPTY_VIEW });
  const isPseudoStage = ref(Boolean(window.frameElement?.closest('#dhl-pseudo-stage-root')));
  const isDetachedMode = computed(() => !controllerReady.value || view.value.detached || !isPseudoStage.value);
  const nativeLatestMessageId = ref(-1);
  const isNativeLatest = computed(() => messageId >= 0 && messageId === nativeLatestMessageId.value);
  const nativeMessageListeners: EventOnReturn[] = [];
  let hostObserver: MutationObserver | null = null;
  const refreshHostState = () => {
    isPseudoStage.value = Boolean(window.frameElement?.closest('#dhl-pseudo-stage-root'));
    for (let id = getLastMessageId(); id >= 0; id -= 1) {
      const message = getChatMessages(id)[0];
      if (message?.role === 'assistant' && !message.is_hidden) {
        nativeLatestMessageId.value = id;
        return;
      }
    }
    nativeLatestMessageId.value = -1;
  };
  const selectedTitle = ref('');
  const draftPrompt = ref('');
  const dialogueDraftPrompt = ref('');
  const dialogueDrawerOpen = ref(false);
  const drawerDialogue = ref<DialogueContext | null>(null);
  const dialogueReadOnly = ref(false);
  const generationState = ref<PseudoLayerGenerationState>('idle');
  const generationOperation = ref<PseudoLayerGenerationOperation | null>(null);
  const rerollTargetMessageId = ref(-1);
  const streamText = ref('');
  const streamReaction = ref('');
  const liveReasoning = ref('');
  const liveReasoningState = ref<PseudoLayerReasoningState>('none');
  const reasoningDuration = ref<number | null>(null);
  const generationError = ref('');
  const activeRequestId = ref('');
  const deleteRequestId = ref('');
  const pendingInputRecoveryRequestId = ref('');
  const editRequestId = ref('');
  const editError = ref('');
  const editSavedNonce = ref(0);
  const floorMessage = ref('');
  const floorUserMessage = ref('');
  const floorUserMessageId = ref(-1);
  const generationUserMessage = ref('');
  const floorReasoning = ref('');
  const floorReasoningDuration = ref<number | null>(null);
  const storyFloorMessageId = ref(-1);
  const storyFloorMessage = ref('');
  const storyFloorUserMessage = ref('');
  const storyFloorUserMessageId = ref(-1);
  const storyFloorReasoning = ref('');
  const storyFloorReasoningDuration = ref<number | null>(null);
  const storyFloorReasoningEditable = ref(false);
  const storyFloorNotice = ref('');
  const dialogueTurns = ref<DialogueTurn[]>([]);
  const timelineEntries = ref<PseudoLayerTimelineEntry[]>([]);
  const timelineHasOlder = ref(false);
  const timelineHasNewer = ref(false);
  const timelineLoading = ref(false);
  const timelineRevision = ref(-1);
  const timelineError = ref('');
  const recentDialogue = ref<DialogueContext | null>(null);
  const focusNonce = ref(0);
  const dialogueFocusNonce = ref(0);
  const generationInteractionMode = ref<InteractionMode | null>(null);
  let submittedDraft: { prompt: string; title: string; mode: InteractionMode } | undefined;
  const settledRequestIds = new Set<string>();
  let timelineTimeout: number | null = null;
  let generationAcknowledged = false;
  let generationRequestedAt = 0;
  let started = false;
  let helloTimer: number | null = null;
  const helloRetryTimers: number[] = [];
  let lastControllerReplyAt = 0;
  let timelineRequest:
    | {
        requestId: string;
        direction: PseudoLayerTimelineDirection;
        anchorMessageId?: number;
        reset: boolean;
        single: boolean;
      }
    | undefined;
  let pendingTimelineRefreshMessageId: number | undefined;
  let pendingTimelineResetAnchor: number | undefined;
  let pendingGenerationCompletionMessageId: number | undefined;
  let generationCompletionFallbackTimer: number | null = null;
  const timelineRefreshTimers: number[] = [];
  const isGenerating = computed(() => generationState.value !== 'idle');
  const canStop = computed(
    () => Boolean(activeRequestId.value) && ['preparing', 'generating'].includes(generationState.value),
  );
  const generationContent = computed(() => parseMessageContent(streamText.value));
  const generationLabel = computed(() => {
    if (generationState.value === 'idle') return '';
    if (generationState.value === 'preparing') return '正在发送';
    if (generationState.value === 'saving') return '正在保存';
    if (generationState.value === 'stopping') return '正在停止';
    if (generationInteractionMode.value === 'dialogue') return streamText.value ? '回应中' : '等待回应';
    if (generationContent.value.narrative.trim()) return '正文落笔中';
    if (liveReasoningState.value === 'thinking' || generationContent.value.reasoning?.isComplete === false) {
      return '推演中';
    }
    return '等待正文';
  });
  const generationWaitingText = computed(() => {
    if (generationState.value === 'preparing') return '正在送出你的行动……';
    if (generationState.value === 'saving') return '回复已收到，正在整理本回记录……';
    if (generationState.value === 'stopping') return '正在停止，已收到的正文会保留。';
    if (generationLabel.value === '推演中') return '正在推演后续，正文将在这里接续。';
    if (liveReasoning.value || generationContent.value.reasoning) return '推演已完成，正在等待正文……';
    return '行动已送出，正在等待回应……';
  });
  const supportsMessageEditing = computed(
    () => (controllerProtocolVersion.value ?? 0) >= PSEUDO_LAYER_MESSAGE_EDITING_VERSION,
  );
  const supportsTimelinePaging = computed(
    () => (controllerProtocolVersion.value ?? 0) >= PSEUDO_LAYER_TIMELINE_PAGING_VERSION,
  );
  const supportsUserMessageEditing = computed(
    () => (controllerProtocolVersion.value ?? 0) >= PSEUDO_LAYER_USER_MESSAGE_EDITING_VERSION,
  );
  const supportsPendingInputRecovery = computed(
    () => (controllerProtocolVersion.value ?? 0) >= PSEUDO_LAYER_PENDING_INPUT_RECOVERY_VERSION,
  );
  const supportsReasoningEditing = computed(
    () => (controllerProtocolVersion.value ?? 0) >= PSEUDO_LAYER_REASONING_EDITING_VERSION,
  );
  const supportsDialogueDrawer = computed(
    () => (controllerProtocolVersion.value ?? 0) >= PSEUDO_LAYER_DIALOGUE_DRAWER_VERSION,
  );
  const controllerCompatibilityMode = computed(
    () =>
      controllerReady.value &&
      controllerProtocolVersion.value !== null &&
      controllerProtocolVersion.value < PSEUDO_LAYER_VERSION,
  );
  const controllerConnectionDescription = computed(() => {
    if (!controllerReady.value) return '伪同层控制脚本未连接';
    if (!controllerCompatibilityMode.value) return `伪同层控制脚本已连接（协议 v${PSEUDO_LAYER_VERSION}）`;
    return `已兼容连接缓存中的控制器 v${controllerProtocolVersion.value}；前端协议为 v${PSEUDO_LAYER_VERSION}，新功能将安全降级`;
  });
  const isRerolling = computed(() => isGenerating.value && generationOperation.value === 'reroll');
  const isDeleting = computed(() => deleteRequestId.value !== '');
  const isRecoveringPendingInput = computed(() => pendingInputRecoveryRequestId.value !== '');
  const isUpdatingMessage = computed(() => editRequestId.value !== '');
  const isSelected = computed(() => view.value.hostMessageId === messageId);
  const isLatest = computed(() => view.value.isLatest && isSelected.value);
  const isStoryHistoryLatest = computed(() =>
    isDetachedMode.value
      ? isNativeLatest.value
      : isSelected.value && (view.value.histories.story.total === 0 || view.value.histories.story.isLatest),
  );
  const isDialogueHistoryLatest = computed(
    () => isSelected.value && (view.value.histories.dialogue.total === 0 || view.value.histories.dialogue.isLatest),
  );
  const isCurrentHistoryLatest = computed(() =>
    view.value.stage.kind === 'dialogue' ? isDialogueHistoryLatest.value : isStoryHistoryLatest.value,
  );
  const activeDialogue = computed<DialogueContext | null>(() =>
    view.value.activeInteraction.mode === 'dialogue' ? view.value.activeInteraction : null,
  );
  const selectedDialogue = computed<DialogueContext | null>(() =>
    view.value.stage.kind === 'dialogue'
      ? {
          mode: 'dialogue',
          sessionId: view.value.stage.sessionId,
          targetName: view.value.stage.targetName,
          canonicalName: view.value.stage.canonicalName,
          channel: view.value.stage.channel,
          ...(view.value.stage.anchorStoryMessageId !== undefined
            ? { anchorStoryMessageId: view.value.stage.anchorStoryMessageId }
            : {}),
        }
      : null,
  );
  const dialogueContext = computed(
    () => drawerDialogue.value ?? activeDialogue.value ?? selectedDialogue.value ?? recentDialogue.value,
  );
  const dialogueThreads = computed<PseudoLayerDialogueThread[]>(() => view.value.dialogueThreads ?? []);
  const latestStoryMessageId = computed(
    () => view.value.latestStoryMessageId ?? view.value.histories.story.latestMessageId ?? view.value.latestMessageId,
  );
  const latestStateMessageId = computed(() => {
    if (view.value.latestStateMessageId !== undefined) return view.value.latestStateMessageId;
    const runtimeLastMessageId = Number(getLastMessageId());
    return Number.isFinite(runtimeLastMessageId)
      ? Math.max(view.value.latestMessageId, runtimeLastMessageId)
      : view.value.latestMessageId;
  });
  const isDialogueActive = computed(() => activeDialogue.value !== null);
  const isDialogueView = computed(() => dialogueDrawerOpen.value);
  const isDialogueWritable = computed(
    () =>
      !dialogueReadOnly.value &&
      drawerDialogue.value !== null &&
      activeDialogue.value?.sessionId === drawerDialogue.value.sessionId &&
      (drawerDialogue.value.anchorStoryMessageId ?? latestStoryMessageId.value) === latestStoryMessageId.value,
  );
  const canSubmitBase = computed(
    () =>
      !isDetachedMode.value &&
      draftPrompt.value.trim().length > 0 &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const canSubmitStory = computed(() => canSubmitBase.value && isStoryHistoryLatest.value);
  const canSubmitDialogue = computed(
    () =>
      !isDetachedMode.value &&
      dialogueDraftPrompt.value.trim().length > 0 &&
      isDialogueWritable.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const canSubmitLatestStory = computed(() => canSubmitBase.value);
  const canSubmitLatestDialogue = computed(() => canSubmitDialogue.value);
  const canSubmit = computed(() => canSubmitStory.value);
  const canReroll = computed(
    () =>
      controllerReady.value &&
      latestStoryMessageId.value >= 0 &&
      view.value.selectedMessageId === latestStoryMessageId.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const canRerollLatest = computed(
    () =>
      controllerReady.value &&
      latestStoryMessageId.value >= 0 &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const canDelete = computed(
    () =>
      controllerReady.value &&
      view.value.selectedMessageId === latestStoryMessageId.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value &&
      view.value.histories.story.total > 1,
  );
  const canDeleteLatest = computed(
    () =>
      controllerReady.value &&
      latestStoryMessageId.value >= 0 &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value &&
      view.value.histories.story.total > 1,
  );
  const canEditMessage = computed(
    () =>
      controllerReady.value &&
      supportsMessageEditing.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const canEditUserMessage = computed(
    () =>
      controllerReady.value &&
      supportsUserMessageEditing.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const canEditReasoning = computed(
    () =>
      controllerReady.value &&
      supportsReasoningEditing.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value,
  );
  const turnUserMessage = computed(() =>
    isGenerating.value
      ? generationUserMessage.value ||
        (generationInteractionMode.value === 'dialogue'
          ? dialogueDraftPrompt.value.trim()
          : draftPrompt.value.trim()) ||
        floorUserMessage.value
      : floorUserMessage.value,
  );
  const post = (request: PseudoLayerRequest) =>
    window.parent.postMessage(
      {
        ...request,
        version: controllerProtocolVersion.value ?? request.version,
      } as PseudoLayerRequest,
      '*',
    );
  const getMessageRange = (lastId: number) => {
    if (!Number.isFinite(lastId) || lastId < 0) return [];
    return getChatMessages(`0-${lastId}`);
  };
  const findImmediatePreviousMessage = (messages: ChatMessage[], targetMessageId: number) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].message_id < targetMessageId) return messages[index];
    }
    return undefined;
  };
  const findLatestUserMessage = () => {
    const lastMessageId = getLastMessageId();
    if (!Number.isFinite(lastMessageId)) return '';
    for (let candidateId = lastMessageId; candidateId >= 0; candidateId -= 1) {
      const message = getChatMessages(candidateId)[0];
      if (message?.role === 'user') return rawUserText(message);
    }
    return '';
  };
  const refreshGenerationUserMessage = () => {
    generationUserMessage.value =
      (generationInteractionMode.value === 'dialogue' ? dialogueDraftPrompt.value.trim() : draftPrompt.value.trim()) ||
      findLatestUserMessage();
  };
  const refreshDialogueTurns = (
    targetMessageId: number,
    sessionId: string,
    messages = getMessageRange(targetMessageId),
  ) => {
    const byId = new Map(messages.map(message => [message.message_id, message]));
    dialogueTurns.value = messages
      .filter(message => message.role === 'assistant')
      .flatMap(message => {
        const previousMessage = findImmediatePreviousMessage(messages, message.message_id);
        const adjacentUser = previousMessage?.role === 'user' ? previousMessage : undefined;
        const metadata = readMetadata(message) ?? readMetadata(adjacentUser);
        if (!metadata || metadata.sessionId !== sessionId) return [];
        const linkedUser =
          (metadata.userMessageId !== undefined ? byId.get(metadata.userMessageId) : undefined) ?? adjacentUser;
        const reasoning = readReasoning(message);
        const visible = extractDialogueContent(String(message.message ?? ''));
        return [
          {
            assistantMessageId: message.message_id,
            userMessageId: linkedUser?.message_id ?? null,
            userText: rawUserText(linkedUser),
            reaction: metadata.reaction ?? visible.reaction,
            replyText: visible.dialogue,
            reasoning: reasoning.text,
            rawMessage: String(message.message ?? ''),
            reasoningDuration: reasoning.duration,
            reasoningEditable: reasoning.editable,
            responseDuration: readResponseDuration(message),
            tokenCount: readTokenCount(message),
            ...(metadata.visualCard ? { visualCard: metadata.visualCard } : {}),
            ...(metadata.variableEffects ? { variableEffects: metadata.variableEffects } : {}),
          },
        ];
      });
  };
  const findLatestDialogue = (
    targetMessageId: number,
    messages = getMessageRange(targetMessageId),
  ): DialogueContext | null => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const metadata = readMetadata(messages[index]);
      if (!metadata) continue;
      return {
        mode: 'dialogue',
        sessionId: metadata.sessionId,
        targetName: metadata.targetName,
        canonicalName: metadata.canonicalName,
        channel: metadata.channel,
        ...(metadata.anchorStoryMessageId !== undefined ? { anchorStoryMessageId: metadata.anchorStoryMessageId } : {}),
      };
    }
    return null;
  };
  const refreshStoryFloor = (targetMessageId: number, messages = getMessageRange(targetMessageId)) => {
    let storyMessage: ChatMessage | undefined;
    let storyUserMessage: ChatMessage | undefined;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'assistant' || message.message_id > targetMessageId) continue;
      const previousMessage = messages[index - 1];
      const adjacentUser = previousMessage?.role === 'user' ? previousMessage : undefined;
      if (readMetadata(message) ?? readMetadata(adjacentUser)) continue;
      storyMessage = message;
      storyUserMessage = adjacentUser;
      break;
    }
    storyFloorMessageId.value = storyMessage?.message_id ?? -1;
    storyFloorMessage.value = String(storyMessage?.message ?? '');
    storyFloorNotice.value = String(
      storyMessage?.extra?.dhl_pseudo_generation_notice ??
        storyMessage?.extra?.extra?.dhl_pseudo_generation_notice ??
        '',
    );
    storyFloorUserMessage.value = rawUserText(storyUserMessage);
    storyFloorUserMessageId.value = storyUserMessage?.message_id ?? -1;
    const reasoning = readReasoning(storyMessage);
    storyFloorReasoning.value = reasoning.text;
    storyFloorReasoningDuration.value = reasoning.duration;
    storyFloorReasoningEditable.value = reasoning.editable;
  };
  const refreshFloor = (targetMessageId = view.value.selectedMessageId) => {
    if (!Number.isFinite(targetMessageId) || targetMessageId < 0) return;
    try {
      const messages = getMessageRange(Math.max(targetMessageId, latestStateMessageId.value));
      const message = messages.find(message => message.message_id === targetMessageId);
      const previousMessage = findImmediatePreviousMessage(messages, targetMessageId);
      floorMessage.value = String(message?.message ?? '');
      floorUserMessage.value = rawUserText(previousMessage?.role === 'user' ? previousMessage : undefined);
      floorUserMessageId.value = previousMessage?.role === 'user' ? previousMessage.message_id : -1;
      const reasoning = readReasoning(message);
      floorReasoning.value = reasoning.text;
      floorReasoningDuration.value = reasoning.duration;
      refreshStoryFloor(targetMessageId, messages);
      const archivedDialogue = findLatestDialogue(Math.max(targetMessageId, latestStateMessageId.value), messages);
      recentDialogue.value = archivedDialogue;
      const currentDialogue = drawerDialogue.value ?? activeDialogue.value;
      if (currentDialogue) refreshDialogueTurns(latestStateMessageId.value, currentDialogue.sessionId, messages);
    } catch (error) {
      console.warn('[灯火阑珊·伪同层] 读取楼层正文失败', error);
    }
  };
  const hydrateCompatibleTimelineEntry = (targetMessageId = view.value.selectedMessageId, preserveEntries = false) => {
    const selectedMessageId =
      Number.isFinite(targetMessageId) && targetMessageId >= 0
        ? Math.trunc(targetMessageId)
        : view.value.selectedMessageId;
    if (!Number.isFinite(selectedMessageId) || selectedMessageId < 0) {
      timelineEntries.value = [];
      return;
    }
    refreshFloor(selectedMessageId);
    const stage = view.value.stage;
    const history = stage.kind;
    const historyState = view.value.histories[history];
    const dialogueTimelineTurns =
      stage.kind === 'dialogue'
        ? dialogueTurns.value.map(turn => ({
            assistantMessageId: turn.assistantMessageId,
            ...(turn.userMessageId !== null ? { userMessageId: turn.userMessageId } : {}),
            userText: turn.userText,
            assistantText: turn.rawMessage,
            ...(turn.reaction ? { reaction: turn.reaction } : {}),
            reasoning: turn.reasoning,
            reasoningDuration: turn.reasoningDuration,
            reasoningEditable: turn.reasoningEditable,
            ...(turn.responseDuration !== null ? { responseDuration: turn.responseDuration } : {}),
            ...(turn.tokenCount !== null ? { tokenCount: turn.tokenCount } : {}),
          }))
        : [];
    const selectedMessage = getChatMessages(selectedMessageId)[0];
    const storyTokenCount = readTokenCount(selectedMessage);
    const storyResponseDuration = readResponseDuration(selectedMessage);
    const turns =
      dialogueTimelineTurns.length > 0
        ? dialogueTimelineTurns
        : [
            {
              assistantMessageId: selectedMessageId,
              ...(floorUserMessageId.value >= 0 ? { userMessageId: floorUserMessageId.value } : {}),
              userText: floorUserMessage.value,
              assistantText: floorMessage.value,
              generationNotice: String(selectedMessage?.extra?.dhl_pseudo_generation_notice ?? ''),
              reasoning: floorReasoning.value,
              reasoningDuration: floorReasoningDuration.value,
              reasoningEditable: readReasoning(selectedMessage).editable,
              ...(storyResponseDuration !== null ? { responseDuration: storyResponseDuration } : {}),
              ...(storyTokenCount !== null ? { tokenCount: storyTokenCount } : {}),
            },
          ];
    const messageIds = turns.map(turn => turn.assistantMessageId);
    const entries = [
      {
        representativeMessageId: selectedMessageId,
        messageIds: messageIds.length > 0 ? messageIds : [selectedMessageId],
        index: Math.max(1, view.value.index),
        historyIndex: Math.max(1, historyState.index || view.value.index),
        stage: { ...stage },
        turns,
      },
    ];
    mergeTimelineEntries(entries, !preserveEntries);
    if (!preserveEntries) {
      timelineHasOlder.value = false;
      timelineHasNewer.value = false;
    }
    timelineLoading.value = false;
    timelineRevision.value = view.value.revision;
    timelineError.value = '';
  };
  const readMessageContent = (targetMessageId: number) => {
    if (!Number.isFinite(targetMessageId) || targetMessageId < 0) return '';
    try {
      return String(getChatMessages(Math.trunc(targetMessageId))[0]?.message ?? '');
    } catch {
      return '';
    }
  };
  const readUserMessageContent = (targetMessageId: number) => {
    if (!Number.isFinite(targetMessageId) || targetMessageId < 0) return '';
    try {
      const message = getChatMessages(Math.trunc(targetMessageId))[0];
      return message?.role === 'user' ? rawUserText(message) : '';
    } catch {
      return '';
    }
  };
  const timelineEntriesOverlap = (left: PseudoLayerTimelineEntry, right: PseudoLayerTimelineEntry) =>
    left.representativeMessageId === right.representativeMessageId ||
    left.messageIds.some(messageId => right.messageIds.includes(messageId));
  const mergeTimelineEntries = (incoming: PseudoLayerTimelineEntry[], reset: boolean) => {
    if (reset) {
      timelineEntries.value = incoming;
      return;
    }
    const merged = [...timelineEntries.value];
    incoming.forEach(entry => {
      const existingIndex = merged.findIndex(existing => timelineEntriesOverlap(existing, entry));
      if (existingIndex >= 0) merged.splice(existingIndex, 1, entry);
      else merged.push(entry);
    });
    timelineEntries.value = merged.sort((left, right) => left.index - right.index);
  };
  const loadTimelinePage = (
    direction: PseudoLayerTimelineDirection = 'around',
    anchorMessageId = view.value.selectedMessageId,
    limit = 8,
    options: { reset?: boolean; single?: boolean } = {},
  ) => {
    if (!Number.isFinite(messageId) || timelineLoading.value) return;
    if (!supportsTimelinePaging.value) {
      hydrateCompatibleTimelineEntry(anchorMessageId);
      return;
    }
    const requestId = `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    timelineRequest = {
      requestId,
      direction,
      ...(Number.isFinite(anchorMessageId) && anchorMessageId >= 0
        ? { anchorMessageId: Math.trunc(anchorMessageId) }
        : {}),
      reset: options.reset ?? direction === 'around',
      single: options.single ?? false,
    };
    timelineLoading.value = true;
    timelineError.value = '';
    if (timelineTimeout !== null) window.clearTimeout(timelineTimeout);
    timelineTimeout = window.setTimeout(() => {
      timelineTimeout = null;
      if (timelineRequest?.requestId !== requestId) return;
      timelineRequest = undefined;
      timelineLoading.value = false;
      timelineError.value = '历程同步暂未响应，可以重新载入。';
      flushPendingTimelineWork();
    }, 4500);
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'timeline_page',
      requestId,
      ...(Number.isFinite(anchorMessageId) && anchorMessageId >= 0 ? { anchorMessageId } : {}),
      direction,
      limit,
    });
  };
  const loadOlderTimeline = () => {
    if (!timelineHasOlder.value || timelineEntries.value.length === 0) return;
    loadTimelinePage('older', timelineEntries.value[0].representativeMessageId, 8, { reset: false });
  };
  const loadNewerTimeline = () => {
    const lastEntry = timelineEntries.value.at(-1);
    if (!timelineHasNewer.value || !lastEntry) return;
    loadTimelinePage('newer', lastEntry.representativeMessageId, 8, { reset: false });
  };
  const refreshTimelineEntry = (targetMessageId: number) => {
    if (timelineLoading.value) {
      pendingTimelineRefreshMessageId = targetMessageId;
      return;
    }
    loadTimelinePage('around', targetMessageId, 1, {
      reset: false,
      single: true,
    });
  };
  const resetTimeline = (anchorMessageId = view.value.latestMessageId) => {
    if (timelineLoading.value) {
      pendingTimelineResetAnchor = anchorMessageId;
      pendingTimelineRefreshMessageId = undefined;
      return;
    }
    loadTimelinePage('around', anchorMessageId, 8, { reset: true });
  };
  const flushPendingTimelineWork = () => {
    if (timelineLoading.value) return;
    if (pendingTimelineResetAnchor !== undefined) {
      const anchorMessageId = pendingTimelineResetAnchor;
      pendingTimelineResetAnchor = undefined;
      pendingTimelineRefreshMessageId = undefined;
      resetTimeline(anchorMessageId);
      return;
    }
    if (pendingTimelineRefreshMessageId !== undefined) {
      const targetMessageId = pendingTimelineRefreshMessageId;
      pendingTimelineRefreshMessageId = undefined;
      refreshTimelineEntry(targetMessageId);
    }
  };
  const finalizeGenerationCompletion = () => {
    if (generationCompletionFallbackTimer !== null) {
      window.clearTimeout(generationCompletionFallbackTimer);
      generationCompletionFallbackTimer = null;
    }
    pendingGenerationCompletionMessageId = undefined;
    if (activeRequestId.value) {
      settledRequestIds.add(activeRequestId.value);
      if (settledRequestIds.size > 32) {
        const oldestRequestId = settledRequestIds.values().next().value;
        if (oldestRequestId !== undefined) settledRequestIds.delete(oldestRequestId);
      }
    }
    activeRequestId.value = '';
    generationAcknowledged = false;
    submittedDraft = undefined;
    generationState.value = 'idle';
    generationOperation.value = null;
    rerollTargetMessageId.value = -1;
    generationUserMessage.value = '';
    streamText.value = '';
    streamReaction.value = '';
    liveReasoning.value = '';
    liveReasoningState.value = 'none';
    reasoningDuration.value = null;
    generationInteractionMode.value = null;
  };
  const selectTimelineEntry = (targetMessageId: number) => {
    if (!Number.isFinite(targetMessageId) || isGenerating.value) return;
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'select_entry',
      messageId: Math.trunc(targetMessageId),
    });
  };
  const sendHello = () => {
    if (!Number.isFinite(messageId)) return;
    // 首次连接协商全部兼容版本；连接后每次心跳只发送已经协商成功的版本。
    const versions =
      controllerProtocolVersion.value === null ? PSEUDO_LAYER_SUPPORTED_VERSIONS : [controllerProtocolVersion.value];
    versions.forEach(version => {
      window.parent.postMessage(
        {
          channel: PSEUDO_LAYER_CHANNEL,
          version,
          type: 'hello',
          messageId,
          ...(activeRequestId.value ? { requestId: activeRequestId.value } : {}),
        },
        '*',
      );
    });
  };
  const acceptsRequest = (requestId?: string, allowAdoption = true) => {
    if (!requestId) return true;
    if (settledRequestIds.has(requestId)) return false;
    if (!activeRequestId.value) {
      if (!allowAdoption) return false;
      activeRequestId.value = requestId;
    }
    return activeRequestId.value === requestId;
  };
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (!isPseudoLayerResponse(event.data)) return;
    const response = event.data;
    const previousProtocolVersion = controllerProtocolVersion.value;
    if (previousProtocolVersion !== null && response.version < previousProtocolVersion) return;
    controllerProtocolVersion.value = response.version;
    lastControllerReplyAt = Date.now();
    controllerReady.value = true;
    if (response.type === 'ready') {
      if (typeof response.detached === 'boolean') view.value = { ...view.value, detached: response.detached };
      if (isDetachedMode.value) return;
      if (response.busy && response.requestId) {
        if (!acceptsRequest(response.requestId)) return;
        generationAcknowledged = true;
        // A replacement iframe can receive the heartbeat before the state replay.
        // Keep the active request stoppable instead of showing a disabled idle dock.
        if (generationState.value === 'idle') generationState.value = 'preparing';
        generationOperation.value = response.operation ?? generationOperation.value;
        if (response.operation === 'reroll' && rerollTargetMessageId.value < 0 && view.value.latestMessageId >= 0) {
          rerollTargetMessageId.value = view.value.latestMessageId;
        }
      }
      if (
        !response.busy &&
        activeRequestId.value &&
        pendingGenerationCompletionMessageId === undefined &&
        (generationAcknowledged ||
          generationState.value === 'stopping' ||
          (generationRequestedAt > 0 && Date.now() - generationRequestedAt > 8000))
      ) {
        // 停止后的 complete/error 回执也可能随浏览器事件一起丢失。控制器心跳已明确空闲时，
        // 以控制器状态为准释放本地生成锁，并重新读取时间线以接住已落盘的半截回复。
        restoreSubmittedDraft();
        pendingGenerationCompletionMessageId = undefined;
        finalizeGenerationCompletion();
        generationError.value = '生成已结束，正在同步实际聊天记录；如回复中断，可在最新回合重新生成或删除。';
        window.queueMicrotask(() => {
          if (started) resetTimeline(Math.max(view.value.latestMessageId, getLastMessageId()));
        });
      }
      if (
        previousProtocolVersion !== null &&
        previousProtocolVersion < PSEUDO_LAYER_TIMELINE_PAGING_VERSION &&
        response.version >= PSEUDO_LAYER_TIMELINE_PAGING_VERSION
      ) {
        timelineEntries.value = [];
        window.queueMicrotask(() => resetTimeline());
      }
      return;
    }
    if (response.type === 'view') {
      const normalizedView = normalizePseudoLayerView(response.view);
      const previousRevision = view.value.revision;
      const previousLatestMessageId = view.value.latestMessageId;
      const shouldRefreshFloor =
        normalizedView.hostMessageId === messageId &&
        (view.value.selectedMessageId !== normalizedView.selectedMessageId ||
          view.value.revision !== normalizedView.revision ||
          !floorMessage.value);
      view.value = normalizedView;
      if (isDetachedMode.value) {
        dialogueDrawerOpen.value = false;
        refreshHostState();
        return;
      }
      if (normalizedView.hostMessageId !== messageId) return;
      if (isRerolling.value && rerollTargetMessageId.value < 0) {
        rerollTargetMessageId.value = normalizedView.latestMessageId;
      }
      if (shouldRefreshFloor) refreshFloor(normalizedView.selectedMessageId);
      if (!shouldRefreshFloor && drawerDialogue.value && previousRevision !== normalizedView.revision) {
        refreshDialogueTurns(normalizedView.latestStateMessageId ?? getLastMessageId(), drawerDialogue.value.sessionId);
      }
      if (!supportsTimelinePaging.value) hydrateCompatibleTimelineEntry(normalizedView.selectedMessageId);
      if (
        (previousRevision !== normalizedView.revision || previousLatestMessageId !== normalizedView.latestMessageId) &&
        !isGenerating.value &&
        normalizedView.latestMessageId >= 0 &&
        (!timelineHasNewer.value ||
          timelineEntries.value.some(entry => entry.messageIds.includes(normalizedView.latestMessageId)))
      ) {
        refreshTimelineEntry(normalizedView.latestMessageId);
      }
      return;
    }
    if (response.type === 'timeline_page') {
      if (!timelineRequest || response.requestId !== timelineRequest.requestId) return;
      const request = timelineRequest;
      if (timelineTimeout !== null) window.clearTimeout(timelineTimeout);
      timelineTimeout = null;
      timelineRequest = undefined;
      timelineLoading.value = false;
      timelineRevision.value = response.revision;
      mergeTimelineEntries(response.entries, request.reset);
      if (request.reset) {
        timelineHasOlder.value = response.hasOlder;
        timelineHasNewer.value = response.hasNewer;
      } else if (request.direction === 'older') {
        timelineHasOlder.value = response.hasOlder;
      } else if (request.direction === 'newer') {
        timelineHasNewer.value = response.hasNewer;
      }
      const completionMessageId = pendingGenerationCompletionMessageId;
      if (
        completionMessageId !== undefined &&
        response.entries.some(
          entry =>
            entry.messageIds.includes(completionMessageId) ||
            entry.dialogueThreads?.some(thread => thread.messageIds.includes(completionMessageId)),
        )
      ) {
        finalizeGenerationCompletion();
      }
      flushPendingTimelineWork();
      return;
    }
    if (response.type === 'error' && timelineRequest && timelineRequest.requestId === response.requestId) {
      if (timelineTimeout !== null) window.clearTimeout(timelineTimeout);
      timelineTimeout = null;
      timelineRequest = undefined;
      timelineLoading.value = false;
      timelineError.value = response.message;
      // Keep the live reply until the completion fallback can read the saved floor.
      flushPendingTimelineWork();
      return;
    }
    if (response.type === 'deleted') {
      if (response.requestId !== deleteRequestId.value) return;
      deleteRequestId.value = '';
      generationError.value = '';
      if (drawerDialogue.value) {
        window.setTimeout(() => {
          const dialogue = drawerDialogue.value;
          if (dialogue) refreshDialogueTurns(view.value.latestStateMessageId ?? getLastMessageId(), dialogue.sessionId);
        }, 80);
      }
      window.setTimeout(() => resetTimeline(), 160);
      return;
    }
    if (response.type === 'pending_input_recovered') {
      if (response.requestId !== pendingInputRecoveryRequestId.value) return;
      pendingInputRecoveryRequestId.value = '';
      draftPrompt.value = response.userText;
      selectedTitle.value = '';
      generationError.value = '';
      focusNonce.value += 1;
      return;
    }
    if (response.type === 'message_updated') {
      if (response.requestId !== editRequestId.value) return;
      editRequestId.value = '';
      editError.value = '';
      if (view.value.selectedMessageId >= 0) refreshFloor(view.value.selectedMessageId);
      refreshTimelineEntry(response.messageId);
      editSavedNonce.value += 1;
      return;
    }
    if (response.type === 'error' && response.requestId === editRequestId.value) {
      editRequestId.value = '';
      editError.value = response.message;
      return;
    }
    if (response.type === 'error' && response.requestId === deleteRequestId.value) {
      deleteRequestId.value = '';
      generationError.value = response.message;
      return;
    }
    if (response.type === 'error' && response.requestId === pendingInputRecoveryRequestId.value) {
      pendingInputRecoveryRequestId.value = '';
      generationError.value = response.message;
      return;
    }
    if (
      response.type === 'reasoning' &&
      response.version >= PSEUDO_LAYER_REASONING_ISOLATION_VERSION &&
      !response.requestId
    ) {
      return;
    }
    if ('requestId' in response && !acceptsRequest(response.requestId, response.type === 'state')) {
      return;
    }
    if (response.type === 'state') {
      generationAcknowledged = true;
      if (pendingGenerationCompletionMessageId !== undefined) return;
      if (generationState.value === 'stopping' && response.state !== 'saving') return;
      if (generationState.value === 'saving' && response.state !== 'saving') return;
      generationState.value = response.state;
      generationOperation.value = response.operation;
      generationInteractionMode.value ??= activeDialogue.value ? 'dialogue' : 'story';
      if (response.userText) generationUserMessage.value = response.userText;
      generationError.value = '';
      if (response.state === 'generating' && !generationUserMessage.value) {
        refreshGenerationUserMessage();
        window.setTimeout(() => {
          if (isGenerating.value && !generationUserMessage.value) refreshGenerationUserMessage();
        }, 100);
      }
      return;
    }
    if (response.type === 'stream') {
      generationAcknowledged = true;
      if (pendingGenerationCompletionMessageId !== undefined) return;
      if (generationState.value !== 'stopping' && generationState.value !== 'saving') {
        generationState.value = 'generating';
      }
      if (!generationUserMessage.value) refreshGenerationUserMessage();
      streamText.value = response.text;
      streamReaction.value = response.reaction ?? '';
      return;
    }
    if (response.type === 'reasoning') {
      liveReasoning.value = sanitizeReasoningText(response.text);
      liveReasoningState.value = response.state;
      reasoningDuration.value = response.duration;
      return;
    }
    if (response.type === 'complete') {
      if (pendingGenerationCompletionMessageId !== undefined) return;
      refreshFloor(response.messageId);
      // 兼容旧控制器/后台解析补发的不带请求 ID 的完成通知。
      // 当前没有生成事务时只补读内容，不能凭完成通知再造一轮 live 正文。
      if (!isGenerating.value && !activeRequestId.value) {
        refreshTimelineEntry(response.messageId);
        return;
      }
      // Keep the completed stream mounted until its formal timeline entry arrives.
      // Clearing it here creates a short empty-layout frame that clamps scrollTop.
      generationState.value = 'saving';
      generationError.value = response.notice ?? '';
      // Only the submitted draft belongs to this request; rerolls must preserve unsent input.
      submittedDraft = undefined;
      if (!supportsTimelinePaging.value) {
        hydrateCompatibleTimelineEntry(response.messageId);
        finalizeGenerationCompletion();
        return;
      }
      pendingGenerationCompletionMessageId = response.messageId;
      refreshTimelineEntry(response.messageId);
      if (generationCompletionFallbackTimer !== null) {
        window.clearTimeout(generationCompletionFallbackTimer);
      }
      generationCompletionFallbackTimer = window.setTimeout(() => {
        generationCompletionFallbackTimer = null;
        if (generationState.value !== 'saving' || pendingGenerationCompletionMessageId !== response.messageId) {
          return;
        }
        // 时间线回执异常时不能让 saving 永久占用操作锁；先解锁，再补一次完整时间线同步。
        refreshFloor(response.messageId);
        hydrateCompatibleTimelineEntry(response.messageId, true);
        finalizeGenerationCompletion();
        resetTimeline(response.messageId);
      }, 5000);
      // 酒馆的正则/MVU 后处理可能稍晚于 GENERATION_ENDED 落盘。
      // 再读取两次可覆盖消息尾部的 UpdateVariable 延迟写入，而不要求重挂控制器。
      [240, 720].forEach(delay => {
        timelineRefreshTimers.push(
          window.setTimeout(() => {
            refreshTimelineEntry(response.messageId);
          }, delay),
        );
      });
      return;
    }
    if (response.type === 'error') {
      if (pendingGenerationCompletionMessageId !== undefined) return;
      restoreSubmittedDraft();
      finalizeGenerationCompletion();
      generationError.value = response.message;
      // Errors may leave an assistant floor without MESSAGE_RECEIVED or a frontend
      // marker. Read the host history instead of hiding that floor behind stale entries.
      window.queueMicrotask(() => {
        if (started) resetTimeline(Math.max(view.value.latestMessageId, getLastMessageId()));
      });
    }
  };
  const start = () => {
    if (started) return;
    started = true;
    refreshHostState();
    if (!isDetachedMode.value) refreshFloor();
    hostObserver = new MutationObserver(refreshHostState);
    hostObserver.observe(window.parent.document.body, { attributes: true, attributeFilter: ['class'] });
    const chat = window.parent.document.querySelector('#chat');
    if (chat) hostObserver.observe(chat, { childList: true });
    [
      tavern_events.MESSAGE_SENT,
      tavern_events.MESSAGE_RECEIVED,
      tavern_events.MESSAGE_DELETED,
      tavern_events.MESSAGE_SWIPED,
      tavern_events.MORE_MESSAGES_LOADED,
    ].forEach(event => {
      nativeMessageListeners.push(eventOn(event, refreshHostState));
    });
    window.addEventListener('message', handleMessage);
    sendHello();
    [250, 1000, 2500].forEach(delay => {
      helloRetryTimers.push(
        window.setTimeout(() => {
          if (started && !controllerReady.value) sendHello();
        }, delay),
      );
    });
    helloTimer = window.setInterval(() => {
      if (lastControllerReplyAt > 0 && Date.now() - lastControllerReplyAt > 8000) {
        controllerReady.value = false;
        controllerProtocolVersion.value = null;
        timelineRequest = undefined;
        timelineLoading.value = false;
      }
      sendHello();
    }, 4000);
  };
  const dispose = () => {
    if (!started) return;
    started = false;
    hostObserver?.disconnect();
    hostObserver = null;
    nativeMessageListeners.splice(0).forEach(listener => listener.stop());
    window.removeEventListener('message', handleMessage);
    if (helloTimer !== null) window.clearInterval(helloTimer);
    if (timelineTimeout !== null) window.clearTimeout(timelineTimeout);
    timelineTimeout = null;
    helloTimer = null;
    controllerReady.value = false;
    controllerProtocolVersion.value = null;
    helloRetryTimers.splice(0).forEach(timer => window.clearTimeout(timer));
    timelineRequest = undefined;
    timelineLoading.value = false;
    pendingTimelineRefreshMessageId = undefined;
    pendingTimelineResetAnchor = undefined;
    pendingGenerationCompletionMessageId = undefined;
    if (generationCompletionFallbackTimer !== null) window.clearTimeout(generationCompletionFallbackTimer);
    generationCompletionFallbackTimer = null;
    rerollTargetMessageId.value = -1;
    pendingInputRecoveryRequestId.value = '';
    timelineRefreshTimers.splice(0).forEach(timer => window.clearTimeout(timer));
    if (Number.isFinite(messageId)) {
      post({ channel: PSEUDO_LAYER_CHANNEL, version: PSEUDO_LAYER_VERSION, type: 'goodbye', messageId });
    }
  };
  const selectDraft = (title: string, prompt: string) => {
    if (isDetachedMode.value) {
      fillNativeInput(prompt);
      return;
    }
    if (isGenerating.value || !isStoryHistoryLatest.value) return;
    selectedTitle.value = title;
    draftPrompt.value = prompt;
    generationError.value = '';
    focusNonce.value += 1;
  };
  const clearDraft = () => {
    if (isGenerating.value) return;
    selectedTitle.value = '';
    draftPrompt.value = '';
    generationError.value = '';
  };
  function beginDialogue(target: DialogueTarget | DialogueContext, sessionId?: string) {
    if (isDetachedMode.value) {
      const name = target.targetName.trim();
      if (!name) return;
      fillNativeInput(
        target.channel === 'transmission' ? `以传讯向${name}问候，询问近况。` : `与${name}交谈，询问近况。`,
      );
      return;
    }
    if (isGenerating.value) return;
    const targetAnchor = 'anchorStoryMessageId' in target ? target.anchorStoryMessageId : undefined;
    const interaction: DialogueContext = {
      mode: 'dialogue',
      sessionId: sessionId ?? `dialogue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      targetName: target.targetName.trim(),
      canonicalName: target.canonicalName.trim(),
      channel: target.channel,
      anchorStoryMessageId: targetAnchor ?? latestStoryMessageId.value,
    };
    if (!interaction.targetName || !interaction.canonicalName) return;
    if (interaction.anchorStoryMessageId !== latestStoryMessageId.value) {
      drawerDialogue.value = interaction;
      dialogueReadOnly.value = true;
      dialogueDrawerOpen.value = true;
      refreshDialogueTurns(latestStateMessageId.value, interaction.sessionId);
      return;
    }
    if (dialogueContext.value?.sessionId !== interaction.sessionId) {
      refreshDialogueTurns(latestStateMessageId.value, interaction.sessionId);
    }
    recentDialogue.value = interaction;
    drawerDialogue.value = interaction;
    dialogueReadOnly.value = false;
    dialogueDrawerOpen.value = true;
    view.value = { ...view.value, activeInteraction: interaction };
    generationError.value = '';
    dialogueFocusNonce.value += 1;
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'set_interaction',
      interaction,
    });
  }
  const continueDialogue = () => {
    const context = dialogueContext.value;
    if (!context) return;
    beginDialogue(context, context.sessionId);
  };
  const openDialogueThread = (thread: PseudoLayerDialogueThread) => {
    const context: DialogueContext = {
      mode: 'dialogue',
      sessionId: thread.sessionId,
      targetName: thread.targetName,
      canonicalName: thread.canonicalName,
      channel: thread.channel,
      anchorStoryMessageId: thread.anchorStoryMessageId,
    };
    drawerDialogue.value = context;
    dialogueDrawerOpen.value = true;
    dialogueReadOnly.value = thread.anchorStoryMessageId !== latestStoryMessageId.value;
    recentDialogue.value = context;
    refreshDialogueTurns(latestStateMessageId.value, thread.sessionId);
    if (!dialogueReadOnly.value) beginDialogue(context, context.sessionId);
  };
  const resetDialogue = () => {
    const context = dialogueContext.value;
    if (!context || isGenerating.value || dialogueReadOnly.value) return;
    dialogueDraftPrompt.value = '';
    generationError.value = '';
    dialogueTurns.value = [];
    beginDialogue({
      targetName: context.targetName,
      canonicalName: context.canonicalName,
      channel: context.channel,
    });
  };
  const closeDialogueDrawer = () => {
    if (isGenerating.value && generationInteractionMode.value === 'dialogue') return;
    dialogueDrawerOpen.value = false;
    view.value = { ...view.value, activeInteraction: STORY_INTERACTION };
    generationError.value = '';
    post({ channel: PSEUDO_LAYER_CHANNEL, version: PSEUDO_LAYER_VERSION, type: 'end_interaction' });
  };
  const endDialogue = closeDialogueDrawer;
  const restoreSubmittedDraft = () => {
    if (generationOperation.value !== 'generate') return;
    const draft = submittedDraft ?? {
      prompt: generationUserMessage.value,
      title: '',
      mode: generationInteractionMode.value ?? 'story',
    };
    if (!draft.prompt) return;
    if (draft.mode === 'dialogue') {
      if (!dialogueDraftPrompt.value) dialogueDraftPrompt.value = draft.prompt;
    } else if (!draftPrompt.value) {
      draftPrompt.value = draft.prompt;
      selectedTitle.value = draft.title;
    }
  };
  const submit = (mode?: InteractionMode, useLatestAnchor = false) => {
    const requestedMode = mode ?? 'story';
    const prompt = requestedMode === 'dialogue' ? dialogueDraftPrompt.value.trim() : draftPrompt.value.trim();
    if (isDetachedMode.value) {
      if (fillNativeInput(prompt, true)) clearDraft();
      return;
    }
    const maySubmit = useLatestAnchor
      ? requestedMode === 'dialogue'
        ? canSubmitLatestDialogue.value
        : canSubmitLatestStory.value
      : requestedMode === 'dialogue'
        ? canSubmitDialogue.value
        : canSubmitStory.value;
    if (!prompt || !maySubmit || !Number.isFinite(messageId)) return;
    const requestId = `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const interaction: PseudoLayerInteraction =
      requestedMode === 'dialogue' && activeDialogue.value ? { ...activeDialogue.value } : STORY_INTERACTION;
    const history = view.value.histories[requestedMode];
    const anchorMessageId =
      requestedMode === 'dialogue'
        ? history.latestMessageId >= 0
          ? history.latestMessageId
          : latestStateMessageId.value
        : useLatestAnchor
          ? latestStoryMessageId.value
          : history.selectedMessageId >= 0
            ? history.selectedMessageId
            : latestStoryMessageId.value;
    if (interaction.mode === 'story' && activeDialogue.value) {
      view.value = { ...view.value, activeInteraction: STORY_INTERACTION };
      dialogueDrawerOpen.value = false;
      post({ channel: PSEUDO_LAYER_CHANNEL, version: PSEUDO_LAYER_VERSION, type: 'end_interaction' });
    }
    activeRequestId.value = requestId;
    generationAcknowledged = false;
    generationRequestedAt = Date.now();
    generationState.value = 'preparing';
    generationOperation.value = 'generate';
    generationInteractionMode.value = requestedMode;
    rerollTargetMessageId.value = -1;
    generationUserMessage.value = prompt;
    submittedDraft = { prompt, title: selectedTitle.value, mode: requestedMode };
    if (requestedMode === 'dialogue') dialogueDraftPrompt.value = '';
    else {
      draftPrompt.value = '';
      selectedTitle.value = '';
    }
    streamText.value = '';
    streamReaction.value = '';
    liveReasoning.value = '';
    liveReasoningState.value = 'none';
    reasoningDuration.value = null;
    generationError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'generate',
      requestId,
      messageId: anchorMessageId,
      prompt,
      interaction,
    });
  };
  const stop = () => {
    if (!canStop.value) return;
    generationState.value = 'stopping';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'stop',
      requestId: activeRequestId.value,
    });
  };
  const reroll = (targetMessageId = view.value.selectedMessageId) => {
    const latestDialogueTurn = dialogueTurns.value[dialogueTurns.value.length - 1];
    const rerollsDialogue = latestDialogueTurn?.assistantMessageId === targetMessageId;
    const rerollsStory = targetMessageId === latestStoryMessageId.value;
    const mayReroll =
      controllerReady.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value &&
      (rerollsDialogue || rerollsStory);
    if (!mayReroll || !Number.isFinite(messageId)) return;
    const dependentThreads =
      timelineEntries.value.find(entry => entry.representativeMessageId === targetMessageId)?.dialogueThreads ??
      dialogueThreads.value;
    if (rerollsStory && dependentThreads.length > 0) {
      const count = dependentThreads.length;
      if (!window.confirm(`重推这段正文将同时删除挂靠其下的 ${count} 个幕间会话。确定继续吗？`)) return;
    }
    const requestId = `reroll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeRequestId.value = requestId;
    generationAcknowledged = false;
    generationRequestedAt = Date.now();
    generationState.value = 'preparing';
    generationOperation.value = 'reroll';
    generationInteractionMode.value = rerollsDialogue ? 'dialogue' : 'story';
    rerollTargetMessageId.value = targetMessageId;
    generationUserMessage.value =
      (rerollsDialogue ? latestDialogueTurn?.userText : storyFloorUserMessage.value) ?? floorUserMessage.value;
    streamText.value = '';
    streamReaction.value = '';
    liveReasoning.value = '';
    liveReasoningState.value = 'none';
    reasoningDuration.value = null;
    generationError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'reroll',
      requestId,
      messageId: targetMessageId,
    });
  };
  const deleteCurrent = (targetMessageId = view.value.selectedMessageId) => {
    const latestDialogueTurn = dialogueTurns.value[dialogueTurns.value.length - 1];
    const deletesDialogue = latestDialogueTurn?.assistantMessageId === targetMessageId;
    const deletesStory = targetMessageId === latestStoryMessageId.value;
    const mayDelete =
      controllerReady.value &&
      !isGenerating.value &&
      !isDeleting.value &&
      !isUpdatingMessage.value &&
      (deletesDialogue || (deletesStory && view.value.histories.story.total > 1));
    if (!mayDelete || !Number.isFinite(messageId)) return;
    const dependentThreads =
      timelineEntries.value.find(entry => entry.representativeMessageId === targetMessageId)?.dialogueThreads ??
      dialogueThreads.value;
    if (deletesStory && dependentThreads.length > 0) {
      const count = dependentThreads.length;
      if (!window.confirm(`删除这段正文将同时删除挂靠其下的 ${count} 个幕间会话，且无法撤销。确定继续吗？`)) return;
    }
    const requestId = `delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    deleteRequestId.value = requestId;
    generationError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'delete_message',
      requestId,
      messageId: targetMessageId,
    });
  };
  const updateCurrentMessage = (content: string, targetMessageId = view.value.selectedMessageId) => {
    if (!canEditMessage.value || !Number.isFinite(messageId)) return;
    const requestId = `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    editRequestId.value = requestId;
    editError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'update_message',
      requestId,
      messageId: targetMessageId,
      content,
    });
  };
  const updateUserMessage = (content: string, userMessageId: number, assistantMessageId: number) => {
    if (
      !canEditUserMessage.value ||
      !Number.isFinite(userMessageId) ||
      !Number.isFinite(assistantMessageId) ||
      !content.trim()
    ) {
      return;
    }
    const requestId = `edit-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    editRequestId.value = requestId;
    editError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'update_user_message',
      requestId,
      messageId: Math.trunc(assistantMessageId),
      userMessageId: Math.trunc(userMessageId),
      content,
    });
  };
  const updateReasoning = (content: string, assistantMessageId: number) => {
    if (!canEditReasoning.value || !Number.isFinite(assistantMessageId) || !content.trim()) return;
    const requestId = `edit-reasoning-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    editRequestId.value = requestId;
    editError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'update_reasoning',
      requestId,
      messageId: Math.trunc(assistantMessageId),
      content,
    });
  };
  const clearEditError = () => {
    editError.value = '';
  };
  const selectHistory = (history: PseudoLayerHistoryKind) => {
    if (!Number.isFinite(messageId) || isGenerating.value) return;
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'select_history',
      history,
    });
  };
  const navigate = (direction: 'previous' | 'next', history?: PseudoLayerHistoryKind) => {
    if (!Number.isFinite(messageId) || isGenerating.value) return;
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'navigate',
      messageId: view.value.selectedMessageId,
      direction,
      ...(history ? { history } : {}),
    });
  };
  const returnLatest = () =>
    post({ channel: PSEUDO_LAYER_CHANNEL, version: PSEUDO_LAYER_VERSION, type: 'return_latest' });
  const returnHistoryLatest = (history: PseudoLayerHistoryKind) =>
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'return_latest',
      history,
    });
  const recoverPendingInput = () => {
    const pendingInput = view.value.pendingInput;
    if (
      !supportsPendingInputRecovery.value ||
      !pendingInput ||
      isGenerating.value ||
      pendingInputRecoveryRequestId.value
    ) {
      return;
    }
    const requestId = `recover-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingInputRecoveryRequestId.value = requestId;
    generationError.value = '';
    post({
      channel: PSEUDO_LAYER_CHANNEL,
      version: PSEUDO_LAYER_VERSION,
      type: 'recover_pending_input',
      requestId,
      latestMessageId: pendingInput.latestMessageId,
    });
  };
  const toggleNativeInput = () =>
    post({ channel: PSEUDO_LAYER_CHANNEL, version: PSEUDO_LAYER_VERSION, type: 'toggle_native_input' });
  const setDetached = (detached: boolean) => {
    if (!controllerReady.value) {
      toastr.info('请在酒馆助手中启用「灯火通明-伪同层控制器」脚本。');
      return;
    }
    if ((controllerProtocolVersion.value ?? 0) < PSEUDO_LAYER_DETACHED_VERSION) {
      toastr.info('请更新并重新启用伪同层控制器后切换模式。');
      return;
    }
    if (isGenerating.value || isDeleting.value || isUpdatingMessage.value) {
      toastr.info('请等待当前生成或楼层操作结束后再切换模式。');
      return;
    }
    post({ channel: PSEUDO_LAYER_CHANNEL, version: PSEUDO_LAYER_VERSION, type: 'set_detached', detached });
  };
  // 原生楼层与舞台共享同一行动入口，历史快照只允许填入起念。
  function fillNativeInput(prompt: string, direct = false) {
    refreshHostState();
    if (direct && !isNativeLatest.value) {
      toastr.info('请先回到最新楼层再发送行动。');
      return false;
    }
    const parentDocument = window.parent.document;
    const input = parentDocument.querySelector<HTMLTextAreaElement>('#send_textarea');
    const sendButton = parentDocument.querySelector<HTMLButtonElement>('#send_but');
    if (!input || (direct && !sendButton)) {
      toastr.info('请先打开酒馆聊天，再使用行动起念。');
      return false;
    }
    if (
      direct &&
      (!prompt.trim() ||
        input.disabled ||
        sendButton?.disabled ||
        parentDocument.querySelector('#mes_stop')?.getClientRects().length)
    ) {
      toastr.info('请等待当前生成结束，再发送行动。');
      return false;
    }
    input.value = prompt;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
    if (direct) sendButton!.click();
    else toastr.success('已填入酒馆输入框');
    return true;
  }
  const performAction = (title: string, prompt: string, direct = false) => {
    if (isDetachedMode.value) return fillNativeInput(prompt, direct);
    if (isGenerating.value || !isStoryHistoryLatest.value) {
      toastr.info('请先返回最新正文并等待推演结束，再选择行动。');
      return false;
    }
    selectDraft(title, prompt);
    if (direct && canSubmitStory.value) submit('story');
    return true;
  };
  return {
    messageId,
    isPseudoStage,
    isDetachedMode,
    isNativeLatest,
    controllerReady,
    controllerProtocolVersion,
    controllerCompatibilityMode,
    controllerConnectionDescription,
    supportsMessageEditing,
    supportsTimelinePaging,
    supportsUserMessageEditing,
    supportsPendingInputRecovery,
    supportsReasoningEditing,
    supportsDialogueDrawer,
    view,
    selectedTitle,
    draftPrompt,
    dialogueDraftPrompt,
    dialogueDrawerOpen,
    drawerDialogue,
    dialogueReadOnly,
    generationState,
    generationOperation,
    generationInteractionMode,
    rerollTargetMessageId,
    streamText,
    streamReaction,
    liveReasoning,
    liveReasoningState,
    reasoningDuration,
    generationError,
    activeRequestId,
    deleteRequestId,
    pendingInputRecoveryRequestId,
    editRequestId,
    editError,
    editSavedNonce,
    floorMessage,
    floorUserMessage,
    floorUserMessageId,
    generationUserMessage,
    floorReasoning,
    floorReasoningDuration,
    storyFloorMessageId,
    storyFloorMessage,
    storyFloorUserMessage,
    storyFloorUserMessageId,
    storyFloorReasoning,
    storyFloorReasoningDuration,
    storyFloorReasoningEditable,
    storyFloorNotice,
    dialogueTurns,
    dialogueThreads,
    timelineEntries,
    timelineHasOlder,
    timelineHasNewer,
    timelineLoading,
    timelineRevision,
    timelineError,
    recentDialogue,
    focusNonce,
    dialogueFocusNonce,
    isGenerating,
    canStop,
    generationLabel,
    generationWaitingText,
    isRerolling,
    isDeleting,
    isRecoveringPendingInput,
    isUpdatingMessage,
    isLatest,
    isStoryHistoryLatest,
    isDialogueHistoryLatest,
    isCurrentHistoryLatest,
    isSelected,
    activeDialogue,
    latestStoryMessageId,
    selectedDialogue,
    dialogueContext,
    isDialogueActive,
    isDialogueView,
    isDialogueWritable,
    canSubmit,
    canSubmitStory,
    canSubmitDialogue,
    canSubmitLatestStory,
    canSubmitLatestDialogue,
    canReroll,
    canRerollLatest,
    canDelete,
    canDeleteLatest,
    canEditMessage,
    canEditUserMessage,
    canEditReasoning,
    turnUserMessage,
    start,
    dispose,
    refreshFloor,
    readMessageContent,
    readUserMessageContent,
    loadTimelinePage,
    loadOlderTimeline,
    loadNewerTimeline,
    refreshTimelineEntry,
    resetTimeline,
    selectTimelineEntry,
    selectDraft,
    clearDraft,
    beginDialogue,
    openDialogueThread,
    continueDialogue,
    resetDialogue,
    endDialogue,
    closeDialogueDrawer,
    submit,
    stop,
    reroll,
    deleteCurrent,
    updateCurrentMessage,
    updateUserMessage,
    updateReasoning,
    clearEditError,
    selectHistory,
    navigate,
    returnLatest,
    returnHistoryLatest,
    recoverPendingInput,
    toggleNativeInput,
    setDetached,
    performAction,
  };
});
