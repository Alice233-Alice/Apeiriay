import {
  DialogueContext,
  DialogueEngineKind,
  PSEUDO_LAYER_CHANNEL,
  PSEUDO_LAYER_DETACHED_STORAGE_KEY,
  PSEUDO_LAYER_VERSION,
  PseudoLayerGenerationOperation,
  PseudoLayerGenerationState,
  PseudoLayerHistoryKind,
  PseudoLayerHistoryState,
  PseudoLayerInteraction,
  PseudoLayerInteractionMetadata,
  PseudoLayerPendingInput,
  PseudoLayerReasoningState,
  PseudoLayerRequest,
  PseudoLayerResponse,
  PseudoLayerStage,
  PseudoLayerTimelineEntry,
  PseudoLayerDialogueThread,
  PseudoLayerTimelineTurn,
  PseudoLayerView,
  isPseudoLayerRequest,
} from '../灯火通明/pseudo-layer-protocol';
import { Schema } from '../灯火通明/schema';
import { readAdviceInput, readPlayerInput } from '../灯火通明/player-input';
import {
  extractDialogueContent,
  extractInlineReasoning,
  parseMessageContent,
  sanitizeReasoningText,
  selectReasoningText,
} from '../灯火通明/message-content';
import { ParsedDialogueGeneration, generateDialogueReply, parseDialogueGeneration } from './dialogue-engine';
import { buildJourneyContext, JOURNEY_GENERATION_PREFIX, JOURNEY_PROMPT_ID } from '../灯火通明-测试版/journey';
import { clearReadingPosition, saveReadingPosition } from '../灯火通明-测试版/reading-position';

type ReplyTarget = MessageEventSource & Pick<Window, 'postMessage'>;
type WithoutEnvelope<T> = T extends unknown ? Omit<T, 'channel' | 'version'> : never;
type ResponsePayload = WithoutEnvelope<PseudoLayerResponse>;
type ChatRefreshMode = 'none' | 'affected' | 'all';

type NativeSwipeMessage = {
  mes?: string;
  send_date?: unknown;
  gen_started?: unknown;
  gen_finished?: unknown;
  extra?: Record<string, unknown>;
  swipe_id?: number;
  swipes?: unknown[];
  swipe_info?: Array<
    | {
        send_date?: unknown;
        gen_started?: unknown;
        gen_finished?: unknown;
        extra?: Record<string, unknown>;
      }
    | undefined
  >;
};

type GenerationReasoning = {
  messageId: number;
  text: string;
  duration: number | null;
  state: PseudoLayerReasoningState;
};

type NativeReasoningHandler = {
  state?: unknown;
  reasoning?: unknown;
  reasoningDisplayText?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  initialTime?: unknown;
  getDuration?: () => unknown;
};

type NativeStreamingProcessor = {
  messageId?: unknown;
  isFinished?: boolean;
  isStopped?: boolean;
  reasoningHandler?: NativeReasoningHandler;
};

type TavernRuntimeWindow = Window & {
  SillyTavern?: {
    getContext?: () => {
      streamingProcessor?: NativeStreamingProcessor | null;
    };
  };
};

type ActiveGeneration = {
  requestId: string;
  source: ReplyTarget;
  operation: PseudoLayerGenerationOperation;
  state: Exclude<PseudoLayerGenerationState, 'idle'>;
  baseMessageId: number;
  interaction: PseudoLayerInteraction;
  rawUserText: string;
  engine: DialogueEngineKind;
  generationId?: string;
  operationId?: string;
  chatId?: string;
  baselineLastMessageId?: number;
  cancelled?: boolean;
  userMessageId?: number;
  sent: boolean;
  received: boolean;
  streamText: string;
  streamReaction: string;
  reasoning?: GenerationReasoning;
  lockedView?: PseudoLayerView;
  rerollOriginal?: {
    messageId: number;
    name: string;
    role: 'system' | 'assistant' | 'user';
    isHidden: boolean;
    message: string;
    data: Record<string, any>;
    extra: Record<string, any>;
    swipeId?: number;
    swipes?: string[];
    swipesData?: Record<string, any>[];
    swipesInfo?: Record<string, any>[];
  };
  nativeSwipeOriginal?: NativeSwipeMessage;
  rerollRollback?: Promise<boolean>;
  rerollFailure?: Promise<void>;
  generationFailure?: Promise<void>;
  stopSettlementScheduled?: boolean;
  inactiveSince?: number;
};

type StageEntry = {
  representativeMessageId: number;
  messageIds: number[];
  stage: PseudoLayerStage;
};

type StageSnapshot = {
  assistantIds: Set<number>;
  entries: StageEntry[];
  messages: ChatMessage[];
  messagesById: Map<number, ChatMessage>;
  previousMessages: Map<number, ChatMessage>;
  timelineEntries?: PseudoLayerTimelineEntry[];
  timelineTurns?: Map<number, PseudoLayerTimelineTurn[]>;
};

type ControllerLease = {
  instanceId: string;
  dispose: () => void;
};

type ControllerHostWindow = Window & {
  __dhlPseudoLayerControllerLease__?: ControllerLease;
};

const STYLE_ID = 'dhl-pseudo-layer-controller-style';
const INPUT_STORAGE_KEY = 'denghuolanshan:pseudo-layer:native-input-collapsed';
const PENDING_NATIVE_REROLL_STORAGE_KEY = 'denghuolanshan:pseudo-layer:pending-native-rerolls-v1';
const MOBILE_INPUT_DEFAULT_APPLIED_KEY = 'denghuolanshan:pseudo-layer:mobile-native-input-default-v1';
const MOBILE_VIEWPORT_QUERY = '(max-width: 760px)';
const DIALOGUE_CARRYOVER_PROMPT_ID = 'denghuolanshan:dialogue-carryover';
const INTERACTION_KEY = 'dhl_pseudo_interaction';
const GENERATION_NOTICE_KEY = 'dhl_pseudo_generation_notice';
const STAGE_CLASS = 'dhl-pseudo-stage';
const SELECTED_CLASS = 'dhl-pseudo-selected';
const PARKED_FRAME_CLASS = 'dhl-pseudo-frame-parked';
const NATIVE_STAGE_CLASS = 'dhl-pseudo-native-stage';
const FRAME_KEEPER_CLASS = 'dhl-pseudo-frame-keeper';
const ACTIVE_KEEPER_CLASS = 'dhl-pseudo-frame-active';
const STAGE_ROOT_ID = 'dhl-pseudo-stage-root';
const ROOT_ACTIVE_CLASS = 'dhl-pseudo-stage-root-active';
const STREAM_DISPATCH_INTERVAL_MS = window.matchMedia?.('(pointer: coarse)').matches ? 240 : 160;
const FRAME_CANDIDATE_BATCH_MS = 32;
const FRAME_LOAD_GRACE_MS = 30000;
const STORY_INTERACTION = { mode: 'story' } as const;
const tavernWindow = window.parent;
const tavernDocument = tavernWindow.document;
const controllerHost = tavernWindow as ControllerHostWindow;
const controllerFrame = window.frameElement as HTMLIFrameElement | null;
const controllerInstanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const registrations = new Map<number, ReplyTarget>();
const controllerEventStops: EventOnReturn[] = [];
const duplicatePruneTimers: number[] = [];
let sourceProtocolVersions = new WeakMap<ReplyTarget, number>();
let sourceFrameCache = new WeakMap<ReplyTarget, HTMLIFrameElement>();
const frameMessageIdCache = new WeakMap<HTMLIFrameElement, number>();
const pendingFrameCandidates = new Set<HTMLIFrameElement>();
const frameLoadStartedAt = new WeakMap<HTMLIFrameElement, number>();

// Heavy presets emit dense DOM and message-event bursts, so stage work stays cached and coalesced.
let activeGeneration: ActiveGeneration | null = null;
let activeInteraction: PseudoLayerInteraction = STORY_INTERACTION;
let selectedMessageId: number | null = null;
const selectedHistoryMessageIds: Record<PseudoLayerHistoryKind, number | null> = {
  story: null,
  dialogue: null,
};
let selectedHistoryKind: PseudoLayerHistoryKind | null = null;
let browsingHistory = false;
let detachedMode = localStorage.getItem(PSEUDO_LAYER_DETACHED_STORAGE_KEY) === 'true';
let deletingMessageId: number | null = null;
let updatingMessageId: number | null = null;
const nativeInputMedia = tavernWindow.matchMedia(MOBILE_VIEWPORT_QUERY);
const shouldApplyMobileInputDefault =
  nativeInputMedia.matches && localStorage.getItem(MOBILE_INPUT_DEFAULT_APPLIED_KEY) === null;
let nativeInputFollowsViewport = shouldApplyMobileInputDefault || localStorage.getItem(INPUT_STORAGE_KEY) === null;
let nativeInputCollapsed = shouldApplyMobileInputDefault
  ? true
  : nativeInputFollowsViewport
    ? nativeInputMedia.matches
    : localStorage.getItem(INPUT_STORAGE_KEY) === 'true';
if (shouldApplyMobileInputDefault) {
  localStorage.setItem(MOBILE_INPUT_DEFAULT_APPLIED_KEY, 'true');
  localStorage.setItem(INPUT_STORAGE_KEY, 'true');
}
let viewRevision = 0;
let frameObserver: MutationObserver | null = null;
let observedChat: HTMLElement | null = null;
let duplicateControllerObserver: MutationObserver | null = null;
let frameCandidateTimer: number | null = null;
let viewRefreshTimer: number | null = null;
let viewRefreshDeadline = 0;
let mobileStageAlignFrame: number | null = null;
let stageSnapshotCache: StageSnapshot | null = null;
let stageSnapshotLastMessageId = Number.NaN;
let streamDispatchTimer: number | null = null;
let pendingStreamDispatch: {
  requestId: string;
  source: ReplyTarget;
  text: string;
  reaction?: string;
  reasoning?: GenerationReasoning;
} | null = null;
let controllerDisposed = false;
let generationHealthTimer: number | null = null;
// A heartbeat can recover the final receipt after a frame reload or a dropped message.
const generationReceipts = new Map<string, { chatId: string | undefined; payload: ResponsePayload }>();

const rememberSourceProtocolVersion = (source: ReplyTarget, version: number) => {
  const previous = sourceProtocolVersions.get(source) ?? 0;
  if (version > previous) sourceProtocolVersions.set(source, version);
};

const send = (source: ReplyTarget | undefined, message: ResponsePayload) => {
  if (
    activeGeneration &&
    (message.type === 'complete' || message.type === 'error') &&
    message.requestId === activeGeneration?.requestId
  ) {
    generationReceipts.set(message.requestId!, { chatId: activeGeneration.chatId, payload: message });
    if (generationReceipts.size > 8) generationReceipts.delete(generationReceipts.keys().next().value!);
  }
  source?.postMessage(
    {
      channel: PSEUDO_LAYER_CHANNEL,
      version: (source && sourceProtocolVersions.get(source)) ?? PSEUDO_LAYER_VERSION,
      ...message,
    } as PseudoLayerResponse,
    '*',
  );
};

const flushQueuedStream = (generation?: ActiveGeneration | null) => {
  if (streamDispatchTimer !== null) {
    window.clearTimeout(streamDispatchTimer);
    streamDispatchTimer = null;
  }
  const pending = pendingStreamDispatch;
  pendingStreamDispatch = null;
  if (!pending || (generation && pending.requestId !== generation.requestId)) return;
  if (!generation && activeGeneration?.requestId !== pending.requestId) return;
  send(pending.source, {
    type: 'stream',
    requestId: pending.requestId,
    text: pending.text,
    ...(pending.reaction ? { reaction: pending.reaction } : {}),
  });
  if (pending.reasoning) {
    send(pending.source, {
      type: 'reasoning',
      requestId: pending.requestId,
      ...pending.reasoning,
    });
  }
};

const queueStream = (generation: ActiveGeneration, text: string, reaction = '', reasoning?: GenerationReasoning) => {
  const queuedReasoning =
    reasoning ??
    (pendingStreamDispatch?.requestId === generation.requestId ? pendingStreamDispatch.reasoning : undefined);
  pendingStreamDispatch = {
    requestId: generation.requestId,
    source: generation.source,
    text,
    ...(reaction ? { reaction } : {}),
    ...(queuedReasoning ? { reasoning: queuedReasoning } : {}),
  };
  if (streamDispatchTimer !== null) return;
  streamDispatchTimer = window.setTimeout(() => {
    streamDispatchTimer = null;
    flushQueuedStream();
  }, STREAM_DISPATCH_INTERVAL_MS);
};

const discardQueuedStream = () => {
  if (streamDispatchTimer !== null) window.clearTimeout(streamDispatchTimer);
  streamDispatchTimer = null;
  pendingStreamDispatch = null;
};

const sendGenerationState = (
  generation: ActiveGeneration,
  state: Exclude<PseudoLayerGenerationState, 'idle'>,
  source = generation.source,
) => {
  if (generation.cancelled && state !== 'stopping' && state !== 'saving') return;
  generation.state = state;
  send(source, {
    type: 'state',
    requestId: generation.requestId,
    state,
    operation: generation.operation,
    ...(generation.rawUserText ? { userText: generation.rawUserText } : {}),
  });
};

const replayGeneration = (generation: ActiveGeneration, source: ReplyTarget) => {
  sendGenerationState(generation, generation.state, source);
  if (generation.streamText) {
    send(source, {
      type: 'stream',
      requestId: generation.requestId,
      text: generation.streamText,
      ...(generation.streamReaction ? { reaction: generation.streamReaction } : {}),
    });
  }
  if (generation.reasoning) {
    send(source, {
      type: 'reasoning',
      requestId: generation.requestId,
      ...generation.reasoning,
    });
  }
};

const asReplyTarget = (source: MessageEventSource | null): ReplyTarget | null => {
  if (!source || typeof (source as Window).postMessage !== 'function') return null;
  return source as ReplyTarget;
};

const normalizeDialogueContext = (value: unknown): DialogueContext | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DialogueContext>;
  if (candidate.mode !== 'dialogue' || (candidate.channel !== 'present' && candidate.channel !== 'transmission')) {
    return null;
  }
  const sessionId = String(candidate.sessionId ?? '').trim();
  const targetName = String(candidate.targetName ?? '').trim();
  const canonicalName = String(candidate.canonicalName ?? '').trim();
  if (!sessionId || !targetName || !canonicalName) return null;
  const anchorStoryMessageId = Number(candidate.anchorStoryMessageId);
  return {
    mode: 'dialogue',
    sessionId,
    targetName,
    canonicalName,
    channel: candidate.channel,
    ...(Number.isInteger(anchorStoryMessageId) && anchorStoryMessageId >= 0 ? { anchorStoryMessageId } : {}),
  };
};

const isSameInteraction = (left: PseudoLayerInteraction, right: PseudoLayerInteraction) =>
  left.mode === right.mode &&
  (left.mode === 'story' ||
    (right.mode === 'dialogue' &&
      left.sessionId === right.sessionId &&
      left.targetName === right.targetName &&
      left.canonicalName === right.canonicalName &&
      left.channel === right.channel &&
      left.anchorStoryMessageId === right.anchorStoryMessageId));

const setActiveInteraction = (interaction: PseudoLayerInteraction) => {
  const normalized =
    interaction.mode === 'dialogue' ? (normalizeDialogueContext(interaction) ?? STORY_INTERACTION) : STORY_INTERACTION;
  const next =
    normalized.mode === 'dialogue' && normalized.anchorStoryMessageId === undefined
      ? { ...normalized, anchorStoryMessageId: latestStoryStageId() }
      : normalized;
  if (isSameInteraction(activeInteraction, next)) return;
  activeInteraction = next;
};

const getMessageElement = (messageId: number) =>
  tavernDocument.querySelector<HTMLElement>(`#chat > .mes[mesid='${messageId}']`);

const getStageRoot = (create = true) => {
  let root = tavernDocument.getElementById(STAGE_ROOT_ID);
  if (!root && create) {
    const chat = tavernDocument.querySelector<HTMLElement>('#chat');
    if (!chat) return null;
    root = tavernDocument.createElement('div');
    root.id = STAGE_ROOT_ID;
    chat.append(root);
  }
  return root;
};

const getFrameKeeper = (messageId: number, create = true) => {
  const root = getStageRoot(create);
  if (!root) return null;
  let keeper = root.querySelector<HTMLElement>(`:scope > .${FRAME_KEEPER_CLASS}[data-message-id='${messageId}']`);
  if (!keeper && create) {
    keeper = tavernDocument.createElement('div');
    keeper.className = FRAME_KEEPER_CLASS;
    keeper.dataset.messageId = String(messageId);
    root.append(keeper);
  }
  return keeper ?? null;
};

const getFrameMessageId = (frame: HTMLIFrameElement) => {
  const rawMessageId = frame.dataset.dhlMessageId ?? frame.closest<HTMLElement>('.mes')?.getAttribute('mesid');
  if (rawMessageId === undefined || rawMessageId === null || rawMessageId.trim() === '') {
    return frameMessageIdCache.get(frame);
  }
  const messageId = Number(rawMessageId);
  if (Number.isFinite(messageId)) {
    frameMessageIdCache.set(frame, messageId);
    return messageId;
  }
  return frameMessageIdCache.get(frame);
};

const rememberFrame = (frame: HTMLIFrameElement) => {
  const source = asReplyTarget(frame.contentWindow);
  if (source) sourceFrameCache.set(source, frame);
  getFrameMessageId(frame);
};

const getFrameForSource = (source: ReplyTarget) => {
  const cached = sourceFrameCache.get(source);
  if (cached?.isConnected && cached.contentWindow === source) return cached;
  sourceFrameCache.delete(source);

  const frame = [
    ...tavernDocument.querySelectorAll<HTMLIFrameElement>(
      `#chat > .mes .TH-render iframe, #${STAGE_ROOT_ID} > .${FRAME_KEEPER_CLASS} > iframe`,
    ),
  ].find(candidate => candidate.contentWindow === source);
  if (frame) rememberFrame(frame);
  return frame;
};

const hasMountedPseudoApp = (frame: HTMLIFrameElement | null | undefined) => {
  try {
    return Boolean(frame?.contentDocument?.querySelector('#app > .cultivation-status'));
  } catch {
    return false;
  }
};

const isPseudoFrontendLoader = (frame: HTMLIFrameElement) => {
  const code = frame.closest('.TH-render')?.querySelector('pre code')?.textContent ?? '';
  let loader = code;
  try {
    loader = decodeURIComponent(code);
  } catch {
    // 原始加载器含普通百分号时直接按原文识别。
  }
  return (
    /(?:\$|jQuery)\s*\(\s*(['"])body\1\s*\)\s*\.load\s*\(/u.test(loader) &&
    /(?:灯火通明|灯火阑珊)(?:-测试版)?\/index\.html(?=[?#'"]|$)/u.test(loader)
  );
};

/**
 * 酒馆切换 swipe 时会清空 `.mes_text`，连同其中的 TH-render 一起销毁。
 * 原 iframe 受酒馆助手虚拟 DOM 管理，移动后仍会被删除；因此创建一个控制器自有
 * 的同源实例。原节点继续留给酒馆刷新，自有实例挂载完成后接管可见舞台。
 */
const parkFrame = (messageId: number, frame: HTMLIFrameElement) => {
  if (detachedMode || controllerDisposed) return false;
  if (frame.dataset.dhlControllerOwned === 'true' && frame.closest(`#${STAGE_ROOT_ID}`)) return false;
  // 宿主可能先插入空 iframe 再填入地址；不能把 about:blank 当成正在加载的完整前端。
  const sourceUrl = frame.getAttribute('src')?.trim();
  if (!frame.getAttribute('srcdoc')?.trim() && (!sourceUrl || sourceUrl === 'about:blank')) return false;
  // 已确认的本项目前端加载器可直接创建自有实例，避开视口外懒加载和两次串行挂载。
  // 其他 iframe 仍需实际挂载灯火界面才允许接管。
  if (!hasMountedPseudoApp(frame) && !isPseudoFrontendLoader(frame)) return false;
  const message = getMessageElement(messageId);
  if (!message || message.getAttribute('is_user') === 'true') return false;
  frame.closest('.TH-render')?.classList.add(NATIVE_STAGE_CLASS);
  const keeper = getFrameKeeper(messageId);
  if (!keeper) return false;

  const keptFrame = keeper.querySelector<HTMLIFrameElement>(':scope > iframe');
  if (keptFrame === frame) return true;
  if (keptFrame) {
    const keptSource = asReplyTarget(keptFrame.contentWindow);
    const keptIsLive =
      hasMountedPseudoApp(keptFrame) || (keptSource !== null && registrations.get(messageId) === keptSource);
    if (keptIsLive) return false;
    // 慢设备上模块导入可能持续数秒，重复 DOM/hello 通知不能不断销毁正在启动的实例。
    const startedAt = frameLoadStartedAt.get(keptFrame);
    if (startedAt !== undefined && Date.now() - startedAt < FRAME_LOAD_GRACE_MS) return false;
    keptFrame.remove();
  }

  if (frame.dataset.dhlControllerOwned === 'true') {
    frame.dataset.dhlMessageId = String(messageId);
    keeper.append(frame);
    rememberFrame(frame);
    return true;
  }

  const ownedFrame = frame.cloneNode(false) as HTMLIFrameElement;
  for (const name of ['id', 'loading', 'style', 'width', 'height']) ownedFrame.removeAttribute(name);
  ownedFrame.dataset.dhlControllerOwned = 'true';
  ownedFrame.dataset.dhlMessageId = String(messageId);
  frameLoadStartedAt.set(ownedFrame, Date.now());
  ownedFrame.addEventListener('load', () => scheduleViewRefresh(0), { once: true });
  keeper.append(ownedFrame);
  rememberFrame(ownedFrame);
  message.classList.add(PARKED_FRAME_CLASS);
  return true;
};

const parkSourceFrame = (source: ReplyTarget) => {
  const frame = getFrameForSource(source);
  const messageId = frame ? getFrameMessageId(frame) : undefined;
  return frame && messageId !== undefined ? parkFrame(messageId, frame) : false;
};

const getParkedMessageId = () => {
  const keepers = [...(getStageRoot(false)?.querySelectorAll<HTMLElement>(`:scope > .${FRAME_KEEPER_CLASS}`) ?? [])];
  const isMounted = (keeper: HTMLElement) =>
    // 自有舞台的身份与正文楼层分离：删除楼层或宿主虚拟化回收 DOM 后继续复用。
    hasMountedPseudoApp(keeper.querySelector<HTMLIFrameElement>(':scope > iframe'));
  const active = keepers.find(keeper => keeper.classList.contains(ACTIVE_KEEPER_CLASS) && isMounted(keeper));
  const keeper = active ?? keepers.filter(isMounted).at(-1);
  const messageId = Number(keeper?.dataset.messageId);
  return Number.isFinite(messageId) ? messageId : undefined;
};

const rememberStageReadingPosition = () => {
  const messageId = getParkedMessageId();
  if (messageId === undefined) return;
  saveReadingPosition(
    getFrameKeeper(messageId, false)?.querySelector<HTMLIFrameElement>(':scope > iframe'),
    String(getCurrentChatId()),
  );
};

const syncParkedStage = (hostMessageId: number | undefined) => {
  const root = getStageRoot(false);
  let hasActiveFrame = false;
  root?.querySelectorAll<HTMLElement>(`:scope > .${FRAME_KEEPER_CLASS}`).forEach(keeper => {
    const active =
      Number(keeper.dataset.messageId) === hostMessageId &&
      hasMountedPseudoApp(keeper.querySelector<HTMLIFrameElement>(':scope > iframe'));
    keeper.classList.toggle(ACTIVE_KEEPER_CLASS, active);
    if (active) hasActiveFrame = true;
  });
  tavernDocument.body.classList.toggle(ROOT_ACTIVE_CLASS, hasActiveFrame);
  if (hasActiveFrame) {
    root?.querySelectorAll<HTMLElement>(`:scope > .${FRAME_KEEPER_CLASS}`).forEach(keeper => {
      if (keeper.classList.contains(ACTIVE_KEEPER_CLASS)) return;
      const frame = keeper.querySelector<HTMLIFrameElement>(':scope > iframe');
      const id = Number(keeper.dataset.messageId);
      if (frame?.contentWindow === registrations.get(id)) registrations.delete(id);
      keeper.remove();
    });
  }
};

const releaseParkedFrames = () => {
  const root = getStageRoot(false);
  root?.querySelectorAll<HTMLElement>(`:scope > .${FRAME_KEEPER_CLASS}`).forEach(keeper => {
    const messageId = Number(keeper.dataset.messageId);
    if (Number.isFinite(messageId)) getMessageElement(messageId)?.classList.remove(PARKED_FRAME_CLASS);
  });
  root?.remove();
  tavernDocument.body.classList.remove(ROOT_ACTIVE_CLASS);
};

const getAllMessages = (): ChatMessage[] => {
  const lastMessageId = getLastMessageId();
  if (!Number.isFinite(lastMessageId) || lastMessageId < 0) return [];
  return getChatMessages(`0-${lastMessageId}`);
};

const getAdjacentMessages = (messageId: number): ChatMessage[] => {
  if (!Number.isFinite(messageId) || messageId < 0) return [];
  const normalizedMessageId = Math.trunc(messageId);
  return getChatMessages(`${Math.max(0, normalizedMessageId - 1)}-${normalizedMessageId}`);
};

const invalidateStageSnapshot = () => {
  stageSnapshotCache = null;
  stageSnapshotLastMessageId = Number.NaN;
};

const migrateLegacyDialogueMessages = async () => {
  const messages = [...getAllMessages()].sort((left, right) => left.message_id - right.message_id);
  const updates: Parameters<typeof setChatMessages>[0] = [];
  let latestStoryMessageId: number | undefined;

  messages.forEach(message => {
    const metadata = readInteractionMetadata(message);
    if (message.role === 'assistant' && !metadata) {
      latestStoryMessageId = message.message_id;
      return;
    }
    if (!metadata || latestStoryMessageId === undefined) return;
    const nextMetadata: PseudoLayerInteractionMetadata = {
      ...metadata,
      version: 3,
      anchorStoryMessageId: metadata.anchorStoryMessageId ?? latestStoryMessageId,
    };
    if (message.is_hidden && metadata.version === 3 && metadata.anchorStoryMessageId !== undefined) return;
    updates.push({
      message_id: message.message_id,
      is_hidden: true,
      extra: {
        ...(message.extra ?? {}),
        [INTERACTION_KEY]: nextMetadata,
      },
    });
  });

  if (updates.length === 0) return;
  await setChatMessages(updates, { refresh: 'affected' });
  invalidateStageSnapshot();
  viewRevision += 1;
  console.info(`[灯火阑珊·幕间交谈] 已归档 ${updates.length} 条旧交谈楼层`);
};

const readInteractionMetadata = (message: ChatMessage | undefined): PseudoLayerInteractionMetadata | null => {
  if (!message) return null;
  const direct = message.extra?.[INTERACTION_KEY];
  const nested = message.extra?.extra?.[INTERACTION_KEY];
  const value = (direct ?? nested) as Partial<PseudoLayerInteractionMetadata> | undefined;
  if (!value || (value.version !== 1 && value.version !== 2 && value.version !== 3) || value.kind !== 'dialogue') {
    return null;
  }
  const context = normalizeDialogueContext({ mode: 'dialogue', ...value });
  if (!context) return null;
  const userMessageId = Number(value.userMessageId);
  return {
    ...value,
    version: value.version,
    kind: 'dialogue',
    ...context,
    ...(typeof value.rawUserText === 'string' ? { rawUserText: value.rawUserText } : {}),
    ...(Number.isFinite(userMessageId) ? { userMessageId } : {}),
  } as PseudoLayerInteractionMetadata;
};

const toDialogueContext = (metadata: PseudoLayerInteractionMetadata): DialogueContext => ({
  mode: 'dialogue',
  sessionId: metadata.sessionId,
  targetName: metadata.targetName,
  canonicalName: metadata.canonicalName,
  channel: metadata.channel,
  ...(Number.isInteger(metadata.anchorStoryMessageId) ? { anchorStoryMessageId: metadata.anchorStoryMessageId } : {}),
});

const findPreviousUserMessage = (messages: ChatMessage[], messageId: number) =>
  [...messages].reverse().find(message => message.role === 'user' && message.message_id < messageId);

const findPreviousMessage = (messages: ChatMessage[], messageId: number) =>
  [...messages].reverse().find(message => message.message_id < messageId);

const resolveAssistantInteractionMetadata = (
  message: ChatMessage | undefined,
  messages: ChatMessage[],
): PseudoLayerInteractionMetadata | null => {
  const direct = readInteractionMetadata(message);
  if (direct || !message || message.role !== 'assistant') return direct;

  const userMessage = findPreviousMessage(messages, message.message_id);
  if (userMessage?.role !== 'user') return null;
  const userMetadata = readInteractionMetadata(userMessage);
  if (!userMetadata) return null;
  return {
    ...userMetadata,
    userMessageId: userMessage.message_id,
  };
};

const getAssistantMessagesFromDom = (): ChatMessage[] =>
  [...tavernDocument.querySelectorAll<HTMLElement>('#chat > .mes')]
    .filter(element => element.getAttribute('is_user') === 'false' && element.getAttribute('is_system') === 'false')
    .map(element => ({
      message_id: Number(element.getAttribute('mesid')),
      name: '',
      role: 'assistant' as const,
      is_hidden: false,
      message: '',
      data: {},
      extra: {},
    }))
    .filter(message => Number.isFinite(message.message_id));

const buildStageEntries = (
  assistantMessages: ChatMessage[],
  previousMessages: Map<number, ChatMessage>,
): StageEntry[] => {
  const entries: StageEntry[] = [];
  let latestStoryMessageId: number | undefined;
  assistantMessages.forEach(message => {
    const directMetadata = readInteractionMetadata(message);
    const previousMessage = previousMessages.get(message.message_id);
    const inheritedMetadata =
      !directMetadata && previousMessage?.role === 'user' ? readInteractionMetadata(previousMessage) : null;
    const metadata =
      directMetadata ??
      (inheritedMetadata ? { ...inheritedMetadata, userMessageId: previousMessage!.message_id } : null);
    const anchorStoryMessageId = metadata?.anchorStoryMessageId ?? latestStoryMessageId;
    const previous = entries.at(-1);
    if (
      metadata &&
      previous?.stage.kind === 'dialogue' &&
      previous.stage.sessionId === metadata.sessionId &&
      previous.stage.anchorStoryMessageId === anchorStoryMessageId
    ) {
      previous.messageIds.push(message.message_id);
      previous.representativeMessageId = message.message_id;
      previous.stage.turnCount += 1;
      previous.stage.engine = metadata.engine ?? previous.stage.engine;
      return;
    }

    entries.push({
      representativeMessageId: message.message_id,
      messageIds: [message.message_id],
      stage: metadata
        ? {
            kind: 'dialogue',
            sessionId: metadata.sessionId,
            targetName: metadata.targetName,
            canonicalName: metadata.canonicalName,
            channel: metadata.channel,
            turnCount: 1,
            engine: metadata.engine,
            ...(anchorStoryMessageId !== undefined ? { anchorStoryMessageId } : {}),
          }
        : { kind: 'story' },
    });
    if (!metadata) latestStoryMessageId = message.message_id;
  });
  return entries;
};

const getStageSnapshot = (): StageSnapshot => {
  const lastMessageId = getLastMessageId();
  if (stageSnapshotCache && stageSnapshotLastMessageId === lastMessageId) return stageSnapshotCache;

  let messages: ChatMessage[];
  let assistantMessages: ChatMessage[];
  try {
    messages = [...getAllMessages()].sort((left, right) => left.message_id - right.message_id);
    assistantMessages = messages.filter(message => message.role === 'assistant');
  } catch (error) {
    console.warn('[灯火阑珊·伪同层] 读取完整聊天楼层失败，暂时使用页面楼层', error);
    assistantMessages = getAssistantMessagesFromDom().sort((left, right) => left.message_id - right.message_id);
    messages = assistantMessages;
  }

  const previousMessages = new Map<number, ChatMessage>();
  const messagesById = new Map<number, ChatMessage>();
  let previousMessage: ChatMessage | undefined;
  messages.forEach(message => {
    messagesById.set(message.message_id, message);
    if (previousMessage) previousMessages.set(message.message_id, previousMessage);
    previousMessage = message;
  });

  stageSnapshotCache = {
    assistantIds: new Set(assistantMessages.map(message => message.message_id)),
    entries: buildStageEntries(assistantMessages, previousMessages),
    messages,
    messagesById,
    previousMessages,
  };
  stageSnapshotLastMessageId = lastMessageId;
  return stageSnapshotCache;
};

const readTimelineReasoning = (message: ChatMessage | undefined) => {
  const direct = (message?.extra ?? {}) as Record<string, any>;
  const nested =
    direct.extra && typeof direct.extra === 'object'
      ? (direct.extra as Record<string, any>)
      : ({} as Record<string, any>);
  const inlineReasoning = extractInlineReasoning(String(message?.message ?? ''));
  const nativeReasoning = String(direct.reasoning ?? nested.reasoning ?? '').trim();
  const reasoning = selectReasoningText(nativeReasoning, inlineReasoning?.text ?? '');
  const rawDuration = Number(direct.reasoning_duration ?? nested.reasoning_duration);
  return {
    reasoning,
    reasoningDuration: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null,
    reasoningEditable: Boolean(nativeReasoning),
  };
};

const isReasoningState = (value: unknown): value is PseudoLayerReasoningState =>
  value === 'none' || value === 'thinking' || value === 'done' || value === 'hidden';

const toReasoningTimestamp = (value: unknown) => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const readMessageResponseDuration = (message: ChatMessage | undefined) => {
  const direct = (message?.extra ?? {}) as Record<string, any>;
  const nested =
    direct.extra && typeof direct.extra === 'object'
      ? (direct.extra as Record<string, any>)
      : ({} as Record<string, any>);
  const startedAt = toReasoningTimestamp(direct.gen_started ?? nested.gen_started);
  const finishedAt = toReasoningTimestamp(direct.gen_finished ?? nested.gen_finished);
  if (startedAt === null || finishedAt === null || finishedAt < startedAt) return undefined;
  return Math.round(finishedAt - startedAt);
};

const readNativeLiveReasoning = (generation: ActiveGeneration): GenerationReasoning | null => {
  let processor: NativeStreamingProcessor | null | undefined;
  try {
    processor = (tavernWindow as TavernRuntimeWindow).SillyTavern?.getContext?.().streamingProcessor;
  } catch {
    processor = null;
  }

  const handler = processor?.reasoningHandler;
  const runtimeReasoning =
    typeof handler?.reasoningDisplayText === 'string' && handler.reasoningDisplayText.trim()
      ? handler.reasoningDisplayText
      : typeof handler?.reasoning === 'string'
        ? handler.reasoning
        : '';
  let text = sanitizeReasoningText(runtimeReasoning);
  let messageId = Number(processor?.messageId);
  let rawState: unknown = handler?.state;
  let duration: number | null = null;

  try {
    const reportedDuration = Number(handler?.getDuration?.());
    if (Number.isFinite(reportedDuration) && reportedDuration >= 0) duration = reportedDuration;
  } catch {
    // Older SillyTavern versions may expose the handler without getDuration().
  }

  if (duration === null && text) {
    const startedAt = toReasoningTimestamp(handler?.startTime) ?? toReasoningTimestamp(handler?.initialTime);
    const endedAt = toReasoningTimestamp(handler?.endTime);
    if (startedAt !== null) duration = Math.max(0, (endedAt ?? Date.now()) - startedAt);
  }

  const belongsToGeneration = (candidateId: number) => {
    if (!Number.isInteger(candidateId) || candidateId < 0) return false;
    if (generation.operation === 'reroll') return candidateId === generation.baseMessageId;
    if (Number.isInteger(generation.userMessageId)) return candidateId > Number(generation.userMessageId);
    return candidateId > generation.baseMessageId;
  };
  const domMessage =
    (belongsToGeneration(messageId) ? getMessageElement(messageId) : null) ??
    [...tavernDocument.querySelectorAll<HTMLElement>('#chat > .mes[data-reasoning-state="thinking"]')]
      .reverse()
      .find(element => belongsToGeneration(Number(element.getAttribute('mesid'))));
  if (domMessage) {
    const domMessageId = Number(domMessage.getAttribute('mesid'));
    if (!Number.isInteger(messageId) || messageId < 0) messageId = domMessageId;
    if (!text) {
      text = sanitizeReasoningText(domMessage.querySelector<HTMLElement>('.mes_reasoning')?.innerText ?? '');
    }
    rawState ??=
      domMessage.dataset.reasoningState ??
      domMessage.querySelector<HTMLDetailsElement>('.mes_reasoning_details')?.dataset.state;
    if (duration === null) {
      const domDuration = Number(
        domMessage.querySelector<HTMLElement>('.mes_reasoning_header_title')?.dataset.duration ??
          domMessage.querySelector<HTMLDetailsElement>('.mes_reasoning_details')?.dataset.duration,
      );
      if (Number.isFinite(domDuration) && domDuration > 0) {
        // The header exposes seconds while message extras and the pseudo layer use milliseconds.
        duration = domDuration * 1000;
      }
    }
  }

  if (!text || !belongsToGeneration(messageId)) return null;
  const state = isReasoningState(rawState) && rawState !== 'none' ? rawState : 'thinking';
  return { messageId, text, duration, state };
};

const updateGenerationReasoning = (
  generation: ActiveGeneration,
  reasoning: GenerationReasoning | null,
): GenerationReasoning | undefined => {
  if (!reasoning) return undefined;
  const previous = generation.reasoning;
  generation.reasoning = reasoning;
  if (
    previous?.messageId === reasoning.messageId &&
    previous.text === reasoning.text &&
    previous.duration === reasoning.duration &&
    previous.state === reasoning.state
  ) {
    return undefined;
  }
  return reasoning;
};

const readMessageTokenCount = (message: ChatMessage | undefined) => {
  const direct = (message?.extra ?? {}) as Record<string, any>;
  const nested =
    direct.extra && typeof direct.extra === 'object'
      ? (direct.extra as Record<string, any>)
      : ({} as Record<string, any>);
  const value = Number(direct.token_count ?? nested.token_count);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
};

const readTimelineUserText = (message: ChatMessage | undefined, metadata: PseudoLayerInteractionMetadata | null) => {
  return readPlayerInput(message, metadata?.rawUserText);
};

const hydrateStageTurns = (
  snapshot: StageSnapshot,
  entry: { representativeMessageId: number; messageIds: number[] },
) => {
  const cache = (snapshot.timelineTurns ??= new Map());
  const cached = cache.get(entry.representativeMessageId);
  if (cached) return cached;
  const turns = entry.messageIds.flatMap<PseudoLayerTimelineTurn>(assistantMessageId => {
    const assistant = snapshot.messagesById.get(assistantMessageId);
    if (!assistant) return [];
    const previous = snapshot.previousMessages.get(assistantMessageId);
    const inherited = previous?.role === 'user' ? readInteractionMetadata(previous) : null;
    const metadata =
      readInteractionMetadata(assistant) ?? (inherited ? { ...inherited, userMessageId: previous!.message_id } : null);
    const linkedUser =
      (metadata?.userMessageId !== undefined ? snapshot.messagesById.get(metadata.userMessageId) : undefined) ??
      (previous?.role === 'user' ? previous : undefined);
    const visibleDialogue = metadata ? extractDialogueContent(String(assistant.message ?? '')) : null;
    const reasoning = readTimelineReasoning(assistant);
    const responseDuration = readMessageResponseDuration(assistant);
    const tokenCount = readMessageTokenCount(assistant);
    return [
      {
        assistantMessageId,
        ...(linkedUser ? { userMessageId: linkedUser.message_id } : {}),
        userText: readTimelineUserText(linkedUser, metadata),
        assistantText: String(assistant.message ?? ''),
        generationNotice: String(
          assistant.extra?.[GENERATION_NOTICE_KEY] ?? assistant.extra?.extra?.[GENERATION_NOTICE_KEY] ?? '',
        ),
        ...(metadata
          ? {
              reaction:
                String(metadata.reaction ?? visibleDialogue?.reaction ?? '')
                  .replace(/<\/?(?:反应|正文|会话状态)(?=[\s/>])[^>]*>/gi, '')
                  .trim() || undefined,
              ...(metadata.visualCard ? { visualCard: { ...metadata.visualCard } } : {}),
              ...(metadata.variableEffects ? { variableEffects: { ...metadata.variableEffects } } : {}),
            }
          : {}),
        ...reasoning,
        ...(responseDuration !== undefined ? { responseDuration } : {}),
        ...(tokenCount !== undefined ? { tokenCount } : {}),
      },
    ];
  });
  cache.set(entry.representativeMessageId, turns);
  return turns;
};

// 索引只包含楼层关系；正文、思考和图卡在当前页被请求时才解析。
const hydrateTimelineEntries = (snapshot: StageSnapshot): PseudoLayerTimelineEntry[] => {
  if (snapshot.timelineEntries) return snapshot.timelineEntries;
  const historyIndexes: Record<PseudoLayerHistoryKind, number> = { story: 0, dialogue: 0 };
  const hydratedEntries = snapshot.entries.map<PseudoLayerTimelineEntry>(entry => {
    const history = entry.stage.kind;
    historyIndexes[history] += 1;

    return {
      representativeMessageId: entry.representativeMessageId,
      messageIds: [...entry.messageIds],
      index: historyIndexes[history],
      historyIndex: historyIndexes[history],
      stage: { ...entry.stage },
      turns: [],
    };
  });

  const storyEntries = hydratedEntries.filter(entry => entry.stage.kind === 'story');
  const storiesById = new Map(storyEntries.map(entry => [entry.representativeMessageId, entry]));
  let previousStory: PseudoLayerTimelineEntry | undefined;
  hydratedEntries.forEach(dialogueEntry => {
    if (dialogueEntry.stage.kind !== 'dialogue') {
      previousStory = dialogueEntry;
      return;
    }
    const requestedAnchor = dialogueEntry.stage.anchorStoryMessageId;
    const anchor = (requestedAnchor !== undefined ? storiesById.get(requestedAnchor) : undefined) ?? previousStory;
    if (!anchor) return;
    const thread: PseudoLayerDialogueThread = {
      sessionId: dialogueEntry.stage.sessionId,
      anchorStoryMessageId: anchor.representativeMessageId,
      representativeMessageId: dialogueEntry.representativeMessageId,
      messageIds: [...dialogueEntry.messageIds],
      targetName: dialogueEntry.stage.targetName,
      canonicalName: dialogueEntry.stage.canonicalName,
      channel: dialogueEntry.stage.channel,
      turnCount: dialogueEntry.stage.turnCount,
      engine: dialogueEntry.stage.engine,
      turns: dialogueEntry.turns,
    };
    (anchor.dialogueThreads ??= []).push(thread);
  });

  storyEntries.forEach((entry, index) => {
    entry.index = index + 1;
    entry.historyIndex = index + 1;
  });
  snapshot.timelineEntries = storyEntries;
  return storyEntries;
};

const hydrateTimelinePageEntry = (
  snapshot: StageSnapshot,
  entry: PseudoLayerTimelineEntry,
): PseudoLayerTimelineEntry => ({
  ...entry,
  turns: hydrateStageTurns(snapshot, entry),
  ...(entry.dialogueThreads
    ? {
        dialogueThreads: entry.dialogueThreads.map(thread => ({
          ...thread,
          turns: hydrateStageTurns(snapshot, thread),
        })),
      }
    : {}),
});

const findTimelineEntryIndex = (entries: PseudoLayerTimelineEntry[], messageId: number | undefined) => {
  if (!Number.isFinite(messageId)) return entries.length - 1;
  const normalized = Math.trunc(messageId!);
  const exact = entries.findIndex(
    entry =>
      entry.representativeMessageId === normalized ||
      entry.messageIds.includes(normalized) ||
      entry.dialogueThreads?.some(
        thread => thread.representativeMessageId === normalized || thread.messageIds.includes(normalized),
      ),
  );
  return exact >= 0 ? exact : entries.length - 1;
};

const sendTimelinePage = (source: ReplyTarget, request: Extract<PseudoLayerRequest, { type: 'timeline_page' }>) => {
  const snapshot = getStageSnapshot();
  const entries = hydrateTimelineEntries(snapshot);
  const limit = _.clamp(Math.trunc(Number(request.limit) || 8), 1, 20);
  const anchorIndex = findTimelineEntryIndex(entries, request.anchorMessageId);
  let start: number;
  let end: number;

  if (request.direction === 'older') {
    end = Math.max(0, anchorIndex);
    start = Math.max(0, end - limit);
  } else if (request.direction === 'newer') {
    start = Math.min(entries.length, anchorIndex + 1);
    end = Math.min(entries.length, start + limit);
  } else {
    start = _.clamp(anchorIndex - Math.floor((limit - 1) / 2), 0, Math.max(0, entries.length - limit));
    end = Math.min(entries.length, start + limit);
  }

  send(source, {
    type: 'timeline_page',
    requestId: request.requestId,
    revision: viewRevision,
    entries: entries.slice(start, end).map(entry => hydrateTimelinePageEntry(snapshot, entry)),
    hasOlder: start > 0,
    hasNewer: end < entries.length,
  });
};

const getStageEntries = () => getStageSnapshot().entries;

const latestStageId = () => getStageEntries().at(-1)?.representativeMessageId;

const latestStoryStageId = (entries = getStageEntries()) =>
  getHistoryEntries(entries, 'story').at(-1)?.representativeMessageId;

const getHistoryEntries = (entries: StageEntry[], history: PseudoLayerHistoryKind) =>
  entries.filter(entry => entry.stage.kind === history);

const getHistoryLatestMessageId = (history: PseudoLayerHistoryKind, entries = getStageEntries()) =>
  getHistoryEntries(entries, history).at(-1)?.representativeMessageId;

const getGenerationAnchor = (history: PseudoLayerHistoryKind, entries = getStageEntries()) =>
  getHistoryLatestMessageId(history, entries) ?? entries.at(-1)?.representativeMessageId;

const resolveHistorySelection = (entries: StageEntry[], history: PseudoLayerHistoryKind): number | null => {
  const historyEntries = getHistoryEntries(entries, history);
  if (historyEntries.length === 0) {
    selectedHistoryMessageIds[history] = null;
    return null;
  }

  const remembered = selectedHistoryMessageIds[history];
  const selectedEntry = historyEntries.find(
    entry =>
      entry.representativeMessageId === remembered || (remembered !== null && entry.messageIds.includes(remembered)),
  );
  const selected = selectedEntry ?? historyEntries.at(-1)!;
  selectedHistoryMessageIds[history] = selected.representativeMessageId;
  return selected.representativeMessageId;
};

const makeHistoryState = (entries: StageEntry[], history: PseudoLayerHistoryKind): PseudoLayerHistoryState => {
  const historyEntries = getHistoryEntries(entries, history);
  const ids = historyEntries.map(entry => entry.representativeMessageId);
  const selected = resolveHistorySelection(entries, history) ?? -1;
  const position = ids.indexOf(selected);
  const latestMessageId = ids.at(-1) ?? -1;
  return {
    selectedMessageId: selected,
    latestMessageId,
    index: position >= 0 ? position + 1 : 0,
    total: ids.length,
    previousMessageId: position > 0 ? ids[position - 1] : undefined,
    nextMessageId: position >= 0 && position < ids.length - 1 ? ids[position + 1] : undefined,
    isLatest: selected === latestMessageId,
  };
};

const rememberStageSelection = (messageId: number, entries = getStageEntries()) => {
  const entry = entries.find(
    candidate => candidate.representativeMessageId === messageId || candidate.messageIds.includes(messageId),
  );
  if (!entry) return;
  selectedHistoryMessageIds[entry.stage.kind] = entry.representativeMessageId;
};

const refreshParkedFrontend = (frame: HTMLIFrameElement) => {
  const revision = frame.dataset.dhlFrontendRevision;
  const hostMessageId = getParkedMessageId();
  if (!revision || hostMessageId === undefined) return false;
  const keptFrame = getFrameKeeper(hostMessageId, false)?.querySelector<HTMLIFrameElement>(':scope > iframe');
  if (!keptFrame || keptFrame === frame || keptFrame.dataset.dhlFrontendRevision === revision) return false;
  const sourceDocument = frame.getAttribute('srcdoc')?.trim();
  const sourceUrl = frame.getAttribute('src')?.trim();
  if (!sourceDocument && (!sourceUrl || sourceUrl === 'about:blank')) return false;

  // 生成及编辑结算完成后再应用新模板，保留当前操作的接收窗口。
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    queueFrameCandidate(frame, 500);
    return true;
  }
  const currentView = keptFrame.contentDocument?.querySelector('.cultivation-status')?.getAttribute('data-view');
  saveReadingPosition(keptFrame, String(getCurrentChatId()));
  if (currentView) keptFrame.dataset.dhlReloadView = currentView;
  keptFrame.dataset.dhlFrontendRevision = revision;
  frameLoadStartedAt.set(keptFrame, Date.now());
  keptFrame.addEventListener('load', () => scheduleViewRefresh(0), { once: true });
  if (sourceDocument) {
    keptFrame.srcdoc = sourceDocument;
  } else {
    keptFrame.removeAttribute('srcdoc');
    keptFrame.src = sourceUrl!;
  }
  console.info('[灯火阑珊·伪同层] 前端编译已更新，自动同步阅读舞台');
  return true;
};

const eagerLoadFrontendFrame = (frame: HTMLIFrameElement) => {
  if (frame.loading !== 'lazy') return;
  if (isPseudoFrontendLoader(frame)) {
    // 尚未具备可复制的地址时，先解除懒加载，后续 src 到达仍由观察器接管。
    frame.loading = 'eager';
  }
};

const parkCandidateFrame = (frame: HTMLIFrameElement, latestMessageId = latestStoryStageId()) => {
  if (detachedMode || controllerDisposed) return;
  rememberFrame(frame);
  if (frame.dataset.dhlControllerOwned === 'true') return;
  const messageId = getFrameMessageId(frame);
  if (messageId === undefined) return;
  if (refreshParkedFrontend(frame)) return;
  // MVU 额外解析会重新渲染最新楼层；已有阅读舞台时只更新数据，不另建舞台抢走阅读位置。
  const parkedMessageId = getParkedMessageId();
  if (parkedMessageId !== undefined && parkedMessageId !== messageId && getLiveRegistration(parkedMessageId)) return;
  const shouldPark =
    messageId === latestMessageId ||
    (activeGeneration?.operation === 'reroll' && messageId === activeGeneration.baseMessageId);
  if (!shouldPark) return;
  if (parkFrame(messageId, frame)) scheduleViewRefresh(0);
  else if (!getFrameKeeper(messageId, false)?.querySelector(':scope > iframe')) eagerLoadFrontendFrame(frame);
};

const flushFrameCandidates = () => {
  frameCandidateTimer = null;
  if (controllerDisposed || detachedMode || pendingFrameCandidates.size === 0) return;
  const frames = [...pendingFrameCandidates];
  pendingFrameCandidates.clear();
  const latestMessageId = latestStoryStageId();
  frames.forEach(frame => {
    if (frame.isConnected) parkCandidateFrame(frame, latestMessageId);
  });
};

const queueFrameCandidate = (frame: HTMLIFrameElement, delay = FRAME_CANDIDATE_BATCH_MS) => {
  if (detachedMode || controllerDisposed) return;
  rememberFrame(frame);
  pendingFrameCandidates.add(frame);
  if (frameCandidateTimer !== null) return;
  frameCandidateTimer = window.setTimeout(flushFrameCandidates, delay);
};

const inspectAddedFrameNode = (node: Node) => {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as Element;
  if (element.tagName === 'IFRAME') {
    queueFrameCandidate(element as HTMLIFrameElement);
    return;
  }

  const containsRelevantFrames =
    element.matches('.mes, .TH-render') ||
    element.closest('.TH-render') !== null ||
    element.id === STAGE_ROOT_ID ||
    element.classList.contains(FRAME_KEEPER_CLASS);
  if (!containsRelevantFrames) return;
  element.querySelectorAll<HTMLIFrameElement>('iframe').forEach(queueFrameCandidate);
};

const installFrameObserver = () => {
  if (detachedMode || controllerDisposed) return;
  const chat = tavernDocument.querySelector<HTMLElement>('#chat');
  if (chat === observedChat && frameObserver) return;
  frameObserver?.disconnect();
  observedChat = chat;
  if (!chat) return;
  frameObserver = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes') {
        const frame = record.target as HTMLIFrameElement;
        if (frame.tagName === 'IFRAME' && frame.closest('.TH-render')) queueFrameCandidate(frame);
      } else {
        record.addedNodes.forEach(inspectAddedFrameNode);
      }
    });
  });
  frameObserver.observe(chat, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcdoc', 'data-dhl-frontend-revision'],
  });
};

const parkLatestStageFrame = () => {
  if (detachedMode || controllerDisposed) return;
  const messageId = latestStoryStageId();
  if (messageId === undefined) return;
  const frames = getMessageElement(messageId)?.querySelectorAll<HTMLIFrameElement>('.TH-render iframe');
  // 首次进入时 iframe 可能尚未挂载，仍需识别并唤醒被视口外懒加载阻塞的加载器。
  frames?.forEach(frame => parkCandidateFrame(frame, messageId));
};

const reconcileStageFrame = () => {
  if (controllerDisposed || detachedMode) return;
  installFrameObserver();
  const parkedId = getParkedMessageId();
  if (parkedId !== undefined && getLiveRegistration(parkedId)) {
    if (!tavernDocument.body.classList.contains(ROOT_ACTIVE_CLASS)) scheduleViewRefresh(0);
    return;
  }
  // 分阶段进卡、iframe 延迟设置 src 或错过首个渲染事件时，无须手动重启控制器。
  invalidateStageSnapshot();
  parkLatestStageFrame();
  scheduleViewRefresh(FRAME_CANDIDATE_BATCH_MS);
};

const getSourceMessageId = (source: ReplyTarget) => {
  const frame = getFrameForSource(source);
  return frame ? getFrameMessageId(frame) : undefined;
};

const getLiveRegistration = (messageId: number) => {
  const source = registrations.get(messageId);
  if (!source) return undefined;
  if (getSourceMessageId(source) === messageId) return source;
  registrations.delete(messageId);
  return undefined;
};

const getRegisteredAssistantIds = () =>
  [...registrations.keys()]
    .filter(messageId => getLiveRegistration(messageId) !== undefined)
    .sort((left, right) => left - right);

const getRerollLock = () => (activeGeneration?.operation === 'reroll' ? activeGeneration.lockedView : undefined);

const getHostStageId = () => {
  if (detachedMode) return undefined;
  // 宿主楼层与正在阅读/更新的楼层可以不同。优先沿用可见实例，保留滚动位置和展开状态。
  const parkedMessageId = getParkedMessageId();
  if (parkedMessageId !== undefined && getLiveRegistration(parkedMessageId)) return parkedMessageId;
  if (activeGeneration?.operation === 'reroll' && getMessageElement(activeGeneration.baseMessageId)) {
    return activeGeneration.baseMessageId;
  }
  return (
    getRegisteredAssistantIds()
      .filter(messageId => getMessageElement(messageId))
      .at(-1) ?? parkedMessageId
  );
};

const makeView = (entries = getStageEntries()): PseudoLayerView => {
  const pendingInput = getPendingInput();
  const lockedView = getRerollLock();
  if (lockedView) {
    return {
      ...lockedView,
      hostMessageId: getHostStageId() ?? lockedView.hostMessageId,
      nativeInputCollapsed,
      detached: detachedMode,
      // The lock freezes navigation, not the pending-input status from before reroll.
      pendingInput,
      activeInteraction: activeInteraction.mode === 'dialogue' ? { ...activeInteraction } : STORY_INTERACTION,
    };
  }

  const storyEntries = getHistoryEntries(entries, 'story');
  const ids = storyEntries.map(entry => entry.representativeMessageId);
  const latestMessageId = ids.at(-1) ?? -1;
  const selected = selectedMessageId !== null && ids.includes(selectedMessageId) ? selectedMessageId : latestMessageId;
  const position = ids.indexOf(selected);
  const selectedEntry = storyEntries[position];
  const selectedAssistantMessageId = selectedEntry?.messageIds.at(-1) ?? selected;
  const tokenCount = readMessageTokenCount(getStageSnapshot().messagesById.get(selectedAssistantMessageId));
  return {
    hostMessageId: getHostStageId() ?? -1,
    revision: viewRevision,
    selectedMessageId: selected,
    latestMessageId,
    latestStoryMessageId: latestMessageId,
    latestStateMessageId: latestStageId() ?? latestMessageId,
    index: position >= 0 ? position + 1 : 0,
    total: ids.length,
    previousMessageId: position > 0 ? ids[position - 1] : undefined,
    nextMessageId: position >= 0 && position < ids.length - 1 ? ids[position + 1] : undefined,
    isLatest: selected === latestMessageId,
    nativeInputCollapsed,
    detached: detachedMode,
    ...(pendingInput ? { pendingInput } : {}),
    ...(tokenCount !== undefined ? { tokenCount } : {}),
    stage: selectedEntry?.stage ?? { kind: 'story' },
    dialogueThreads: detachedMode
      ? []
      : (hydrateTimelineEntries(getStageSnapshot())
          .find(entry => entry.representativeMessageId === selected)
          ?.dialogueThreads?.map(thread => ({ ...thread, turns: hydrateStageTurns(getStageSnapshot(), thread) })) ??
        []),
    histories: {
      story: makeHistoryState(entries, 'story'),
      dialogue: makeHistoryState(entries, 'dialogue'),
    },
    activeInteraction: activeInteraction.mode === 'dialogue' ? { ...activeInteraction } : STORY_INTERACTION,
  };
};

const applyNativeInputState = () => {
  const active = !detachedMode && tavernDocument.body.classList.contains('dhl-pseudo-layer-active');
  tavernDocument.body.classList.toggle('dhl-native-input-collapsed', active && nativeInputCollapsed);

  const chat = tavernDocument.querySelector<HTMLElement>('#chat');
  if (!chat || !active || chat.scrollTop === 0) return;
  chat.scrollTop = 0;
  if (mobileStageAlignFrame !== null) tavernWindow.cancelAnimationFrame(mobileStageAlignFrame);
  mobileStageAlignFrame = tavernWindow.requestAnimationFrame(() => {
    mobileStageAlignFrame = null;
    if (!controllerDisposed && !detachedMode && chat.isConnected) chat.scrollTop = 0;
  });
};

const restoreNativeChatPosition = () => {
  const chat = tavernDocument.querySelector<HTMLElement>('#chat');
  if (!chat) return;

  const scrollToLatest = () => {
    const activeLease = controllerHost.__dhlPseudoLayerControllerLease__;
    if (!chat.isConnected || (activeLease && activeLease.instanceId !== controllerInstanceId)) return;
    const latest = [...chat.querySelectorAll<HTMLElement>(':scope > .mes')].at(-1);
    if (!latest) return;
    const text = latest.querySelector<HTMLElement>('.mes_text') ?? latest;
    chat.scrollTop += text.getBoundingClientRect().top - chat.getBoundingClientRect().top;
  };

  // 切回原生时定位到最新楼层的正文开头，两帧后交还滚动控制。
  tavernWindow.requestAnimationFrame(() => {
    scrollToLatest();
    tavernWindow.requestAnimationFrame(scrollToLatest);
  });
};

const handleNativeInputViewportChange = (event: MediaQueryListEvent) => {
  if (!nativeInputFollowsViewport) return;
  nativeInputCollapsed = event.matches;
  broadcastView();
};

const applyStageVisibility = (snapshot = getStageSnapshot()) => {
  if (detachedMode) {
    tavernDocument.body.classList.remove('dhl-pseudo-layer-active', ROOT_ACTIVE_CLASS, 'dhl-native-input-collapsed');
    tavernDocument.querySelectorAll<HTMLElement>('#chat > .mes').forEach(element => {
      element.classList.remove(STAGE_CLASS, SELECTED_CLASS, PARKED_FRAME_CLASS);
    });
    return;
  }
  const entries = snapshot.entries;
  const ids = entries.map(entry => entry.representativeMessageId);
  if (!getRerollLock()) {
    const scopedIds = selectedHistoryKind
      ? getHistoryEntries(entries, selectedHistoryKind).map(entry => entry.representativeMessageId)
      : ids;
    if (!activeGeneration) {
      if (selectedHistoryKind) {
        if (selectedMessageId === null || !scopedIds.includes(selectedMessageId)) {
          selectedMessageId = scopedIds.at(-1) ?? ids.at(-1) ?? null;
        }
      } else if (!browsingHistory) {
        selectedMessageId = ids.at(-1) ?? null;
      }
    }
    if (selectedMessageId !== null && !ids.includes(selectedMessageId)) {
      selectedMessageId = scopedIds.at(-1) ?? ids.at(-1) ?? null;
    }
  }
  const hostMessageId = entries.length > 0 ? getHostStageId() : undefined;
  const assistantIds = snapshot.assistantIds;

  tavernDocument.querySelectorAll<HTMLElement>('#chat > .mes').forEach(element => {
    const id = Number(element.getAttribute('mesid'));
    element.classList.toggle(STAGE_CLASS, assistantIds.has(id));
    element.classList.toggle(SELECTED_CLASS, id === hostMessageId);
  });
  syncParkedStage(hostMessageId);
  tavernDocument.body.classList.toggle('dhl-pseudo-layer-active', hostMessageId !== undefined);
  applyNativeInputState();
};

const broadcastView = () => {
  if (viewRefreshTimer !== null) {
    window.clearTimeout(viewRefreshTimer);
    viewRefreshTimer = null;
    viewRefreshDeadline = 0;
  }
  const snapshot = getStageSnapshot();
  applyStageVisibility(snapshot);
  const view = makeView(snapshot.entries);
  const registeredIds = getRegisteredAssistantIds();
  registeredIds.forEach(messageId => send(registrations.get(messageId), { type: 'view', view }));
};

const scheduleViewRefresh = (delay = 0, invalidateSnapshot = false) => {
  if (invalidateSnapshot) invalidateStageSnapshot();
  const deadline = Date.now() + Math.max(0, delay);
  if (viewRefreshTimer !== null && viewRefreshDeadline <= deadline) return;
  if (viewRefreshTimer !== null) window.clearTimeout(viewRefreshTimer);
  viewRefreshDeadline = deadline;
  viewRefreshTimer = window.setTimeout(
    () => {
      viewRefreshTimer = null;
      viewRefreshDeadline = 0;
      if (!controllerDisposed) broadcastView();
    },
    Math.max(0, deadline - Date.now()),
  );
};

const setDetachedMode = (detached: boolean, source?: ReplyTarget) => {
  if (controllerDisposed) return;
  if (
    activeGeneration ||
    deletingMessageId !== null ||
    updatingMessageId !== null ||
    tavernDocument.querySelector<HTMLElement>('#mes_stop')?.getClientRects().length
  ) {
    const message = '请等待当前生成或楼层操作结束后再切换模式。';
    if (source) send(source, { type: 'error', message });
    else toastr.info(message);
    return;
  }
  if (detachedMode === detached) {
    broadcastView();
    return;
  }
  if (detached) rememberStageReadingPosition();
  detachedMode = detached;
  localStorage.setItem(PSEUDO_LAYER_DETACHED_STORAGE_KEY, String(detached));
  activeInteraction = STORY_INTERACTION;
  selectedMessageId = null;
  selectedHistoryKind = null;
  browsingHistory = false;
  clearDialogueCarryoverPrompt();
  viewRevision += 1;
  if (detached) {
    frameObserver?.disconnect();
    frameObserver = null;
    observedChat = null;
    if (frameCandidateTimer !== null) window.clearTimeout(frameCandidateTimer);
    frameCandidateTimer = null;
    pendingFrameCandidates.clear();
    if (mobileStageAlignFrame !== null) tavernWindow.cancelAnimationFrame(mobileStageAlignFrame);
    mobileStageAlignFrame = null;
    releaseParkedFrames();
    registrations.clear();
    applyStageVisibility();
    restoreNativeChatPosition();
  } else {
    clearReadingPosition(tavernWindow, getCurrentChatId());
    invalidateStageSnapshot();
    installFrameObserver();
    parkLatestStageFrame();
  }
  broadcastView();
  console.info(`[灯火阑珊·伪同层] 已切换至${detached ? '原生楼层状态栏' : '伪同层舞台'}模式`);
};

const installStyle = () => {
  if (tavernDocument.getElementById(STYLE_ID)) return;
  const style = tavernDocument.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.dhl-pseudo-layer-active #show_more_messages { display: none !important; }
    body.dhl-pseudo-layer-active #chat > .mes { display: none !important; }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} {
      display: flex !important;
      width: 100% !important;
      max-width: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    #${STAGE_ROOT_ID} { display: none !important; }
    body.${ROOT_ACTIVE_CLASS} #chat > :not(#${STAGE_ROOT_ID}) { display: none !important; }
    body.${ROOT_ACTIVE_CLASS} #${STAGE_ROOT_ID} {
      display: block !important;
      flex: 1 1 0% !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    #${STAGE_ROOT_ID} > .${FRAME_KEEPER_CLASS} { display: none !important; }
    #${STAGE_ROOT_ID} > .${FRAME_KEEPER_CLASS}.${ACTIVE_KEEPER_CLASS} {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
    }
    #${STAGE_ROOT_ID} > .${FRAME_KEEPER_CLASS} > iframe {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      border: 0 !important;
    }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} > .for_checkbox,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} > .del_checkbox,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} > .mesAvatarWrapper,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} > .swipe_left,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} > .swipeRightBlock,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .ch_name,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_reasoning_details,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_media_wrapper,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_file_wrapper,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_bias { display: none !important; }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_block,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_text { width: 100% !important; max-width: none !important; }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_text { padding: 0 !important; }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .mes_text > :not(.TH-render) { display: none !important; }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .TH-render:not(.${NATIVE_STAGE_CLASS}) { display: none !important; }
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .TH-render,
    body.dhl-pseudo-layer-active #chat > .mes.${SELECTED_CLASS} .TH-render > iframe { width: 100% !important; }
    body.dhl-native-input-collapsed #form_sheld { display: none !important; }
    body.dhl-pseudo-layer-active.dhl-native-input-collapsed {
      --bottomFormBlockSize: 0px !important;
    }
    body.dhl-pseudo-layer-active.dhl-native-input-collapsed #chat {
      height: 100% !important;
      max-height: 100% !important;
    }
    body.${ROOT_ACTIVE_CLASS} #${STAGE_ROOT_ID},
    body.${ROOT_ACTIVE_CLASS} #${STAGE_ROOT_ID} > .${FRAME_KEEPER_CLASS}.${ACTIVE_KEEPER_CLASS},
    body.${ROOT_ACTIVE_CLASS} #${STAGE_ROOT_ID} > .${FRAME_KEEPER_CLASS}.${ACTIVE_KEEPER_CLASS} > iframe {
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
    }
    body.dhl-pseudo-layer-active #chat {
      overflow: hidden !important;
      overflow-anchor: none !important;
      overscroll-behavior: none !important;
      scrollbar-width: none !important;
    }
    body.dhl-pseudo-layer-active #chat::-webkit-scrollbar { display: none !important; }
  `;
  tavernDocument.head.append(style);
};

const buildMessage = (reply: string) => {
  const text = reply.trim();
  if (/<visual_cards>[\s\S]*?<\/visual_cards>/i.test(text) || /<pseudo_layer>[\s\S]*?<\/pseudo_layer>/i.test(text)) {
    return text;
  }
  return `${text}\n\n<pseudo_layer>\n灯火阑珊\n</pseudo_layer>`;
};

const buildEditedMessage = (content: string) => {
  if (
    /<visual_cards>[\s\S]*?<\/visual_cards>/i.test(content) ||
    /<pseudo_layer>[\s\S]*?<\/pseudo_layer>/i.test(content)
  ) {
    return content;
  }
  const separator = content.length === 0 ? '' : content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${separator}<pseudo_layer>\n灯火阑珊\n</pseudo_layer>`;
};

const ensurePseudoMarker = async (messageId: number, refresh: ChatRefreshMode = 'affected') => {
  const message = getChatMessages(messageId)[0];
  if (!message || message.role !== 'assistant') return;
  const content = String(message.message ?? '');
  const nextContent = buildMessage(content);
  if (nextContent === content.trim()) return;
  await setChatMessages([{ message_id: messageId, message: nextContent }], { refresh });
};

const writeInteractionMetadata = async (
  messageId: number,
  context: DialogueContext,
  options: { rawUserText?: string; userMessageId?: number } = {},
) => {
  const message = getChatMessages(messageId)[0];
  if (!message) return;
  const existing = readInteractionMetadata(message);
  const metadata: PseudoLayerInteractionMetadata = {
    ...existing,
    version: 3,
    kind: 'dialogue',
    ...context,
    engine: existing?.engine ?? 'native',
    ...(options.rawUserText ? { rawUserText: options.rawUserText } : {}),
    ...(Number.isFinite(options.userMessageId) ? { userMessageId: options.userMessageId } : {}),
  };
  await setChatMessages(
    [
      {
        message_id: messageId,
        extra: {
          ...(message.extra ?? {}),
          [INTERACTION_KEY]: metadata,
        },
      },
    ],
    { refresh: 'none' },
  );
};

const decorateDialogueInput = (text: string, context: DialogueContext) => {
  const value = text.trim();
  const prefix = context.channel === 'present' ? `（对${context.targetName}说）` : `（向${context.targetName}传讯）`;
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
};

const triggerNativeSend = (prompt: string) => {
  const textarea = tavernDocument.querySelector<HTMLTextAreaElement>('#send_textarea');
  const sendButton = tavernDocument.querySelector<HTMLElement>('#send_but');
  if (!textarea || !sendButton) throw new Error('没有找到酒馆原生输入区。');
  textarea.value = prompt;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

const setDialogueCarryoverPrompt = async (content = '') => {
  const context = (
    tavernWindow as typeof tavernWindow & {
      SillyTavern?: {
        getContext?: () => {
          setExtensionPrompt?: (
            id: string,
            content: string,
            position: -1 | 1,
            depth: number,
            scan?: boolean,
            role?: number,
          ) => Promise<void> | void;
        };
      };
    }
  ).SillyTavern?.getContext?.();
  if (typeof context?.setExtensionPrompt !== 'function') return;
  await context.setExtensionPrompt(DIALOGUE_CARRYOVER_PROMPT_ID, content, content ? 1 : -1, 1, false, 0);
};

const buildDialogueCarryoverPrompt = (anchorStoryMessageId: number) => {
  const snapshot = getStageSnapshot();
  const storyIndexEntry = hydrateTimelineEntries(snapshot).find(
    entry => entry.representativeMessageId === anchorStoryMessageId,
  );
  const storyEntry = storyIndexEntry ? hydrateTimelinePageEntry(snapshot, storyIndexEntry) : undefined;
  const threads = storyEntry?.dialogueThreads ?? [];
  if (threads.length === 0) return '';

  const significantLines: string[] = [];
  const recentTurns = threads
    .flatMap(thread =>
      thread.turns.map(turn => ({
        ...turn,
        targetName: thread.targetName,
      })),
    )
    .sort((left, right) => left.assistantMessageId - right.assistantMessageId);

  recentTurns.forEach(turn => {
    const metadata = readInteractionMetadata(snapshot.messagesById.get(turn.assistantMessageId));
    metadata?.memoryEvents?.forEach(event => {
      if (event.status === 'open') significantLines.push(`${metadata.targetName}记住：${event.summary}`);
    });
    metadata?.relationEvents?.forEach(event => {
      if (event.applied) significantLines.push(`${metadata.targetName}关系变化：${event.summary}`);
    });
    if (metadata?.sessionState?.unresolvedThreads?.length) {
      significantLines.push(`${metadata.targetName}未了话题：${metadata.sessionState.unresolvedThreads.join('；')}`);
    }
  });

  const quoteLines = recentTurns.slice(-4).flatMap(turn => {
    const visible = extractDialogueContent(turn.assistantText);
    return [
      turn.userText && `{{user}}：${turn.userText}`,
      visible.dialogue && `${turn.targetName}：${visible.dialogue}`,
    ].filter(Boolean) as string[];
  });
  const content = [
    '【刚刚发生的幕间交谈】',
    '以下交谈已经发生，是本轮正文的既成事实。自然承接其关系、承诺和情绪，不要机械复述整段对白。',
    ...[...new Set(significantLines)].slice(-8),
    quoteLines.length ? '【近期原话】' : '',
    ...quoteLines,
  ]
    .filter(Boolean)
    .join('\n');
  return content.slice(0, 1200);
};

const prepareDialogueCarryoverPrompt = async (anchorStoryMessageId: number) => {
  await setDialogueCarryoverPrompt(buildDialogueCarryoverPrompt(anchorStoryMessageId));
};

const clearDialogueCarryoverPrompt = () => {
  void setDialogueCarryoverPrompt().catch(error => {
    console.warn('[灯火阑珊·幕间交谈] 清理正文承接提示失败', error);
  });
};

const triggerNativeReroll = async (messageId: number) => {
  const context = (
    tavernWindow as typeof tavernWindow & {
      SillyTavern?: {
        getContext?: () => {
          chat?: NativeSwipeMessage[];
          swipe?: {
            right?: (
              event?: Event | null,
              options?: { source?: string; repeated?: boolean; message?: unknown },
            ) => Promise<void>;
          };
        };
      };
    }
  ).SillyTavern?.getContext?.();
  const swipeRight = context?.swipe?.right;
  if (typeof swipeRight !== 'function') throw new Error('当前酒馆版本没有提供原生重生成接口。');

  const nativeButton = getMessageElement(messageId)?.querySelector<HTMLElement>('.swipe_right');
  const nativeMessage = context?.chat?.[messageId];
  if (!nativeMessage) throw new Error(`没有找到第 ${messageId} 楼的原生消息。`);
  repairNativeSwipeState(messageId, nativeMessage);
  await swipeRight.call(nativeButton ?? context?.swipe, null, {
    source: 'dhl-pseudo-layer',
    message: nativeMessage,
  });
};

const getNativeSwipeMessage = (messageId: number): NativeSwipeMessage | undefined => {
  const context = (
    tavernWindow as typeof tavernWindow & {
      SillyTavern?: { getContext?: () => { chat?: NativeSwipeMessage[] } };
    }
  ).SillyTavern?.getContext?.();
  return context?.chat?.[messageId];
};

const stripNativeSwipeMarker = (value: unknown) =>
  String(value ?? '')
    .replace(/<pseudo_layer>[\s\S]*?<\/pseudo_layer>/gi, '')
    .trim();

const isNativeSwipePlaceholder = (value: unknown) => stripNativeSwipeMarker(value) === '...';

const isUsableNativeSwipeCandidate = (value: unknown) => {
  const visible = stripNativeSwipeMarker(value);
  // Even a thought-only or provider-error reply is a real floor. Preserve it so
  // the player can inspect, reroll or delete it without leaving the pseudo UI.
  return visible.length > 0 && !isNativeSwipePlaceholder(value);
};

function getPendingInput(): PseudoLayerPendingInput | undefined {
  // 正常生成中的 user 楼层由流式视图承载；这里只暴露控制器已失去事务状态的孤立输入。
  if (activeGeneration) return undefined;
  const messages = getAllMessages();
  const latestAssistantId = messages
    .filter(message => message.role === 'assistant' && isUsableNativeSwipeCandidate(message.message))
    .at(-1)?.message_id;
  const pendingUsers = messages.filter(
    message =>
      message.role === 'user' &&
      message.message_id > (latestAssistantId ?? -1) &&
      String(message.message ?? '').trim().length > 0,
  );
  const latest = pendingUsers.at(-1);
  if (!latest) return undefined;
  return {
    messageIds: pendingUsers.map(message => message.message_id),
    latestMessageId: latest.message_id,
    text: readTimelineUserText(latest, readInteractionMetadata(latest)),
    count: pendingUsers.length,
  };
}

const resolveNativeGenerationUserMessage = (generation: ActiveGeneration): ChatMessage | undefined => {
  if (Number.isInteger(generation.userMessageId)) {
    const explicit = getChatMessages(Number(generation.userMessageId))[0];
    if (explicit?.role === 'user') return explicit;
  }

  const baseline = Number(generation.baselineLastMessageId ?? generation.baseMessageId);
  const expectedText = generation.rawUserText.trim();
  const inferred = getAllMessages().find(message => {
    if (message.role !== 'user' || message.message_id <= baseline) return false;
    if (!expectedText) return true;
    return String(message.message ?? '').trim() === expectedText;
  });
  if (inferred) generation.userMessageId = inferred.message_id;
  return inferred;
};

const isNativeGenerationAssistant = (generation: ActiveGeneration, messageId: number) => {
  if (generation.engine !== 'native' || generation.operation !== 'generate') return false;
  const message = getChatMessages(messageId)[0];
  if (message?.role !== 'assistant' || !isUsableNativeSwipeCandidate(message.message)) return false;
  const userMessage = resolveNativeGenerationUserMessage(generation);
  const boundary = userMessage?.message_id ?? generation.baselineLastMessageId ?? generation.baseMessageId;
  return message.message_id > boundary;
};

const findNativeGenerationAssistant = (generation: ActiveGeneration) => {
  const userMessage = resolveNativeGenerationUserMessage(generation);
  const boundary = userMessage?.message_id ?? generation.baselineLastMessageId ?? generation.baseMessageId;
  return getAllMessages().find(
    message =>
      message.role === 'assistant' && message.message_id > boundary && isUsableNativeSwipeCandidate(message.message),
  );
};

const isNativeSwipeCandidateIncomplete = (message: NativeSwipeMessage, index: number) => {
  const swipeInfo = message.swipe_info?.[index];
  if (swipeInfo?.gen_started != null) return swipeInfo.gen_finished == null;
  if (message.swipe_id === index && message.gen_started != null) return message.gen_finished == null;
  return false;
};

const repairNativeSwipeState = (messageId: number, message: NativeSwipeMessage) => {
  if (!Array.isArray(message.swipes) || message.swipes.length === 0) return;

  const swipeId = message.swipe_id;
  const isValid =
    Number.isInteger(swipeId) &&
    (swipeId as number) >= 0 &&
    (swipeId as number) < message.swipes.length &&
    isUsableNativeSwipeCandidate(message.swipes[swipeId as number]) &&
    !isNativeSwipeCandidateIncomplete(message, swipeId as number) &&
    isUsableNativeSwipeCandidate(message.mes);
  if (isValid) return false;

  const fallbackSwipeId = message.swipes.findLastIndex(
    (candidate, index) => isUsableNativeSwipeCandidate(candidate) && !isNativeSwipeCandidateIncomplete(message, index),
  );
  if (fallbackSwipeId < 0) throw new Error(`第 ${messageId} 楼没有可恢复的重生成候选。`);

  // fallback 之后只可能是占位符或未写完的候选。必须整段移除，否则下一次 swipe.right
  // 会优先切回这个半成品，而不会真正发起新的重答。
  if (message.swipes.length > fallbackSwipeId + 1) {
    message.swipes.splice(fallbackSwipeId + 1);
  }
  if (Array.isArray(message.swipe_info) && message.swipe_info.length > fallbackSwipeId + 1) {
    message.swipe_info.splice(fallbackSwipeId + 1);
  }

  message.swipe_id = fallbackSwipeId;
  message.mes = message.swipes[fallbackSwipeId] as string;
  const swipeInfo = message.swipe_info?.[fallbackSwipeId];
  if (swipeInfo) {
    message.send_date = swipeInfo.send_date ?? message.send_date;
    message.gen_started = swipeInfo.gen_started;
    message.gen_finished = swipeInfo.gen_finished;
    message.extra = _.cloneDeep(swipeInfo.extra ?? message.extra ?? {});
  }
  console.warn(`[灯火阑珊·伪同层] 已修复第 ${messageId} 楼失效的 swipe 候选：${String(swipeId)} -> ${fallbackSwipeId}`);
  return true;
};

const isNativeSwipeMaterialized = (messageId: number, generation = activeGeneration) => {
  const message = getNativeSwipeMessage(messageId);
  if (!message) return false;
  if (!isUsableNativeSwipeCandidate(message.mes)) return false;
  if (!Number.isInteger(message.swipe_id) || !Array.isArray(message.swipes)) {
    return generation?.operation !== 'reroll' || message.mes !== generation.nativeSwipeOriginal?.mes;
  }
  const swipeId = message.swipe_id as number;
  if (
    swipeId < 0 ||
    swipeId >= message.swipes.length ||
    !isUsableNativeSwipeCandidate(message.swipes[swipeId]) ||
    isNativeSwipeCandidateIncomplete(message, swipeId)
  ) {
    return false;
  }
  if (generation?.operation !== 'reroll' || !generation.nativeSwipeOriginal) return true;
  const original = generation.nativeSwipeOriginal;
  return (
    swipeId !== original.swipe_id ||
    message.swipes.length !== (original.swipes?.length ?? 0) ||
    String(message.swipes[swipeId] ?? '') !== String(original.mes ?? '')
  );
};

const waitForNativeSwipeMaterialized = async (messageId: number, timeout = 5000, generation = activeGeneration) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (isNativeSwipeMaterialized(messageId, generation)) return true;
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }
  return isNativeSwipeMaterialized(messageId, generation);
};

const getCurrentChatId = () => String(SillyTavern.getCurrentChatId() ?? '');

type NativeRerollOriginal = NonNullable<ActiveGeneration['rerollOriginal']>;
type PendingNativeRerollRecord = {
  version: 1;
  chatId: string;
  requestId: string;
  createdAt: number;
  original: NativeRerollOriginal;
  nativeSwipeOriginal: NativeSwipeMessage;
};

const captureNativeRerollOriginal = (message: ChatMessage): NativeRerollOriginal => {
  const swipeSnapshot = getChatMessages(message.message_id, { include_swipes: true })[0];
  return {
    messageId: message.message_id,
    name: String(message.name ?? ''),
    role: message.role,
    isHidden: Boolean(message.is_hidden),
    message: String(message.message ?? ''),
    data: _.cloneDeep(message.data ?? {}),
    extra: _.cloneDeep(message.extra ?? {}),
    ...(swipeSnapshot
      ? {
          swipeId: swipeSnapshot.swipe_id,
          swipes: _.cloneDeep(swipeSnapshot.swipes ?? []),
          swipesData: _.cloneDeep(swipeSnapshot.swipes_data ?? []),
          swipesInfo: _.cloneDeep(swipeSnapshot.swipes_info ?? []),
        }
      : {}),
  };
};

const readPendingNativeRerolls = (): PendingNativeRerollRecord[] => {
  try {
    const parsed = JSON.parse(tavernWindow.sessionStorage.getItem(PENDING_NATIVE_REROLL_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (record): record is PendingNativeRerollRecord =>
        record?.version === 1 &&
        typeof record.chatId === 'string' &&
        Number.isInteger(record.original?.messageId) &&
        record.original?.role === 'assistant',
    );
  } catch (error) {
    console.warn('[灯火阑珊·伪同层] 无法读取重答恢复快照', error);
    return [];
  }
};

const writePendingNativeRerolls = (records: PendingNativeRerollRecord[]) => {
  try {
    if (records.length === 0) tavernWindow.sessionStorage.removeItem(PENDING_NATIVE_REROLL_STORAGE_KEY);
    else tavernWindow.sessionStorage.setItem(PENDING_NATIVE_REROLL_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('[灯火阑珊·伪同层] 无法保存重答恢复快照，将仅使用本次运行内存回滚', error);
  }
};

const persistPendingNativeReroll = (generation: ActiveGeneration) => {
  if (
    generation.operation !== 'reroll' ||
    generation.engine !== 'native' ||
    !generation.chatId ||
    !generation.rerollOriginal ||
    !generation.nativeSwipeOriginal
  ) {
    return;
  }
  const next = readPendingNativeRerolls().filter(
    record => record.chatId !== generation.chatId || record.original.messageId !== generation.rerollOriginal?.messageId,
  );
  next.push({
    version: 1,
    chatId: generation.chatId,
    requestId: generation.requestId,
    createdAt: Date.now(),
    original: _.cloneDeep(generation.rerollOriginal),
    nativeSwipeOriginal: _.cloneDeep(generation.nativeSwipeOriginal),
  });
  writePendingNativeRerolls(next);
};

const clearPendingNativeReroll = (chatId: string | undefined, messageId: number | undefined) => {
  if (!chatId || !Number.isInteger(messageId)) return;
  writePendingNativeRerolls(
    readPendingNativeRerolls().filter(record => record.chatId !== chatId || record.original.messageId !== messageId),
  );
};

const restoreNativeSwipeSnapshot = (message: NativeSwipeMessage, snapshot: NativeSwipeMessage) => {
  const restore = <Key extends keyof NativeSwipeMessage>(key: Key) => {
    if (snapshot[key] === undefined) delete message[key];
    else message[key] = _.cloneDeep(snapshot[key]) as NativeSwipeMessage[Key];
  };
  restore('mes');
  restore('send_date');
  restore('gen_started');
  restore('gen_finished');
  restore('extra');
  restore('swipe_id');
  restore('swipes');
  restore('swipe_info');
};

const restoreNativeRerollRecord = async (
  chatId: string,
  original: NativeRerollOriginal,
  nativeSwipeOriginal: NativeSwipeMessage,
) => {
  if (getCurrentChatId() !== chatId) return false;

  let current = getChatMessages(original.messageId)[0];
  if (!current) {
    if (getLastMessageId() !== original.messageId - 1) {
      throw new Error(`第 ${original.messageId} 楼已不存在，且聊天记录发生了其他变化，未贸然插回原回复。`);
    }
    await createChatMessages(
      [
        {
          name: original.name,
          role: original.role,
          is_hidden: original.isHidden,
          message: original.message,
          data: _.cloneDeep(original.data),
          extra: _.cloneDeep(original.extra),
        },
      ],
      { insert_before: 'end', refresh: 'affected' },
    );
    current = getChatMessages(original.messageId)[0];
    if (!current) throw new Error(`第 ${original.messageId} 楼原回复重新插入失败。`);
  }

  const restorePayload = {
    message_id: original.messageId,
    name: original.name,
    role: original.role,
    is_hidden: original.isHidden,
    message: original.message,
    data: _.cloneDeep(original.data),
    extra: _.cloneDeep(original.extra),
    ...(original.swipes
      ? {
          swipe_id: original.swipeId ?? 0,
          swipes: _.cloneDeep(original.swipes),
          swipes_data: _.cloneDeep(original.swipesData ?? []),
          swipes_info: _.cloneDeep(original.swipesInfo ?? []),
        }
      : {}),
  } as Parameters<typeof setChatMessages>[0][number];
  await setChatMessages([restorePayload], { refresh: 'affected' });

  const nativeMessage = getNativeSwipeMessage(original.messageId);
  if (nativeMessage) restoreNativeSwipeSnapshot(nativeMessage, nativeSwipeOriginal);
  const restored = getChatMessages(original.messageId)[0];
  if (!restored || String(restored.message ?? '') !== original.message) {
    throw new Error(`第 ${original.messageId} 楼原回复校验失败。`);
  }
  return true;
};

const rollbackNativeReroll = (generation: ActiveGeneration): Promise<boolean> => {
  if (generation.rerollRollback) return generation.rerollRollback;
  if (
    generation.operation !== 'reroll' ||
    generation.engine !== 'native' ||
    !generation.rerollOriginal ||
    !generation.nativeSwipeOriginal ||
    !generation.chatId
  ) {
    return Promise.resolve(false);
  }

  const task = (async () => {
    const original = generation.rerollOriginal!;
    const restored = await restoreNativeRerollRecord(generation.chatId!, original, generation.nativeSwipeOriginal!);
    if (!restored) return false;
    clearPendingNativeReroll(generation.chatId, original.messageId);
    invalidateStageSnapshot();
    selectedMessageId = original.messageId;
    selectedHistoryKind = generation.interaction.mode;
    rememberStageSelection(original.messageId);
    browsingHistory = false;
    viewRevision += 1;
    return true;
  })();
  generation.rerollRollback = task;
  return task;
};

const isNativeRerollBackAtOriginal = (generation: ActiveGeneration) => {
  const current = getNativeSwipeMessage(generation.baseMessageId);
  const original = generation.nativeSwipeOriginal;
  if (!current || !original) return false;
  const currentSwipeId = Number(current.swipe_id);
  const originalSwipeId = Number(original.swipe_id);
  return (
    Number.isInteger(currentSwipeId) &&
    Number.isInteger(originalSwipeId) &&
    currentSwipeId === originalSwipeId &&
    String(current.mes ?? '') === String(original.mes ?? '') &&
    (current.swipes?.length ?? 0) === (original.swipes?.length ?? 0)
  );
};

const waitForNativeRerollToSettle = async (generation: ActiveGeneration, timeout = 1800) => {
  // SillyTavern 收到接口错误后会先触发 STOPPED，再异步执行自身的 “Swiping back”。
  // 若此时立刻改写 swipes，会与酒馆回退互相覆盖，留下 swipe_id 指向越界候选。
  await new Promise(resolve => window.setTimeout(resolve, 360));
  const deadline = Date.now() + timeout;
  let stableChecks = 0;
  while (Date.now() < deadline) {
    if (isNativeRerollBackAtOriginal(generation)) {
      stableChecks += 1;
      if (stableChecks >= 3) return;
    } else {
      stableChecks = 0;
    }
    await new Promise(resolve => window.setTimeout(resolve, 80));
  }
};

const schedulePostRerollRecoverySync = (generation: ActiveGeneration) => {
  const messageId = generation.rerollOriginal?.messageId;
  const chatId = generation.chatId;
  if (!Number.isInteger(messageId) || !chatId) return;

  [120, 480, 1200, 2600].forEach(delay => {
    window.setTimeout(() => {
      if (controllerDisposed || getCurrentChatId() !== chatId || activeGeneration) return;
      invalidateStageSnapshot();
      const entries = getStageEntries();
      const ids = entries.map(entry => entry.representativeMessageId);
      if (!browsingHistory && ids.includes(messageId!)) {
        selectedMessageId = messageId!;
        selectedHistoryKind = generation.interaction.mode;
        rememberStageSelection(messageId!, entries);
      }
      viewRevision += 1;
      broadcastView();
    }, delay);
  });
};

const failNativeReroll = (generation: ActiveGeneration, error: unknown): Promise<void> => {
  if (generation.rerollFailure) return generation.rerollFailure;
  generation.cancelled = true;

  const task = (async () => {
    await waitForNativeRerollToSettle(generation);
    let restored = false;
    try {
      restored = await rollbackNativeReroll(generation);
    } catch (rollbackError) {
      console.error('[灯火阑珊·伪同层] 原生重生成回滚失败', rollbackError);
    }
    if (activeGeneration !== generation) return;
    clearDialogueCarryoverPrompt();
    discardQueuedStream();
    send(generation.source, {
      type: 'error',
      requestId: generation.requestId,
      message: `${error instanceof Error ? error.message : String(error)}${
        restored ? '；原回复已恢复，可以重新重答。' : '；原回复恢复尚未完成，控制器重载后会继续尝试恢复。'
      }`,
    });
    activeGeneration = null;
    broadcastView();
    schedulePostRerollRecoverySync(generation);
  })();
  generation.rerollFailure = task;
  return task;
};

const rollbackNativeGenerationInput = async (generation: ActiveGeneration) => {
  if (generation.engine !== 'native' || generation.operation !== 'generate') return false;
  if (generation.chatId && getCurrentChatId() !== generation.chatId) return false;
  if (findNativeGenerationAssistant(generation)) return false;

  const userMessage = resolveNativeGenerationUserMessage(generation);
  if (!userMessage) return false;
  const baseline = Number(generation.baselineLastMessageId ?? generation.baseMessageId);
  if (userMessage.message_id <= baseline) return false;

  const transactionMessageIds = getAllMessages()
    .filter(
      message =>
        message.message_id >= userMessage.message_id &&
        (message.message_id === userMessage.message_id ||
          (message.role === 'assistant' && !isUsableNativeSwipeCandidate(message.message))),
    )
    .map(message => message.message_id);
  if (!transactionMessageIds.includes(userMessage.message_id)) return false;

  const previousDeletingMessageId = deletingMessageId;
  deletingMessageId = Math.max(...transactionMessageIds);
  try {
    await deleteChatMessages(transactionMessageIds, { refresh: 'affected' });
  } finally {
    deletingMessageId = previousDeletingMessageId;
  }

  invalidateStageSnapshot();
  const fallbackMessageId = latestStageId() ?? generation.baseMessageId;
  selectedMessageId = fallbackMessageId;
  selectedHistoryKind = generation.interaction.mode;
  rememberStageSelection(fallbackMessageId);
  browsingHistory = false;
  viewRevision += 1;
  return true;
};

const failNativeGeneration = (generation: ActiveGeneration, error: unknown): Promise<void> => {
  if (generation.generationFailure) return generation.generationFailure;
  generation.cancelled = true;

  const task = (async () => {
    let rolledBack = false;
    try {
      rolledBack = await rollbackNativeGenerationInput(generation);
    } catch (rollbackError) {
      console.error('[灯火阑珊·伪同层] 失败推演的临时输入回滚失败', rollbackError);
    }
    if (activeGeneration !== generation) return;
    clearDialogueCarryoverPrompt();
    if (!rolledBack) {
      const lateAssistant = findNativeGenerationAssistant(generation);
      if (lateAssistant) {
        await finishMessage(lateAssistant.message_id);
        return;
      }
    }

    discardQueuedStream();
    const reason = error instanceof Error ? error.message : String(error);
    const cleanupNotice = rolledBack
      ? '本轮临时输入已撤销，原文仍保留在输入框中，可以直接重试。'
      : Number.isInteger(generation.userMessageId)
        ? '未能安全撤销本轮输入，请展开酒馆原生聊天检查是否残留孤立楼层。'
        : '本轮尚未写入聊天记录，原文仍保留在输入框中。';
    send(generation.source, {
      type: 'error',
      requestId: generation.requestId,
      message: `${reason}；${cleanupNotice}`,
    });
    activeGeneration = null;
    broadcastView();
  })();
  generation.generationFailure = task;
  return task;
};

let recoveringNativeSwipeState = false;
const recoverFailedNativeRerolls = async () => {
  if (recoveringNativeSwipeState || activeGeneration || controllerDisposed) return;
  recoveringNativeSwipeState = true;
  const recoveredIds: number[] = [];
  try {
    const currentChatId = getCurrentChatId();
    const pendingRecords = readPendingNativeRerolls().filter(record => record.chatId === currentChatId);
    for (const record of pendingRecords) {
      try {
        if (!(await restoreNativeRerollRecord(record.chatId, record.original, record.nativeSwipeOriginal))) continue;
        clearPendingNativeReroll(record.chatId, record.original.messageId);
        recoveredIds.push(record.original.messageId);
      } catch (error) {
        console.warn(`[灯火阑珊·伪同层] 第 ${record.original.messageId} 楼的事务快照恢复失败`, error);
      }
    }

    for (const message of getAllMessages()) {
      if (message.role !== 'assistant') continue;
      const nativeMessage = getNativeSwipeMessage(message.message_id);
      if (!nativeMessage) continue;
      try {
        if (!repairNativeSwipeState(message.message_id, nativeMessage)) continue;
        const restored = buildMessage(String(nativeMessage.mes ?? ''));
        await setChatMessages(
          [
            {
              message_id: message.message_id,
              message: restored,
              extra: _.cloneDeep((nativeMessage.extra ?? message.extra ?? {}) as Record<string, any>),
            },
          ],
          { refresh: 'affected' },
        );
        if (!recoveredIds.includes(message.message_id)) recoveredIds.push(message.message_id);
      } catch (error) {
        console.warn(`[灯火阑珊·伪同层] 第 ${message.message_id} 楼的失败重答无法自动恢复`, error);
      }
    }
    if (recoveredIds.length > 0) {
      invalidateStageSnapshot();
      selectedMessageId = latestStageId() ?? selectedMessageId;
      selectedHistoryKind = null;
      if (selectedMessageId !== null) rememberStageSelection(selectedMessageId);
      browsingHistory = false;
      viewRevision += 1;
      broadcastView();
      console.info(`[灯火阑珊·伪同层] 已恢复失败重答楼层：${recoveredIds.join(', ')}`);
    }
  } finally {
    recoveringNativeSwipeState = false;
  }
};

const getDialogueMvuSnapshot = (messageId: number): Record<string, any> => {
  let snapshot: unknown;
  try {
    if (typeof Mvu !== 'undefined') {
      snapshot = Mvu.getMvuData({ type: 'message', message_id: messageId });
    }
  } catch (error) {
    console.warn('[灯火阑珊·短对话] 读取 MVU 快照失败，改用楼层数据', error);
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    snapshot = getChatMessages(messageId)[0]?.data ?? {};
  }
  return _.cloneDeep(snapshot as Record<string, any>);
};

const stripDialogueStructureTags = (text: string) =>
  text
    .replace(/<\/?(?:反应|正文|会话状态|visual_cards|pseudo_layer|UpdateVariable|JSONPatch)(?=[\s/>])[^>]*>/gi, '')
    .trim();

const buildDedicatedDialogueMessage = (result: ParsedDialogueGeneration) => {
  const reaction = stripDialogueStructureTags(result.reaction);
  const dialogue = stripDialogueStructureTags(result.dialogue);
  return [
    `<反应>${reaction}</反应>`,
    `<正文>${dialogue}</正文>`,
    `<visual_cards>${JSON.stringify([result.visualCard])}</visual_cards>`,
    result.variableUpdateBlock,
    '<pseudo_layer>',
    '灯火阑珊',
    '</pseudo_layer>',
  ]
    .filter(Boolean)
    .join('\n');
};

const applyDialogueVariableUpdate = async (
  result: ParsedDialogueGeneration,
  mvuSnapshot: Record<string, any>,
): Promise<Record<string, any>> => {
  const baseline = _.cloneDeep(mvuSnapshot);
  if (!result.variableUpdateBlock) return baseline;
  try {
    await waitGlobalInitialized('Mvu');
    const updated = await Mvu.parseMessage(result.variableUpdateBlock, baseline as Mvu.MvuData);
    const statData = _.get(updated, 'stat_data');
    if (statData && typeof statData === 'object') {
      _.set(updated, 'stat_data', Schema.parse(statData));
    }
    return updated;
  } catch (error) {
    console.warn('[灯火阑珊·短对话] 受限变量更新未能通过 MVU/Schema 校验，已保留对白并沿用旧快照', error);
    result.variableEffects = {};
    result.variableUpdateBlock = '';
    return baseline;
  }
};

const buildDedicatedMetadata = (
  generation: ActiveGeneration,
  context: DialogueContext,
  userMessageId: number,
  result?: ParsedDialogueGeneration,
): PseudoLayerInteractionMetadata => {
  const reaction = result ? stripDialogueStructureTags(result.reaction) : '';
  return {
    version: 3,
    kind: 'dialogue',
    ...context,
    engine: 'dedicated',
    operationId: generation.operationId,
    rawUserText: generation.rawUserText,
    userMessageId,
    ...(reaction ? { reaction } : {}),
    ...(result?.sessionState ? { sessionState: result.sessionState } : {}),
    ...(result?.memoryEvents.length ? { memoryEvents: result.memoryEvents } : {}),
    ...(result?.relationEvents.length
      ? {
          relationEvents: result.relationEvents.map(event => ({
            ...event,
            applied: Object.values(result.variableEffects).some(Boolean),
          })),
        }
      : {}),
    ...(result?.visualCard ? { visualCard: { ...result.visualCard } } : {}),
    ...(result && Object.values(result.variableEffects).some(Boolean)
      ? { variableEffects: { ...result.variableEffects } }
      : {}),
  };
};

const getDialogueOperationMessages = (operationId: string) =>
  getAllMessages().filter(message => readInteractionMetadata(message)?.operationId === operationId);

const rollbackDialogueOperation = async (generation: ActiveGeneration) => {
  if (!generation.operationId || getCurrentChatId() !== generation.chatId) return;
  if (generation.operation === 'reroll' && generation.rerollOriginal) {
    const original = generation.rerollOriginal;
    await setChatMessages(
      [
        {
          message_id: original.messageId,
          message: original.message,
          data: _.cloneDeep(original.data),
          extra: _.cloneDeep(original.extra),
        },
      ],
      { refresh: 'affected' },
    );
    return;
  }
  const ids = getDialogueOperationMessages(generation.operationId).map(message => message.message_id);
  if (ids.length === 0) return;
  const previousDeletingMessageId = deletingMessageId;
  deletingMessageId = Math.max(...ids);
  try {
    await deleteChatMessages(ids, { refresh: 'affected' });
  } finally {
    deletingMessageId = previousDeletingMessageId;
  }
};

const commitDedicatedDialogue = async (
  generation: ActiveGeneration,
  context: DialogueContext,
  result: ParsedDialogueGeneration,
  mvuSnapshot: Record<string, any>,
  updatedMvuData: Record<string, any>,
) => {
  const baseline = generation.baselineLastMessageId;
  if (
    baseline === undefined ||
    generation.cancelled ||
    getCurrentChatId() !== generation.chatId ||
    getLastMessageId() !== baseline
  ) {
    throw new Error('生成期间聊天记录已经变化，本轮短对话未写入。');
  }

  const userMessageId = baseline + 1;
  const assistantMessageId = baseline + 2;
  const userMetadata = buildDedicatedMetadata(generation, context, userMessageId);
  const assistantMetadata = buildDedicatedMetadata(generation, context, userMessageId, result);
  await createChatMessages(
    [
      {
        role: 'user',
        is_hidden: true,
        message: decorateDialogueInput(generation.rawUserText, context),
        data: _.cloneDeep(mvuSnapshot),
        extra: { [INTERACTION_KEY]: userMetadata },
      },
      {
        role: 'assistant',
        is_hidden: true,
        message: buildDedicatedDialogueMessage(result),
        data: _.cloneDeep(updatedMvuData),
        extra: { [INTERACTION_KEY]: assistantMetadata },
      },
    ],
    { refresh: 'affected' },
  );

  const created = getDialogueOperationMessages(generation.operationId ?? '');
  const user = created.find(message => message.role === 'user');
  const assistant = created.find(message => message.role === 'assistant');
  if (
    generation.cancelled ||
    getCurrentChatId() !== generation.chatId ||
    getLastMessageId() !== assistantMessageId ||
    user?.message_id !== userMessageId ||
    assistant?.message_id !== assistantMessageId
  ) {
    throw new Error('写入短对话时聊天记录发生并发变化，已撤销本轮写入。');
  }
  return assistantMessageId;
};

const commitDedicatedDialogueReroll = async (
  generation: ActiveGeneration,
  context: DialogueContext,
  result: ParsedDialogueGeneration,
  updatedMvuData: Record<string, any>,
) => {
  const baseline = generation.baselineLastMessageId;
  const userMessageId = generation.userMessageId;
  const targetMessageId = generation.baseMessageId;
  if (
    baseline === undefined ||
    userMessageId === undefined ||
    generation.cancelled ||
    getCurrentChatId() !== generation.chatId ||
    getLastMessageId() !== baseline
  ) {
    throw new Error('生成期间聊天记录已经变化，本次重答未写入。');
  }

  const current = getChatMessages(targetMessageId)[0];
  if (!current || current.role !== 'assistant') throw new Error('没有找到需要重答的角色回复。');
  const metadata = buildDedicatedMetadata(generation, context, userMessageId, result);
  await setChatMessages(
    [
      {
        message_id: targetMessageId,
        is_hidden: true,
        message: buildDedicatedDialogueMessage(result),
        data: _.cloneDeep(updatedMvuData),
        extra: {
          ...(current.extra ?? {}),
          [INTERACTION_KEY]: metadata,
        },
      },
    ],
    { refresh: 'affected' },
  );

  const updated = getChatMessages(targetMessageId)[0];
  if (
    generation.cancelled ||
    getCurrentChatId() !== generation.chatId ||
    getLastMessageId() !== baseline ||
    readInteractionMetadata(updated)?.operationId !== generation.operationId
  ) {
    throw new Error('写入重答时聊天记录发生并发变化，已恢复原回复。');
  }
  return targetMessageId;
};

const finishDedicatedGeneration = (generation: ActiveGeneration, messageId: number) => {
  invalidateStageSnapshot();
  selectedMessageId =
    generation.interaction.mode === 'dialogue'
      ? (generation.interaction.anchorStoryMessageId ?? latestStoryStageId() ?? messageId)
      : messageId;
  selectedHistoryKind = 'story';
  if (selectedMessageId !== null) rememberStageSelection(selectedMessageId);
  browsingHistory = false;
  viewRevision += 1;
  flushQueuedStream(generation);
  send(generation.source, { type: 'complete', requestId: generation.requestId, messageId });
  if (activeGeneration === generation) activeGeneration = null;
  broadcastView();
};

const runDedicatedDialogueGeneration = async (
  generation: ActiveGeneration,
  context: DialogueContext,
  messages: ChatMessage[],
  mvuSnapshot: Record<string, any>,
) => {
  try {
    generation.sent = true;
    sendGenerationState(generation, 'generating');
    const result = await generateDialogueReply({
      generationId: generation.generationId!,
      operationId: generation.operationId!,
      baseMessageId:
        generation.operation === 'reroll' && generation.userMessageId !== undefined
          ? generation.userMessageId
          : generation.baseMessageId,
      prompt: generation.rawUserText,
      context,
      messages,
      mvuData: mvuSnapshot,
      getStreamFallback: () => ({
        reaction: generation.streamReaction,
        dialogue: generation.streamText,
      }),
    });
    if (activeGeneration !== generation) return;
    if (generation.cancelled) throw new Error('本轮短对话已停止。');
    sendGenerationState(generation, 'saving');
    const updatedMvuData = await applyDialogueVariableUpdate(result, mvuSnapshot);
    const messageId =
      generation.operation === 'reroll'
        ? await commitDedicatedDialogueReroll(generation, context, result, updatedMvuData)
        : await commitDedicatedDialogue(generation, context, result, mvuSnapshot, updatedMvuData);
    if (activeGeneration !== generation) return;
    finishDedicatedGeneration(generation, messageId);
  } catch (error) {
    try {
      await rollbackDialogueOperation(generation);
    } catch (rollbackError) {
      console.error('[灯火阑珊·短对话] 回滚未完成，请检查本轮 operationId', rollbackError);
    }
    if (activeGeneration !== generation) return;
    discardQueuedStream();
    if (generation.cancelled) {
      send(generation.source, {
        type: 'error',
        requestId: generation.requestId,
        message: '交谈已停止，输入已保留，可以修改后重试。',
      });
    } else {
      send(generation.source, {
        type: 'error',
        requestId: generation.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    activeGeneration = null;
    broadcastView();
  }
};

const beginGeneration = (request: Extract<PseudoLayerRequest, { type: 'generate' }>, source: ReplyTarget) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, { type: 'error', requestId: request.requestId, message: '已有一场生成正在进行。' });
    return;
  }
  const prompt = request.prompt.trim();
  const entries = getStageEntries();
  const requestedHistory: PseudoLayerHistoryKind = request.interaction.mode;
  const anchor = getGenerationAnchor(requestedHistory, entries);
  if (!prompt) {
    send(source, { type: 'error', requestId: request.requestId, message: '输入内容不能为空。' });
    return;
  }
  if (anchor === undefined || request.messageId !== anchor) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message:
        requestedHistory === 'dialogue'
          ? '这不是最新一段交谈，请先返回最新交谈。'
          : '这不是最新正文，请先返回最新正文。',
    });
    return;
  }

  const normalizedDialogue =
    request.interaction.mode === 'dialogue' ? normalizeDialogueContext(request.interaction) : null;
  const dialogue =
    normalizedDialogue && normalizedDialogue.anchorStoryMessageId === undefined
      ? { ...normalizedDialogue, anchorStoryMessageId: latestStoryStageId(entries) }
      : normalizedDialogue;
  const interaction: PseudoLayerInteraction = dialogue ?? STORY_INTERACTION;
  setActiveInteraction(interaction);

  if (dialogue) {
    try {
      const baselineLastMessageId = getLastMessageId();
      const baseMessageId = latestStageId() ?? request.messageId;
      const messages = getAllMessages();
      const mvuSnapshot = getDialogueMvuSnapshot(baseMessageId);
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const generation: ActiveGeneration = {
        requestId: request.requestId,
        source,
        operation: 'generate',
        state: 'preparing',
        baseMessageId,
        interaction: dialogue,
        rawUserText: prompt,
        engine: 'dedicated',
        generationId: `dhl-dialogue-${nonce}`,
        operationId: `dhl-dialogue-write-${nonce}`,
        chatId: getCurrentChatId(),
        baselineLastMessageId,
        sent: false,
        received: false,
        streamText: '',
        streamReaction: '',
      };
      activeGeneration = generation;
      selectedHistoryKind = 'dialogue';
      browsingHistory = false;
      sendGenerationState(generation, 'preparing');
      applyStageVisibility();
      void runDedicatedDialogueGeneration(generation, dialogue, messages, mvuSnapshot);
    } catch (error) {
      send(source, {
        type: 'error',
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
      activeGeneration = null;
      broadcastView();
    }
    return;
  }

  activeGeneration = {
    requestId: request.requestId,
    source,
    operation: 'generate',
    state: 'preparing',
    baseMessageId: request.messageId,
    interaction,
    rawUserText: prompt,
    engine: 'native',
    chatId: getCurrentChatId(),
    baselineLastMessageId: getLastMessageId(),
    sent: false,
    received: false,
    streamText: '',
    streamReaction: '',
  };
  selectedHistoryKind = 'story';
  browsingHistory = false;
  sendGenerationState(activeGeneration, 'preparing');
  applyStageVisibility();

  const generation = activeGeneration;
  void prepareDialogueCarryoverPrompt(request.messageId)
    .then(() => {
      if (activeGeneration !== generation || generation.cancelled) return;
      triggerNativeSend(prompt);
      window.setTimeout(() => {
        if (!activeGeneration || activeGeneration.requestId !== request.requestId || activeGeneration.sent) return;
        void failNativeGeneration(activeGeneration, new Error('酒馆没有开始生成，请检查连接和发送按钮状态'));
      }, 10000);
    })
    .catch(error => {
      if (activeGeneration === generation) void failNativeGeneration(generation, error);
    });
};

const beginReroll = async (request: Extract<PseudoLayerRequest, { type: 'reroll' }>, source: ReplyTarget) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, { type: 'error', requestId: request.requestId, message: '已有一场生成正在进行。' });
    return;
  }
  let messages = getAllMessages();
  let message = messages.find(item => item.message_id === request.messageId);
  let metadata = resolveAssistantInteractionMetadata(message, messages);
  const entries = getStageEntries();
  const latest = latestStageId();
  const latestStory = latestStoryStageId(entries);
  if ((metadata && request.messageId !== latest) || (!metadata && request.messageId !== latestStory)) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: metadata ? '只能重答最新一轮幕间回复。' : '只能重推最新正文。',
    });
    return;
  }

  if (!metadata) {
    const dependentEntries = entries.filter(
      entry => entry.stage.kind === 'dialogue' && entry.stage.anchorStoryMessageId === request.messageId,
    );
    const dependentIds = dependentEntries.flatMap(entry =>
      entry.messageIds.flatMap(assistantMessageId => {
        const dialogueAssistant = messages.find(candidate => candidate.message_id === assistantMessageId);
        const dialogueMetadata = resolveAssistantInteractionMetadata(dialogueAssistant, messages);
        const dialogueUser = Number.isFinite(dialogueMetadata?.userMessageId)
          ? messages.find(candidate => candidate.message_id === dialogueMetadata?.userMessageId)
          : findPreviousUserMessage(messages, assistantMessageId);
        return [assistantMessageId, ...(dialogueUser ? [dialogueUser.message_id] : [])];
      }),
    );
    if (dependentIds.length > 0) {
      deletingMessageId = Math.max(...dependentIds);
      try {
        await deleteChatMessages(
          [...new Set(dependentIds)].sort((left, right) => left - right),
          {
            refresh: 'affected',
          },
        );
      } catch (error) {
        send(source, {
          type: 'error',
          requestId: request.requestId,
          message: `移除依赖幕间交谈失败：${error instanceof Error ? error.message : String(error)}`,
        });
        return;
      } finally {
        deletingMessageId = null;
      }
      invalidateStageSnapshot();
      messages = getAllMessages();
      message = messages.find(item => item.message_id === request.messageId);
      metadata = resolveAssistantInteractionMetadata(message, messages);
    }
  }

  if (metadata) {
    try {
      if (!message || message.role !== 'assistant') throw new Error('没有找到需要重答的角色回复。');
      const context = toDialogueContext(metadata);
      const linkedUser =
        (metadata.userMessageId !== undefined
          ? messages.find(item => item.role === 'user' && item.message_id === metadata.userMessageId)
          : undefined) ?? findPreviousUserMessage(messages, request.messageId);
      if (!linkedUser) throw new Error('没有找到这条角色回复对应的玩家发言。');
      const rerollUserText = readTimelineUserText(linkedUser, metadata);
      if (!rerollUserText) throw new Error('这轮交谈没有可用于重答的玩家发言。');

      const mvuSnapshot = getDialogueMvuSnapshot(linkedUser.message_id);
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      setActiveInteraction(context);
      const lockedView = makeView();
      const generation: ActiveGeneration = {
        requestId: request.requestId,
        source,
        operation: 'reroll',
        state: 'preparing',
        baseMessageId: request.messageId,
        interaction: context,
        rawUserText: rerollUserText,
        engine: 'dedicated',
        generationId: `dhl-dialogue-reroll-${nonce}`,
        operationId: `dhl-dialogue-reroll-write-${nonce}`,
        chatId: getCurrentChatId(),
        baselineLastMessageId: getLastMessageId(),
        userMessageId: linkedUser.message_id,
        sent: false,
        received: false,
        streamText: '',
        streamReaction: '',
        lockedView,
        rerollOriginal: captureNativeRerollOriginal(message),
      };
      activeGeneration = generation;
      parkSourceFrame(source);
      selectedHistoryKind = 'dialogue';
      browsingHistory = false;
      sendGenerationState(generation, 'preparing');
      applyStageVisibility();
      void runDedicatedDialogueGeneration(generation, context, messages, mvuSnapshot);
    } catch (error) {
      send(source, {
        type: 'error',
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
      activeGeneration = null;
      broadcastView();
    }
    return;
  }
  const previousUser = findPreviousUserMessage(messages, request.messageId);
  if (!message || message.role !== 'assistant') {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到需要重答的正文。' });
    return;
  }
  if (!previousUser) {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到这条正文对应的玩家发言。' });
    return;
  }
  const rerollUserText = readTimelineUserText(previousUser, null);
  if (!rerollUserText) {
    send(source, { type: 'error', requestId: request.requestId, message: '这轮正文没有可用于重答的玩家发言。' });
    return;
  }
  const nativeSwipeMessage = getNativeSwipeMessage(request.messageId);
  if (!nativeSwipeMessage) {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到酒馆原生重生成数据。' });
    return;
  }
  try {
    repairNativeSwipeState(request.messageId, nativeSwipeMessage);
  } catch (error) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  const interaction: PseudoLayerInteraction = STORY_INTERACTION;
  setActiveInteraction(interaction);
  const lockedView = makeView();
  const generation: ActiveGeneration = {
    requestId: request.requestId,
    source,
    operation: 'reroll',
    state: 'preparing',
    baseMessageId: request.messageId,
    interaction,
    rawUserText: rerollUserText,
    engine: 'native',
    userMessageId: previousUser?.message_id,
    chatId: getCurrentChatId(),
    sent: false,
    received: false,
    streamText: '',
    streamReaction: '',
    lockedView,
    rerollOriginal: captureNativeRerollOriginal(message),
    nativeSwipeOriginal: _.cloneDeep(nativeSwipeMessage),
  };
  activeGeneration = generation;
  persistPendingNativeReroll(generation);
  parkSourceFrame(source);
  selectedHistoryKind = 'story';
  browsingHistory = false;
  sendGenerationState(generation, 'preparing');
  applyStageVisibility();

  void triggerNativeReroll(request.messageId).catch(async error => {
    const generation = activeGeneration;
    if (!generation || generation.requestId !== request.requestId) return;
    const materialized = await waitForNativeSwipeMaterialized(request.messageId, 3000, generation);
    if (materialized) {
      console.warn('[灯火阑珊·伪同层] 酒馆在重生成完成后报告 swipe 收尾异常，已保留新回复', error);
      void finishMessage(request.messageId);
      return;
    }
    console.error('[灯火阑珊·伪同层] 原生重生成失败', error);
    await failNativeReroll(generation, error);
  });

  window.setTimeout(() => {
    if (!activeGeneration || activeGeneration.requestId !== request.requestId || activeGeneration.sent) return;
    void failNativeReroll(activeGeneration, new Error('酒馆没有开始重生成，请检查连接状态。'));
  }, 10_000);

  // 少数网络/接口异常不会触发酒馆的 STOPPED/ENDED 事件。事务快照不能因此永久悬挂，
  // 超时后主动恢复旧 swipe；正常生成完成后 requestId 已失效，不会触发这里。
  window.setTimeout(
    () => {
      const stalledGeneration = activeGeneration;
      if (
        !stalledGeneration ||
        stalledGeneration.requestId !== request.requestId ||
        stalledGeneration.operation !== 'reroll' ||
        stalledGeneration.engine !== 'native'
      ) {
        return;
      }
      void failNativeReroll(stalledGeneration, new Error('重答长时间未能完整结束'));
    },
    15 * 60 * 1000,
  );
};

const finishingMessages = new Map<number, Promise<void>>();
const recentlyFinishedMessages = new Map<number, number>();
const FINISH_DEDUP_WINDOW_MS = 2500;

const finishMessageInternal = async (messageId: number) => {
  const generation = activeGeneration;
  if (
    generation?.engine === 'native' &&
    generation.operation === 'reroll' &&
    (generation.cancelled || messageId !== generation.baseMessageId)
  ) {
    return false;
  }
  const targetMessage = getChatMessages(messageId)[0];
  if (!targetMessage || targetMessage.role !== 'assistant') {
    if (generation?.engine === 'native' && generation.operation === 'generate') {
      await failNativeGeneration(generation, new Error('生成结束但没有形成有效的 AI 回复'));
    }
    return false;
  }
  if (
    generation?.engine === 'native' &&
    generation.operation === 'generate' &&
    !isNativeGenerationAssistant(generation, messageId)
  ) {
    await failNativeGeneration(generation, new Error('生成结束但回复楼层与本轮输入不匹配'));
    return false;
  }
  if (generation) {
    generation.received = true;
    sendGenerationState(generation, 'saving');
  }

  try {
    if (generation?.engine === 'native' && generation.operation === 'reroll') {
      if (!(await waitForNativeSwipeMaterialized(messageId, 5000, generation))) {
        throw new Error('酒馆尚未完成重生成候选的写入，请稍后再试。');
      }
      // STOPPED/错误事件有时会紧跟在 ENDED 后抵达。短暂让出事件循环，
      // 避免把刚被终止的半截 swipe 误判成完整回复并提交。
      await new Promise(resolve => window.setTimeout(resolve, 320));
      if (activeGeneration !== generation || generation.cancelled) {
        throw new Error('重答在完成前被终止');
      }
    }
    if (generation?.engine === 'native') clearDialogueCarryoverPrompt();
    if (generation?.interaction.mode === 'dialogue') {
      await writeInteractionMetadata(messageId, generation.interaction, {
        rawUserText: generation.rawUserText,
        userMessageId: generation.userMessageId,
      });
    } else if (!generation) {
      const messages = getAdjacentMessages(messageId);
      const message = messages.find(item => item.message_id === messageId);
      const metadata = resolveAssistantInteractionMetadata(message, messages);
      if (metadata) {
        await writeInteractionMetadata(messageId, toDialogueContext(metadata), {
          rawUserText: metadata.rawUserText,
          userMessageId: metadata.userMessageId,
        });
      }
    }
    await ensurePseudoMarker(messageId, generation?.engine === 'native' ? 'none' : 'affected');
    const processor = (tavernWindow as TavernRuntimeWindow).SillyTavern?.getContext?.().streamingProcessor;
    const savedMessage = getChatMessages(messageId)[0];
    const hasNarrative = Boolean(parseMessageContent(String(savedMessage?.message ?? '')).narrative.trim());
    const notice =
      generation?.cancelled || (generation?.engine === 'native' && processor?.isStopped)
        ? '本回回复已中断，已保留输入和收到的内容。可以重新生成，或删除本回。'
        : !hasNarrative
          ? '本回没有形成可显示的正文。输入与回复原文已保留，可以重新生成或删除本回。'
          : '';
    if (savedMessage && (notice || savedMessage.extra?.[GENERATION_NOTICE_KEY])) {
      await setChatMessages(
        [{ message_id: messageId, extra: { ...savedMessage.extra, [GENERATION_NOTICE_KEY]: notice } }],
        { refresh: 'none' },
      );
    }
    if (generation?.engine === 'native' && generation.operation === 'reroll') {
      clearPendingNativeReroll(generation.chatId, generation.rerollOriginal?.messageId);
    }
    invalidateStageSnapshot();
    selectedMessageId = messageId;
    selectedHistoryKind = generation?.interaction.mode ?? null;
    rememberStageSelection(messageId);
    browsingHistory = false;
    viewRevision += 1;
    if (generation) {
      flushQueuedStream(generation);
      send(generation.source, { type: 'complete', requestId: generation.requestId, messageId, notice });
    }
    activeGeneration = null;
    broadcastView();
    return true;
  } catch (error) {
    console.error('[灯火阑珊·伪同层] 回复收尾失败', error);
    if (generation) {
      if (generation.engine === 'native' && generation.operation === 'reroll') {
        await failNativeReroll(generation, error);
        return false;
      }
      send(generation.source, {
        type: 'error',
        requestId: generation.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    activeGeneration = null;
    invalidateStageSnapshot();
    selectedMessageId = latestStoryStageId() ?? null;
    selectedHistoryKind = 'story';
    if (selectedMessageId !== null) rememberStageSelection(selectedMessageId);
    browsingHistory = false;
    viewRevision += 1;
    broadcastView();
    return false;
  }
};

const finishMessage = (messageId: number) => {
  const existing = finishingMessages.get(messageId);
  if (existing) return existing;

  const now = Date.now();
  recentlyFinishedMessages.forEach((finishedAt, finishedMessageId) => {
    if (now - finishedAt > FINISH_DEDUP_WINDOW_MS * 4) {
      recentlyFinishedMessages.delete(finishedMessageId);
    }
  });
  const recentlyFinishedAt = recentlyFinishedMessages.get(messageId);
  if (!activeGeneration && recentlyFinishedAt && now - recentlyFinishedAt < FINISH_DEDUP_WINDOW_MS) {
    return Promise.resolve();
  }

  const task = finishMessageInternal(messageId)
    .then(finished => {
      if (finished) recentlyFinishedMessages.set(messageId, Date.now());
    })
    .finally(() => {
      finishingMessages.delete(messageId);
    });
  finishingMessages.set(messageId, task);
  return task;
};

const settleNativeGeneration = (
  generation: ActiveGeneration,
  candidateMessageId: number,
  failureMessage: string,
  delayMs: number,
) => {
  window.setTimeout(() => {
    if (activeGeneration !== generation || generation.received || generation.generationFailure) return;
    const processor = (tavernWindow as TavernRuntimeWindow).SillyTavern?.getContext?.().streamingProcessor;
    // ENDED is also emitted when native UI buttons are hidden. Background calls must
    // not finalize this turn while its stream is still receiving tokens.
    if (!generation.cancelled && processor?.isFinished === false && !processor.isStopped) {
      settleNativeGeneration(generation, candidateMessageId, failureMessage, 1000);
      return;
    }
    if (isNativeGenerationAssistant(generation, candidateMessageId)) {
      void finishMessage(candidateMessageId);
      return;
    }
    const assistant = findNativeGenerationAssistant(generation);
    if (assistant) {
      void finishMessage(assistant.message_id);
      return;
    }
    void failNativeGeneration(generation, new Error(failureMessage));
  }, delayMs);
};

const settleStoppedNativeGeneration = (generation: ActiveGeneration) => {
  if (activeGeneration !== generation || generation.engine !== 'native') return;
  generation.cancelled = true;
  if (generation.operation === 'reroll') {
    void failNativeReroll(generation, new Error('重答在完成前被终止'));
    return;
  }
  if (generation.stopSettlementScheduled) return;
  generation.stopSettlementScheduled = true;
  // 部分浏览器/酒馆版本在主动 stopGeneration 后不会继续派发 STOPPED/ENDED。
  // 不再把解锁完全寄托于外部事件：给原生消息短暂落盘时间，再保留半截回复或回滚临时输入。
  settleNativeGeneration(generation, Number.NaN, '生成在有效回复写入前停止', 3000);
};

// Some providers abort without emitting STOPPED/MESSAGE_RECEIVED. Reconcile only
// after the native UI and processor both report inactivity; never time out a live stream.
const reconcileNativeGeneration = () => {
  const generation = activeGeneration;
  if (!generation || generation.engine !== 'native' || !generation.sent || generation.received) return;
  if (generation.generationFailure || generation.rerollFailure) return;
  const processor = (tavernWindow as TavernRuntimeWindow).SillyTavern?.getContext?.().streamingProcessor;
  const stopButton = tavernDocument.querySelector<HTMLElement>('#mes_stop');
  const nativeBusy = stopButton && tavernWindow.getComputedStyle(stopButton).display !== 'none';
  if (nativeBusy || (processor?.isFinished === false && !processor.isStopped)) {
    generation.inactiveSince = undefined;
    return;
  }
  if (!stopButton && !processor) return;
  generation.inactiveSince ??= Date.now();
  if (Date.now() - generation.inactiveSince < 4000) return;
  if (generation.operation === 'reroll') {
    if (processor?.isStopped || generation.cancelled) {
      void failNativeReroll(generation, new Error('本次重生成中断'));
    } else {
      void finishMessage(generation.baseMessageId);
    }
  } else {
    settleNativeGeneration(generation, Number.NaN, '本次回复中断，模型未返回正文', 0);
  }
};

const repairDialogueMetadata = async (messageId: number) => {
  const messages = getAdjacentMessages(messageId);
  const message = messages.find(item => item.message_id === messageId);
  if (!message || readInteractionMetadata(message)) return;
  const metadata = resolveAssistantInteractionMetadata(message, messages);
  if (!metadata) return;
  await writeInteractionMetadata(messageId, toDialogueContext(metadata), {
    rawUserText: metadata.rawUserText,
    userMessageId: metadata.userMessageId,
  });
  invalidateStageSnapshot();
  viewRevision += 1;
  broadcastView();
};

const selectStage = (target: number, history?: PseudoLayerHistoryKind) => {
  const entries = getStageEntries();
  selectedMessageId = target;
  selectedHistoryKind = history ?? null;
  if (history) selectedHistoryMessageIds[history] = target;
  else rememberStageSelection(target, entries);
  const scopedEntries = history ? getHistoryEntries(entries, history) : entries;
  browsingHistory = target !== scopedEntries.at(-1)?.representativeMessageId;
  viewRevision += 1;
  broadcastView();
  getMessageElement(getHostStageId() ?? target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const navigate = (request: Extract<PseudoLayerRequest, { type: 'navigate' }>) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) return;
  const entries = getStageEntries();
  const historyEntries = request.history ? getHistoryEntries(entries, request.history) : entries;
  const ids = historyEntries.map(entry => entry.representativeMessageId);
  const selected = request.history ? resolveHistorySelection(entries, request.history) : request.messageId;
  const position = selected === null ? -1 : ids.indexOf(selected);
  if (position < 0) return;
  const target = request.direction === 'previous' ? ids[position - 1] : ids[position + 1];
  if (target === undefined) return;
  selectStage(target, request.history);
};

const selectHistory = (history: PseudoLayerHistoryKind) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) return;
  const entries = getStageEntries();
  const target = resolveHistorySelection(entries, history);
  if (target === null) {
    selectedHistoryKind = history;
    browsingHistory = false;
    viewRevision += 1;
    broadcastView();
    return;
  }

  selectStage(target, history);
};

const deleteLatestTurn = async (
  request: Extract<PseudoLayerRequest, { type: 'delete_message' }>,
  source: ReplyTarget,
) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, { type: 'error', requestId: request.requestId, message: '当前仍有操作正在进行。' });
    return;
  }

  const entries = getStageEntries();
  const target = entries.find(entry => entry.representativeMessageId === request.messageId);
  const latest = entries.at(-1);
  const latestStory = getHistoryEntries(entries, 'story').at(-1);
  const isLatestDialogue = target?.stage.kind === 'dialogue' && target === latest;
  const isLatestStory = target?.stage.kind === 'story' && target === latestStory;
  if (!target || (!isLatestDialogue && !isLatestStory)) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '只能删除最新正文或最新一轮幕间交谈。',
    });
    return;
  }
  if (target.stage.kind === 'story' && getHistoryEntries(entries, 'story').length <= 1) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '至少需要保留一个伪同层回合。',
    });
    return;
  }

  const messages = getAllMessages();
  const assistant = messages.find(
    message => message.role === 'assistant' && message.message_id === target.representativeMessageId,
  );
  if (!assistant) {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到要删除的回复。' });
    return;
  }

  const metadata = resolveAssistantInteractionMetadata(assistant, messages);
  const explicitUser = Number.isFinite(metadata?.userMessageId)
    ? messages.find(message => message.role === 'user' && message.message_id === metadata?.userMessageId)
    : undefined;
  const previousUser = findPreviousUserMessage(messages, assistant.message_id);
  const linkedUser = explicitUser ?? (previousUser?.message_id === assistant.message_id - 1 ? previousUser : undefined);
  const messageIds = new Set([assistant.message_id, ...(linkedUser ? [linkedUser.message_id] : [])]);
  if (target.stage.kind === 'story') {
    entries
      .filter(
        entry => entry.stage.kind === 'dialogue' && entry.stage.anchorStoryMessageId === target.representativeMessageId,
      )
      .forEach(entry => {
        entry.messageIds.forEach(assistantMessageId => {
          messageIds.add(assistantMessageId);
          const dialogueAssistant = messages.find(message => message.message_id === assistantMessageId);
          const dialogueMetadata = resolveAssistantInteractionMetadata(dialogueAssistant, messages);
          const dialogueUser = Number.isFinite(dialogueMetadata?.userMessageId)
            ? messages.find(message => message.message_id === dialogueMetadata?.userMessageId)
            : findPreviousUserMessage(messages, assistantMessageId);
          if (dialogueUser) messageIds.add(dialogueUser.message_id);
        });
      });
  }
  const sortedMessageIds = [...messageIds].sort((left, right) => left - right);

  deletingMessageId = Math.max(...sortedMessageIds);
  try {
    await deleteChatMessages(sortedMessageIds, { refresh: 'affected' });
    invalidateStageSnapshot();
    selectedMessageId = latestStoryStageId() ?? null;
    selectedHistoryKind = null;
    if (selectedMessageId !== null) rememberStageSelection(selectedMessageId);
    browsingHistory = false;
    viewRevision += 1;
    send(source, {
      type: 'deleted',
      requestId: request.requestId,
      deletedMessageId: assistant.message_id,
    });
  } catch (error) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    deletingMessageId = null;
    scheduleViewRefresh(120, true);
  }
};

const recoverPendingInput = async (
  request: Extract<PseudoLayerRequest, { type: 'recover_pending_input' }>,
  source: ReplyTarget,
) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '当前仍有操作正在进行，暂不能撤回残留输入。',
    });
    return;
  }

  const pending = getPendingInput();
  if (!pending || pending.latestMessageId !== Math.trunc(request.latestMessageId)) {
    send(source, { type: 'error', requestId: request.requestId, message: '这组残留输入已经变化，请稍后重试。' });
    return;
  }

  const pendingIds = new Set(pending.messageIds);
  const firstPendingId = Math.min(...pending.messageIds);
  const messages = getAllMessages();
  const hasCompletedReply = messages.some(
    message =>
      message.message_id > firstPendingId &&
      message.role === 'assistant' &&
      isUsableNativeSwipeCandidate(message.message),
  );
  if (hasCompletedReply) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '残留输入之后已经出现有效回复，未执行撤回。',
    });
    return;
  }

  const removableIds = messages
    .filter(
      message =>
        pendingIds.has(message.message_id) ||
        (message.message_id >= firstPendingId &&
          message.role === 'assistant' &&
          !isUsableNativeSwipeCandidate(message.message)),
    )
    .map(message => message.message_id);
  if (removableIds.length === 0) {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到可撤回的残留输入。' });
    return;
  }

  const chatId = getCurrentChatId();
  deletingMessageId = Math.max(...removableIds);
  try {
    await deleteChatMessages(removableIds, { refresh: 'affected' });
    if (getCurrentChatId() !== chatId) throw new Error('撤回期间聊天已经切换。');
    invalidateStageSnapshot();
    selectedMessageId = latestStageId() ?? null;
    selectedHistoryKind = null;
    browsingHistory = false;
    viewRevision += 1;
    send(source, {
      type: 'pending_input_recovered',
      requestId: request.requestId,
      userText: pending.text,
      removedCount: pending.count,
    });
  } catch (error) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    deletingMessageId = null;
    scheduleViewRefresh(120, true);
  }
};

const updateMessageContent = async (
  request: Extract<PseudoLayerRequest, { type: 'update_message' }>,
  source: ReplyTarget,
) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, { type: 'error', requestId: request.requestId, message: '当前仍有操作正在进行。' });
    return;
  }

  const messageId = Math.trunc(request.messageId);
  const entry = getStageEntries().find(
    candidate => candidate.representativeMessageId === messageId || candidate.messageIds.includes(messageId),
  );
  if (!Number.isFinite(messageId) || !entry) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '当前回合已经变化，请重新打开原文编辑器。',
    });
    return;
  }

  const message = getChatMessages(messageId)[0];
  if (!message || message.role !== 'assistant') {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到需要编辑的角色回复。' });
    return;
  }

  const chatId = getCurrentChatId();
  updatingMessageId = messageId;
  try {
    await setChatMessages([{ message_id: messageId, message: buildEditedMessage(String(request.content ?? '')) }], {
      refresh: 'affected',
    });
    if (getCurrentChatId() !== chatId) throw new Error('保存期间聊天已经切换，本次编辑未完成。');

    invalidateStageSnapshot();
    if (entry.representativeMessageId === messageId) {
      selectedMessageId = messageId;
      rememberStageSelection(messageId);
    }
    viewRevision += 1;
    send(source, {
      type: 'message_updated',
      requestId: request.requestId,
      messageId,
    });
    broadcastView();
  } catch (error) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    updatingMessageId = null;
    scheduleViewRefresh(120, true);
  }
};

const updateMessageReasoning = async (
  request: Extract<PseudoLayerRequest, { type: 'update_reasoning' }>,
  source: ReplyTarget,
) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, { type: 'error', requestId: request.requestId, message: '当前仍有操作正在进行。' });
    return;
  }

  const messageId = Math.trunc(request.messageId);
  const content = String(request.content ?? '').trim();
  const entry = getStageEntries().find(candidate => candidate.messageIds.includes(messageId));
  const message = getChatMessages(messageId)[0];
  if (!Number.isFinite(messageId) || !entry || !message || message.role !== 'assistant') {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '当前回合已经变化，请重新打开思维链编辑器。',
    });
    return;
  }
  if (!content) {
    send(source, { type: 'error', requestId: request.requestId, message: '思维链内容不能为空。' });
    return;
  }

  const extra = _.cloneDeep((message.extra ?? {}) as Record<string, any>);
  if (extra.extra && typeof extra.extra === 'object') {
    extra.extra = { ...(extra.extra as Record<string, any>), reasoning: content };
  } else {
    extra.reasoning = content;
  }

  const chatId = getCurrentChatId();
  updatingMessageId = messageId;
  try {
    await setChatMessages([{ message_id: messageId, extra }], { refresh: 'affected' });
    if (getCurrentChatId() !== chatId) throw new Error('保存期间聊天已经切换，本次编辑未完成。');
    await eventEmit(tavern_events.MESSAGE_REASONING_EDITED, messageId);

    invalidateStageSnapshot();
    viewRevision += 1;
    send(source, {
      type: 'message_updated',
      requestId: request.requestId,
      messageId,
    });
    broadcastView();
  } catch (error) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    updatingMessageId = null;
    scheduleViewRefresh(120, true);
  }
};

const updateUserMessageContent = async (
  request: Extract<PseudoLayerRequest, { type: 'update_user_message' }>,
  source: ReplyTarget,
) => {
  if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) {
    send(source, { type: 'error', requestId: request.requestId, message: '当前仍有操作正在进行。' });
    return;
  }

  const messageId = Math.trunc(request.messageId);
  const userMessageId = Math.trunc(request.userMessageId);
  const content = String(request.content ?? '').trim();
  const snapshot = getStageSnapshot();
  const entry = snapshot.entries.find(candidate => candidate.messageIds.includes(messageId));
  const assistant = snapshot.messagesById.get(messageId);
  const metadata = resolveAssistantInteractionMetadata(assistant, snapshot.messages);
  const previous = snapshot.previousMessages.get(messageId);
  const linkedUser =
    (metadata?.userMessageId !== undefined ? snapshot.messagesById.get(metadata.userMessageId) : undefined) ??
    (previous?.role === 'user' ? previous : undefined);

  if (!Number.isFinite(messageId) || !Number.isFinite(userMessageId) || !entry || assistant?.role !== 'assistant') {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: '当前回合已经变化，请重新打开输入编辑器。',
    });
    return;
  }
  if (!linkedUser || linkedUser.role !== 'user' || linkedUser.message_id !== userMessageId) {
    send(source, { type: 'error', requestId: request.requestId, message: '没有找到这条回复对应的玩家输入。' });
    return;
  }
  if (!content) {
    send(source, { type: 'error', requestId: request.requestId, message: '玩家输入不能为空。' });
    return;
  }

  const chatId = getCurrentChatId();
  updatingMessageId = userMessageId;
  try {
    const updates: Parameters<typeof setChatMessages>[0] = [{ message_id: userMessageId, message: content }];
    if (metadata) {
      const context = toDialogueContext(metadata);
      const existingUserMetadata = readInteractionMetadata(linkedUser);
      const userMetadata: PseudoLayerInteractionMetadata = {
        ...existingUserMetadata,
        version: 3,
        kind: 'dialogue',
        ...context,
        engine: existingUserMetadata?.engine ?? metadata.engine ?? 'native',
        ...((existingUserMetadata?.operationId ?? metadata.operationId)
          ? { operationId: existingUserMetadata?.operationId ?? metadata.operationId }
          : {}),
        rawUserText: content,
        userMessageId,
      };
      const assistantMetadata: PseudoLayerInteractionMetadata = {
        ...metadata,
        version: 3,
        kind: 'dialogue',
        ...context,
        rawUserText: content,
        userMessageId,
      };
      updates[0] = {
        message_id: userMessageId,
        message: decorateDialogueInput(content, context),
        extra: {
          ...(linkedUser.extra ?? {}),
          [INTERACTION_KEY]: userMetadata,
        },
      };
      updates.push({
        message_id: messageId,
        extra: {
          ...(assistant.extra ?? {}),
          [INTERACTION_KEY]: assistantMetadata,
        },
      });
    }

    await setChatMessages(updates, { refresh: 'affected' });
    if (getCurrentChatId() !== chatId) throw new Error('保存期间聊天已经切换，本次编辑未完成。');

    // setChatMessages emits render events, not the native edit event. Let the
    // preset update its own advice block, snapshot and replacement sentence.
    if (readAdviceInput(linkedUser)) {
      await eventEmit(tavern_events.MESSAGE_EDITED, userMessageId);
      if (getCurrentChatId() !== chatId) throw new Error('保存期间聊天已经切换，本次编辑未完成。');
    }

    invalidateStageSnapshot();
    viewRevision += 1;
    send(source, {
      type: 'message_updated',
      requestId: request.requestId,
      messageId,
      userMessageId,
    });
    broadcastView();
  } catch (error) {
    send(source, {
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    updatingMessageId = null;
    scheduleViewRefresh(120, true);
  }
};

const handleMessage = (event: MessageEvent<unknown>) => {
  if (!isPseudoLayerRequest(event.data)) return;
  const request = event.data;
  const source = asReplyTarget(event.source);
  if (!source) return;
  rememberSourceProtocolVersion(source, request.version);

  if (request.type === 'hello') {
    const messageId = getSourceMessageId(source) ?? request.messageId;
    const isHeartbeat = registrations.get(messageId) === source && getSourceMessageId(source) === messageId;
    const previousSource = registrations.get(messageId);
    if (previousSource && previousSource !== source) {
      const previousFrame = getFrameForSource(previousSource);
      if (previousFrame?.closest(`#${STAGE_ROOT_ID}`) && hasMountedPseudoApp(previousFrame)) {
        send(source, {
          type: 'ready',
          detached: detachedMode,
          busy: activeGeneration !== null || deletingMessageId !== null || updatingMessageId !== null,
          requestId: activeGeneration?.requestId,
          operation: activeGeneration?.operation,
        });
        return;
      }
    }
    registrations.set(messageId, source);
    const receipt = request.requestId ? generationReceipts.get(request.requestId) : undefined;
    if (receipt && receipt.chatId === getCurrentChatId()) send(source, receipt.payload);
    if (selectedHistoryKind === null && !browsingHistory && !activeGeneration) {
      selectedMessageId = latestStageId() ?? messageId;
    }
    if (
      activeGeneration &&
      (messageId === getHostStageId() ||
        messageId ===
          (getSourceMessageId(activeGeneration.source) ??
            activeGeneration.lockedView?.hostMessageId ??
            activeGeneration.baseMessageId))
    ) {
      activeGeneration.source = source;
    }
    send(source, {
      type: 'ready',
      detached: detachedMode,
      busy: activeGeneration !== null || deletingMessageId !== null || updatingMessageId !== null,
      requestId: activeGeneration?.requestId,
      operation: activeGeneration?.operation,
    });
    if (activeGeneration?.source === source) replayGeneration(activeGeneration, source);
    if (!activeGeneration && request.requestId) scheduleViewRefresh(0, true);
    if (isHeartbeat) return;
    window.setTimeout(() => {
      const frame = getFrameForSource(source);
      if (frame && getSourceMessageId(source) === messageId) parkCandidateFrame(frame);
    }, 0);
    scheduleViewRefresh(FRAME_CANDIDATE_BATCH_MS);
    return;
  }

  if (request.type === 'goodbye') {
    const messageId = getSourceMessageId(source) ?? request.messageId;
    if (registrations.get(messageId) === source) registrations.delete(messageId);
    sourceProtocolVersions.delete(source);
    scheduleViewRefresh(FRAME_CANDIDATE_BATCH_MS);
    return;
  }

  if (request.type === 'set_detached') {
    if (getSourceMessageId(source) === undefined || typeof request.detached !== 'boolean') return;
    setDetachedMode(request.detached, source);
    return;
  }

  if (detachedMode) return;

  if (request.type === 'generate') {
    beginGeneration(request, source);
    return;
  }

  if (request.type === 'reroll') {
    void beginReroll(request, source);
    return;
  }

  if (request.type === 'delete_message') {
    void deleteLatestTurn(request, source);
    return;
  }

  if (request.type === 'update_message') {
    void updateMessageContent(request, source);
    return;
  }

  if (request.type === 'update_user_message') {
    void updateUserMessageContent(request, source);
    return;
  }

  if (request.type === 'update_reasoning') {
    void updateMessageReasoning(request, source);
    return;
  }

  if (request.type === 'recover_pending_input') {
    void recoverPendingInput(request, source);
    return;
  }

  if (request.type === 'stop') {
    if (!activeGeneration || activeGeneration.requestId !== request.requestId) return;
    const generation = activeGeneration;
    if (generation.cancelled || generation.state === 'saving') return;
    generation.cancelled = true;
    sendGenerationState(generation, 'stopping', source);
    if (generation.engine === 'dedicated') {
      if (generation.generationId) stopGenerationById(generation.generationId);
      window.setTimeout(() => {
        if (activeGeneration !== generation || !generation.cancelled) return;
        discardQueuedStream();
        send(generation.source, {
          type: 'error',
          requestId: generation.requestId,
          message: '交谈已停止，输入已保留，可以修改后重试。',
        });
        activeGeneration = null;
        broadcastView();
      }, 3000);
    } else {
      try {
        SillyTavern.stopGeneration();
      } catch (error) {
        console.warn('[灯火阑珊·伪同层] 酒馆停止生成接口抛出异常，转入本地收尾', error);
      }
      settleStoppedNativeGeneration(generation);
    }
    return;
  }

  if (request.type === 'navigate') {
    if (getSourceMessageId(source) === undefined) return;
    navigate(request);
    return;
  }

  if (request.type === 'timeline_page') {
    if (getSourceMessageId(source) === undefined) return;
    sendTimelinePage(source, request);
    return;
  }

  if (request.type === 'select_entry') {
    if (getSourceMessageId(source) === undefined || activeGeneration) return;
    const entry = getStageEntries().find(
      candidate =>
        candidate.representativeMessageId === request.messageId || candidate.messageIds.includes(request.messageId),
    );
    if (entry) selectStage(entry.representativeMessageId, entry.stage.kind);
    return;
  }

  if (request.type === 'select_history') {
    if (getSourceMessageId(source) === undefined) return;
    selectHistory(request.history);
    return;
  }

  if (request.type === 'return_latest') {
    if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) return;
    if (request.history) {
      const entries = getStageEntries();
      const target = getHistoryEntries(entries, request.history).at(-1)?.representativeMessageId;
      if (target !== undefined) selectStage(target, request.history);
      return;
    }
    const target = latestStageId();
    if (target !== undefined) selectStage(target);
    return;
  }

  if (request.type === 'set_interaction') {
    if (activeGeneration || deletingMessageId !== null || updatingMessageId !== null) return;
    const interaction = normalizeDialogueContext(request.interaction);
    if (!interaction) {
      send(source, { type: 'error', message: '交谈目标无效，请重新选择。' });
      return;
    }
    setActiveInteraction(interaction);
    viewRevision += 1;
    broadcastView();
    return;
  }

  if (request.type === 'end_interaction') {
    if (deletingMessageId !== null || updatingMessageId !== null) return;
    setActiveInteraction(STORY_INTERACTION);
    viewRevision += 1;
    broadcastView();
    return;
  }

  nativeInputFollowsViewport = false;
  nativeInputCollapsed = !nativeInputCollapsed;
  localStorage.setItem(INPUT_STORAGE_KEY, String(nativeInputCollapsed));
  broadcastView();
};

const getActiveSource = () => activeGeneration?.source ?? registrations.get(getHostStageId() ?? -1);

const handleMessageSent = async (messageId: number) => {
  if (detachedMode) {
    scheduleViewRefresh(100, true);
    return;
  }
  if (activeGeneration?.engine === 'dedicated') return;
  const source = getActiveSource();
  if (!source) return;
  const message = getChatMessages(messageId)[0];
  if (!activeGeneration) {
    const interaction = activeInteraction.mode === 'dialogue' ? { ...activeInteraction } : STORY_INTERACTION;
    activeGeneration = {
      requestId: `native-${Date.now()}`,
      source,
      operation: 'generate',
      state: 'generating',
      baseMessageId: latestStageId() ?? messageId - 1,
      interaction,
      rawUserText: readTimelineUserText(message, readInteractionMetadata(message)),
      engine: 'native',
      chatId: getCurrentChatId(),
      baselineLastMessageId: messageId - 1,
      userMessageId: messageId,
      sent: true,
      received: false,
      streamText: '',
      streamReaction: '',
    };
  } else {
    activeGeneration.sent = true;
    activeGeneration.userMessageId = messageId;
  }

  if (activeGeneration.interaction.mode === 'dialogue' && message) {
    const rawUserText = activeGeneration.rawUserText || String(message.message ?? '').trim();
    activeGeneration.rawUserText = rawUserText;
    const decorated = decorateDialogueInput(rawUserText, activeGeneration.interaction);
    await setChatMessages(
      [
        {
          message_id: messageId,
          message: decorated,
          extra: {
            ...(message.extra ?? {}),
            [INTERACTION_KEY]: {
              version: 3,
              kind: 'dialogue',
              ...activeGeneration.interaction,
              engine: 'native',
              rawUserText,
            } satisfies PseudoLayerInteractionMetadata,
          },
        },
      ],
      { refresh: 'none' },
    );
  }

  invalidateStageSnapshot();
  sendGenerationState(activeGeneration, 'generating', source);
  applyStageVisibility();
};

const isControllerLoaderFrame = (frame: HTMLIFrameElement) => {
  if (frame === controllerFrame) return false;
  try {
    const loaderSource = frame.contentDocument?.body?.textContent?.trim().replace(/\\/g, '/') ?? '';
    return /^import\s+['"][^'"]*灯火通明-伪同层控制器\/index\.js(?:\?[^'"]*)?['"]\s*;?$/u.test(loaderSource);
  } catch {
    return false;
  }
};

const getControllerObservationRoot = () => {
  const parent = controllerFrame?.parentElement;
  if (!parent || parent === tavernDocument.body || parent === tavernDocument.documentElement) return null;
  return parent;
};

const pruneDuplicateControllerFrames = () => {
  getControllerObservationRoot()
    ?.querySelectorAll<HTMLIFrameElement>('iframe')
    .forEach(frame => {
      if (!isControllerLoaderFrame(frame)) return;
      console.warn('[灯火阑珊·伪同层] 已卸载重复控制器');
      frame.remove();
    });
};

const scheduleDuplicateControllerPrune = (frame: HTMLIFrameElement) => {
  if (frame === controllerFrame) return;
  const pruneFrame = () => {
    if (controllerDisposed || !frame.isConnected || !isControllerLoaderFrame(frame)) return;
    console.warn('[灯火阑珊·伪同层] 已卸载延迟载入的重复控制器');
    frame.remove();
  };
  frame.addEventListener('load', pruneFrame, { once: true });
  duplicatePruneTimers.push(window.setTimeout(pruneFrame, 0));
};

const inspectAddedControllerNode = (node: Node) => {
  if (node.nodeType !== 1) return;
  const element = node as Element;
  if (element.tagName === 'IFRAME') {
    scheduleDuplicateControllerPrune(element as HTMLIFrameElement);
    return;
  }
  element
    .querySelectorAll<HTMLIFrameElement>(':scope > iframe, :scope > * > iframe')
    .forEach(scheduleDuplicateControllerPrune);
};

const installDuplicateControllerObserver = () => {
  duplicateControllerObserver?.disconnect();
  const root = getControllerObservationRoot();
  if (!root) return;
  duplicateControllerObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(inspectAddedControllerNode));
  });
  duplicateControllerObserver.observe(root, {
    childList: true,
    subtree: true,
  });
};

const disposeController = () => {
  uninjectPrompts([JOURNEY_PROMPT_ID]);
  if (controllerDisposed) return;
  rememberStageReadingPosition();
  const disposingGeneration = activeGeneration;
  controllerDisposed = true;
  if (generationHealthTimer !== null) window.clearInterval(generationHealthTimer);
  generationHealthTimer = null;
  clearDialogueCarryoverPrompt();

  if (disposingGeneration?.engine === 'dedicated') {
    disposingGeneration.cancelled = true;
    if (disposingGeneration.generationId) stopGenerationById(disposingGeneration.generationId);
  } else if (disposingGeneration?.engine === 'native' && disposingGeneration.operation === 'reroll') {
    disposingGeneration.cancelled = true;
    try {
      SillyTavern.stopGeneration();
    } catch (error) {
      console.warn('[灯火阑珊·伪同层] 控制器卸载时停止重答失败，将继续恢复旧回复', error);
    }
    void waitForNativeRerollToSettle(disposingGeneration)
      .then(() => rollbackNativeReroll(disposingGeneration))
      .catch(error => {
        // sessionStorage 中的事务快照仍保留；下次控制器挂载时会再次恢复。
        console.error('[灯火阑珊·伪同层] 控制器卸载时恢复旧回复失败', error);
      });
  }
  controllerEventStops.splice(0).forEach(subscription => subscription.stop());
  duplicatePruneTimers.splice(0).forEach(timer => window.clearTimeout(timer));
  duplicateControllerObserver?.disconnect();
  duplicateControllerObserver = null;
  frameObserver?.disconnect();
  frameObserver = null;
  observedChat = null;
  if (frameCandidateTimer !== null) window.clearTimeout(frameCandidateTimer);
  frameCandidateTimer = null;
  pendingFrameCandidates.clear();
  if (viewRefreshTimer !== null) window.clearTimeout(viewRefreshTimer);
  viewRefreshTimer = null;
  viewRefreshDeadline = 0;
  if (mobileStageAlignFrame !== null) tavernWindow.cancelAnimationFrame(mobileStageAlignFrame);
  mobileStageAlignFrame = null;
  sourceFrameCache = new WeakMap<ReplyTarget, HTMLIFrameElement>();
  invalidateStageSnapshot();
  discardQueuedStream();
  tavernWindow.removeEventListener('message', handleMessage);
  nativeInputMedia.removeEventListener('change', handleNativeInputViewportChange);
  releaseParkedFrames();
  tavernDocument.getElementById(STYLE_ID)?.remove();
  tavernDocument.body.classList.remove('dhl-pseudo-layer-active', 'dhl-native-input-collapsed', ROOT_ACTIVE_CLASS);
  tavernDocument.querySelectorAll<HTMLElement>('#chat > .mes').forEach(element => {
    element.classList.remove(STAGE_CLASS, SELECTED_CLASS, PARKED_FRAME_CLASS);
  });
  tavernDocument.querySelectorAll<HTMLElement>(`#chat > .mes .${NATIVE_STAGE_CLASS}`).forEach(element => {
    element.classList.remove(NATIVE_STAGE_CLASS);
  });
  if (controllerHost.__dhlPseudoLayerControllerLease__?.instanceId === controllerInstanceId) {
    delete controllerHost.__dhlPseudoLayerControllerLease__;
  }
  restoreNativeChatPosition();
};

const syncJourneyPrompt = () => {
  uninjectPrompts([JOURNEY_PROMPT_ID]);
  if (controllerDisposed || activeInteraction.mode === 'dialogue' || typeof Mvu === 'undefined') return;
  try {
    const messageId = latestStoryStageId();
    if (messageId === undefined) return;
    const variables = Mvu.getMvuData({ type: 'message', message_id: messageId });
    const content = buildJourneyContext(variables.stat_data);
    if (content)
      injectPrompts([
        { id: JOURNEY_PROMPT_ID, role: 'system', position: 'in_chat', depth: 0, should_scan: false, content },
      ]);
  } catch (error) {
    console.warn('[灯火阑珊·行旅] 本轮行旅引导未能读取', error);
  }
};

controllerHost.__dhlPseudoLayerControllerLease__?.dispose();
pruneDuplicateControllerFrames();
controllerHost.__dhlPseudoLayerControllerLease__ = {
  instanceId: controllerInstanceId,
  dispose: disposeController,
};
installDuplicateControllerObserver();

controllerEventStops.push(
  eventOn(tavern_events.GENERATION_AFTER_COMMANDS, type => {
    if (type === 'quiet' || type === 'impersonate') uninjectPrompts([JOURNEY_PROMPT_ID]);
    else syncJourneyPrompt();
  }),
  eventOn(iframe_events.GENERATION_STARTED, id => {
    if (id.startsWith(JOURNEY_GENERATION_PREFIX)) uninjectPrompts([JOURNEY_PROMPT_ID]);
    else syncJourneyPrompt();
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.MESSAGE_SENT, messageId => {
    void handleMessageSent(Number(messageId)).catch(error => {
      console.error('[灯火阑珊·伪同层] 写入交谈楼层元数据失败', error);
    });
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.GENERATION_STARTED, (type, _options, dryRun) => {
    if (detachedMode) return;
    if (dryRun || type === 'quiet' || type === 'impersonate') return;
    if (!activeGeneration || activeGeneration.engine !== 'native') return;
    activeGeneration.sent = true;
    sendGenerationState(activeGeneration, 'generating');
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.STREAM_TOKEN_RECEIVED, text => {
    if (detachedMode) return;
    const generation = activeGeneration;
    if (!generation || generation.engine !== 'native' || generation.cancelled) return;
    generation.streamText = text;
    const reasoning = updateGenerationReasoning(generation, readNativeLiveReasoning(generation));
    queueStream(generation, text, '', reasoning);
  }),
);

controllerEventStops.push(
  eventOn(iframe_events.STREAM_TOKEN_RECEIVED_FULLY, (text, generationId) => {
    const generation = activeGeneration;
    if (
      !generation ||
      generation.engine !== 'dedicated' ||
      generation.cancelled ||
      generation.generationId !== generationId ||
      generation.interaction.mode !== 'dialogue'
    ) {
      return;
    }
    const parsed = parseDialogueGeneration(
      text,
      generation.interaction,
      generation.operationId ?? generation.requestId,
    );
    generation.streamText = parsed.dialogue;
    generation.streamReaction = parsed.reaction;
    queueStream(generation, parsed.dialogue, parsed.reaction);
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.STREAM_REASONING_DONE, (reasoning, duration, messageId, state) => {
    if (detachedMode) return;
    const generation = activeGeneration;
    if (!generation || generation.engine !== 'native' || generation.cancelled) return;
    const targetMessageId = Number(messageId);
    const belongsToGeneration =
      generation.operation === 'reroll'
        ? targetMessageId === generation.baseMessageId
        : Number.isInteger(generation.userMessageId)
          ? targetMessageId > Number(generation.userMessageId)
          : targetMessageId > generation.baseMessageId;
    const text = sanitizeReasoningText(reasoning);
    if (!belongsToGeneration || !text) return;

    const completedReasoning = { messageId: targetMessageId, text, duration, state };
    generation.reasoning = completedReasoning;
    if (pendingStreamDispatch?.requestId === generation.requestId) {
      pendingStreamDispatch.reasoning = completedReasoning;
      flushQueuedStream(generation);
      return;
    }
    send(generation.source, {
      type: 'reasoning',
      requestId: generation.requestId,
      ...completedReasoning,
    });
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.MESSAGE_RECEIVED, messageId => {
    if (detachedMode) {
      viewRevision += 1;
      scheduleViewRefresh(120, true);
      return;
    }
    if (activeGeneration?.engine === 'dedicated') return;
    if (activeGeneration?.engine === 'native') {
      const targetId = Number(messageId);
      if (activeGeneration.operation === 'reroll' && targetId !== activeGeneration.baseMessageId) return;
      if (activeGeneration.operation === 'generate' && !isNativeGenerationAssistant(activeGeneration, targetId)) return;
    }
    void finishMessage(Number(messageId));
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.GENERATION_ENDED, messageId => {
    if (detachedMode) {
      scheduleViewRefresh(200, true);
      return;
    }
    if (activeGeneration?.engine === 'dedicated') return;
    const generation = activeGeneration;
    if (generation?.engine === 'native' && generation.operation === 'reroll') {
      // hideStopButton 发出的是 chat.length，且早于正文最终写入/MVU 后处理完成。
      // 重答目标以本次事务为准，再由 finishMessage 等待候选落盘；不能据此误判失败并回滚。
      if (!generation.cancelled) void finishMessage(generation.baseMessageId);
      return;
    }
    const reportedMessageId = Number(messageId);
    if (generation?.engine === 'native' && generation.operation === 'generate') {
      settleNativeGeneration(generation, reportedMessageId, '生成结束但模型没有返回有效回复', 800);
      return;
    }
    const lastMessageId = getLastMessageId();
    const targetMessageId = reportedMessageId === lastMessageId + 1 ? lastMessageId : reportedMessageId;
    const shouldRepairDialogueMetadata = activeGeneration?.interaction.mode === 'dialogue';
    void finishMessage(targetMessageId);
    if (shouldRepairDialogueMetadata) {
      window.setTimeout(() => {
        void repairDialogueMetadata(targetMessageId).catch(error => {
          console.warn('[灯火阑珊·伪同层] 交谈楼层元数据补写失败', error);
        });
      }, 500);
    }
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.GENERATION_STOPPED, () => {
    const generation = activeGeneration;
    if (!generation || generation.engine !== 'native') return;
    settleStoppedNativeGeneration(generation);
  }),
);

controllerEventStops.push(
  eventOn(tavern_events.MORE_MESSAGES_LOADED, () => {
    scheduleViewRefresh(300, true);
  }),
);
controllerEventStops.push(
  eventOn(tavern_events.MESSAGE_UPDATED, () => {
    viewRevision += 1;
    scheduleViewRefresh(200, true);
  }),
);
controllerEventStops.push(
  eventOn(tavern_events.MESSAGE_EDITED, () => {
    viewRevision += 1;
    scheduleViewRefresh(200, true);
  }),
);
controllerEventStops.push(
  eventOn(tavern_events.MESSAGE_SWIPED, () => {
    if (activeGeneration?.operation === 'reroll') {
      scheduleViewRefresh(200, true);
      return;
    }
    viewRevision += 1;
    scheduleViewRefresh(200, true);
  }),
);
controllerEventStops.push(
  eventOn(tavern_events.MESSAGE_DELETED, () => {
    if (deletingMessageId !== null) return;
    if (activeGeneration?.operation === 'reroll') {
      scheduleViewRefresh(200, true);
      return;
    }
    invalidateStageSnapshot();
    selectedMessageId = latestStageId() ?? null;
    selectedHistoryKind = null;
    browsingHistory = false;
    viewRevision += 1;
    scheduleViewRefresh(200);
  }),
);

void waitGlobalInitialized('Mvu')
  .then(() => {
    if (controllerDisposed) return;
    controllerEventStops.push(
      eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
        viewRevision += 1;
        scheduleViewRefresh(80, true);
      }),
    );
  })
  .catch(error => {
    console.warn('[灯火阑珊·伪同层] MVU 更新事件监听未启用，将使用消息更新事件刷新', error);
  });

controllerEventStops.push(
  eventOn(tavern_events.CHAT_CHANGED, () => {
    uninjectPrompts([JOURNEY_PROMPT_ID]);
    clearDialogueCarryoverPrompt();
    if (activeGeneration?.engine === 'dedicated') {
      activeGeneration.cancelled = true;
      if (activeGeneration.generationId) stopGenerationById(activeGeneration.generationId);
    }
    getStageRoot(false)?.remove();
    tavernDocument.body.classList.remove(ROOT_ACTIVE_CLASS);
    registrations.clear();
    sourceProtocolVersions = new WeakMap<ReplyTarget, number>();
    sourceFrameCache = new WeakMap<ReplyTarget, HTMLIFrameElement>();
    pendingFrameCandidates.clear();
    finishingMessages.clear();
    recentlyFinishedMessages.clear();
    invalidateStageSnapshot();
    discardQueuedStream();
    activeGeneration = null;
    deletingMessageId = null;
    updatingMessageId = null;
    activeInteraction = STORY_INTERACTION;
    selectedMessageId = null;
    selectedHistoryKind = null;
    selectedHistoryMessageIds.story = null;
    selectedHistoryMessageIds.dialogue = null;
    browsingHistory = false;
    viewRevision += 1;
    tavernDocument.body.classList.remove('dhl-pseudo-layer-active');
    scheduleViewRefresh(50);
    window.setTimeout(() => {
      void migrateLegacyDialogueMessages()
        .catch(error => console.warn('[灯火阑珊·幕间交谈] 旧交谈归档失败', error))
        .finally(() => recoverFailedNativeRerolls().finally(parkLatestStageFrame));
    }, 300);
  }),
);

installStyle();
const modeButtonName = '切换伪同层 / 原生楼层';
appendInexistentScriptButtons([{ name: modeButtonName, visible: true }]);
controllerEventStops.push(eventOn(getButtonEvent(modeButtonName), () => setDetachedMode(!detachedMode)));
generationHealthTimer = window.setInterval(() => {
  if (detachedMode) return;
  reconcileNativeGeneration();
  reconcileStageFrame();
}, 2000);
applyNativeInputState();
tavernWindow.addEventListener('message', handleMessage);
nativeInputMedia.addEventListener('change', handleNativeInputViewportChange);
installFrameObserver();
window.setTimeout(reconcileStageFrame, 0);
window.setTimeout(() => {
  void migrateLegacyDialogueMessages()
    .catch(error => console.warn('[灯火阑珊·幕间交谈] 旧交谈归档失败', error))
    .finally(() => recoverFailedNativeRerolls().finally(parkLatestStageFrame));
}, 600);
duplicatePruneTimers.push(
  window.setTimeout(() => {
    if (!controllerDisposed) pruneDuplicateControllerFrames();
  }, 500),
);

$(window).on('pagehide', disposeController);

console.info(`[灯火阑珊·伪同层] 原生楼层控制器已连接 v${PSEUDO_LAYER_VERSION}`);
