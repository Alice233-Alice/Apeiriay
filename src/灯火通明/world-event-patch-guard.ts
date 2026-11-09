export type WorldEventPatchOperation = {
  op: 'replace' | 'insert' | 'remove' | 'delta';
  path: string;
  value?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const cloneJsonValue = <T>(value: T): T => structuredClone(value);

const decodePointerSegment = (segment: string) => segment.replaceAll('~1', '/').replaceAll('~0', '~');

const getPointerSegments = (path: string) => {
  if (!path.startsWith('/')) return [];
  return path.slice(1).split('/').map(decodePointerSegment);
};

const unsafePathSegments = new Set(['__proto__', 'prototype', 'constructor']);

export const parseWorldEventPatchOperation = (fullMatch: unknown): WorldEventPatchOperation | null => {
  if (typeof fullMatch !== 'string') return null;

  try {
    const parsed = JSON.parse(fullMatch) as Partial<WorldEventPatchOperation>;
    if (!parsed || !['replace', 'insert', 'remove', 'delta'].includes(String(parsed.op))) return null;
    if (typeof parsed.path !== 'string') return null;

    const segments = getPointerSegments(parsed.path);
    if (segments[0] !== '世界图志' || segments.some(segment => unsafePathSegments.has(segment))) return null;

    return {
      op: parsed.op as WorldEventPatchOperation['op'],
      path: parsed.path,
      ...(Object.hasOwn(parsed, 'value') ? { value: cloneJsonValue(parsed.value) } : {}),
    };
  } catch {
    return null;
  }
};

const mergeLedgerSnapshot = (before: unknown, after: unknown): Record<string, unknown> => {
  const previous = isRecord(before) ? before : {};
  const current = isRecord(after) ? after : {};

  return Object.fromEntries(
    Object.entries(current).map(([id, currentEvent]) => {
      const previousEvent = previous[id];
      if (isRecord(previousEvent) && isRecord(currentEvent)) {
        return [id, { ...cloneJsonValue(previousEvent), ...cloneJsonValue(currentEvent) }];
      }
      return [id, cloneJsonValue(currentEvent)];
    }),
  );
};

const setAtSegments = (target: Record<string, unknown>, segments: string[], value: unknown) => {
  if (segments.length === 0) return;

  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment];
    if (!isRecord(existing)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments.at(-1)!] = cloneJsonValue(value);
};

const removeAtSegments = (target: Record<string, unknown>, segments: string[]) => {
  if (segments.length === 0) return;

  let cursor: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment];
    if (!isRecord(existing)) return;
    cursor = existing;
  }
  delete cursor[segments.at(-1)!];
};

export const restoreWorldEventLedger = (
  before: unknown,
  after: unknown,
  operations: readonly WorldEventPatchOperation[],
): Record<string, unknown> => {
  let ledger = mergeLedgerSnapshot(before, after);

  for (const operation of operations) {
    const [, ...segments] = getPointerSegments(operation.path);

    if (segments.length === 0) {
      if (operation.op === 'remove') ledger = {};
      else if (isRecord(operation.value)) ledger = cloneJsonValue(operation.value);
      continue;
    }

    if (operation.op === 'remove') {
      removeAtSegments(ledger, segments);
      continue;
    }

    if (operation.op === 'delta') {
      const current = segments.reduce<unknown>(
        (value, segment) => (isRecord(value) ? value[segment] : undefined),
        ledger,
      );
      const delta = Number(operation.value);
      if (Number.isFinite(delta)) setAtSegments(ledger, segments, Number(current ?? 0) + delta);
      continue;
    }

    if (Object.hasOwn(operation, 'value')) setAtSegments(ledger, segments, operation.value);
  }

  return ledger;
};
