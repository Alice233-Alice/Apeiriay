import { extractNarrative } from '../灯火通明/message-content';
import { readPlayerInput } from '../灯火通明/player-input';

// 这些别名也会自然出现在景物描写中，不能作为独立的人物证据。
const AMBIGUOUS_CHARACTER_ALIASES = new Set(['泠泠']);
const AUXILIARY_TAGS = 'konatan_planning~?|tucao|advice|initvar|current_event|progress|style';

/** 只用剧情正文判断人物，避免思考、变量补丁和未选择的行动串入人设。 */
export function sanitizeContextMessage(content: string): string {
  let text = String(content || '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/```[\s\S]*?(?:```|$)/g, '')
    .replace(new RegExp(`<(${AUXILIARY_TAGS})(?=[\\s/>])[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<(?:${AUXILIARY_TAGS})(?=[\\s/>])[^>]*/>`, 'gi'), '')
    .replace(new RegExp(`<(?:${AUXILIARY_TAGS})(?=[\\s/>])[^>]*>[\\s\\S]*$`, 'gi'), '');

  // 某些预设把思考起始标签放在提示词里，消息只带结束标签。
  const planningEnd = /<\/konatan_planning~?\s*>/i.exec(text);
  if (planningEnd) text = text.slice(planningEnd.index + planningEnd[0].length);

  return extractNarrative(text)
    .replace(/\[动态世界书\][^\n]*/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

type ContextMessage = Pick<ChatMessage, 'role' | 'message' | 'extra' | 'is_hidden'>;

export function readContextMessage(message: ContextMessage | undefined): string {
  if (!message || (message.role !== 'user' && message.role !== 'assistant')) return '';
  // 伪同层的隐藏对话也是实际剧情，其余隐藏消息不参与人物判断。
  if (message.is_hidden && message.extra?.dhl_pseudo_interaction?.kind !== 'dialogue') return '';
  return sanitizeContextMessage(message.role === 'user' ? readPlayerInput(message) : message.message);
}

export function collectRecentContext(messages: ContextMessage[], windowSize: number): string[] {
  // 先截取楼层再清洗；空正文、隐藏消息不能让很久以前的人物重新进入窗口。
  return messages.slice(-Math.max(1, windowSize)).map(readContextMessage);
}

export function collectCharacterMentions(messages: string[], names: string[]) {
  const details: string[] = [];
  const ignored: string[] = [];
  const evidence: string[] = [];
  let count = 0;
  for (const name of new Set(names.map(name => name.trim()).filter(Boolean))) {
    const matches = messages.filter(message => message.includes(name));
    if (!matches.length) continue;
    if (AMBIGUOUS_CHARACTER_ALIASES.has(name)) {
      ignored.push(name);
      continue;
    }
    count += matches.length;
    details.push(`${name}(${matches.length}层)`);
    const text = matches[0].replace(/\s+/g, ' ');
    const start = Math.max(0, text.indexOf(name) - 20);
    evidence.push(text.slice(start, start + 80));
  }
  return { count, details, ignored, evidence };
}
