import type { DialogueBubbleSpec } from './parser';
import { parseDialogueMarkupRoot, parseDialogueParagraph } from './parser';

type DialogueChoiceFlags = {
  shixiaSelected: boolean;
  kuriharaSelected: boolean;
};

type BubbleAppearance = {
  displayName: string;
  tone: 'shixia' | 'kurihara' | 'purple';
  avatarUrl: string | null;
  avatarText: string;
};

type SpeakerProfileConfig = {
  aliases: string[];
  displayName?: string;
  avatarUrl?: string | null;
  avatarText?: string;
  tone?: BubbleAppearance['tone'];
};

const STYLE_ATTRIBUTE = 'data-dialogue-bubble-style';
const RENDERED_ATTRIBUTE = 'data-dialogue-bubble-rendered';
const SOURCE_ATTRIBUTE = 'data-dialogue-bubble-source';
const SOURCE_HIDDEN_CLASS = 'DialogueBubble__source-hidden';
const MESSAGE_SELECTOR = '#chat > .mes[is_system="false"]';
const MARKUP_ROOT_SELECTOR = 'dialogue-bubbles, [data-dialogue-bubbles="true"], .dialogue-bubbles';
const EXCLUDED_DIALOGUE_SELECTOR = [
  '.TH-streaming',
  MARKUP_ROOT_SELECTOR,
  '[data-dialogue-bubble-rendered="true"]',
  '[data-dialogue-bubble-source="true"]',
  'details',
  'summary',
  'pre',
  'code',
  'table',
  'script',
  'style',
  'textarea',
  '[script_id]',
].join(', ');

const SHIXIA_SMILE_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%97%B6%E5%A4%8Fsmile.png';
const SHIXIA_SAD_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%97%B6%E5%A4%8Fsad.png';
const KURIHARA_SMILE_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%A0%97%E5%8E%9Fsmile.png';
const KURIHARA_SAD_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%A0%97%E5%8E%9Fsad.png';

// 在这里补充“角色名 -> 显示名 / 头像 / 配色”的映射，后面只改这个配置区即可。
const CUSTOM_SPEAKER_PROFILES: SpeakerProfileConfig[] = [
  {
    aliases: ['白清弦'],
    displayName: '白清弦',
    avatarUrl: '',
    tone: 'purple',
  },
  {
    aliases: ['虞颜'],
    displayName: '虞颜',
    avatarUrl: '',
    tone: 'purple',
  },
];

const STYLE_TEXT = `
.${SOURCE_HIDDEN_CLASS} {
  display: none !important;
}

.DialogueBubble {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.1rem 0 0.45rem;
  animation: dialogue-bubble-enter 0.24s ease-out both;
}

.DialogueBubble__row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  width: 100%;
}

.DialogueBubble__row.is-right {
  flex-direction: row-reverse;
}

.DialogueBubble__avatar {
  width: 4.2rem;
  height: 4.2rem;
  flex: 0 0 4.2rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.96);
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.42), transparent 38%),
    linear-gradient(145deg, rgba(129, 116, 230, 0.95), rgba(92, 80, 194, 0.92));
  box-shadow:
    0 18px 38px rgba(12, 18, 32, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, 0.42);
  border: 2px solid rgba(255, 255, 255, 0.72);
}

.DialogueBubble__avatar.is-shixia {
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.42), transparent 38%),
    linear-gradient(145deg, rgba(147, 210, 255, 0.95), rgba(107, 177, 245, 0.92));
}

.DialogueBubble__avatar.is-kurihara {
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.44), transparent 38%),
    linear-gradient(145deg, rgba(255, 228, 134, 0.95), rgba(244, 196, 82, 0.92));
}

.DialogueBubble__avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.DialogueBubble__avatarText {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0.45rem;
  text-align: center;
  line-height: 1.1;
  font-size: 0.96rem;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
}

.DialogueBubble__main {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  width: fit-content;
  max-width: min(52%, 42rem);
}

.DialogueBubble__row.is-right .DialogueBubble__main {
  align-items: flex-end;
}

.DialogueBubble__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--SmartThemeBodyColor, #d7deea) 82%, white 18%);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.16);
  padding: 0 0.4rem;
}

.DialogueBubble__bubble {
  position: relative;
  border-radius: 1.7rem;
  padding: 1rem 1.22rem;
  color: #1d2736;
  box-shadow:
    0 18px 42px rgba(7, 12, 24, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.62);
  line-height: 1.78;
  overflow-wrap: anywhere;
  border: 1px solid rgba(255, 255, 255, 0.82);
  min-width: min(20rem, 48vw);
}

.DialogueBubble__bubble::after {
  content: '';
  position: absolute;
  bottom: 1.02rem;
  width: 1rem;
  height: 1rem;
  border-radius: 0.2rem;
  transform: rotate(45deg);
  border-right: 1px solid rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(255, 255, 255, 0.72);
}

.DialogueBubble__bubble.is-left::after {
  left: -0.42rem;
}

.DialogueBubble__bubble.is-right::after {
  right: -0.42rem;
}

.DialogueBubble__bubble.tone-shixia {
  background:
    linear-gradient(145deg, rgba(214, 237, 255, 0.96), rgba(181, 220, 255, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0));
}

.DialogueBubble__bubble.tone-shixia::after {
  background: rgba(188, 223, 255, 0.96);
}

.DialogueBubble__bubble.tone-kurihara {
  background:
    linear-gradient(145deg, rgba(255, 241, 178, 0.97), rgba(255, 222, 120, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0));
}

.DialogueBubble__bubble.tone-kurihara::after {
  background: rgba(255, 228, 143, 0.96);
}

.DialogueBubble__bubble.tone-purple {
  background:
    linear-gradient(145deg, rgba(236, 223, 255, 0.97), rgba(215, 192, 255, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0));
}

.DialogueBubble__bubble.tone-purple::after {
  background: rgba(222, 203, 255, 0.96);
}

.DialogueBubble__bubbleContent {
  font-size: 1.06rem;
}

.DialogueBubble__bubbleContent p,
.DialogueBubble__bubbleContent blockquote,
.DialogueBubble__bubbleContent ul,
.DialogueBubble__bubbleContent ol,
.DialogueBubble__bubbleContent pre {
  margin: 0;
}

.DialogueBubble__bubbleContent p + p,
.DialogueBubble__bubbleContent blockquote + p,
.DialogueBubble__bubbleContent p + blockquote,
.DialogueBubble__bubbleContent ul + p,
.DialogueBubble__bubbleContent ol + p {
  margin-top: 0.55rem;
}

.DialogueBubble__narration {
  width: 100%;
  animation: dialogue-bubble-enter 0.2s ease-out both;
}

.DialogueBubble__narrationContent {
  width: 100%;
  color: inherit;
  text-align: left;
  line-height: inherit;
  font-style: normal;
  text-shadow: none;
}

.DialogueBubble__narrationContent p,
.DialogueBubble__narrationContent blockquote,
.DialogueBubble__narrationContent ul,
.DialogueBubble__narrationContent ol,
.DialogueBubble__narrationContent pre {
  margin: 0;
}

.DialogueBubble__narrationContent p + p,
.DialogueBubble__narrationContent blockquote + p,
.DialogueBubble__narrationContent p + blockquote,
.DialogueBubble__narrationContent ul + p,
.DialogueBubble__narrationContent ol + p {
  margin-top: 0.55rem;
}

@keyframes dialogue-bubble-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .DialogueBubble__row {
    gap: 0.75rem;
  }

  .DialogueBubble__avatar {
    width: 3.35rem;
    height: 3.35rem;
    flex-basis: 3.35rem;
  }

  .DialogueBubble__main {
    max-width: min(82%, 100%);
  }

  .DialogueBubble__bubble {
    min-width: 0;
    padding: 0.92rem 1.05rem;
  }
}
`;

function ensureStyle() {
  const selector = `head > style[script_id="${getScriptId()}"][${STYLE_ATTRIBUTE}="true"]`;
  if ($(selector).length > 0) {
    return;
  }

  $('<style>')
    .attr('script_id', getScriptId())
    .attr(STYLE_ATTRIBUTE, 'true')
    .text(STYLE_TEXT)
    .appendTo('head');
}

function removeStyle() {
  $(`head > style[script_id="${getScriptId()}"][${STYLE_ATTRIBUTE}="true"]`).remove();
}

function getUserName(): string {
  try {
    return String(SillyTavern.name1 || substitudeMacros('{{user}}') || 'User').trim() || 'User';
  } catch (_error) {
    return substitudeMacros('{{user}}').trim() || 'User';
  }
}

function getCurrentCharacterName(messageName?: string): string {
  try {
    return String(messageName || SillyTavern.name2 || substitudeMacros('{{char}}') || '角色').trim() || '角色';
  } catch (_error) {
    return String(messageName || substitudeMacros('{{char}}') || '角色').trim() || '角色';
  }
}

function normalizeBool(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
}

function normalizeSpeakerKey(value: string): string {
  return value
    .replace(/[【】[\]（）()「」“”"'`<>《》]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function findCustomSpeakerProfile(speakerName: string): SpeakerProfileConfig | null {
  const normalizedSpeakerName = normalizeSpeakerKey(speakerName);
  if (!normalizedSpeakerName) {
    return null;
  }

  return (
    CUSTOM_SPEAKER_PROFILES.find(profile =>
      profile.aliases.some(alias => normalizeSpeakerKey(alias) === normalizedSpeakerName),
    ) ?? null
  );
}

function findBooleanByKey(root: unknown, targetKey: string): boolean {
  const visited = new Set<unknown>();
  const stack: unknown[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach(item => stack.push(item));
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === targetKey && normalizeBool(value)) {
        return true;
      }
      stack.push(value);
    }
  }

  return false;
}

function getDialogueChoiceFlags(): DialogueChoiceFlags {
  const chatVariables = getVariables({ type: 'chat' });

  return {
    shixiaSelected: findBooleanByKey(chatVariables, '时夏'),
    kuriharaSelected: findBooleanByKey(chatVariables, '栗原'),
  };
}

function extractUrlFromBackgroundImage(value: string | null | undefined): string | null {
  if (!value || value === 'none') {
    return null;
  }
  const matched = value.match(/url\((['"]?)(.+?)\1\)/);
  return matched?.[2] ?? null;
}

function resolveUserAvatarUrl(): string | null {
  const $userMessages = $('#chat > .mes[is_user="true"]');
  const $lastUserMessage = $userMessages.last();
  const roots = [$lastUserMessage, $userMessages.first()].filter($root => $root.length > 0);
  const selectors = ['.avatar img', '.mesAvatar img', 'img.avatar', 'img'];

  for (const $root of roots) {
    for (const selector of selectors) {
      const imageElement = $root.find(selector).get(0) as HTMLImageElement | undefined;
      const source = imageElement?.src?.trim();
      if (source) {
        return source;
      }
    }

    const avatarElement = $root.find('.avatar, .mesAvatar').get(0) as HTMLElement | undefined;
    const backgroundImage = avatarElement ? getComputedStyle(avatarElement).backgroundImage : null;
    const url = extractUrlFromBackgroundImage(backgroundImage);
    if (url) {
      return url;
    }
  }

  return null;
}

function toAvatarText(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    return '?';
  }
  const glyphs = Array.from(normalized);
  return glyphs.slice(0, Math.min(glyphs.length, 3)).join('');
}

function createAppearance(
  bubble: DialogueBubbleSpec,
  flags: DialogueChoiceFlags,
  userAvatarUrl: string | null,
): BubbleAppearance {
  const customProfile = findCustomSpeakerProfile(bubble.speakerName);
  const displayName = customProfile?.displayName?.trim() || bubble.speakerName;
  const customAvatarUrl = normalizeOptionalText(customProfile?.avatarUrl);
  const customAvatarText = customProfile?.avatarText?.trim() || toAvatarText(displayName);
  const customTone = customProfile?.tone;

  switch (bubble.speakerCategory) {
    case 'shixia':
      return {
        displayName,
        tone: customTone ?? 'shixia',
        avatarUrl: customAvatarUrl ?? (flags.kuriharaSelected ? SHIXIA_SAD_AVATAR : SHIXIA_SMILE_AVATAR),
        avatarText: customProfile?.avatarText?.trim() || '时夏',
      };
    case 'kurihara':
      return {
        displayName,
        tone: customTone ?? 'kurihara',
        avatarUrl: customAvatarUrl ?? (flags.shixiaSelected ? KURIHARA_SAD_AVATAR : KURIHARA_SMILE_AVATAR),
        avatarText: customProfile?.avatarText?.trim() || '栗原',
      };
    case 'user':
      return {
        displayName,
        tone: customTone ?? 'purple',
        avatarUrl: customAvatarUrl ?? userAvatarUrl,
        avatarText: customAvatarText,
      };
    default:
      return {
        displayName,
        tone: customTone ?? 'purple',
        avatarUrl: customAvatarUrl,
        avatarText: customAvatarText,
      };
  }
}

function getParagraphText(node: HTMLParagraphElement): string {
  const clone = node.cloneNode(true) as HTMLParagraphElement;
  clone.querySelectorAll('br').forEach(lineBreak => {
    lineBreak.replaceWith(document.createTextNode('\n'));
  });
  return clone.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
}

function createBubbleContentHtml(messageId: number, content: string): string {
  return formatAsDisplayedMessage(content.trim(), { message_id: messageId });
}

function createBubbleRow(
  messageId: number,
  bubble: DialogueBubbleSpec,
  appearance: BubbleAppearance,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = `DialogueBubble__row ${bubble.side === 'right' ? 'is-right' : 'is-left'}`;

  const avatar = document.createElement('div');
  avatar.className = `DialogueBubble__avatar is-${appearance.tone}`;

  if (appearance.avatarUrl) {
    const image = document.createElement('img');
    image.className = 'DialogueBubble__avatarImage';
    image.src = appearance.avatarUrl;
    image.alt = bubble.speakerName;
    avatar.appendChild(image);
  } else {
    const text = document.createElement('span');
    text.className = 'DialogueBubble__avatarText';
    text.textContent = appearance.avatarText;
    avatar.appendChild(text);
  }

  const main = document.createElement('div');
  main.className = 'DialogueBubble__main';

  const name = document.createElement('div');
  name.className = 'DialogueBubble__name';
  name.textContent = appearance.displayName;

  const bubbleElement = document.createElement('div');
  bubbleElement.className = `DialogueBubble__bubble ${bubble.side === 'right' ? 'is-right' : 'is-left'} tone-${appearance.tone}`;

  const bubbleContent = document.createElement('div');
  bubbleContent.className = 'DialogueBubble__bubbleContent';
  bubbleContent.innerHTML = createBubbleContentHtml(messageId, bubble.content);

  bubbleElement.appendChild(bubbleContent);
  main.append(name, bubbleElement);
  row.append(avatar, main);

  return row;
}

function cleanupMessage(messageId: number) {
  const $messageElement = $(`#chat > .mes[mesid='${messageId}']`);
  $messageElement.find(`[${RENDERED_ATTRIBUTE}="true"]`).remove();
  $messageElement.find(`[${SOURCE_ATTRIBUTE}="true"]`).each((_index, element) => {
    element.removeAttribute(SOURCE_ATTRIBUTE);
    element.classList.remove(SOURCE_HIDDEN_CLASS);
  });
}

function cleanupAllMessages() {
  $(MESSAGE_SELECTOR).each((_index, element) => {
    const messageId = Number($(element).attr('mesid') ?? 'NaN');
    if (!Number.isNaN(messageId)) {
      cleanupMessage(messageId);
    }
  });
}

function isParagraphInSafeRange(paragraph: HTMLParagraphElement, root: HTMLElement): boolean {
  const nearestBlockedAncestor = paragraph.parentElement?.closest(EXCLUDED_DIALOGUE_SELECTOR);
  if (nearestBlockedAncestor && root.contains(nearestBlockedAncestor)) {
    return false;
  }

  const blockedSelf = paragraph.matches(EXCLUDED_DIALOGUE_SELECTOR);
  if (blockedSelf) {
    return false;
  }

  return paragraph.closest('.mes_text') === root || root.contains(paragraph);
}

function collectCandidateParagraphs(root: HTMLElement): HTMLParagraphElement[] {
  const directParagraphs = Array.from(root.children).filter(
    (node): node is HTMLParagraphElement => node instanceof HTMLParagraphElement && isParagraphInSafeRange(node, root),
  );
  if (directParagraphs.length > 0) {
    return directParagraphs;
  }

  return Array.from(root.querySelectorAll('p')).filter(paragraph => isParagraphInSafeRange(paragraph, root));
}

function collectMarkupRoots(root: HTMLElement): HTMLElement[] {
  const roots = Array.from(root.querySelectorAll(MARKUP_ROOT_SELECTOR)).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );

  if (root.matches(MARKUP_ROOT_SELECTOR)) {
    return [root, ...roots.filter(node => node !== root)];
  }

  return roots;
}

function createRenderedBlock(
  messageId: number,
  parsed: Extract<ReturnType<typeof parseDialogueParagraph>, { kind: 'segments' }>,
  flags: DialogueChoiceFlags,
  userAvatarUrl: string | null,
): HTMLDivElement {
  const rendered = document.createElement('div');
  rendered.setAttribute(RENDERED_ATTRIBUTE, 'true');
  rendered.className = 'DialogueBubble';

  parsed.segments.forEach(segment => {
    if (segment.type === 'narration') {
      const narration = document.createElement('div');
      narration.className = 'DialogueBubble__narration';
      const narrationContent = document.createElement('div');
      narrationContent.className = 'DialogueBubble__narrationContent';
      narrationContent.innerHTML = segment.html;
      narration.appendChild(narrationContent);
      rendered.appendChild(narration);
      return;
    }

    const appearance = createAppearance(segment.bubble, flags, userAvatarUrl);
    rendered.appendChild(createBubbleRow(messageId, segment.bubble, appearance));
  });

  return rendered;
}

function renderMessage(messageId: number) {
  cleanupMessage(messageId);

  const message = getChatMessages(messageId)[0];
  if (!message) {
    return;
  }

  const $messageElement = $(`#chat > .mes[mesid='${messageId}']`);
  const messageElement = $messageElement.get(0);
  if (!messageElement || $messageElement.attr('is_system') === 'true') {
    return;
  }

  const messageTextElement =
    (retrieveDisplayedMessage(messageId).get(0) as HTMLDivElement | undefined) ||
    ($messageElement.find('.mes_text').get(0) as HTMLDivElement | undefined);
  if (!messageTextElement) {
    return;
  }

  const flags = getDialogueChoiceFlags();
  const userAvatarUrl = resolveUserAvatarUrl();
  const role = message.role ?? ($messageElement.attr('is_user') === 'true' ? 'user' : 'assistant');
  const currentCharName = getCurrentCharacterName(message.name);
  const userName = getUserName();
  const markupRoots = collectMarkupRoots(messageTextElement);

  markupRoots.forEach(root => {
    const parsed = parseDialogueMarkupRoot({
      messageId,
      message: message.message ?? '',
      root,
      role,
      name: message.name ?? '',
      currentCharName,
      userName,
    });

    if (parsed.kind === 'none') {
      return;
    }

    root.setAttribute(SOURCE_ATTRIBUTE, 'true');
    root.classList.add(SOURCE_HIDDEN_CLASS);
    root.insertAdjacentElement('afterend', createRenderedBlock(messageId, parsed, flags, userAvatarUrl));
  });

  const candidateParagraphs = collectCandidateParagraphs(messageTextElement);

  candidateParagraphs.forEach(paragraph => {
    const paragraphText = getParagraphText(paragraph);
    if (!paragraphText) {
      return;
    }

    const parsed = parseDialogueParagraph({
      messageId,
      message: message.message ?? '',
      paragraph: paragraphText,
      role,
      name: message.name ?? '',
      currentCharName,
      userName,
    });

    if (parsed.kind === 'none') {
      return;
    }

    paragraph.setAttribute(SOURCE_ATTRIBUTE, 'true');
    paragraph.classList.add(SOURCE_HIDDEN_CLASS);
    paragraph.insertAdjacentElement('afterend', createRenderedBlock(messageId, parsed, flags, userAvatarUrl));
  });
}

function renderAllMessages() {
  cleanupAllMessages();

  $(MESSAGE_SELECTOR).each((_index, element) => {
    const messageId = Number($(element).attr('mesid') ?? 'NaN');
    if (!Number.isNaN(messageId)) {
      renderMessage(messageId);
    }
  });
}

function renderLatestMessage() {
  const messageId = Number($('#chat').children('.mes.last_mes').attr('mesid') ?? 'NaN');
  if (!Number.isNaN(messageId)) {
    renderMessage(messageId);
  }
}

function stopOnPagehide(stopList: Array<() => void>) {
  $(window).on('pagehide', () => {
    cleanupAllMessages();
    removeStyle();
    stopList.forEach(stop => stop());
  });
}

function init() {
  console.info('[对白气泡渲染] 开始挂载对白气泡渲染脚本');

  ensureStyle();
  renderAllMessages();
  setTimeout(errorCatched(renderAllMessages), 120);
  setTimeout(errorCatched(renderAllMessages), 480);

  const stopList: Array<() => void> = [];
  const scopedEventOn = <T extends EventType>(event: T, listener: ListenerType[T]) => {
    stopList.push(eventOn(event, errorCatched(listener)).stop);
  };

  scopedEventOn(tavern_events.CHAT_CHANGED, () => setTimeout(errorCatched(renderAllMessages), 60));
  scopedEventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, messageId => setTimeout(() => renderMessage(messageId), 30));
  scopedEventOn(tavern_events.MESSAGE_UPDATED, messageId => setTimeout(() => renderMessage(messageId), 30));
  scopedEventOn(tavern_events.MESSAGE_SWIPED, messageId => setTimeout(() => renderMessage(messageId), 30));
  scopedEventOn(tavern_events.MESSAGE_DELETED, () => setTimeout(errorCatched(renderAllMessages), 120));
  scopedEventOn(tavern_events.MESSAGE_SENT, () => setTimeout(errorCatched(renderLatestMessage), 50));
  scopedEventOn(tavern_events.MESSAGE_RECEIVED, () => setTimeout(errorCatched(renderLatestMessage), 50));
  scopedEventOn(tavern_events.STREAM_TOKEN_RECEIVED, () => renderLatestMessage());

  stopOnPagehide(stopList);
}

$(() => {
  errorCatched(init)();
});
