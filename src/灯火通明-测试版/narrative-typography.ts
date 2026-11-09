const DIALOGUE_QUOTE_PAIRS = [
  ['“', '”'],
  ['「', '」'],
  ['『', '』'],
] as const;

type DialogueClosingQuote = (typeof DIALOGUE_QUOTE_PAIRS)[number][1];

export type NarrativeDialogueState = DialogueClosingQuote[];

export type NarrativeTextSegment = {
  text: string;
  dialogue: boolean;
};

const OPEN_TO_CLOSE = new Map<string, DialogueClosingQuote>(DIALOGUE_QUOTE_PAIRS);

export const segmentNarrativeDialogueText = (
  text: string,
  quoteStack: NarrativeDialogueState,
): NarrativeTextSegment[] => {
  const segments: NarrativeTextSegment[] = [];

  const append = (character: string, dialogue: boolean) => {
    const previous = segments.at(-1);
    if (previous?.dialogue === dialogue) {
      previous.text += character;
      return;
    }
    segments.push({ text: character, dialogue });
  };

  for (const character of text) {
    const closingQuote = OPEN_TO_CLOSE.get(character);
    if (closingQuote) {
      quoteStack.push(closingQuote);
      append(character, true);
      continue;
    }

    if (quoteStack.at(-1) === character) {
      append(character, true);
      quoteStack.pop();
      continue;
    }

    append(character, quoteStack.length > 0);
  }

  return segments;
};
