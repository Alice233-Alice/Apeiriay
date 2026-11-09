const relationshipSubjectPattern = /红颜|道侣|伴侣|妻子|夫人|恋人/u;
const relationshipRupturePattern = /移情|变心|另寻新欢|改嫁|另嫁|背叛感情|抛弃(?:主角|玩家)|感情破裂|关系破裂/u;
const outsideIntimacyPattern =
  /(?:与|被|同|和|跟)(?:陌生|其他|别的|外来的|第三方|另一名|某个)?(?:男子|男人|男修|公子|少主|他人|外人).{0,10}(?:成亲|结为道侣|拥吻|亲吻|双修|同眠|洞房|献身|失身|暧昧|相恋)/u;
const coerciveIntimacyPattern =
  /(?:强迫|胁迫|操控|控制心神|迷药|媚药|幻术|夺舍|替身|冒充|伪装成).{0,18}(?:成亲|拥吻|亲吻|双修|同眠|洞房|献身|失身|亲密)/u;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export const preservesRelationshipContinuity = (text: unknown, companionNames: string[] = []): boolean => {
  const content = String(text ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!content) return true;

  const normalizedNames = companionNames.map(name => String(name).trim()).filter(Boolean);
  const namedCompanionPattern = normalizedNames.length
    ? new RegExp(normalizedNames.map(name => escapeRegExp(name)).join('|'), 'u')
    : null;
  const concernsEstablishedRelationship =
    relationshipSubjectPattern.test(content) || Boolean(namedCompanionPattern?.test(content));

  if (!concernsEstablishedRelationship) return true;
  return ![relationshipRupturePattern, outsideIntimacyPattern, coerciveIntimacyPattern].some(pattern =>
    pattern.test(content),
  );
};
