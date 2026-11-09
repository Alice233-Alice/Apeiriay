type MessageInput = {
  messageId: number;
  message: string;
  role: ChatMessage['role'];
  name?: string;
  currentCharName?: string;
  userName?: string;
};

export type DialogueSpeakerCategory = 'shixia' | 'kurihara' | 'user' | 'other';

type SpeakerContext = {
  charName: string;
  userName: string;
  currentCharCategory: DialogueSpeakerCategory;
  charAliases: Set<string>;
  userAliases: Set<string>;
};

export type DialogueParagraphSegment =
  | {
      type: 'bubble';
      bubble: DialogueBubbleSpec;
    }
  | {
      type: 'narration';
      html: string;
    };

export type DialogueBubbleSpec = {
  side: 'left' | 'right';
  speakerName: string;
  speakerCategory: DialogueSpeakerCategory;
  content: string;
};

export type DialogueParagraphParseResult =
  | {
      kind: 'none';
    }
  | {
      kind: 'segments';
      segments: DialogueParagraphSegment[];
    };

export type BubbleSegment = {
  key: string;
  type: 'bubble';
  side: 'left' | 'right';
  speakerName: string;
  speakerCategory: DialogueSpeakerCategory;
  html: string;
};

export type NarrationSegment = {
  key: string;
  type: 'narration';
  html: string;
};

export type ParsedMessageSegment = BubbleSegment | NarrationSegment;

const quotePairs = [
  ['「', '」'],
  ['“', '”'],
  ['"', '"'],
] as const;

const userAliasSeed = ['{{user}}', '<user>', 'user', '玩家', '主角'];
const charAliasSeed = ['{{char}}', '<char>', 'char', 'character'];
const protocolUserTargets = ['user', 'self', 'player', 'protagonist'];
const protocolCharTargets = ['char', 'assistant', 'character', 'npc'];
const strictSpeakerPattern = /^[\p{L}\p{N}_\-·・]{1,16}$/u;
const reportingVerbPattern =
  /(?:说|道|问|答|喊|叫|笑|叹|骂|低语|呢喃|嘀咕|开口|表示|回应|提醒|补充|解释|命令|宣布)$/u;

function normalizeSpeakerToken(value: string): string {
  return value
    .replace(/[【】[\]（）()「」“”"'`<>《》]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function detectFixedSpeakerCategory(name: string): DialogueSpeakerCategory | null {
  const normalized = normalizeSpeakerToken(name);
  if (!normalized) {
    return null;
  }
  if (normalized === normalizeSpeakerToken('时夏')) {
    return 'shixia';
  }
  if (normalized === normalizeSpeakerToken('栗原')) {
    return 'kurihara';
  }
  return null;
}

function buildSpeakerContext(input: MessageInput): SpeakerContext {
  const charName = input.currentCharName?.trim() || input.name?.trim() || substitudeMacros('{{char}}').trim() || '角色';
  const userName = input.userName?.trim() || substitudeMacros('{{user}}').trim() || 'User';

  return {
    charName,
    userName,
    currentCharCategory: detectFixedSpeakerCategory(charName) ?? 'other',
    charAliases: new Set([charName, input.name ?? '', ...charAliasSeed].map(normalizeSpeakerToken).filter(Boolean)),
    userAliases: new Set([userName, ...userAliasSeed].map(normalizeSpeakerToken).filter(Boolean)),
  };
}

function classifySpeaker(rawSpeaker: string, context: SpeakerContext): DialogueSpeakerCategory {
  const normalized = normalizeSpeakerToken(rawSpeaker);
  if (!normalized) {
    return context.currentCharCategory;
  }
  if (context.userAliases.has(normalized)) {
    return 'user';
  }

  const fixedCategory = detectFixedSpeakerCategory(rawSpeaker);
  if (fixedCategory) {
    return fixedCategory;
  }

  if (context.charAliases.has(normalized)) {
    return context.currentCharCategory;
  }

  return 'other';
}

function getSpeakerName(rawSpeaker: string, category: DialogueSpeakerCategory, context: SpeakerContext): string {
  if (category === 'user') {
    return context.userName;
  }
  if (rawSpeaker.trim()) {
    return rawSpeaker.trim();
  }
  return context.charName;
}

function stripOuterQuotes(text: string): string {
  let current = text.trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of quotePairs) {
      if (current.startsWith(open) && current.endsWith(close) && current.length > open.length + close.length) {
        current = current.slice(open.length, current.length - close.length).trim();
        changed = true;
      }
    }
  }

  return current;
}

function createHtml(messageId: number, text: string): string {
  return formatAsDisplayedMessage(text.trim(), { message_id: messageId });
}

function createNarrationSegment(messageId: number, content: string): DialogueParagraphSegment | null {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return null;
  }

  return {
    type: 'narration',
    html: createHtml(messageId, trimmedContent),
  };
}

function speakerLooksStrict(rawSpeaker: string, context: SpeakerContext): boolean {
  const trimmed = rawSpeaker.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = normalizeSpeakerToken(trimmed);
  if (!normalized) {
    return false;
  }

  if (context.userAliases.has(normalized) || context.charAliases.has(normalized)) {
    return true;
  }

  if (detectFixedSpeakerCategory(trimmed)) {
    return true;
  }

  if (!strictSpeakerPattern.test(trimmed)) {
    return false;
  }

  return !reportingVerbPattern.test(trimmed);
}

function createBubbleSpec(content: string, rawSpeaker: string, context: SpeakerContext): DialogueBubbleSpec | null {
  const trimmedContent = stripOuterQuotes(content);
  if (!trimmedContent) {
    return null;
  }

  const speakerCategory = classifySpeaker(rawSpeaker, context);
  const speakerName = getSpeakerName(rawSpeaker, speakerCategory, context);

  return {
    side: speakerCategory === 'user' ? 'right' : 'left',
    speakerName,
    speakerCategory,
    content: trimmedContent,
  };
}

function resolveProtocolSpeaker(target: string, explicitName: string | null, context: SpeakerContext): string | null {
  const preferredName = explicitName?.trim();
  if (preferredName) {
    return preferredName;
  }

  const trimmedTarget = target.trim();
  if (!trimmedTarget) {
    return null;
  }

  const normalizedTarget = normalizeSpeakerToken(trimmedTarget);
  if (!normalizedTarget) {
    return null;
  }

  if (protocolUserTargets.some(alias => normalizedTarget === normalizeSpeakerToken(alias))) {
    return context.userName;
  }

  if (protocolCharTargets.some(alias => normalizedTarget === normalizeSpeakerToken(alias))) {
    return context.charName;
  }

  if (normalizedTarget === normalizeSpeakerToken('时夏')) {
    return '时夏';
  }

  if (normalizedTarget === normalizeSpeakerToken('栗原')) {
    return '栗原';
  }

  const otherMatch = trimmedTarget.match(/^(?:other|npc)[:：](.+)$/i);
  if (otherMatch?.[1]?.trim()) {
    return otherMatch[1].trim();
  }

  return speakerLooksStrict(trimmedTarget, context) ? trimmedTarget : null;
}

function parseProtocolLine(
  line: string,
  messageId: number,
  context: SpeakerContext,
): DialogueParagraphSegment | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const bracketNarrationMatch = trimmed.match(/^\[nar\]\s*([\s\S]*)$/i);
  if (bracketNarrationMatch) {
    return createNarrationSegment(messageId, bracketNarrationMatch[1] ?? '');
  }

  const xmlNarrationMatch = trimmed.match(/^<nar>\s*([\s\S]*?)\s*<\/nar>$/i);
  if (xmlNarrationMatch) {
    return createNarrationSegment(messageId, xmlNarrationMatch[1] ?? '');
  }

  const bracketDialogueMatch = trimmed.match(/^\[dia\|([^\]\n]+)\]\s*([\s\S]*)$/i);
  if (bracketDialogueMatch) {
    const rawSpeaker = resolveProtocolSpeaker(bracketDialogueMatch[1] ?? '', null, context);
    if (!rawSpeaker) {
      return null;
    }

    const bubble = createBubbleSpec(bracketDialogueMatch[2] ?? '', rawSpeaker, context);
    return bubble ? { type: 'bubble', bubble } : null;
  }

  const xmlDialogueMatch = trimmed.match(/^<dia\b([^>]*)>\s*([\s\S]*?)\s*<\/dia>$/i);
  if (xmlDialogueMatch) {
    const rawAttributes = xmlDialogueMatch[1] ?? '';
    const content = xmlDialogueMatch[2] ?? '';
    const whoMatch = rawAttributes.match(/\bwho=(['"])(.*?)\1/i);
    const nameMatch = rawAttributes.match(/\bname=(['"])(.*?)\1/i);
    const rawSpeaker = resolveProtocolSpeaker(whoMatch?.[2] ?? '', nameMatch?.[2] ?? null, context);
    if (!rawSpeaker) {
      return null;
    }

    const bubble = createBubbleSpec(content, rawSpeaker, context);
    return bubble ? { type: 'bubble', bubble } : null;
  }

  return null;
}

function createBubbleSegment(bubble: DialogueBubbleSpec): DialogueParagraphSegment {
  return {
    type: 'bubble',
    bubble,
  };
}

function parseExplicitProtocolParagraph(
  paragraph: string,
  messageId: number,
  context: SpeakerContext,
): DialogueParagraphParseResult {
  const segment = parseProtocolLine(paragraph, messageId, context);
  if (!segment) {
    return { kind: 'none' };
  }

  return {
    kind: 'segments',
    segments: [segment],
  };
}

function getFirstNonEmptyAttribute(element: Element, names: string[]): string | null {
  for (const name of names) {
    const value = element.getAttribute(name)?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function isMarkupRoot(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return tagName === 'dialogue-bubbles' || element.matches('[data-dialogue-bubbles="true"], .dialogue-bubbles');
}

function isBubbleMarkupElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return tagName === 'bubble' || tagName === 'dia' || element.matches('[data-dialogue-bubble], [data-dia]');
}

function isNarrationMarkupElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return tagName === 'nar' || tagName === 'narration' || element.matches('[data-dialogue-narration], [data-nar]');
}

function resolveMarkupSpeaker(element: Element, context: SpeakerContext): string | null {
  const explicitName = getFirstNonEmptyAttribute(element, ['name', 'speaker', 'data-name', 'data-speaker']);
  const target = getFirstNonEmptyAttribute(element, ['who', 'data-who']) ?? '';
  return resolveProtocolSpeaker(target, explicitName, context);
}

function createSegmentFromMarkupElement(
  element: Element,
  messageId: number,
  context: SpeakerContext,
): DialogueParagraphSegment | null {
  if (isNarrationMarkupElement(element)) {
    return createNarrationSegment(messageId, element.textContent ?? '');
  }

  if (!isBubbleMarkupElement(element)) {
    return createNarrationSegment(messageId, element.textContent ?? '');
  }

  const rawSpeaker = resolveMarkupSpeaker(element, context);
  if (!rawSpeaker) {
    return null;
  }

  const bubble = createBubbleSpec(element.textContent ?? '', rawSpeaker, context);
  return bubble ? createBubbleSegment(bubble) : null;
}

export function parseDialogueMarkupRoot(
  input: MessageInput & { root: HTMLElement },
): DialogueParagraphParseResult {
  if (!isMarkupRoot(input.root)) {
    return { kind: 'none' };
  }

  const context = buildSpeakerContext(input);
  const segments: DialogueParagraphSegment[] = [];

  Array.from(input.root.children).forEach(child => {
    const segment = createSegmentFromMarkupElement(child, input.messageId, context);
    if (segment) {
      segments.push(segment);
    }
  });

  return segments.length > 0 ? { kind: 'segments', segments } : { kind: 'none' };
}

function splitParagraphs(message: string): string[] {
  return message
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);
}

function pushNarrationSegment(
  segments: ParsedMessageSegment[],
  narrationBlocks: string[],
  messageId: number,
  keyRef: { value: number },
) {
  const narrationText = narrationBlocks.join('\n\n').trim();
  if (!narrationText) {
    narrationBlocks.length = 0;
    return;
  }

  segments.push({
    key: `narration-${keyRef.value++}`,
    type: 'narration',
    html: createHtml(messageId, narrationText),
  });
  narrationBlocks.length = 0;
}

function pushBubbleSegments(
  segments: ParsedMessageSegment[],
  messageId: number,
  bubbles: DialogueBubbleSpec[],
  keyRef: { value: number },
) {
  bubbles.forEach(bubble => {
    segments.push({
      key: `bubble-${keyRef.value++}`,
      type: 'bubble',
      side: bubble.side,
      speakerName: bubble.speakerName,
      speakerCategory: bubble.speakerCategory,
      html: createHtml(messageId, bubble.content),
    });
  });
}

export function parseDialogueParagraph(input: MessageInput & { paragraph: string }): DialogueParagraphParseResult {
  const context = buildSpeakerContext(input);
  const paragraph = input.paragraph.trim();
  if (!paragraph) {
    return { kind: 'none' };
  }

  if (input.role === 'user') {
    const bubble = createBubbleSpec(paragraph, context.userName, context);
    return bubble
      ? {
          kind: 'segments',
          segments: [createBubbleSegment(bubble)],
        }
      : { kind: 'none' };
  }

  return parseExplicitProtocolParagraph(paragraph, input.messageId, context);
}

export function parseBubbleSegments(input: MessageInput): ParsedMessageSegment[] {
  const segments: ParsedMessageSegment[] = [];
  const narrationBlocks: string[] = [];
  const keyRef = { value: 0 };
  const paragraphs = splitParagraphs(input.message);

  if (paragraphs.length === 0) {
    return segments;
  }

  for (const paragraph of paragraphs) {
    const parsed = parseDialogueParagraph({
      ...input,
      paragraph,
    });

    if (parsed.kind === 'none') {
      narrationBlocks.push(paragraph);
      continue;
    }

    pushNarrationSegment(segments, narrationBlocks, input.messageId, keyRef);
    parsed.segments.forEach(segment => {
      if (segment.type === 'narration') {
        segments.push({
          key: `narration-${keyRef.value++}`,
          type: 'narration',
          html: segment.html,
        });
        return;
      }

      pushBubbleSegments(segments, input.messageId, [segment.bubble], keyRef);
    });
  }

  pushNarrationSegment(segments, narrationBlocks, input.messageId, keyRef);
  return segments;
}
