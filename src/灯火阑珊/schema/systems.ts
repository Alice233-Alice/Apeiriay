// ============================================================================
// 踏月寻仙 - 系统 Schema（任务列表、声望系统、可参与机遇、当前处境）
// ============================================================================

import { z } from 'zod';
import { LOCATION_DOMAIN_VALUES } from '../map-system';
import { finiteNumber, NormalizedStringListSchema } from './common';
import { CURRENT_CULTIVATION_VERSION, CURRENT_SCHEMA_VERSION } from './constants';

// 任务状态容错映射：兼容既有存档和明确的放弃结果。
const 任务状态映射: Record<string, '进行中' | '已完成' | '已失败' | '已放弃'> = {
  进行中: '进行中',
  进行: '进行中',
  处理中: '进行中',
  未完成: '进行中',
  待完成: '进行中',
  未开始: '进行中',
  已接取: '进行中',
  接取: '进行中',
  active: '进行中',

  已完成: '已完成',
  完成: '已完成',
  完成了: '已完成',
  已达成: '已完成',
  达成: '已完成',
  已结束: '已完成',
  结束: '已完成',
  done: '已完成',
  complete: '已完成',
  completed: '已完成',

  已失败: '已失败',
  失败: '已失败',
  失敗: '已失败',
  失败了: '已失败',
  中止: '已失败',
  终止: '已失败',
  放弃: '已放弃',
  已放弃: '已放弃',
  abandoned: '已放弃',
  超时失败: '已失败',
  failed: '已失败',
  fail: '已失败',
};

// 任务类型容错映射：兼容 AI 常见写法，统一到任务系统支持的类型
const 任务类型映射: Record<string, '主线' | '支线' | '每日' | '临危受命' | '秘境探索'> = {
  主线: '主线',
  主任务: '主线',
  主线任务: '主线',
  main: '主线',

  支线: '支线',
  支线任务: '支线',
  side: '支线',
  sidequest: '支线',

  每日: '每日',
  日常: '每日',
  每日任务: '每日',
  daily: '每日',

  临危受命: '临危受命',
  紧急: '临危受命',
  紧急任务: '临危受命',
  urgent: '临危受命',

  秘境探索: '秘境探索',
  秘境: '秘境探索',
  探索: '秘境探索',
  秘境任务: '秘境探索',
  dungeon: '秘境探索',

  // “修炼任务”在当前 UI 语义上更接近支线，做保守归一
  修炼: '支线',
  修炼任务: '支线',
};

// 任务列表 Schema
export const QuestSchema = z.object({
  名称: z.string().prefault(''),
  类型: z
    .string()
    .transform(v => 任务类型映射[String(v).trim()] || '支线')
    .prefault('主线'),
  目标: z.string().prefault(''),
  进度: z.string().prefault(''),
  下一步: z.string().prefault(''),
  关联人物: NormalizedStringListSchema.optional(),
  关联地点: NormalizedStringListSchema.optional(),
  关联物品: NormalizedStringListSchema.optional(),
  关联事件ID: z
    .string()
    .transform(value => value.trim())
    .optional(),
  结果: z.string().optional(),
  状态: z
    .string()
    .transform(v => 任务状态映射[String(v).trim()] || '进行中')
    .prefault('进行中'),
  // 秘境专属字段（仅当类型为秘境探索时需要）
  秘境信息: z
    .object({
      域: z.enum(LOCATION_DOMAIN_VALUES).optional(),
      危: finiteNumber(0)
        .transform(v => _.clamp(v, 0, 100))
        .optional(),
      特: z.string().optional(),
      奖: NormalizedStringListSchema,
      限: z.string().optional(),
    })
    .optional(),
  创建时间: z
    .union([
      finiteNumber(Date.now()), // 兼容已有的时间戳
      z.string().transform(() => {
        // AI 输入修仙时间格式时，简化处理：直接用当前时间
        return Date.now();
      }),
    ])
    .prefault(() => Date.now()),
});

export const QuestResultSchema = z.object({
  名称: z.string(),
  类型: z.string(),
  状态: z.enum(['已完成', '已失败', '已放弃']),
  结果: z.string().prefault(''),
  时地: z.string().prefault(''),
  关联事件ID: z.string().optional(),
});

export const RecentQuestResultsSchema = z.record(z.string(), QuestResultSchema).prefault({});

/** 先归档再清理，归档本身只记录事实，不触发任何资产结算。 */
export function settleQuestLedger(
  tasks: Record<string, z.output<typeof QuestSchema>>,
  history: z.output<typeof RecentQuestResultsSchema>,
  timePlace: string,
) {
  const active: typeof tasks = {};
  const results = { ...history };
  for (const [id, task] of Object.entries(tasks)) {
    if (task.状态 === '进行中') {
      active[id] = task;
      continue;
    }
    delete results[id];
    results[id] = {
      名称: task.名称,
      类型: task.类型,
      状态: task.状态,
      结果: task.结果?.trim() || task.进度 || task.目标,
      时地: timePlace,
      ...(task.关联事件ID ? { 关联事件ID: task.关联事件ID } : {}),
    };
  }
  return { tasks: active, results: Object.fromEntries(Object.entries(results).slice(-5)) };
}

// 声望条目 Schema
export const ReputationEntrySchema = z.object({
  值: finiteNumber(0)
    .transform(v => _.clamp(v, -100, 100))
    .prefault(0),
  关系: z.string().prefault('陌生'),
  更新时间: finiteNumber(Date.now()).prefault(() => Date.now()),
});

// 声望系统 Schema（带自动关系计算 transform）
export const ReputationSystemSchema = z
  .record(z.string().describe('势力名'), ReputationEntrySchema)
  .prefault({})
  .transform(factions => {
    const autoRelationLabels = new Set([
      '陌生',
      '盟友',
      '友善',
      '友好',
      '中立偏好',
      '中立',
      '中立偏恶',
      '敌对',
      '仇恨',
      '不死不休',
    ]);

    // 自动根据声望值计算关系描述
    return _(factions)
      .mapValues(faction => {
        const value = faction.值;
        let 自动关系: string;

        if (value >= 80) {
          自动关系 = '盟友';
        } else if (value >= 60) {
          自动关系 = '友善';
        } else if (value >= 30) {
          自动关系 = '友好';
        } else if (value >= 10) {
          自动关系 = '中立偏好';
        } else if (value >= -10) {
          自动关系 = '中立';
        } else if (value >= -30) {
          自动关系 = '中立偏恶';
        } else if (value >= -60) {
          自动关系 = '敌对';
        } else if (value >= -80) {
          自动关系 = '仇恨';
        } else {
          自动关系 = '不死不休';
        }

        // 标准称谓视为派生值并随声望重算；剧情自定义称谓（如“真传弟子”）继续保留。
        const 最终关系 = faction.关系 && !autoRelationLabels.has(faction.关系) ? faction.关系 : 自动关系;

        return {
          ...faction,
          关系: 最终关系,
        };
      })
      .value();
  });

// 可参与机遇 / 叙事提案 Schema
export type OpportunityType = '探索' | '交涉' | '战斗' | '修炼' | '整备' | '亲密';
export type NarrativeProposalKind = '平淡延续' | '当前行动' | '事件行动' | '回应事件' | '场景大纲' | '时间推进';
export type ProposalEventNature = '无事件' | '选中后成立' | '回应已发生事件';

const 叙事类型映射: Record<string, NarrativeProposalKind> = {
  平淡: '平淡延续',
  平淡延续: '平淡延续',
  继续: '当前行动',
  当前行动: '当前行动',
  行动: '当前行动',
  事件: '事件行动',
  事件行动: '事件行动',
  回应: '回应事件',
  回应事件: '回应事件',
  大纲: '场景大纲',
  场景大纲: '场景大纲',
  时间跳转: '时间推进',
  时间推进: '时间推进',
  calm: '平淡延续',
  action: '当前行动',
  event: '事件行动',
  response: '回应事件',
  outline: '场景大纲',
  timeskip: '时间推进',
};

const 事件性质映射: Record<string, ProposalEventNature> = {
  无: '无事件',
  无事件: '无事件',
  候选: '选中后成立',
  候选事件: '选中后成立',
  选中后成立: '选中后成立',
  已发生: '回应已发生事件',
  回应已发生事件: '回应已发生事件',
  none: '无事件',
  candidate: '选中后成立',
  existing: '回应已发生事件',
};

const 机遇类型映射: Record<string, OpportunityType> = {
  探索: '探索',
  行动: '探索',
  冒险: '探索',
  机缘: '探索',
  机遇: '探索',
  奇遇: '探索',
  秘境: '探索',
  寻宝: '探索',
  交涉: '交涉',
  结交: '交涉',
  交谈: '交涉',
  社交: '交涉',
  互动: '交涉',
  邀约: '交涉',
  邂逅: '交涉',
  战斗: '战斗',
  争夺: '战斗',
  挑战: '战斗',
  修炼: '修炼',
  整备: '整备',
  交易: '整备',
  采购: '整备',
  易物: '整备',
  买卖: '整备',
  红颜: '亲密',
  双修: '亲密',
  亲密: '亲密',
  调情: '亲密',
  explore: '探索',
  exploration: '探索',
  adventure: '探索',
  negotiate: '交涉',
  negotiation: '交涉',
  social: '交涉',
  interaction: '交涉',
  battle: '战斗',
  combat: '战斗',
  fight: '战斗',
  cultivate: '修炼',
  cultivation: '修炼',
  training: '修炼',
  prepare: '整备',
  preparation: '整备',
  supply: '整备',
  trade: '整备',
  intimate: '亲密',
  intimacy: '亲密',
  romance: '亲密',
};

const 机遇类型推断规则: Array<{ type: OpportunityType; pattern: RegExp }> = [
  {
    type: '亲密',
    pattern:
      /红颜|佳人|道侣|双修|温情|独处|相拥|相守|调情|缠绵|共寝|同眠|亲吻|亲密|忘忧|听雨|清弦|晚棠|云裳|梦杳泠|羽岚|羽岚烟|岚烟|朔璃鸢|阿鸢|血手飞鸢|朔望舒|赤月女帝|幽影宗主|虞汐|虞颜|虞汐颜|沈倩宁|倩宁|赤血狂刃/,
  },
  {
    type: '修炼',
    pattern: /修炼|闭关|打坐|吐纳|调息|冲关|破境|突破|压境|稳固|悟道|渡劫|根基|炼化|参悟/,
  },
  {
    type: '整备',
    pattern: /整备|修复|炼器|疗伤|丹药|灵阵|阵纹|坊市|易物|交易|买卖|采购|拍卖|商会|补给|售卖|收购|置换/,
  },
  {
    type: '战斗',
    pattern: /战斗|争夺|夺取|抢夺|截杀|斗法|厮杀|围攻|追杀|迎战|强敌|魔修|冲突|守擂|比斗/,
  },
  {
    type: '交涉',
    pattern: /交涉|交谈|结交|拜访|邀约|会面|结识|拉拢|试探|求见|访友|赴宴|询问|劝说|谈判|论道|同游/,
  },
  {
    type: '探索',
    pattern: /探索|探查|调查|追查|搜寻|寻找|寻路|赶路|潜入|护送|营救|赴约|秘境|线索|遗迹|洞穴/,
  },
];

function normalizeOpportunityText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeNarrativeKind(value: unknown, eventNature: ProposalEventNature): NarrativeProposalKind {
  const mapped = 叙事类型映射[normalizeOpportunityText(value).toLowerCase()];
  if (mapped) return mapped;
  if (eventNature === '回应已发生事件') return '回应事件';
  if (eventNature === '选中后成立') return '事件行动';
  return '当前行动';
}

function normalizeProposalEventNature(value: unknown, event: string, eventId: string): ProposalEventNature {
  const mapped = 事件性质映射[normalizeOpportunityText(value).toLowerCase()];
  if (mapped) return mapped;
  if (eventId) return '回应已发生事件';
  if (event) return '选中后成立';
  return '无事件';
}

function inferOpportunityType(rawType: string, payload: Record<string, string>): OpportunityType {
  const mappedType = 机遇类型映射[normalizeOpportunityText(rawType).toLowerCase()];
  if (mappedType) return mappedType;

  const text = Object.values(payload)
    .map(value => normalizeOpportunityText(value))
    .filter(Boolean)
    .join('｜');

  for (const rule of 机遇类型推断规则) {
    if (rule.pattern.test(text)) return rule.type;
  }

  return '探索';
}

function buildLegacyOpportunityHint(timeLimit: string, risk: string): string {
  const parts = [
    /^(?:无|无时限|不限)$/u.test(timeLimit) ? '' : timeLimit,
    /^(?:无|无风险)$/u.test(risk) ? '' : risk,
  ].filter(Boolean);
  return _.uniq(parts).join(' · ');
}

function getOpportunityPatchIndex(value: unknown): number | null | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value) || '行动' in value || 'action' in value) {
    return undefined;
  }

  const wrapper = value as Record<string, unknown>;
  if (!['replace', 'insert'].includes(String(wrapper.op ?? '')) || !Object.hasOwn(wrapper, 'value')) {
    return undefined;
  }

  const normalizedPath = String(wrapper.path ?? '')
    .trim()
    .replace(/^\/+/u, '')
    .replace(/^stat_data[./]/u, '')
    .replaceAll('/', '.');
  if (normalizedPath === '$可参与机遇' || normalizedPath === '可参与机遇') return null;

  const indexMatch = /^\$?可参与机遇\.(\d+)$/u.exec(normalizedPath);
  return indexMatch ? Number(indexMatch[1]) : undefined;
}

function unwrapOpportunityPatchLayer(value: unknown): { changed: boolean; value: unknown } {
  const directIndex = getOpportunityPatchIndex(value);
  if (directIndex === null) {
    return { changed: true, value: (value as Record<string, unknown>).value };
  }
  if (!Array.isArray(value) || value.length === 0) {
    return { changed: false, value };
  }

  if (value.length === 1 && getOpportunityPatchIndex(value[0]) === null) {
    return { changed: true, value: (value[0] as Record<string, unknown>).value };
  }

  const indexedEntries = value.map(item => ({
    index: getOpportunityPatchIndex(item),
    value: (item as Record<string, unknown>)?.value,
  }));
  if (indexedEntries.some(entry => typeof entry.index !== 'number')) {
    return { changed: false, value };
  }

  return {
    changed: true,
    value: _(indexedEntries).sortBy('index').map('value').value(),
  };
}

function collectEmbeddedOpportunityItems(value: unknown, depth = 0): unknown[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => collectEmbeddedOpportunityItems(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return [];

  const item = value as Record<string, unknown>;
  if (
    Object.hasOwn(item, '行动') ||
    Object.hasOwn(item, 'action') ||
    Object.hasOwn(item, '名称') ||
    Object.hasOwn(item, '描述')
  ) {
    return [item];
  }
  if (Object.hasOwn(item, 'value') && (Object.hasOwn(item, 'op') || Object.hasOwn(item, 'path'))) {
    return collectEmbeddedOpportunityItems(item.value, depth + 1);
  }
  return [];
}

/**
 * 兼容模型偶发生成的双重嵌套：
 * replace /$可参与机遇（兼容旧路径 /可参与机遇）的 value 内又放入整组或逐下标 patch 操作。
 */
export function unwrapOpportunityPatchPayload(value: unknown): unknown {
  let current = value;
  if (typeof current === 'string' && current.trimStart().startsWith('[')) {
    try {
      current = JSON.parse(current);
    } catch {
      return value;
    }
  }

  for (let depth = 0; depth < 4; depth += 1) {
    const layer = unwrapOpportunityPatchLayer(current);
    if (!layer.changed) break;
    current = layer.value;
  }

  const recoveredItems = collectEmbeddedOpportunityItems(current);
  return recoveredItems.length > 0 ? recoveredItems : current;
}

const CompactOpportunitySchema = z.object({
  标题: z.coerce.string().transform(normalizeOpportunityText).optional(),
  行动: z.coerce.string().transform(normalizeOpportunityText),
  类型: z.coerce.string().transform(normalizeOpportunityText).prefault('探索'),
  叙事类型: z.coerce.string().transform(normalizeOpportunityText).optional(),
  事件性质: z.coerce.string().transform(normalizeOpportunityText).optional(),
  事件: z.coerce.string().transform(normalizeOpportunityText).optional(),
  关联事件ID: z.coerce.string().transform(normalizeOpportunityText).optional(),
  关联任务ID: z.coerce.string().transform(normalizeOpportunityText).optional(),
  提示: z.coerce.string().transform(normalizeOpportunityText).optional(),
});

const EnglishOpportunitySchema = z.object({
  title: z.coerce.string().transform(normalizeOpportunityText).optional(),
  action: z.coerce.string().transform(normalizeOpportunityText),
  type: z.coerce.string().transform(normalizeOpportunityText).prefault('探索'),
  narrativeKind: z.coerce.string().transform(normalizeOpportunityText).optional(),
  eventNature: z.coerce.string().transform(normalizeOpportunityText).optional(),
  event: z.coerce.string().transform(normalizeOpportunityText).optional(),
  eventId: z.coerce.string().transform(normalizeOpportunityText).optional(),
  taskId: z.coerce.string().transform(normalizeOpportunityText).optional(),
  hint: z.coerce.string().transform(normalizeOpportunityText).optional(),
});

const LegacyOpportunitySchema = z.object({
  名称: z.coerce.string().transform(normalizeOpportunityText).prefault(''),
  来源: z.coerce.string().transform(normalizeOpportunityText).prefault(''),
  类型: z.coerce.string().transform(normalizeOpportunityText).prefault('探索'),
  描述: z.coerce.string().transform(normalizeOpportunityText).prefault(''),
  回报预期: z.coerce.string().transform(normalizeOpportunityText).prefault(''),
  风险评估: z.coerce.string().transform(normalizeOpportunityText).prefault(''),
  时限: z.coerce.string().transform(normalizeOpportunityText).optional(),
  关联事件: z.coerce.string().transform(normalizeOpportunityText).optional(),
  优先级: finiteNumber(0).optional(),
});

export type NormalizedOpportunity = {
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

export const OpportunitySchema = z
  .union([CompactOpportunitySchema, EnglishOpportunitySchema, LegacyOpportunitySchema])
  .transform((item): NormalizedOpportunity => {
    if ('行动' in item) {
      const title = normalizeOpportunityText(item.标题);
      const hint = normalizeOpportunityText(item.提示);
      const event = normalizeOpportunityText(item.事件);
      const eventId = normalizeOpportunityText(item.关联事件ID);
      const taskId = normalizeOpportunityText(item.关联任务ID);
      const eventNature = normalizeProposalEventNature(item.事件性质, event, eventId);
      return {
        ...(title ? { 标题: title } : {}),
        行动: item.行动,
        类型: inferOpportunityType(item.类型, { 行动: item.行动, 提示: hint }),
        叙事类型: normalizeNarrativeKind(item.叙事类型, eventNature),
        事件性质: eventNature,
        ...(event ? { 事件: event } : {}),
        ...(eventId ? { 关联事件ID: eventId } : {}),
        ...(taskId ? { 关联任务ID: taskId } : {}),
        ...(hint ? { 提示: hint } : {}),
      };
    }

    if ('action' in item) {
      const title = normalizeOpportunityText(item.title);
      const hint = normalizeOpportunityText(item.hint);
      const event = normalizeOpportunityText(item.event);
      const eventId = normalizeOpportunityText(item.eventId);
      const taskId = normalizeOpportunityText(item.taskId);
      const eventNature = normalizeProposalEventNature(item.eventNature, event, eventId);
      return {
        ...(title ? { 标题: title } : {}),
        行动: item.action,
        类型: inferOpportunityType(item.type, { action: item.action, hint }),
        叙事类型: normalizeNarrativeKind(item.narrativeKind, eventNature),
        事件性质: eventNature,
        ...(event ? { 事件: event } : {}),
        ...(eventId ? { 关联事件ID: eventId } : {}),
        ...(taskId ? { 关联任务ID: taskId } : {}),
        ...(hint ? { 提示: hint } : {}),
      };
    }

    const action = item.描述 || item.名称;
    const hint = buildLegacyOpportunityHint(item.时限 ?? '', item.风险评估);
    const title = normalizeOpportunityText(item.名称);
    const event = normalizeOpportunityText(item.描述);
    const eventId = normalizeOpportunityText(item.关联事件);
    const eventNature = normalizeProposalEventNature('', event, eventId);
    return {
      ...(title ? { 标题: title } : {}),
      行动: action,
      类型: inferOpportunityType(item.类型, {
        名称: item.名称,
        来源: item.来源,
        描述: item.描述,
        回报预期: item.回报预期,
        风险评估: item.风险评估,
        时限: item.时限 ?? '',
        关联事件: item.关联事件 ?? '',
      }),
      叙事类型: normalizeNarrativeKind('', eventNature),
      事件性质: eventNature,
      ...(event ? { 事件: event } : {}),
      ...(eventId ? { 关联事件ID: eventId } : {}),
      ...(hint ? { 提示: hint } : {}),
    };
  });

// 世界图志保存已经在正文中成立的持续事件；候选提案不进入这里。
export type WorldEventStatus = '活跃' | '已平息' | '已错过';
export type WorldEventStage = '征兆' | '发展' | '可介入' | '余波' | '落幕';
export type WorldEventParticipation = '未介入' | '旁观' | '介入' | '主导';
export type WorldEventImpact = '微澜' | '轻变' | '显著';

export const WORLD_EVENT_ACTIVE_LIMIT = 3;
export const WORLD_EVENT_HISTORY_LIMIT = 5;
export const WORLD_EVENT_LEDGER_LIMIT = WORLD_EVENT_ACTIVE_LIMIT + WORLD_EVENT_HISTORY_LIMIT;

const earthlyBranchRank = new Map(
  ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].map((branch, index) => [branch, index]),
);

const parseWorldEventTime = (value: string | undefined) => {
  const normalized = String(value ?? '').trim();
  const match = normalized.match(/^(.*?)(-?\d+)年(\d+)月(\d+)日(?:[·\s]*([子丑寅卯辰巳午未申酉戌亥])时)?/u);
  if (!match) return null;

  return {
    era: match[1].trim(),
    year: Number(match[2]),
    month: Number(match[3]),
    day: Number(match[4]),
    hour: earthlyBranchRank.get(match[5] ?? '') ?? -1,
  };
};

export const compareWorldEventTimeDescending = (left: string | undefined, right: string | undefined): number => {
  const leftTime = parseWorldEventTime(left);
  const rightTime = parseWorldEventTime(right);
  if (leftTime && rightTime && leftTime.era === rightTime.era) {
    for (const field of ['year', 'month', 'day', 'hour'] as const) {
      const difference = rightTime[field] - leftTime[field];
      if (difference !== 0) return difference;
    }
    return 0;
  }

  if (leftTime && !rightTime) return -1;
  if (!leftTime && rightTime) return 1;
  return String(right ?? '').localeCompare(String(left ?? ''), 'zh-CN');
};

const 世界事件状态映射: Record<string, WorldEventStatus> = {
  活跃: '活跃',
  进行中: '活跃',
  正在发生: '活跃',
  征兆: '活跃',
  发展: '活跃',
  可介入: '活跃',
  余波: '活跃',
  已平息: '已平息',
  平息: '已平息',
  已解决: '已平息',
  解决: '已平息',
  已完成: '已平息',
  完成: '已平息',
  结束: '已平息',
  落幕: '已平息',
  已错过: '已错过',
  错过: '已错过',
  失效: '已错过',
  active: '活跃',
  resolved: '已平息',
  missed: '已错过',
};

const 世界事件阶段映射: Record<string, WorldEventStage> = {
  征兆: '征兆',
  潜伏: '征兆',
  发展: '发展',
  发酵: '发展',
  介入: '可介入',
  可介入: '可介入',
  余波: '余波',
  结果: '余波',
  落幕: '落幕',
  结束: '落幕',
  omen: '征兆',
  developing: '发展',
  actionable: '可介入',
  aftermath: '余波',
  closed: '落幕',
};

const 世界事件参与映射: Record<string, WorldEventParticipation> = {
  未介入: '未介入',
  未参与: '未介入',
  旁观: '旁观',
  关注: '旁观',
  介入: '介入',
  参与: '介入',
  主导: '主导',
  none: '未介入',
  observed: '旁观',
  involved: '介入',
  led: '主导',
};

const 世界事件影响映射: Record<string, WorldEventImpact> = {
  微澜: '微澜',
  轻微: '微澜',
  平和: '微澜',
  轻变: '轻变',
  温和: '轻变',
  中等: '轻变',
  显著: '显著',
  严重: '显著',
  灾难: '显著',
  minor: '微澜',
  mild: '轻变',
  notable: '显著',
  severe: '显著',
};

const WorldEventInputSchema = z.object({
  状态: z.coerce.string().transform(normalizeOpportunityText).prefault('活跃'),
  阶段: z.coerce.string().transform(normalizeOpportunityText).optional(),
  事件: z.coerce.string().transform(normalizeOpportunityText).prefault(''),
  地点: z.coerce.string().transform(normalizeOpportunityText).optional(),
  最近变化: z.coerce.string().transform(normalizeOpportunityText).optional(),
  可见影响: NormalizedStringListSchema,
  参与情况: z.coerce.string().transform(normalizeOpportunityText).optional(),
  影响等级: z.coerce.string().transform(normalizeOpportunityText).optional(),
  更新时间: z.coerce.string().transform(normalizeOpportunityText).optional(),
  来源: z.string().optional(),
  关联人物: NormalizedStringListSchema.optional(),
  下一步: z.string().optional(),
});

export type NormalizedWorldEvent = {
  状态: WorldEventStatus;
  阶段: WorldEventStage;
  事件: string;
  地点?: string;
  最近变化?: string;
  可见影响: string[];
  参与情况: WorldEventParticipation;
  影响等级: WorldEventImpact;
  更新时间?: string;
  来源?: string;
  关联人物?: string[];
  下一步?: string;
};

export const WorldEventSchema = WorldEventInputSchema.transform((item): NormalizedWorldEvent => {
  const rawStatus = normalizeOpportunityText(item.状态);
  const rawStage = normalizeOpportunityText(item.阶段) || rawStatus;
  const status = 世界事件状态映射[rawStatus.toLowerCase()] ?? '活跃';
  const stage = 世界事件阶段映射[rawStage.toLowerCase()] ?? (status === '活跃' ? '征兆' : '落幕');
  const place = normalizeOpportunityText(item.地点);
  const latestChange = normalizeOpportunityText(item.最近变化);
  const participation = 世界事件参与映射[normalizeOpportunityText(item.参与情况).toLowerCase()] ?? '未介入';
  const impact = 世界事件影响映射[normalizeOpportunityText(item.影响等级).toLowerCase()] ?? '微澜';
  const updatedAt = normalizeOpportunityText(item.更新时间);

  return {
    状态: status,
    阶段: stage,
    事件: item.事件,
    ...(place ? { 地点: place } : {}),
    ...(latestChange ? { 最近变化: latestChange } : {}),
    可见影响: item.可见影响,
    参与情况: participation,
    影响等级: impact,
    ...(updatedAt ? { 更新时间: updatedAt } : {}),
    ...(item.来源?.trim() ? { 来源: item.来源.trim() } : {}),
    ...(item.关联人物?.length ? { 关联人物: item.关联人物 } : {}),
    ...(item.下一步?.trim() ? { 下一步: item.下一步.trim() } : {}),
  };
});

export const compactWorldEventLedger = (
  source: Record<string, NormalizedWorldEvent>,
): Record<string, NormalizedWorldEvent> => {
  const entries = Object.entries(source).map(([id, event], sourceIndex) => ({ id, event, sourceIndex }));

  // 活跃事件保护既有事实：若模型误建第 4 条，优先拒绝后插入的新事件，避免新线索顶掉旧事件。
  const retainedActiveIds = new Set(
    entries
      .filter(entry => entry.event.状态 === '活跃')
      .slice(0, WORLD_EVENT_ACTIVE_LIMIT)
      .map(entry => entry.id),
  );

  // 已结束事件按世界时间取最近五条；旧会话缺少时间时，以后插入者视作更新。
  const retainedHistoryIds = new Set(
    entries
      .filter(entry => entry.event.状态 !== '活跃')
      .sort(
        (left, right) =>
          compareWorldEventTimeDescending(left.event.更新时间, right.event.更新时间) ||
          right.sourceIndex - left.sourceIndex,
      )
      .slice(0, WORLD_EVENT_HISTORY_LIMIT)
      .map(entry => entry.id),
  );

  // 输出仍保持原有 key 顺序，使缺失时间的旧存档重复解析时保持幂等。
  return Object.fromEntries(
    entries
      .filter(entry => retainedActiveIds.has(entry.id) || retainedHistoryIds.has(entry.id))
      .map(entry => [entry.id, entry.event]),
  );
};

export const WorldEventLedgerSchema = z
  .record(z.string().describe('事件名或稳定事件ID'), WorldEventSchema)
  .transform(compactWorldEventLedger)
  .prefault({});

// 系统设置 Schema
export const SystemSettingsSchema = z
  .object({
    启用行动提示: z.boolean().prefault(true),
    修炼系统版本: finiteNumber(CURRENT_CULTIVATION_VERSION)
      .transform(value => Math.max(1, Math.floor(value)))
      .prefault(CURRENT_CULTIVATION_VERSION),
    变量结构版本: finiteNumber(CURRENT_SCHEMA_VERSION)
      .transform(value => Math.max(1, Math.floor(value)))
      .prefault(CURRENT_SCHEMA_VERSION),
    _临时状态手动覆盖签名: z.string().prefault(''),
  })
  .prefault({});

// 行动系统设置 Schema
export const ActionSystemSettingsSchema = z
  .object({
    启用行动提示: z.boolean().prefault(true),
  })
  .prefault({});

// 难度系统 Schema（v2 最小接入版）
const 天道感应映射: Record<string, '顺遂' | '受挫' | '平稳'> = {
  顺遂: '顺遂',
  受挫: '受挫',
  平稳: '平稳',
  顺利: '顺遂',
  受阻: '受挫',
  正常: '平稳',
};

export const DifficultySystemSchema = z
  .object({
    天道感应: z
      .string()
      .transform(v => 天道感应映射[String(v).trim()] || '平稳')
      .prefault('平稳'),
    环境高压警告: z.string().prefault('天道运转如常，万物循理。'),
    _难度系统内部数据: z
      .object({
        版本号: finiteNumber(1)
          .transform(value => Math.max(1, Math.floor(value)))
          .prefault(1),
        平衡保护: z
          .object({
            连续受挫计数: finiteNumber(0).prefault(0),
            触发阈值: finiteNumber(3).prefault(3),
            生效剩余回合: finiteNumber(0).prefault(0),
            冷却剩余回合: finiteNumber(0).prefault(0),
          })
          .prefault({}),
        动态策略: z
          .object({
            单回合改变量上限: finiteNumber(0.15).prefault(0.15),
            自然回落速度: finiteNumber(0.03).prefault(0.03),
            增长冷却回合: finiteNumber(2).prefault(2),
          })
          .prefault({}),
        难度结算快照: z
          .object({
            回合基线系数: finiteNumber(1).prefault(1),
            本回合最终系数: finiteNumber(1).prefault(1),
            分层来源: z
              .object({
                世界叙事层: finiteNumber(1).prefault(1),
                玩家偏好层: finiteNumber(1).prefault(1),
                短期状态层: finiteNumber(1).prefault(1),
              })
              .prefault({}),
          })
          .prefault({}),
      })
      .prefault({}),
  })
  .prefault({});
