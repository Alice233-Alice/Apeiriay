import {
  OpportunitySchema,
  unwrapOpportunityPatchPayload,
  type NarrativeProposalKind,
  type ProposalEventNature,
} from './schema';
import { preservesRelationshipContinuity } from './narrative-continuity';
import { ensureSentence } from './action-text';
import { getForegroundWorldEvent, getWorldEventEntries } from './world-events';

export type OpportunityType = '探索' | '交涉' | '战斗' | '修炼' | '整备' | '亲密';

export type OpportunityAction = {
  标题?: string;
  行动: string;
  类型: OpportunityType;
  叙事类型: NarrativeProposalKind;
  事件性质: ProposalEventNature;
  事件?: string;
  关联事件ID?: string;
  关联任务ID?: string;
  提示?: string;
};

export type JsonPatchOperation = {
  op?: string;
  path?: string;
  value?: unknown;
};

export type ActionFeedMode = 'full' | 'partial' | 'fallback' | 'none' | 'cleared';

export type TaskSnapshot = { 名称?: unknown; 类型?: unknown; 目标?: unknown; 下一步?: unknown; 状态?: unknown };

/** 只整理展示文字，保留选择行动时提交的原始字段。 */
export function getActionCopy(action: OpportunityAction) {
  const seen = new Set<string>();
  const take = (text: string | undefined) => {
    const value = text?.trim() ?? '';
    const key = value.replace(/\s+/gu, ' ').replace(/[。.]+$/u, '');
    if (!value || seen.has(key)) return '';
    seen.add(key);
    return value;
  };
  return {
    title: take(action.标题?.trim() || action.行动),
    description: take(action.行动),
    event: take(action.事件),
    hint: take(action.提示),
  };
}

type ResolveActionFeedOptions = {
  operations: JsonPatchOperation[];
  storedActions: unknown[];
  tasks: Record<string, TaskSnapshot>;
  situation: unknown;
  worldEvents?: unknown;
  companionNames?: string[];
  useStoredActionsWithoutPatch?: boolean;
};

export const normalizeAction = (value: unknown): OpportunityAction | null => {
  const result = OpportunitySchema.safeParse(value);
  if (!result.success || !result.data.行动) return null;
  return result.data;
};

const isActionAllowed = (action: OpportunityAction, companionNames: string[]) =>
  preservesRelationshipContinuity(
    [action.标题, action.行动, action.事件, action.提示].filter(Boolean).join('｜'),
    companionNames,
  );

const reconcileActionEventReference = (
  action: OpportunityAction,
  knownWorldEventIds: ReadonlySet<string>,
): OpportunityAction => {
  const claimsExistingEvent = action.事件性质 === '回应已发生事件' || action.叙事类型 === '回应事件';
  if (!claimsExistingEvent) return action;

  const eventId = action.关联事件ID?.trim();
  if (eventId && knownWorldEventIds.has(eventId)) {
    return {
      ...action,
      叙事类型: '回应事件',
      事件性质: '回应已发生事件',
      关联事件ID: eventId,
    };
  }

  // 世界图志中没有对应事实时，只能把它当作普通的当前行动，避免界面凭空显示“回应世闻”。
  const { 事件: _event, 关联事件ID: _eventId, ...plainAction } = action;
  return {
    ...plainAction,
    叙事类型: '当前行动',
    事件性质: '无事件',
  };
};

const normalizeActionList = (values: unknown[], companionNames: string[], worldEvents?: unknown) => {
  const knownWorldEventIds = new Set(getWorldEventEntries(worldEvents).map(event => event.id));
  return values
    .map(normalizeAction)
    .filter((action): action is OpportunityAction => action !== null)
    .map(action => reconcileActionEventReference(action, knownWorldEventIds))
    .filter(action => isActionAllowed(action, companionNames));
};

const normalizeActionPayload = (
  value: unknown,
  companionNames: string[],
  worldEvents?: unknown,
): OpportunityAction[] | null => {
  const payload = unwrapOpportunityPatchPayload(value);
  if (!Array.isArray(payload)) return null;
  return normalizeActionList(payload, companionNames, worldEvents);
};

export const buildQuestAction = (id: string, task: TaskSnapshot): OpportunityAction => {
  const name = String(task.名称 || id).trim();
  const next = String(task.下一步 ?? '').trim();
  return {
    标题: next ? `推进「${name}」` : `理清「${name}」`,
    行动: next ? ensureSentence(next) : `借眼下的空档理一理「${name}」的头绪，看看接下来先办哪一桩。`,
    类型: ({ 每日: '修炼', 临危受命: '战斗' } as const)[String(task.类型) as '每日' | '临危受命'] ?? '探索',
    叙事类型: '当前行动',
    事件性质: '无事件',
    关联任务ID: id,
    提示: '顺着此事眼下的脉络往下走',
  };
};

export const buildFallbackActions = (
  tasks: Record<string, TaskSnapshot>,
  situation: unknown,
  worldEvents?: unknown,
): OpportunityAction[] => {
  const foregroundEvent = getForegroundWorldEvent(worldEvents);
  const eventActions: OpportunityAction[] = foregroundEvent
    ? [
        {
          标题: `留意「${foregroundEvent.名称}」`,
          行动: foregroundEvent.下一步?.trim()
            ? ensureSentence(foregroundEvent.下一步)
            : `留意着「${foregroundEvent.名称}」的动静，先在近处探听一下风声。`,
          类型: '探索',
          叙事类型: '回应事件',
          事件性质: '回应已发生事件',
          关联事件ID: foregroundEvent.id,
          提示: `${foregroundEvent.阶段} · ${foregroundEvent.参与情况}`,
        },
      ]
    : [];
  const taskActions = Object.entries(tasks)
    .filter(([, task]) => !task.状态 || task.状态 === '进行中')
    .slice(0, 2)
    .flatMap<OpportunityAction>(([id, task]) => {
      const name = String(task.名称 ?? '').trim();
      const target = String(task.目标 ?? '').trim();
      if (!name || !target) return [];

      return [buildQuestAction(id, task)];
    });
  if (eventActions.length > 0 || taskActions.length > 0) return [...eventActions, ...taskActions].slice(0, 3);
  if (!String(situation ?? '').trim()) return [];

  return [
    {
      标题: '静观其变',
      行动: '暂且按兵不动，先留意周遭的动静与风向。',
      类型: '探索',
      叙事类型: '平淡延续',
      事件性质: '无事件',
      提示: '静看局势变化',
    },
  ];
};

export const extractJsonPatch = (content: string): JsonPatchOperation[] => {
  const match = content.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/i);
  if (!match) return [];

  const payload = match[1]
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[行动提示] 当前楼层 JSONPatch 解析失败', error);
    return [];
  }
};

export const containsInitVar = (content: string) => /<initvar\b[^>]*>/i.test(content);

export const resolveActionFeed = ({
  operations,
  storedActions,
  tasks,
  situation,
  worldEvents,
  companionNames = [],
  useStoredActionsWithoutPatch = false,
}: ResolveActionFeedOptions): { mode: ActionFeedMode; actions: OpportunityAction[] } => {
  const validOperations = operations.filter(operation => typeof operation.path === 'string');
  const replaceAll = validOperations.find(
    operation => operation.op === 'replace' && (operation.path === '/$可参与机遇' || operation.path === '/可参与机遇'),
  );

  if (replaceAll) {
    const actions =
      normalizeActionPayload(replaceAll.value, companionNames, worldEvents) ??
      normalizeActionList(storedActions, companionNames, worldEvents);
    if (actions.length > 0) return { mode: 'full', actions };

    const fallbackActions = buildFallbackActions(tasks, situation, worldEvents);
    return fallbackActions.length > 0
      ? { mode: 'fallback', actions: fallbackActions }
      : { mode: 'cleared', actions: [] };
  }

  const clearActionList = validOperations.some(
    operation => (operation.path === '/$可参与机遇' || operation.path === '/可参与机遇') && operation.op === 'remove',
  );
  if (clearActionList) {
    const fallbackActions = buildFallbackActions(tasks, situation, worldEvents);
    return fallbackActions.length > 0
      ? { mode: 'fallback', actions: fallbackActions }
      : { mode: 'cleared', actions: [] };
  }

  const touchedIndices = [
    ...new Set(
      validOperations
        .map(operation => /^\/\$?可参与机遇\/(\d+)$/u.exec(String(operation.path))?.[1])
        .filter((index): index is string => index !== undefined)
        .map(Number)
        .filter(Number.isInteger),
    ),
  ];

  if (touchedIndices.length > 0) {
    const actions = normalizeActionList(
      touchedIndices.map(index => storedActions[index]),
      companionNames,
      worldEvents,
    );
    return { mode: actions.length > 0 ? 'partial' : 'none', actions };
  }

  if (useStoredActionsWithoutPatch) {
    const actions = normalizeActionList(storedActions, companionNames, worldEvents);
    if (actions.length > 0) return { mode: 'full', actions };
  }

  const fallbackActions = buildFallbackActions(tasks, situation, worldEvents);
  return fallbackActions.length > 0 ? { mode: 'fallback', actions: fallbackActions } : { mode: 'none', actions: [] };
};

export const actionIconMap: Record<OpportunityType, string> = {
  探索: 'fa-solid fa-mountain-sun',
  交涉: 'fa-solid fa-comments',
  战斗: 'fa-solid fa-swords',
  修炼: 'fa-solid fa-yin-yang',
  整备: 'fa-solid fa-toolbox',
  亲密: 'fa-solid fa-heart',
};

export const getActionIcon = (type: OpportunityType) => actionIconMap[type];
export const getActionKey = (action: OpportunityAction, index: number) =>
  `${action.叙事类型}|${action.类型}|${action.标题 ?? ''}|${action.行动}|${action.提示 ?? ''}|${index}`;
