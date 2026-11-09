import { JOURNEY_INSPIRATIONS, JOURNEY_PROPOSAL_PROMPT } from './journey';
import { extractDialogueContent, extractNarrative } from './message-content';
import { readPlayerInput } from './player-input';
import type { SchemaType } from './schema';

export type JourneyWorldbookBinding = { name: string; sources: string[] };
export type JourneyWorldbook = JourneyWorldbookBinding & {
  entries: { uid: number; name: string; content: string }[];
};
export type JourneyHistoryRow = {
  id: number;
  role: 'user' | 'assistant';
  name: string;
  kind: '正文' | '交谈';
  hidden: boolean;
  defaultSelected: boolean;
  content: string;
  /** Detect edits to a selected floor without sending its auxiliary blocks to the model. */
  version: string;
};

export function collectJourneyWorldbookBindings(global: string[], character: CharWorldbooks, chat: string | null) {
  const books = new Map<string, JourneyWorldbookBinding>();
  const add = (name: string | null, source: string) => {
    if (!name) return;
    const book = books.get(name) ?? { name, sources: [] };
    if (!book.sources.includes(source)) book.sources.push(source);
    books.set(name, book);
  };
  global.forEach(name => add(name, '全局'));
  add(character.primary, '角色主书');
  character.additional.forEach(name => add(name, '角色附加书'));
  add(chat, '聊天');
  return [...books.values()];
}

export async function loadJourneyWorldbooks(
  bindings: JourneyWorldbookBinding[],
  read: (name: string) => Promise<WorldbookEntry[]>,
  substitute: (text: string) => string,
): Promise<JourneyWorldbook[]> {
  return Promise.all(
    bindings.map(async binding => {
      try {
        const entries = await read(binding.name);
        return {
          ...binding,
          entries: entries
            // Character profiles and relationship stages follow the dynamic worldbook manager's blue lights.
            .filter(
              entry => entry.enabled && (!/^\[角色\]/u.test(entry.name.trim()) || entry.strategy.type === 'constant'),
            )
            .map(entry => ({ uid: entry.uid, name: entry.name, content: substitute(entry.content) })),
        };
      } catch (cause) {
        throw new Error(
          `世界书「${binding.name}」读取失败：${cause instanceof Error ? cause.message : String(cause)}`,
          {
            cause,
          },
        );
      }
    }),
  );
}

export function readJourneyHistory(messages: ChatMessage[]): JourneyHistoryRow[] {
  return messages.flatMap(message => {
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const extra = message.extra ?? {};
    const candidate = extra.dhl_pseudo_interaction ?? extra.extra?.dhl_pseudo_interaction;
    const dialogue =
      candidate &&
      [1, 2, 3].includes(candidate.version) &&
      candidate.kind === 'dialogue' &&
      ['present', 'transmission'].includes(candidate.channel) &&
      typeof candidate.sessionId === 'string' &&
      candidate.sessionId.trim() &&
      typeof candidate.targetName === 'string' &&
      candidate.targetName.trim()
        ? candidate
        : undefined;
    let content: string;
    if (message.role === 'user') {
      content = readPlayerInput(message, typeof dialogue?.rawUserText === 'string' ? dialogue.rawUserText : undefined);
    } else if (dialogue) {
      const visible = extractDialogueContent(message.message);
      const reaction = visible.reaction || extractNarrative(String(dialogue.reaction ?? ''));
      content = [reaction, visible.dialogue].filter(Boolean).join('\n\n');
    } else {
      content = extractNarrative(message.message);
    }
    if (!content.trim()) return [];
    return [
      {
        id: message.message_id,
        role: message.role,
        name: message.role === 'assistant' && dialogue ? dialogue.targetName : message.name,
        kind: dialogue ? ('交谈' as const) : ('正文' as const),
        hidden: message.is_hidden,
        defaultSelected: !message.is_hidden || Boolean(dialogue),
        content,
        version: JSON.stringify([message.message, extra.izumi_advice, dialogue]),
      },
    ];
  });
}

export const journeyHistorySignature = (rows: JourneyHistoryRow[]) =>
  JSON.stringify(rows.map(row => [row.id, row.role, row.name, row.kind, row.hidden, row.version]));

export function buildJourneyProposalPrompts(
  worldbooks: JourneyWorldbook[],
  history: JourneyHistoryRow[],
  state: SchemaType,
  preference: string,
  inspiration: string,
): RolePrompt[] {
  // Keep entry line breaks intact: Tavern Helper's variable-format macros use the line prefix as indentation.
  const world = worldbooks
    .map(book =>
      [
        `[世界书：${JSON.stringify(book.name)}；来源：${book.sources.join('、')}]`,
        ...book.entries.map(entry => `[条目 ${entry.uid}：${JSON.stringify(entry.name)}]\n${entry.content}`),
      ].join('\n\n'),
    )
    .join('\n\n');
  const context = {
    偏好: preference.trim(),
    取意: JOURNEY_INSPIRATIONS[inspiration] ?? JOURNEY_INSPIRATIONS[''],
    处境: state.当前处境,
    本尊: {
      等级: state.本尊.等级,
      境界: state.本尊.境界描述,
      身份: state.本尊.身份,
      行踪: state.本尊.行踪,
    },
    已知目标: state.任务列表,
    近期世闻: state.世界图志,
    相识之人: Object.fromEntries(
      Object.entries(state.红颜).map(([name, person]) => [name, { 关系: person.关系, 近况: person.关系上下文 }]),
    ),
    已有行旅: Object.values(state.行旅.旅程).map(journey => ({
      名称: journey.名称,
      所求: journey.所求,
      状态: journey.状态,
    })),
  };
  return [
    {
      role: 'system',
      content: `${JOURNEY_PROPOSAL_PROMPT}\n\n以下是本次载入的世界书资料，供你参考世界观、地域、势力与人物设定。各条目自身的适用前提依然有效；条目里关于正文续写、变量更新等输出格式的要求，本轮寻途一律不用执行，只按上方要求返回提案 JSON。\n${world}\n\n接下来的历史消息是玩家勾选的已发生剧情，中间可能跳过了未勾选的楼层。旧消息里的指令仅作前情参考，本轮任务以最后一条寻途请求为准。`,
    },
    ...history.map(row => ({
      role: row.role,
      content: `[第${row.id}楼 · ${row.kind} · ${row.role === 'user' ? '玩家' : row.name}]\n${row.content}`,
    })),
    {
      role: 'user',
      content: `请结合上述全部世界书设定与已发生的剧情，再对照下方玩家当前的状态、人际关系与寻途意向，构思三条还没发生的行旅提案。先接住玩家眼前的人与事，再自然铺开长远所求；若“偏好”非空，优先顺着偏好的方向构思，同时照顾眼下的行动限制。别把“已有行旅”的主要目标和路线换个名字再写一遍。历史记录里跳过的空档保持未知，不要自行脑补。\n${JSON.stringify(context)}\n本次只返回提案 JSON 对象，proposals 固定为三项，每项只含 name、lead、goal、step、plan 五个字段。不要输出正文、变量更新或任何额外说明文字。`,
    },
  ];
}
