import { parseMessageContent } from './message-content';

export type GreetingIndexItem = {
  index: number;
  title: string;
  content: string;
  searchText: string;
  preview: string;
};

export type GreetingIndexState = {
  items: GreetingIndexItem[];
  currentIndex: number | null;
};

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function toPreviewText(content: string): string {
  return normalizeSpace(content)
    .replace(/\*\*/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .slice(0, 180);
}

function getGreetingItems(): GreetingIndexItem[] {
  const data = getCharData('current');
  if (!data) return [];

  // 与独立开场白索引保持一致：这里只列额外问候语，不把 first_mes 算进编号。
  const v2 = data.data as Partial<SillyTavern.v2CharData> | undefined;
  const alternateRaw = v2?.alternate_greetings;
  const alternates = Array.isArray(alternateRaw) ? alternateRaw.map(item => String(item ?? '')) : [];

  return alternates.map((content, offset) => {
    const narrative = parseMessageContent(content).narrative;
    const firstLine = content
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);
    const bracketTitle = firstLine?.match(/^(?:\[(.+?)\]|【(.+?)】)/);
    const plainTitle = normalizeSpace(firstLine ?? '')
      .replace(/^\*+|\*+$/g, '')
      .slice(0, 24);

    return {
      index: offset + 1,
      title: bracketTitle?.[1]?.trim() || bracketTitle?.[2]?.trim() || plainTitle || `开场白 #${offset + 1}`,
      content,
      searchText: narrative,
      preview: toPreviewText(firstLine && /^(?:【|\[)/.test(firstLine) ? narrative.replace(firstLine, '') : narrative),
    };
  });
}

function findGreetingSwipeMessage(): ChatMessageSwiped | null {
  const messages = getChatMessages('0-{{lastMessageId}}', { include_swipes: true });
  return messages.find(message => Array.isArray(message.swipes) && message.swipes.length > 1) ?? null;
}

function normalizeForMatch(text: string): string {
  return normalizeSpace(text).replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function extractBracketTitle(text: string): string {
  const firstLine = text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);
  const match = firstLine?.match(/^(?:\[(.+?)\]|【(.+?)】)/);
  return (match?.[1] ?? match?.[2])?.trim() ?? '';
}

function getFirstMessageContent(): string {
  const data = getCharData('current');
  if (!data) return '';

  const v2 = data.data as Partial<SillyTavern.v2CharData> | undefined;
  return String(v2?.first_mes ?? data.first_mes ?? '');
}

function resolveSwipeId(target: GreetingIndexItem, swipes: string[]): number | null {
  const normalizedTarget = normalizeForMatch(target.content);

  let index = swipes.findIndex(swipe => normalizeForMatch(swipe) === normalizedTarget);
  if (index >= 0) return index;

  const targetTitle = extractBracketTitle(target.content);
  if (targetTitle) {
    index = swipes.findIndex(swipe => extractBracketTitle(swipe) === targetTitle);
    if (index >= 0) return index;
  }

  const targetPrefix = normalizedTarget.slice(0, 120);
  index = swipes.findIndex(swipe => {
    const normalizedSwipe = normalizeForMatch(swipe);
    return normalizedSwipe.includes(targetPrefix) || targetPrefix.includes(normalizedSwipe.slice(0, 120));
  });
  if (index >= 0) return index;

  const normalizedFirstMessage = normalizeForMatch(getFirstMessageContent());
  const normalizedFirstSwipe = normalizeForMatch(swipes[0] ?? '');
  const includesFirstMessage =
    normalizedFirstMessage.length > 0 &&
    normalizedFirstSwipe.length > 0 &&
    (normalizedFirstSwipe === normalizedFirstMessage ||
      normalizedFirstSwipe.includes(normalizedFirstMessage.slice(0, 120)) ||
      normalizedFirstMessage.includes(normalizedFirstSwipe.slice(0, 120)));
  const fallbackIndex = target.index - 1 + (includesFirstMessage ? 1 : 0);

  return fallbackIndex >= 0 && fallbackIndex < swipes.length ? fallbackIndex : null;
}

export function readGreetingIndex(): GreetingIndexState {
  const items = getGreetingItems();
  const greetingMessage = findGreetingSwipeMessage();
  if (!greetingMessage || !Number.isInteger(greetingMessage.swipe_id)) {
    return { items, currentIndex: null };
  }

  const currentSwipeId = Number(greetingMessage.swipe_id);
  const currentItem = items.find(item => resolveSwipeId(item, greetingMessage.swipes) === currentSwipeId);
  return { items, currentIndex: currentItem?.index ?? null };
}

export async function switchGreeting(targetIndex: number): Promise<boolean> {
  const items = getGreetingItems();
  if (items.length === 0) {
    toastr.error('当前角色没有可用的额外开场白。');
    return false;
  }
  if (targetIndex < 1 || targetIndex > items.length) {
    toastr.error(`索引越界：${targetIndex}（有效范围 1-${items.length}）`);
    return false;
  }

  const greetingMessage = findGreetingSwipeMessage();
  if (!greetingMessage) {
    toastr.error('未找到可切换的开场白楼层，请先进入角色聊天并确认开场白已经生成。');
    return false;
  }

  const target = items[targetIndex - 1];
  const swipeId = resolveSwipeId(target, greetingMessage.swipes);
  if (swipeId === null) {
    toastr.error('未能定位对应开场白，建议先在“其他开场”里手动切换一次后重试。');
    return false;
  }

  await setChatMessages([{ message_id: greetingMessage.message_id, swipe_id: swipeId }], { refresh: 'all' });
  toastr.success(`已切换到开场白 #${targetIndex}`);
  return true;
}
