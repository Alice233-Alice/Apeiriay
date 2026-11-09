import { z } from 'zod';
import { ProposalEnvelopeSchema } from './journey';

export const JOURNEY_DRAFT_KEY = 'dhl_journey_draft_v1';

const JourneyDraftSchema = z.object({
  version: z.literal(1),
  chatId: z.string(),
  preference: z.string(),
  inspiration: z.string(),
  panelOpen: z.boolean(),
  history: z.object({
    mode: z.enum(['all', 'manual']),
    selectedMessageIds: z.array(z.number().int().nonnegative()),
    rangeStart: z.number().int().nonnegative(),
    rangeEnd: z.number().int().nonnegative(),
  }),
  proposals: z.union([ProposalEnvelopeSchema.shape.proposals, z.tuple([])]),
  source: z
    .object({
      messageId: z.number().int().nonnegative(),
      lastMessageId: z.number().int().nonnegative(),
      historyFingerprint: z.string(),
      invalidated: z.boolean(),
    })
    .nullable(),
});

export type JourneyDraft = z.output<typeof JourneyDraftSchema>;

export function readJourneyDraft(value: unknown, chatId: string): JourneyDraft | undefined {
  const result = JourneyDraftSchema.safeParse(value);
  if (!result.success || result.data.chatId !== chatId) return undefined;
  if (Boolean(result.data.proposals.length) !== Boolean(result.data.source)) return undefined;
  return result.data;
}

/** Store a compact revision check alongside candidates; keep historical prose out of the frontend draft. */
export function fingerprintJourneyHistory(signature: string): string {
  let first = 2166136261;
  let second = 2654435769;
  for (let index = 0; index < signature.length; index += 1) {
    const code = signature.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822507);
  }
  return `${signature.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}
