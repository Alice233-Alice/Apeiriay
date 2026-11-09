import { jsonrepair } from 'jsonrepair';
import { readPlayerInput } from '../灯火通明/player-input';
import { extractDialogueContent, extractNarrative } from '../灯火通明/message-content';
import {
  DialogueContext,
  DialogueMemoryEvent,
  DialogueRelationEvent,
  DialogueSessionState,
  DialogueVariableEffects,
  DialogueVisualCard,
  PseudoLayerInteractionMetadata,
} from '../灯火通明/pseudo-layer-protocol';

const INTERACTION_KEY = 'dhl_pseudo_interaction';
const MAX_VISIBLE_CHARACTERS = 160;
const MAX_REACTION_CHARACTERS = 32;
const MAX_CONTEXT_TEXT = 720;
// Completion budgets also include hidden reasoning on several providers. Keep
// the visible reply bounded separately so reasoning cannot consume the answer.
const MAX_COMPLETION_TOKENS = 1536;

type DialogueEngineContext = {
  sceneSummary: string;
  historyPrompts: RolePrompt[];
};

export type DialogueGenerationInput = {
  generationId: string;
  operationId: string;
  baseMessageId: number;
  prompt: string;
  context: DialogueContext;
  messages: ChatMessage[];
  mvuData: Record<string, any>;
  getStreamFallback?: () => { reaction?: string; dialogue?: string };
};

export type ParsedDialogueGeneration = {
  raw: string;
  reaction: string;
  dialogue: string;
  sessionState?: DialogueSessionState;
  memoryEvents: DialogueMemoryEvent[];
  relationEvents: DialogueRelationEvent[];
  visualCard: DialogueVisualCard;
  variableUpdateBlock: string;
  variableEffects: DialogueVariableEffects;
};

type DialogueVariablePatch = {
  op: 'replace' | 'delta' | 'insert';
  path: string;
  value: unknown;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const compactText = (value: unknown, maxLength = MAX_CONTEXT_TEXT) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const truncateAtSentence = (value: string, maxLength: number) => {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  const candidate = text.slice(0, maxLength);
  const boundary = Math.max(
    candidate.lastIndexOf('。'),
    candidate.lastIndexOf('！'),
    candidate.lastIndexOf('？'),
    candidate.lastIndexOf('…'),
    candidate.lastIndexOf('；'),
  );
  return (boundary >= Math.floor(maxLength * 0.55) ? candidate.slice(0, boundary + 1) : candidate).trim();
};

const readMetadata = (message: ChatMessage | undefined): PseudoLayerInteractionMetadata | null => {
  const value = (message?.extra?.[INTERACTION_KEY] ?? message?.extra?.extra?.[INTERACTION_KEY]) as
    Partial<PseudoLayerInteractionMetadata> | undefined;
  if (
    !value ||
    (value.version !== 1 && value.version !== 2 && value.version !== 3) ||
    value.kind !== 'dialogue' ||
    (value.channel !== 'present' && value.channel !== 'transmission')
  ) {
    return null;
  }
  const sessionId = compactText(value.sessionId, 120);
  const targetName = compactText(value.targetName, 80);
  const canonicalName = compactText(value.canonicalName, 80);
  if (!sessionId || !targetName || !canonicalName) return null;
  return {
    ...value,
    version: value.version,
    kind: 'dialogue',
    sessionId,
    targetName,
    canonicalName,
    channel: value.channel,
  } as PseudoLayerInteractionMetadata;
};

const findPreviousUser = (messages: ChatMessage[], beforeMessageId: number) =>
  [...messages].reverse().find(message => message.role === 'user' && message.message_id < beforeMessageId);

const findPreviousMessage = (messages: ChatMessage[], beforeMessageId: number) =>
  [...messages].reverse().find(message => message.message_id < beforeMessageId);

const resolveAssistantMetadata = (message: ChatMessage, messages: ChatMessage[]) => {
  const direct = readMetadata(message);
  if (direct || message.role !== 'assistant') return direct;
  const previous = findPreviousMessage(messages, message.message_id);
  return previous?.role === 'user' ? readMetadata(previous) : null;
};

const rawUserText = (message: ChatMessage | undefined) => {
  const metadata = readMetadata(message);
  return compactText(readPlayerInput(message, metadata?.rawUserText), 360);
};

const getStatData = (mvuData: Record<string, any>) => {
  const statData = _.get(mvuData, 'stat_data');
  return isRecord(statData) ? statData : mvuData;
};

const buildSceneSummary = (
  context: DialogueContext,
  mvuData: Record<string, any>,
  latestState?: DialogueSessionState,
  memories: DialogueMemoryEvent[] = [],
) => {
  const statData = getStatData(mvuData);
  const companion = _.get(statData, ['红颜', context.canonicalName], {});
  const relationContext = _.get(companion, '关系上下文', {});
  const track = _.get(statData, '本尊.行踪', {});
  const location = compactText(_.get(track, '当前区域', '未知之地'), 100);
  const environment = compactText(_.get(track, '环境描述', ''), 220);
  const situation = compactText(_.get(statData, '当前处境', ''), 360);
  const relationship = compactText(_.get(companion, '关系', ''), 100);
  const favor = Number(_.get(companion, '好感度'));
  const relationLines = [
    ['关系', relationship],
    ['好感', Number.isFinite(favor) ? String(favor) : ''],
    ['当前情绪', compactText(_.get(relationContext, '当前情绪', ''), 120)],
    ['态度缘由', compactText(_.get(relationContext, '态度缘由', ''), 180)],
    ['关系诉求', compactText(_.get(relationContext, '关系诉求', ''), 180)],
    ['相处禁忌', compactText(_.get(relationContext, '相处禁忌', ''), 180)],
    ['未了约定', compactText(_.get(relationContext, '未了约定', ''), 180)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}：${value}`)
    .join('\n');
  const sessionLines = latestState
    ? [
        latestState.emotion && `会话情绪：${compactText(latestState.emotion, 120)}`,
        latestState.topic && `当前话题：${compactText(latestState.topic, 160)}`,
        latestState.subtext && `当前潜台词：${compactText(latestState.subtext, 180)}`,
        latestState.unresolvedThreads?.length &&
          `未解线索：${latestState.unresolvedThreads.map(item => compactText(item, 100)).join('；')}`,
      ]
        .filter(Boolean)
        .join('\n')
    : '';
  const memoryLines = memories.length
    ? `尚未解决的重要记忆：\n${memories.map(item => `- [${item.kind}] ${compactText(item.summary, 160)}`).join('\n')}`
    : '';

  return [
    `目标角色：${context.targetName}（规范角色名：${context.canonicalName}）`,
    `交流方式：${context.channel === 'present' ? '当面交谈' : '远程传讯'}`,
    `地点：${location}`,
    environment && `环境：${environment}`,
    situation && `当前处境：${situation}`,
    relationLines,
    sessionLines,
    memoryLines,
  ]
    .filter(Boolean)
    .join('\n');
};

const collectSessionState = (messages: ChatMessage[], context: DialogueContext, baseMessageId: number) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.message_id > baseMessageId || message.role !== 'assistant') continue;
    const metadata = resolveAssistantMetadata(message, messages);
    if (metadata?.sessionId === context.sessionId && metadata.sessionState) return metadata.sessionState;
  }
  return undefined;
};

const collectOpenMemories = (messages: ChatMessage[], context: DialogueContext, baseMessageId: number) => {
  const projection = new Map<string, DialogueMemoryEvent>();
  messages.forEach(message => {
    if (message.message_id > baseMessageId || message.role !== 'assistant') return;
    const metadata = resolveAssistantMetadata(message, messages);
    if (!metadata || metadata.targetName !== context.targetName) return;
    (metadata.memoryEvents ?? []).forEach(event => {
      (event.resolves ?? []).forEach(id => projection.delete(id));
      if (event.status === 'resolved') projection.delete(event.id);
      else projection.set(event.id, event);
    });
  });
  return [...projection.values()].slice(-8);
};

const buildHistoryPrompts = (
  messages: ChatMessage[],
  context: DialogueContext,
  baseMessageId: number,
  sceneSummary: string,
) => {
  const prompts: RolePrompt[] = [{ role: 'system', content: `【本轮对话资料】\n${sceneSummary}` }];
  const storyAssistant = [...messages]
    .reverse()
    .find(
      message =>
        message.role === 'assistant' &&
        message.message_id <= baseMessageId &&
        !resolveAssistantMetadata(message, messages),
    );
  if (storyAssistant) {
    const storyUser = findPreviousUser(messages, storyAssistant.message_id);
    const userAnchor = compactText(storyUser?.message, 360);
    const assistantAnchor = compactText(extractNarrative(storyAssistant.message), MAX_CONTEXT_TEXT);
    prompts.push({
      role: 'system',
      content: [
        '【最近正文锚点，仅用于理解现场，不要续写成长篇剧情】',
        userAnchor && `用户：${userAnchor}`,
        assistantAnchor && `剧情：${assistantAnchor}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  const sessionTurns = messages
    .filter(message => message.role === 'assistant' && message.message_id <= baseMessageId)
    .flatMap(message => {
      const metadata = resolveAssistantMetadata(message, messages);
      if (!metadata || metadata.sessionId !== context.sessionId) return [];
      const linkedUser = Number.isFinite(metadata.userMessageId)
        ? messages.find(candidate => candidate.message_id === metadata.userMessageId)
        : findPreviousUser(messages, message.message_id);
      const visible = extractDialogueContent(message.message);
      return [
        {
          user: rawUserText(linkedUser),
          assistant: [visible.reaction && `（${visible.reaction}）`, visible.dialogue].filter(Boolean).join(' '),
        },
      ];
    })
    .slice(-8);
  sessionTurns.forEach(turn => {
    if (turn.user) prompts.push({ role: 'user', content: turn.user });
    if (turn.assistant) prompts.push({ role: 'assistant', content: compactText(turn.assistant, 320) });
  });
  return prompts;
};

const buildEngineContext = (input: DialogueGenerationInput): DialogueEngineContext => {
  const latestState = collectSessionState(input.messages, input.context, input.baseMessageId);
  const memories = collectOpenMemories(input.messages, input.context, input.baseMessageId);
  const sceneSummary = buildSceneSummary(input.context, input.mvuData, latestState, memories);
  return {
    sceneSummary,
    historyPrompts: buildHistoryPrompts(input.messages, input.context, input.baseMessageId, sceneSummary),
  };
};

const buildDialogueContract = (context: DialogueContext) =>
  `
【灯火阑珊·红颜专用短对话引擎】
你现在只扮演「${context.targetName}」（规范角色名：${context.canonicalName}）直接回应用户。
这是${context.channel === 'present' ? '当面交谈' : '远程传讯'}，不是剧情续写任务。

角色表现：
- 必须遵守现有角色人设、关系阶段与世界事实，但允许回避、不同意、设立边界、反问或主动追问。
- 回复除回答内容外，至少自然体现一种私人向量：个人立场、欲望、边界、具体记忆或言外之意。
- 不要固定套用“回答后反问”的模板；角色没有必要每次都提问。
- 不得替用户决定言行，不得无请求地跳时间、换地点、开启任务或推进成长篇剧情。

输出结构：
- 严格按 <反应>、<正文>、<会话状态>、<visual_cards>、<UpdateVariable> 的顺序输出，除此之外不得输出任何文字或 Markdown 代码块。
- <反应> 最多 32 个汉字，只写一个短动作、停顿或神态，可以为空。${context.channel === 'transmission' ? '本轮为远程传讯，<反应>必须为空，不能描写用户看不见的远端动作。' : ''}
- <正文> 只写「${context.targetName}」亲口说出或传回的话，不写说话人标签，不用引号包裹整段。
- 普通回应通常 30 至 70 字；复杂问答或明显情绪冲突可以更长，但 <反应> 与 <正文> 合计不得超过 160 字。
- 不得输出旁白续写或其他结构块。

立绘卡：
- 每轮必须输出一张且只能一张「${context.targetName}」的 visual card；远程传讯也必须输出。
- 格式为 <visual_cards>[{"name":"${context.targetName}","img_code":"normal","back_text":"即时心声"}]</visual_cards>。
- img_code 仅限 normal、smile、shy、angry、sad、surprise；拿不准用 normal。back_text 要短且符合当前角色。

受限变量：
- 每轮必须输出标准 <UpdateVariable><Analysis>...</Analysis><JSONPatch>[...]</JSONPatch></UpdateVariable>；没有重要变化时 JSONPatch 输出 []。
- 只能修改 /红颜/${context.canonicalName}/好感度、/关系、/关系上下文/当前情绪|态度缘由|关系诉求|相处禁忌|未了约定、/羁绊纪事/事件名。
- 普通寒暄不得改变好感；只有明确交心、承诺、冲突或边界事件才可对好感 delta -1 或 1。
- 关系仅在实际跨阶段时 replace；关系上下文单轮最多两项；羁绊纪事只记录以后确实需要记住的重要事件。
- 禁止修改时间、地点、任务、物品、灵石、修炼、战斗、其他角色或任何未列出的字段。

隐藏状态：
<会话状态> 内输出一行严格 JSON，不得用代码围栏：
{"emotion":"当前情绪","topic":"当前话题","subtext":"潜台词","unresolvedThreads":["未解线索"],"memoryEvents":[{"kind":"promise|boundary|conflict|disclosure","summary":"仅记录真正重要且以后应记住的事件","status":"open|resolved","resolves":[]}],"relationEvents":[]}
- 没有重要记忆或关系事件时对应数组必须为空，不要把日常寒暄记为事件。
- relationEvents 应与 UpdateVariable 中的实际变化一致；没有重要变化时必须为空。
`.trim();

const readCompleteTag = (text: string, tag: string) =>
  text.match(new RegExp(`<${tag}(?=[\\s/>])[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'))?.[1]?.trim() ?? '';

const stripDialogueTags = (text: string) =>
  text
    .replace(/<\/?(?:反应|正文|会话状态|visual_cards|UpdateVariable|Analysis|JSONPatch)(?=[\s/>])[^>]*>/gi, '')
    .trim();

const readBoundedTag = (text: string, tag: string, stopTags: string[]) => {
  const open = new RegExp(`<${tag}(?=[\\s/>])[^>]*>`, 'i').exec(text);
  if (!open) return '';

  const remainder = text.slice(open.index + open[0].length);
  const close = new RegExp(`<\\/${tag}\\s*>`, 'i').exec(remainder);
  let end = close?.index ?? remainder.length;
  stopTags.forEach(stopTag => {
    const stop = new RegExp(`<${stopTag}(?=[\\s/>])[^>]*>`, 'i').exec(remainder);
    if (stop && stop.index < end) end = stop.index;
  });
  return stripDialogueTags(remainder.slice(0, end));
};

const parseStateJson = (text: string) => {
  const raw = readCompleteTag(text, '会话状态')
    .replace(/^```(?:json)?\s*|\s*```$/gi, '')
    .trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(jsonrepair(raw));
    return isRecord(parsed) ? parsed : undefined;
  } catch (error) {
    console.warn('[灯火阑珊·短对话] 会话状态解析失败，已保留可见对白', error);
    return undefined;
  }
};

const normalizeSessionState = (value: unknown): DialogueSessionState | undefined => {
  if (!isRecord(value)) return undefined;
  const unresolvedThreads = Array.isArray(value.unresolvedThreads)
    ? value.unresolvedThreads
        .map(item => compactText(item, 120))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const state: DialogueSessionState = {
    emotion: compactText(value.emotion, 100) || undefined,
    topic: compactText(value.topic, 140) || undefined,
    subtext: compactText(value.subtext, 180) || undefined,
    unresolvedThreads: unresolvedThreads.length ? unresolvedThreads : undefined,
  };
  return Object.values(state).some(Boolean) ? state : undefined;
};

const normalizeMemoryEvents = (value: unknown, operationId: string): DialogueMemoryEvent[] => {
  if (!Array.isArray(value)) return [];
  const kinds = new Set<DialogueMemoryEvent['kind']>(['promise', 'boundary', 'conflict', 'disclosure']);
  const statuses = new Set<DialogueMemoryEvent['status']>(['open', 'resolved']);
  return value
    .flatMap((candidate, index) => {
      if (!isRecord(candidate) || !kinds.has(candidate.kind) || !statuses.has(candidate.status)) return [];
      const summary = compactText(candidate.summary, 180);
      if (!summary) return [];
      const resolves = Array.isArray(candidate.resolves)
        ? candidate.resolves
            .map(item => compactText(item, 120))
            .filter(Boolean)
            .slice(0, 8)
        : [];
      return [
        {
          id: `${operationId}:memory:${index}`,
          kind: candidate.kind,
          summary,
          status: candidate.status,
          ...(resolves.length ? { resolves } : {}),
        } satisfies DialogueMemoryEvent,
      ];
    })
    .slice(0, 4);
};

const normalizeRelationEvents = (value: unknown, operationId: string): DialogueRelationEvent[] => {
  if (!Array.isArray(value)) return [];
  const kinds = new Set<DialogueRelationEvent['kind']>(['positive', 'negative', 'promise', 'boundary', 'attitude']);
  return value
    .flatMap((candidate, index) => {
      if (!isRecord(candidate) || !kinds.has(candidate.kind)) return [];
      const summary = compactText(candidate.summary, 180);
      if (!summary) return [];
      const rawDelta = Number(candidate.favorDelta);
      const favorDelta = rawDelta === -1 || rawDelta === 0 || rawDelta === 1 ? rawDelta : undefined;
      return [
        {
          id: `${operationId}:relation:${index}`,
          kind: candidate.kind,
          summary,
          ...(favorDelta !== undefined ? { favorDelta } : {}),
          applied: false,
        } satisfies DialogueRelationEvent,
      ];
    })
    .slice(0, 2);
};

const normalizeVisualCard = (raw: string, context: DialogueContext): DialogueVisualCard => {
  const fallback: DialogueVisualCard = { name: context.targetName, img_code: 'normal', back_text: '' };
  const body = readCompleteTag(raw, 'visual_cards');
  if (!body) return fallback;
  try {
    const parsed = JSON.parse(jsonrepair(body));
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!isRecord(candidate)) return fallback;
    const allowedExpressions = new Set(['normal', 'smile', 'shy', 'angry', 'sad', 'surprise']);
    const imgCode = compactText(candidate.img_code, 24);
    return {
      name: context.targetName,
      img_code: allowedExpressions.has(imgCode) ? imgCode : 'normal',
      back_text: compactText(candidate.back_text, 80),
    };
  } catch (error) {
    console.warn('[灯火阑珊·短对话] visual_cards 解析失败，已补用默认立绘卡', error);
    return fallback;
  }
};

const decodeJsonPointer = (path: string) =>
  path
    .split('/')
    .slice(1)
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

const normalizeDialogueVariablePatches = (
  raw: string,
  context: DialogueContext,
): { patches: DialogueVariablePatch[]; effects: DialogueVariableEffects } => {
  const updateBody = readCompleteTag(raw, 'UpdateVariable');
  const patchBody = readCompleteTag(updateBody || raw, 'JSONPatch');
  if (!patchBody) return { patches: [], effects: {} };
  let candidates: unknown;
  try {
    candidates = JSON.parse(jsonrepair(patchBody));
  } catch (error) {
    console.warn('[灯火阑珊·短对话] JSONPatch 解析失败，本轮对白仍会保存但不更新变量', error);
    return { patches: [], effects: {} };
  }
  if (!Array.isArray(candidates)) return { patches: [], effects: {} };

  const patches: DialogueVariablePatch[] = [];
  const effects: DialogueVariableEffects = {};
  const relationContextFields = new Set(['当前情绪', '态度缘由', '关系诉求', '相处禁忌', '未了约定']);
  let relationContextCount = 0;
  let chronicleCount = 0;
  let favorCount = 0;
  let relationshipCount = 0;

  candidates.forEach(candidate => {
    if (!isRecord(candidate) || typeof candidate.path !== 'string') return;
    const segments = decodeJsonPointer(candidate.path);
    if (segments[0] !== '红颜' || segments[1] !== context.canonicalName) return;

    if (segments.length === 3 && segments[2] === '好感度' && candidate.op === 'delta' && favorCount < 1) {
      const delta = Number(candidate.value);
      if (delta !== -1 && delta !== 1) return;
      patches.push({ op: 'delta', path: candidate.path, value: delta });
      favorCount += 1;
      effects.favor = true;
      return;
    }

    if (segments.length === 3 && segments[2] === '关系' && candidate.op === 'replace' && relationshipCount < 1) {
      const value = compactText(candidate.value, 80);
      if (!value) return;
      patches.push({ op: 'replace', path: candidate.path, value });
      relationshipCount += 1;
      effects.relationship = true;
      return;
    }

    if (
      segments.length === 4 &&
      segments[2] === '关系上下文' &&
      relationContextFields.has(segments[3]) &&
      candidate.op === 'replace' &&
      relationContextCount < 2
    ) {
      const value = compactText(candidate.value, 180);
      if (!value) return;
      patches.push({ op: 'replace', path: candidate.path, value });
      relationContextCount += 1;
      effects.relationContext = true;
      return;
    }

    if (
      segments.length === 4 &&
      segments[2] === '羁绊纪事' &&
      (candidate.op === 'insert' || candidate.op === 'replace') &&
      chronicleCount < 1 &&
      isRecord(candidate.value)
    ) {
      const summary = compactText(candidate.value.摘要, 180);
      if (!segments[3] || !summary) return;
      patches.push({
        op: candidate.op,
        path: candidate.path,
        value: {
          类型: compactText(candidate.value.类型, 20) || '其他',
          摘要: summary,
          时地: compactText(candidate.value.时地, 100),
        },
      });
      chronicleCount += 1;
      effects.chronicle = true;
    }
  });

  return { patches, effects };
};

const buildVariableUpdateBlock = (patches: DialogueVariablePatch[]) => {
  if (patches.length === 0) return '';
  const labels = patches.map(patch => decodeJsonPointer(patch.path).slice(2).join('·'));
  return [
    '<UpdateVariable>',
    `<Analysis>幕间交谈：${[...new Set(labels)].join('、')}</Analysis>`,
    `<JSONPatch>${JSON.stringify(patches)}</JSONPatch>`,
    '</UpdateVariable>',
  ].join('\n');
};

export const parseDialogueGeneration = (
  raw: string,
  context: DialogueContext,
  operationId: string,
): ParsedDialogueGeneration => {
  const visible = extractDialogueContent(raw);
  // Streaming extraction intentionally tolerates unfinished tags. A completed
  // reply needs stricter boundaries because some models open the next block
  // before closing the previous one.
  const boundedReaction = readBoundedTag(raw, '反应', ['正文', '会话状态', 'visual_cards', 'UpdateVariable']);
  const boundedDialogue = readBoundedTag(raw, '正文', ['会话状态', 'visual_cards', 'UpdateVariable']);
  const reaction =
    context.channel === 'transmission'
      ? ''
      : truncateAtSentence(
          compactText(stripDialogueTags(boundedReaction || visible.reaction), MAX_REACTION_CHARACTERS),
          MAX_REACTION_CHARACTERS,
        );
  const dialogueLimit = Math.max(48, MAX_VISIBLE_CHARACTERS - reaction.length);
  const dialogue = truncateAtSentence(
    compactText(stripDialogueTags(boundedDialogue || visible.dialogue), dialogueLimit),
    dialogueLimit,
  );
  const state = parseStateJson(raw);
  const memoryEvents = normalizeMemoryEvents(state?.memoryEvents, operationId);
  const relationEvents = normalizeRelationEvents(state?.relationEvents, operationId);
  const visualCard = normalizeVisualCard(raw, context);
  const variableUpdate = normalizeDialogueVariablePatches(raw, context);
  if (relationEvents.length === 0 && memoryEvents.length === 0 && variableUpdate.effects.favor) {
    variableUpdate.patches = variableUpdate.patches.filter(patch => decodeJsonPointer(patch.path)[2] !== '好感度');
    delete variableUpdate.effects.favor;
  }
  if (relationEvents.length === 0 && variableUpdate.effects.relationship) {
    variableUpdate.patches = variableUpdate.patches.filter(patch => decodeJsonPointer(patch.path)[2] !== '关系');
    delete variableUpdate.effects.relationship;
  }
  if (memoryEvents.length === 0 && variableUpdate.effects.chronicle) {
    variableUpdate.patches = variableUpdate.patches.filter(patch => decodeJsonPointer(patch.path)[2] !== '羁绊纪事');
    delete variableUpdate.effects.chronicle;
  }
  return {
    raw,
    reaction,
    dialogue,
    sessionState: normalizeSessionState(state),
    memoryEvents,
    relationEvents,
    visualCard,
    variableUpdateBlock: buildVariableUpdateBlock(variableUpdate.patches),
    variableEffects: variableUpdate.effects,
  };
};

export const generateDialogueReply = async (input: DialogueGenerationInput): Promise<ParsedDialogueGeneration> => {
  const engineContext = buildEngineContext(input);
  const decoratedInput =
    input.context.channel === 'present'
      ? `（对${input.context.targetName}说）${input.prompt.trim()}`
      : `（向${input.context.targetName}传讯）${input.prompt.trim()}`;
  // The normal preset contains the long-form story contract (and, on some
  // presets, an expensive reasoning directive).  A dialogue request needs the
  // current API/model and world books, but not that prose contract.  Using the
  // raw prompt composer keeps those two concerns separate while preserving all
  // character/world-book activation.
  const result = await generateRaw({
    generation_id: input.generationId,
    user_input: decoratedInput,
    should_stream: true,
    should_silence: true,
    max_chat_history: 0,
    custom_api: { max_tokens: MAX_COMPLETION_TOKENS },
    ordered_prompts: [
      'world_info_before',
      'persona_description',
      'char_description',
      'char_personality',
      'scenario',
      'world_info_after',
      ...engineContext.historyPrompts,
      {
        role: 'system',
        content: buildDialogueContract(input.context),
      },
      'user_input',
    ],
  });
  if (typeof result !== 'string') throw new Error('短对话模型返回了工具调用，未得到可见对白。');
  const parsed = parseDialogueGeneration(result, input.context, input.operationId);
  if (!parsed.dialogue) {
    const streamed = input.getStreamFallback?.();
    const reaction =
      input.context.channel === 'transmission'
        ? ''
        : truncateAtSentence(
            compactText(stripDialogueTags(streamed?.reaction ?? ''), MAX_REACTION_CHARACTERS),
            MAX_REACTION_CHARACTERS,
          );
    const dialogueLimit = Math.max(48, MAX_VISIBLE_CHARACTERS - reaction.length);
    const dialogue = truncateAtSentence(
      compactText(stripDialogueTags(streamed?.dialogue ?? ''), dialogueLimit),
      dialogueLimit,
    );
    if (dialogue) {
      console.warn('[灯火阑珊·短对话] 最终返回值缺少可见对白，已采用最后一份有效的流式对白');
      return { ...parsed, reaction, dialogue };
    }
  }
  if (!parsed.dialogue) throw new Error('角色没有返回可供显示的对白，请重试。');
  return parsed;
};
