import {
  getFavorGainLimitByValue,
  getFavorLossLimitByValue,
  getSpiritStoneCurrencyGrade,
  normalizeSpiritStoneAmount,
  normalizeSpiritStoneLedger,
  normalizeSpiritStoneState,
  Schema,
  type SpiritStoneGrade,
  unwrapOpportunityPatchPayload,
} from '../灯火阑珊/schema';
import { COMPANION_CANONICAL_NAMES } from './companion-aliases';

const COMPATIBILITY_INSTALLED_KEY = '__灯火阑珊_mvu_command_compatibility_installed__';
const READONLY_ENTITY_FIELDS = new Set([
  '突破阈值',
  '寿元上限',
  '境界描述',
  '寿元状态',
  '状态',
  '进度',
  '战力值',
  '积累已足',
  '盈余修为',
  '尝试突破',
]);
const MVU_ROOT_KEYS = [
  '世界时钟',
  '世界地图',
  '世界图志',
  '宗门势力库',
  '功法库',
  '法宝库',
  '地点库',
  '$宗门推断',
  '灵根库',
  '体质库',
  '本尊',
  '红颜角色库',
  '红颜',
  'NPC图鉴',
  '任务列表',
  '行旅',
  '$行旅蓝图',
  '声望系统',
  '难度系统',
  '$可参与机遇',
  '当前处境',
  '_系统设置',
  '_好感度快照',
  '_近期任务结果',
] as const;
const TRADITIONAL_PATH_ALIASES: Record<string, string> = {
  世界時鐘: '世界时钟',
  世界地圖: '世界地图',
  世界圖志: '世界图志',
  宗門勢力庫: '宗门势力库',
  功法庫: '功法库',
  法寶庫: '法宝库',
  地點庫: '地点库',
  靈根庫: '灵根库',
  體質庫: '体质库',
  紅顏角色庫: '红颜角色库',
  紅顏: '红颜',
  聲望系統: '声望系统',
  難度系統: '难度系统',
  危險度: '危险度',
  當前區域: '当前区域',
  所屬層級: '所属层级',
  當前處境: '当前处境',
  可參與機遇: '可参与机遇',
  任務列表: '任务列表',
};
type GuardMutableCommand = {
  type: 'set' | 'insert' | 'delete' | 'add';
  full_match?: string;
  args: unknown[];
  reason?: string;
};

function normalizeCommandPath(rawPath: string): string {
  let path = String(rawPath || '').trim();
  if (!path) return path;

  if (path.startsWith('./')) path = path.slice(1);
  if (path.startsWith('/')) {
    path = path.replace(/^\/+/, '').replaceAll('/', '.');
  }

  // 当前 MVU 的 JSONPatch 解析器会输出 ["行旅"]["旅程"] 形式的路径。
  // 普通字段转为点路径供下方规则识别，键名里的点号等字符保留括号转义。
  if (path.startsWith('[') || path.startsWith('stat_data[')) {
    path = _.toPath(path)
      .map((part, index) =>
        /^[^.[\]/\s"']+$/u.test(part) ? `${index ? '.' : ''}${part}` : `[${JSON.stringify(part)}]`,
      )
      .join('');
  }

  path = path.replaceAll('：', ':').replaceAll('。', '.').replace(/\s+/gu, '').replace(/\.\.+/gu, '.');
  for (const [from, to] of Object.entries(TRADITIONAL_PATH_ALIASES)) {
    path = path.replaceAll(from, to);
  }
  path = path
    .replace(/^stat_data\.可参与机遇(?=\.|$)/u, 'stat_data.$可参与机遇')
    .replace(/^可参与机遇(?=\.|$)/u, '$可参与机遇');

  // 兼容额外模型沿用旧版库存根路径；权威结构统一存放在本尊下。
  path = path.replace(/^(?:stat_data\.)?(背包|法宝|杂物袋)(?=\.|\[|$)/u, 'stat_data.本尊.$1');

  if (
    !path.startsWith('stat_data.') &&
    MVU_ROOT_KEYS.some(rootKey => path === rootKey || path.startsWith(`${rootKey}.`) || path.startsWith(`${rootKey}[`))
  ) {
    path = `stat_data.${path}`;
  }

  path = path.replace(/^(stat_data\.(?:本尊|红颜\.[^./]+)\.灵石)\.灵石$/u, '$1.下品灵石');
  path = path.replace(/^(stat_data\.(?:本尊|红颜\.[^./]+)\.灵石\.(?:下品|中品|上品|极品)灵石)\.数量$/u, '$1');
  path = path.replace(/^(stat_data\.(?:本尊|红颜\.[^./]+)\.修炼状态)\.境界变动(?=\.|$)/u, '$1.最近突破');

  return path;
}

function normalizeCompanionAliasPath(path: string): string {
  const match = path.match(/^stat_data\.(红颜|红颜角色库|_好感度快照)\.([^./]+)(?=\.|$)/u);
  if (!match) return path;

  const [, section, companionName] = match;
  const canonicalName = COMPANION_CANONICAL_NAMES[companionName];
  return canonicalName
    ? path.replace(`stat_data.${section}.${companionName}`, `stat_data.${section}.${canonicalName}`)
    : path;
}

function getCommandValueArgIndex(command: GuardMutableCommand): number | null {
  switch (command.type) {
    case 'set':
    case 'insert':
      return command.args.length >= 3 ? 2 : command.args.length >= 2 ? 1 : null;
    case 'add':
      return command.args.length >= 2 ? 1 : null;
    default:
      return null;
  }
}

function coerceByPath(path: string, value: unknown): unknown {
  if (path === 'stat_data.$可参与机遇') {
    const unwrapped = unwrapOpportunityPatchPayload(value);
    if (Array.isArray(unwrapped)) {
      return typeof value === 'string' ? JSON.stringify(unwrapped) : unwrapped;
    }
  }

  if (path.endsWith('熟练度') && typeof value === 'string') {
    const normalized = value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '');
    if (normalized.includes('小成')) return '熟练';
    if (normalized.includes('中成')) return '精通';
    if (normalized.includes('大圆满')) return '圆满';
  }
  return value;
}

function isReadonlyDerivedStatPath(path: string): boolean {
  const entityFieldMatch = path.match(/^stat_data\.(?:本尊|红颜\.[^./]+)\.([^./]+)$/u);
  if (entityFieldMatch && READONLY_ENTITY_FIELDS.has(entityFieldMatch[1])) return true;

  return (
    /^stat_data\._近期任务结果(?:\.|$)/u.test(path) ||
    /^stat_data\.(?:本尊|红颜\.[^./]+)\.修炼状态\.突破目标$/u.test(path) ||
    /^stat_data\.(?:本尊|红颜\.[^./]+)\.神通列表\.[^./]+\.威力等级$/u.test(path) ||
    /^stat_data\.法宝库\.[^./]+\.特$/u.test(path) ||
    /^stat_data\.灵根库\.[^./]+\.(?:速|特)$/u.test(path) ||
    /^stat_data\.体质库\.[^./]+\.优$/u.test(path) ||
    /^stat_data\._系统设置\.(?:修炼系统版本|变量结构版本)$/u.test(path)
  );
}

function getReadonlyDerivedPathValue(path: string, variables: Mvu.MvuData): unknown {
  const parsed = Schema.safeParse(_.get(variables, 'stat_data'));
  if (parsed.success) {
    return _.get({ stat_data: parsed.data }, path);
  }
  return _.get(variables, path);
}

function rewriteReadonlyDerivedCommand(command: GuardMutableCommand, path: string, variables: Mvu.MvuData): boolean {
  if (!isReadonlyDerivedStatPath(path)) return false;
  if (/^stat_data\._近期任务结果(?:\.|$)/u.test(path)) {
    command.type = 'set';
    command.args = ['stat_data._近期任务结果', JSON.stringify(_.get(variables, 'stat_data._近期任务结果', {}))];
    command.reason = '近期任务结果由结构归档维护';
    return true;
  }
  if (/^stat_data\._近期任务结果(?:\.|$)/u.test(path)) {
    command.type = 'set';
    command.args = ['stat_data._近期任务结果', JSON.stringify(_.get(variables, 'stat_data._近期任务结果', {}))];
    command.reason = '近期任务结果由结构归档维护';
    return true;
  }

  const currentValue = getReadonlyDerivedPathValue(path, variables);
  if (typeof currentValue === 'undefined') return false;

  command.type = 'set';
  command.args = [path, JSON.stringify(currentValue)];
  command.reason = '只读派生字段被命令兼容改写为 no-op';
  return true;
}

function tryParseLiteralObject(input: unknown): Record<string, unknown> | null {
  if (typeof input !== 'string') return null;
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function decodeCommandValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** 只改写本批命令，迁移和库存差额均在影子副本中计算。 */
function normalizeSpiritStoneCommands(variables: Mvu.MvuData, commands: GuardMutableCommand[]): void {
  const containers = ['背包', '杂物袋', '法宝'] as const;
  const migrationReason = '四品灵石旧账归并';
  const contexts = new Map<string, { stocks: Map<string, { grade: SpiritStoneGrade; amount: number }> }>();
  const prelude: GuardMutableCommand[] = [];
  const getTarget = (command: GuardMutableCommand) => {
    const parts = _.toPath(String(command.args[0] ?? ''));
    const size =
      parts[0] === 'stat_data' && parts[1] === '本尊'
        ? 2
        : parts[0] === 'stat_data' && parts[1] === '红颜' && parts[2]
          ? 3
          : 0;
    return size ? { actor: parts.slice(0, size).join('.'), tail: parts.slice(size) } : null;
  };
  const isInventory = (name: string) => containers.includes(name as (typeof containers)[number]);

  for (const command of commands) {
    const target = getTarget(command);
    if (!target || contexts.has(target.actor)) continue;
    const source = _.get(variables, target.actor);
    if (!_.isPlainObject(source)) continue;
    const valueIndex = getCommandValueArgIndex(command);
    const value = valueIndex === null ? undefined : decodeCommandValue(command.args[valueIndex]);
    const incomingItem = target.tail.length === 2 && _.isPlainObject(value) ? value : undefined;
    const oldItem = _.get(source, target.tail.slice(0, 2));
    const inventoryGrade =
      isInventory(target.tail[0]) && target.tail[1]
        ? getSpiritStoneCurrencyGrade(target.tail[1], incomingItem ?? oldItem)
        : null;
    if (target.tail[0] !== '灵石' && !inventoryGrade) continue;

    const stocks = new Map<string, { grade: SpiritStoneGrade; amount: number }>();
    for (const container of containers) {
      for (const [key, item] of Object.entries(source[container] ?? {})) {
        const grade = getSpiritStoneCurrencyGrade(key, item as any);
        if (grade)
          stocks.set(`${container}:${key}`, { grade, amount: normalizeSpiritStoneAmount((item as any)?.数量) });
      }
    }
    contexts.set(target.actor, { stocks });
    if (commands.some(item => item.reason === migrationReason && item.args[0] === `${target.actor}.灵石`)) continue;
    const normalized = normalizeSpiritStoneState(source.灵石, ...containers.map(name => source[name]));
    containers.forEach((name, index) => {
      if (!_.isEqual(source[name] ?? {}, normalized.inventories[index])) {
        prelude.push({
          type: 'set',
          args: [`${target.actor}.${name}`, JSON.stringify(normalized.inventories[index])],
          reason: migrationReason,
        });
      }
    });
    if (!_.isEqual(source.灵石, normalized.spiritStone)) {
      prelude.push({
        type: _.has(source, '灵石') ? 'set' : 'insert',
        args: [`${target.actor}.灵石`, JSON.stringify(normalized.spiritStone)],
        reason: migrationReason,
      });
    }
  }

  if (!contexts.size) return;
  const shadow = _.cloneDeep(variables);
  commands.unshift(...prelude);
  for (const command of commands) {
    if (!Array.isArray(command.args) || !command.args.length) continue;
    const target = getTarget(command);
    const context = target && contexts.get(target.actor);
    const valueIndex = getCommandValueArgIndex(command);
    const value = valueIndex === null ? undefined : decodeCommandValue(command.args[valueIndex]);
    if (target && context) {
      const ledgerPath = `${target.actor}.灵石`;
      const ledger = normalizeSpiritStoneLedger(_.get(shadow, ledgerPath));
      if (target.tail[0] === '灵石') {
        const isLegacyScalar =
          target.tail.length === 1 &&
          (command.type === 'add' || (command.type !== 'delete' && !_.isPlainObject(value)));
        if (isLegacyScalar) {
          command.args[0] = `${ledgerPath}.下品灵石`;
          target.tail.push('下品灵石');
        }
        if (target.tail.length === 1) {
          const removed = command.type === 'delete';
          command.type = 'set';
          command.args = [
            ledgerPath,
            JSON.stringify(removed ? normalizeSpiritStoneLedger() : normalizeSpiritStoneLedger(value)),
          ];
        } else if (target.tail.length === 2 && getSpiritStoneCurrencyGrade(target.tail[1])) {
          if (command.type === 'delete') {
            command.type = 'set';
            command.args = [command.args[0], '0'];
          } else if (command.type === 'insert') {
            command.type = 'set';
            command.args = [command.args[0], JSON.stringify(normalizeSpiritStoneAmount(value))];
          }
        }
      } else if (isInventory(target.tail[0]) && target.tail[1]) {
        const stockKey = `${target.tail[0]}:${target.tail[1]}`;
        const stock = context.stocks.get(stockKey);
        const incomingItem = target.tail.length === 2 && _.isPlainObject(value) ? value : undefined;
        const grade = incomingItem
          ? getSpiritStoneCurrencyGrade(target.tail[1], incomingItem)
          : (stock?.grade ?? getSpiritStoneCurrencyGrade(target.tail[1]));
        if (grade) {
          const oldAmount = stock?.amount ?? 0;
          let newAmount = oldAmount;
          let delta = 0;
          if (command.type === 'delete' && (target.tail.length === 2 || target.tail[2] === '数量')) {
            newAmount = 0;
            delta = -oldAmount;
          } else if (target.tail.length === 2 && incomingItem) {
            newAmount = normalizeSpiritStoneAmount((incomingItem as Record<string, unknown>).数量);
            delta = newAmount - oldAmount;
          } else if (target.tail[2] === '数量') {
            newAmount = normalizeSpiritStoneAmount(command.type === 'add' ? oldAmount + Number(value) : value);
            // 归账后库存已清空，旧式 delta 仍直接作用于持有的对应币种。
            delta =
              command.type === 'add' ? (Number.isFinite(Number(value)) ? Number(value) : 0) : newAmount - oldAmount;
          }
          context.stocks.set(stockKey, { grade, amount: newAmount });
          command.type = 'add';
          command.args = [`${ledgerPath}.${grade}`, String(delta)];
          command.reason = '库存灵石数量差额已归入对应品级账册';
        }
      }
      // 子字段命令始终基于完整账册执行，避免旧标量和缺省品级导致 delta 失败。
      if (String(command.args[0]).startsWith(`${ledgerPath}.`) && !_.isPlainObject(_.get(shadow, ledgerPath))) {
        _.set(shadow, ledgerPath, ledger);
      }
    }

    const path = String(command.args[0]);
    const index = getCommandValueArgIndex(command);
    const nextValue = index === null ? undefined : decodeCommandValue(command.args[index]);
    if (command.type === 'delete') _.unset(shadow, path);
    else if (command.type === 'add') _.set(shadow, path, Number(_.get(shadow, path, 0)) + Number(nextValue));
    else _.set(shadow, path, nextValue);
  }
}

function getExistingCompanionSource(path: string, variables: Mvu.MvuData): Record<string, unknown> | null {
  const currentValue = _.get(variables, path);
  if (currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
    return _.cloneDeep(currentValue);
  }

  return null;
}

function rewriteDuplicateCompanionInsert(
  command: GuardMutableCommand,
  path: string,
  variables: Mvu.MvuData,
): GuardMutableCommand[] {
  if (command.type !== 'insert' || !/^stat_data\.红颜\.[^./]+$/u.test(path)) return [];

  const existing = getExistingCompanionSource(path, variables);
  const valueArgIndex = getCommandValueArgIndex(command);
  const incoming = valueArgIndex === null ? null : tryParseLiteralObject(command.args[valueArgIndex]);
  if (!existing || !incoming) return [];

  const companionName = path.split('.').at(-1) ?? '未知角色';
  const appendedCommands: GuardMutableCommand[] = [];
  if (_.has(incoming, '好感度')) {
    const oldFavor = Number(_.get(existing, '好感度', 0));
    const newFavor = Number(_.get(incoming, '好感度', oldFavor));
    if (Number.isFinite(oldFavor) && Number.isFinite(newFavor) && oldFavor !== newFavor) {
      appendedCommands.push({
        type: 'add',
        full_match: `guard:add:${companionName}:好感度`,
        args: [`${path}.好感度`, String(newFavor - oldFavor)],
        reason: '已存在红颜的重复 insert 已改写为好感增量',
      });
    }
  }

  const incomingChronicle = _.get(incoming, '羁绊纪事');
  if (incomingChronicle && typeof incomingChronicle === 'object' && !Array.isArray(incomingChronicle)) {
    for (const [title, entry] of Object.entries(incomingChronicle)) {
      const existingEntry = _.get(existing, ['羁绊纪事', title]);
      if (!title.trim() || _.isEqual(existingEntry, entry)) continue;
      appendedCommands.push({
        type: existingEntry === undefined ? 'insert' : 'set',
        full_match: `guard:${existingEntry === undefined ? 'insert' : 'set'}:${companionName}:羁绊纪事:${title}`,
        args: [`${path}.羁绊纪事.${title}`, JSON.stringify(entry)],
        reason: '已存在红颜的重复 insert 已改写为羁绊纪事更新',
      });
    }
  }

  const replaceableKeys = [
    '关系',
    '关系上下文',
    '灵根',
    '体质',
    '功法',
    '本命兵器',
    '等级',
    '修为',
    '灵石',
    '已活岁月',
    '尝试突破',
    '修炼状态',
    '神通列表',
  ] as const;
  for (const key of replaceableKeys) {
    if (!_.has(incoming, key) || _.isEqual(_.get(incoming, key), _.get(existing, key))) continue;
    appendedCommands.push({
      type: 'set',
      full_match: `guard:set:${companionName}:${key}`,
      args: [`${path}.${key}`, JSON.stringify(_.get(incoming, key))],
      reason: '已存在红颜的重复 insert 已改写为字段更新',
    });
  }

  command.type = 'set';
  command.args = [path, JSON.stringify(existing)];
  command.reason = '已存在红颜的重复 insert 原命令已改写为 no-op';
  return appendedCommands;
}

export function guardParsedCommands(
  variables: Mvu.MvuData,
  commands: Mvu.CommandInfo[],
  _messageContent: string = '',
): void {
  const mutableCommands = commands as unknown as GuardMutableCommand[];
  const appendedCommands: GuardMutableCommand[] = [];

  for (const command of mutableCommands) {
    if (!Array.isArray(command.args) || command.args.length === 0) continue;
    const rawPath = String(command.args[0] ?? '');
    const path = normalizeCompanionAliasPath(normalizeCommandPath(rawPath));
    if (path && path !== rawPath) command.args[0] = path;
    if (path && rewriteReadonlyDerivedCommand(command, path, variables)) continue;

    appendedCommands.push(...rewriteDuplicateCompanionInsert(command, path, variables));
    const valueArgIndex = getCommandValueArgIndex(command);
    if (valueArgIndex === null || !path) continue;

    const rawValue = command.args[valueArgIndex];
    const normalizedValue = coerceByPath(path, rawValue);
    command.args[valueArgIndex] = normalizedValue;
    if (!_.isEqual(normalizedValue, rawValue) && !command.reason) {
      command.reason =
        path === 'stat_data.$可参与机遇' ? '嵌套的行动列表 patch 已由命令兼容自动拆包' : '变量值已由命令兼容归一化';
    }
  }

  mutableCommands.push(...appendedCommands);
  normalizeSpiritStoneCommands(variables, mutableCommands);
}

/** 以本轮开始前的真实值统一限幅，避免读取或逐条 Schema 校验重复结算。 */
export function settleCompanionFavor(variables: Mvu.MvuData, beforeUpdate: Mvu.MvuData): void {
  const companions = _.get(variables, 'stat_data.红颜');
  if (!companions || typeof companions !== 'object' || Array.isArray(companions)) return;

  const previous = Schema.safeParse(_.get(beforeUpdate, 'stat_data'));
  if (!previous.success) return;

  const snapshot: Record<string, number> = {};
  for (const [name, companion] of Object.entries(companions)) {
    const value = Number(_.get(companion, '好感度'));
    if (!Number.isFinite(value)) continue;

    const oldValue = previous.data.红颜[name]?.好感度;
    const settled =
      typeof oldValue === 'number' && Number.isFinite(oldValue)
        ? _.clamp(value, oldValue - getFavorLossLimitByValue(oldValue), oldValue + getFavorGainLimitByValue(oldValue))
        : _.clamp(value, -200, 200);
    _.set(companion as object, '好感度', settled);
    snapshot[name] = settled;
    if (settled !== value) {
      console.info(`[灯火阑珊] ${name}好感按整轮限幅：${oldValue} → ${value}，结算为 ${settled}`);
    }
  }
  _.set(variables, 'stat_data._好感度快照', snapshot);
}

/** 兼容命令并在整轮更新结束时结算好感；只修改本轮传入数据，不写回楼层。 */
export function installMvuCommandCompatibility(): () => void {
  const globalRef = window as unknown as Record<string, unknown>;
  if (globalRef[COMPATIBILITY_INSTALLED_KEY]) return () => undefined;
  globalRef[COMPATIBILITY_INSTALLED_KEY] = true;

  const listener = eventOn(Mvu.events.COMMAND_PARSED, guardParsedCommands);
  const favorListener = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, settleCompanionFavor);
  console.info('[灯火阑珊] MVU 路径与格式兼容已启用');

  return () => {
    listener.stop();
    favorListener.stop();
    delete globalRef[COMPATIBILITY_INSTALLED_KEY];
  };
}
