/** Saved input used by the Izumi preset's advice transfer. Never infer it from AI prose. */
type PlayerMessage = Pick<ChatMessage, 'role' | 'message' | 'extra'>;

export const readAdviceInput = (message: PlayerMessage | undefined) => {
  if (message?.role !== 'user') return null;
  const meta = message.extra?.izumi_advice;
  if (
    !meta ||
    typeof meta !== 'object' ||
    Array.isArray(meta) ||
    meta.version !== 1 ||
    typeof meta.text !== 'string' ||
    !Number.isInteger(meta.assistantId) ||
    meta.assistantId < 0 ||
    (meta.revision !== undefined && (!Number.isInteger(meta.revision) || meta.revision < 0))
  )
    return null;
  const replacement = Object.prototype.hasOwnProperty.call(meta, 'replacementText')
    ? meta.replacementText
    : '按照advice继续吧。';
  if (typeof replacement !== 'string' || !replacement.trim()) return null;
  return { text: meta.text as string, replacementText: replacement };
};

export const readPlayerInput = (message: PlayerMessage | undefined, dialogueText?: string) => {
  if (!message) return '';
  const advice = readAdviceInput(message);
  // A native edit can leave a newer real message beside older advice metadata.
  // Only replace the exact placeholder owned by that saved record.
  if (advice && message.message === advice.replacementText) return advice.text.trim();
  return (dialogueText || String(message.message ?? '')).replace(/^（(?:对[^）]+说|向[^）]+传讯)）\s*/, '').trim();
};
