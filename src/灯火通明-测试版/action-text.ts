/** 行动已有句末标点时沿用原句，避免拼接出重复句号。 */
export function ensureSentence(text: string): string {
  const sentence = text.trim();
  return sentence && !/[。！？!?…]$/u.test(sentence) ? sentence + '。' : sentence;
}
