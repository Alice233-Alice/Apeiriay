export const PSEUDO_LAYER_CHANNEL = 'denghuolanshan:pseudo-layer';
export const PSEUDO_LAYER_VERSION = 15;
export const PSEUDO_LAYER_MIN_COMPATIBLE_VERSION = 4;
export const PSEUDO_LAYER_SUPPORTED_VERSIONS = Array.from(
  { length: PSEUDO_LAYER_VERSION - PSEUDO_LAYER_MIN_COMPATIBLE_VERSION + 1 },
  (_, index) => PSEUDO_LAYER_VERSION - index,
);
export const PSEUDO_LAYER_MESSAGE_EDITING_VERSION = 8;
export const PSEUDO_LAYER_TIMELINE_PAGING_VERSION = 9;
export const PSEUDO_LAYER_USER_MESSAGE_EDITING_VERSION = 10;
export const PSEUDO_LAYER_REASONING_ISOLATION_VERSION = 11;
export const PSEUDO_LAYER_PENDING_INPUT_RECOVERY_VERSION = 12;
export const PSEUDO_LAYER_REASONING_EDITING_VERSION = 13;
export const PSEUDO_LAYER_DIALOGUE_DRAWER_VERSION = 14;
export const PSEUDO_LAYER_DETACHED_VERSION = 15;
export const PSEUDO_LAYER_DETACHED_STORAGE_KEY = 'denghuolanshan:pseudo-layer:detached';

export const isSupportedPseudoLayerVersion = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= PSEUDO_LAYER_MIN_COMPATIBLE_VERSION &&
  value <= PSEUDO_LAYER_VERSION;

export type InteractionMode = 'story' | 'dialogue';
export type PseudoLayerHistoryKind = InteractionMode;
export type DialogueChannel = 'present' | 'transmission';
export type DialogueEngineKind = 'native' | 'dedicated';

export type DialogueSessionState = {
  emotion?: string;
  topic?: string;
  subtext?: string;
  unresolvedThreads?: string[];
};

export type DialogueMemoryEvent = {
  id: string;
  kind: 'promise' | 'boundary' | 'conflict' | 'disclosure';
  summary: string;
  status: 'open' | 'resolved';
  resolves?: string[];
};

export type DialogueRelationEvent = {
  id: string;
  kind: 'positive' | 'negative' | 'promise' | 'boundary' | 'attitude';
  summary: string;
  favorDelta?: -1 | 0 | 1;
  applied: boolean;
};

export type DialogueVisualCard = {
  name: string;
  img_code: string;
  back_text: string;
};

export type DialogueVariableEffects = {
  favor?: boolean;
  relationship?: boolean;
  relationContext?: boolean;
  chronicle?: boolean;
};

export type DialogueContext = {
  mode: 'dialogue';
  sessionId: string;
  targetName: string;
  canonicalName: string;
  channel: DialogueChannel;
  /** 发起幕间交谈时所在的正文楼层；旧记录允许缺省并由控制器向前推断。 */
  anchorStoryMessageId?: number;
};

export type StoryInteraction = { mode: 'story' };
export type PseudoLayerInteraction = StoryInteraction | DialogueContext;

export type PseudoLayerStoryStage = { kind: 'story' };
export type PseudoLayerDialogueStage = {
  kind: 'dialogue';
  sessionId: string;
  targetName: string;
  canonicalName: string;
  channel: DialogueChannel;
  turnCount: number;
  engine?: DialogueEngineKind;
  anchorStoryMessageId?: number;
};
export type PseudoLayerStage = PseudoLayerStoryStage | PseudoLayerDialogueStage;

export type PseudoLayerTimelineTurn = {
  generationNotice?: string;
  assistantMessageId: number;
  userMessageId?: number;
  userText: string;
  assistantText: string;
  reaction?: string;
  reasoning: string;
  reasoningDuration: number | null;
  reasoningEditable?: boolean;
  responseDuration?: number;
  tokenCount?: number;
  visualCard?: DialogueVisualCard;
  variableEffects?: DialogueVariableEffects;
};

export type PseudoLayerDialogueThread = {
  sessionId: string;
  anchorStoryMessageId: number;
  representativeMessageId: number;
  messageIds: number[];
  targetName: string;
  canonicalName: string;
  channel: DialogueChannel;
  turnCount: number;
  engine?: DialogueEngineKind;
  turns: PseudoLayerTimelineTurn[];
};

export type PseudoLayerTimelineEntry = {
  representativeMessageId: number;
  messageIds: number[];
  index: number;
  historyIndex: number;
  stage: PseudoLayerStage;
  turns: PseudoLayerTimelineTurn[];
  dialogueThreads?: PseudoLayerDialogueThread[];
};

export type PseudoLayerTimelineDirection = 'around' | 'older' | 'newer';

export type PseudoLayerHistoryState = {
  selectedMessageId: number;
  latestMessageId: number;
  index: number;
  total: number;
  previousMessageId?: number;
  nextMessageId?: number;
  isLatest: boolean;
};

export type PseudoLayerInteractionMetadata = {
  version: 1 | 2 | 3;
  kind: 'dialogue';
  sessionId: string;
  targetName: string;
  canonicalName: string;
  channel: DialogueChannel;
  rawUserText?: string;
  userMessageId?: number;
  engine?: DialogueEngineKind;
  operationId?: string;
  reaction?: string;
  sessionState?: DialogueSessionState;
  memoryEvents?: DialogueMemoryEvent[];
  relationEvents?: DialogueRelationEvent[];
  anchorStoryMessageId?: number;
  visualCard?: DialogueVisualCard;
  variableEffects?: DialogueVariableEffects;
};

export type PseudoLayerGenerationState = 'idle' | 'preparing' | 'generating' | 'saving' | 'stopping';
export type PseudoLayerGenerationOperation = 'generate' | 'reroll';
export type PseudoLayerReasoningState = 'none' | 'thinking' | 'done' | 'hidden';

export type PseudoLayerPendingInput = {
  messageIds: number[];
  latestMessageId: number;
  text: string;
  count: number;
};

export type PseudoLayerView = {
  hostMessageId: number;
  revision: number;
  selectedMessageId: number;
  latestMessageId: number;
  index: number;
  total: number;
  previousMessageId?: number;
  nextMessageId?: number;
  isLatest: boolean;
  nativeInputCollapsed: boolean;
  detached: boolean;
  pendingInput?: PseudoLayerPendingInput;
  tokenCount?: number;
  stage: PseudoLayerStage;
  histories: Record<PseudoLayerHistoryKind, PseudoLayerHistoryState>;
  activeInteraction: PseudoLayerInteraction;
  /** 新版界面的正文主轴锚点。 */
  latestStoryMessageId?: number;
  /** 包含隐藏幕间楼层在内的最新状态快照楼层。 */
  latestStateMessageId?: number;
  /** 当前所选正文下归档的幕间线程。 */
  dialogueThreads?: PseudoLayerDialogueThread[];
};

export type PseudoLayerRequest =
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'hello'; messageId: number; requestId?: string }
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'goodbye'; messageId: number }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'generate';
      requestId: string;
      messageId: number;
      prompt: string;
      interaction: PseudoLayerInteraction;
    }
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'stop'; requestId: string }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'reroll';
      requestId: string;
      messageId: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'delete_message';
      requestId: string;
      messageId: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'update_message';
      requestId: string;
      messageId: number;
      content: string;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'update_user_message';
      requestId: string;
      messageId: number;
      userMessageId: number;
      content: string;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'update_reasoning';
      requestId: string;
      messageId: number;
      content: string;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'recover_pending_input';
      requestId: string;
      latestMessageId: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'navigate';
      messageId: number;
      direction: 'previous' | 'next';
      history?: PseudoLayerHistoryKind;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'timeline_page';
      requestId: string;
      anchorMessageId?: number;
      direction: PseudoLayerTimelineDirection;
      limit: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'select_entry';
      messageId: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'select_history';
      history: PseudoLayerHistoryKind;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'return_latest';
      history?: PseudoLayerHistoryKind;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'set_interaction';
      interaction: DialogueContext;
    }
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'end_interaction' }
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'set_detached'; detached: boolean }
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'toggle_native_input' };

export type PseudoLayerResponse =
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'ready';
      busy: boolean;
      detached?: boolean;
      requestId?: string;
      operation?: PseudoLayerGenerationOperation;
    }
  | { channel: typeof PSEUDO_LAYER_CHANNEL; version: number; type: 'view'; view: PseudoLayerView }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'state';
      requestId: string;
      state: Exclude<PseudoLayerGenerationState, 'idle'>;
      operation: PseudoLayerGenerationOperation;
      userText?: string;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'stream';
      requestId: string;
      text: string;
      reaction?: string;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'reasoning';
      requestId?: string;
      messageId: number;
      text: string;
      duration: number | null;
      state: PseudoLayerReasoningState;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'complete';
      requestId: string;
      messageId: number;
      notice?: string;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'deleted';
      requestId: string;
      deletedMessageId: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'message_updated';
      requestId: string;
      messageId: number;
      userMessageId?: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'pending_input_recovered';
      requestId: string;
      userText: string;
      removedCount: number;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'timeline_page';
      requestId: string;
      revision: number;
      entries: PseudoLayerTimelineEntry[];
      hasOlder: boolean;
      hasNewer: boolean;
    }
  | {
      channel: typeof PSEUDO_LAYER_CHANNEL;
      version: number;
      type: 'error';
      requestId?: string;
      message: string;
    };

const hasEnvelope = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.channel === PSEUDO_LAYER_CHANNEL && isSupportedPseudoLayerVersion(message.version);
};

const REQUEST_TYPES = new Set([
  'hello',
  'goodbye',
  'generate',
  'stop',
  'reroll',
  'delete_message',
  'update_message',
  'update_user_message',
  'update_reasoning',
  'recover_pending_input',
  'navigate',
  'timeline_page',
  'select_entry',
  'select_history',
  'return_latest',
  'set_interaction',
  'end_interaction',
  'set_detached',
  'toggle_native_input',
]);
const RESPONSE_TYPES = new Set([
  'ready',
  'view',
  'state',
  'stream',
  'reasoning',
  'complete',
  'deleted',
  'message_updated',
  'pending_input_recovered',
  'timeline_page',
  'error',
]);

export const isPseudoLayerRequest = (value: unknown): value is PseudoLayerRequest =>
  hasEnvelope(value) && REQUEST_TYPES.has(String(value.type));

export const isPseudoLayerResponse = (value: unknown): value is PseudoLayerResponse =>
  hasEnvelope(value) && RESPONSE_TYPES.has(String(value.type));
