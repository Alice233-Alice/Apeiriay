export interface ReadingPosition {
  version: 1;
  view: 'timeline' | 'story';
  messageId: number | null;
  top: number;
  following: boolean;
  blockIndex: number;
  text: string;
  offset: number;
}

const normalizeText = (text: string | null) => (text ?? '').replace(/\s+/gu, ' ').trim().slice(0, 160);
const positionKey = (chatId: string) => 'dhl-reading-position:' + chatId;
const paragraphs = (scope: Element) =>
  [...scope.querySelectorAll<HTMLElement>('.story-prose > *, .story-copy > *')].filter(
    block => block.getBoundingClientRect().height > 0 && normalizeText(block.textContent),
  );

export function parseReadingPosition(raw: string | null | undefined): ReadingPosition | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ReadingPosition;
    if (
      value.version !== 1 ||
      (value.view !== 'timeline' && value.view !== 'story') ||
      !(value.messageId === null || (Number.isInteger(value.messageId) && value.messageId >= 0)) ||
      !Number.isFinite(value.top) ||
      value.top < 0 ||
      !Number.isFinite(value.offset) ||
      !Number.isInteger(value.blockIndex) ||
      value.blockIndex < -1 ||
      typeof value.following !== 'boolean' ||
      typeof value.text !== 'string'
    )
      return null;
    return { ...value, text: value.text.slice(0, 160) };
  } catch {
    return null;
  }
}

export function captureReadingPosition(doc: Document | null | undefined): ReadingPosition | null {
  const view = doc?.querySelector('.cultivation-status')?.getAttribute('data-view');
  if (view !== 'timeline' && view !== 'story') return null;
  const element = doc?.querySelector<HTMLElement>(view === 'timeline' ? '.timeline-scroll' : '.story-scroll');
  if (!element || element.clientHeight <= 0) return null;
  const rect = element.getBoundingClientRect();
  const scope =
    view === 'timeline'
      ? [...element.querySelectorAll<HTMLElement>('[data-timeline-id]')].find(
          entry => entry.getBoundingClientRect().bottom > rect.top + 24,
        )
      : element.closest<HTMLElement>('.story-reader');
  if (!scope) return null;
  const id = Number(view === 'timeline' ? scope.dataset.timelineId : scope.dataset.readerMessageId);
  const blocks = paragraphs(scope);
  const block = blocks.find(candidate => candidate.getBoundingClientRect().bottom > rect.top + 24) ?? scope;
  return {
    version: 1,
    view,
    messageId: Number.isInteger(id) && id >= 0 ? id : null,
    top: element.scrollTop,
    following: element.dataset.following === 'true',
    blockIndex: blocks.indexOf(block),
    text: normalizeText(block.textContent),
    offset: block.getBoundingClientRect().top - rect.top,
  };
}

export function restoreReadingPosition(element: HTMLElement, position: ReadingPosition): boolean {
  const scope =
    position.view === 'timeline'
      ? element.querySelector<HTMLElement>('[data-timeline-id="' + position.messageId + '"]')
      : element.closest<HTMLElement>('.story-reader');
  if (!scope || (position.view === 'story' && Number(scope.dataset.readerMessageId) !== position.messageId))
    return false;
  const blocks = paragraphs(scope);
  const block =
    blocks.find(candidate => normalizeText(candidate.textContent) === position.text) ??
    blocks[position.blockIndex] ??
    scope;
  element.scrollTop += block.getBoundingClientRect().top - element.getBoundingClientRect().top - position.offset;
  return true;
}

export function saveReadingPosition(
  frame: HTMLIFrameElement | null | undefined,
  chatId: string,
): ReadingPosition | null {
  const position = captureReadingPosition(frame?.contentDocument);
  if (!frame || !position) return null;
  const raw = JSON.stringify(position);
  frame.dataset.dhlReadingPosition = raw;
  try {
    if (chatId) frame.ownerDocument.defaultView?.sessionStorage.setItem(positionKey(chatId), raw);
  } catch {
    // 临时禁用浏览器存储时，原位重载仍可从 iframe 属性恢复。
  }
  return position;
}

export function loadReadingPosition(
  frame: HTMLIFrameElement | null | undefined,
  chatId: string,
): ReadingPosition | null {
  const position = parseReadingPosition(frame?.dataset?.dhlReadingPosition);
  if (position) return position;
  if (!chatId) return null;
  try {
    return parseReadingPosition(frame?.ownerDocument?.defaultView?.sessionStorage.getItem(positionKey(chatId)));
  } catch {
    return null;
  }
}

export function clearReadingPosition(host: Window, chatId: string) {
  try {
    host.sessionStorage.removeItem(positionKey(chatId));
  } catch {
    // 存储不可用时，新舞台仍会按默认位置打开。
  }
}
