const GENERIC_LAYERS = ['天层', '地层', '下层'] as const;

const SPECIFIC_DOMAINS = [
    '神州', '东苍', '南炎', '西庚', '北冥', '四海',
    '天渊', '归墟', '黄泉古迹', '无尽炎渊', '雷暴海',
] as const;

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    神州: ['神州', '中州', '中原'],
    东苍: ['东苍', '东荒'],
    南炎: ['南炎', '南疆'],
    西庚: ['西庚', '西漠'],
    北冥: ['北冥', '北域'],
    四海: ['四海', '外海'],
    天渊: ['天渊'],
    归墟: ['归墟'],
    黄泉古迹: ['黄泉古迹', '黄泉'],
    无尽炎渊: ['无尽炎渊', '炎渊'],
    雷暴海: ['雷暴海'],
};

export const ALL_KNOWN_REGIONS = [...GENERIC_LAYERS, ...SPECIFIC_DOMAINS] as readonly string[];
export const GENERIC_LAYERS_LIST = [...GENERIC_LAYERS] as readonly string[];
export const SPECIFIC_DOMAINS_LIST = [...SPECIFIC_DOMAINS] as readonly string[];

export const isSpecificDomain = (value: string): boolean => SPECIFIC_DOMAINS.includes(value as typeof SPECIFIC_DOMAINS[number]);
export const isGenericLayer = (value: string): boolean => GENERIC_LAYERS.includes(value as typeof GENERIC_LAYERS[number]);

export const normalizeRegionName = (value: string): string => {
    const cleaned = String(value || '').trim();
    if (!cleaned) return '';

    const parts = cleaned
        .split(/[·•\-—_：:／/|]/)
        .map(s => s.trim())
        .filter(Boolean);

    if (parts.length >= 2 && ALL_KNOWN_REGIONS.includes(parts[0])) {
        return parts.slice(1).join('');
    }
    return cleaned;
};

export const extractDomainFromText = (text: string): string => {
    const source = String(text || '');
    if (!source) return '';

    for (const domain of SPECIFIC_DOMAINS) {
        if (source.includes(domain)) return domain;
    }

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        if (keywords.some(k => source.includes(k))) return domain;
    }

    return '';
};

const inferDomainFromRecord = <TValue>(
    currentRegionRaw: string,
    currentRegion: string,
    record: Record<string, TValue> | undefined,
    getDomain: (value: TValue) => string | undefined,
): string => {
    if (!record) return '';

    const rawRegion = String(currentRegionRaw || '').trim();
    const candidates = Array.from(new Set([
        rawRegion,
        currentRegion,
        normalizeRegionName(rawRegion),
        normalizeRegionName(currentRegion),
    ].filter(Boolean)));

    for (const candidate of candidates) {
        const directMatch = record[candidate];
        const directDomain = directMatch ? String(getDomain(directMatch) || '').trim() : '';
        if (isSpecificDomain(directDomain)) {
            return directDomain;
        }
    }

    let bestMatch = '';
    let bestDomain = '';

    for (const [name, value] of Object.entries(record)) {
        const domain = String(getDomain(value) || '').trim();
        if (!isSpecificDomain(domain)) continue;

        const normalizedName = normalizeRegionName(name);
        if (!normalizedName) continue;

        const matched = candidates.some(candidate =>
            candidate.includes(normalizedName) || normalizedName.includes(candidate),
        );
        if (!matched) continue;

        if (normalizedName.length > bestMatch.length) {
            bestMatch = normalizedName;
            bestDomain = domain;
        }
    }

    return bestDomain;
};

export const inferLayerFromTrack = (
    currentRegionRaw: string,
    layerRaw: string,
    environmentDesc: string,
    locationLib?: Record<string, { 域?: string }>,
    worldMap?: Record<string, { layer?: string }>,
    previousLayer?: string,
): string => {
    const currentRegion = normalizeRegionName(currentRegionRaw);
    const layer = String(layerRaw || '').trim();
    const prev = String(previousLayer || '').trim();

    const inlineDomain = extractDomainFromText(String(currentRegionRaw || ''));
    if (inlineDomain) return inlineDomain;

    const locationDomain = inferDomainFromRecord(currentRegionRaw, currentRegion, locationLib, value => String((value as { 域?: string })?.域 || ''));
    if (locationDomain) return locationDomain;

    const mapDomain = inferDomainFromRecord(currentRegionRaw, currentRegion, worldMap, value => String((value as { layer?: string })?.layer || ''));
    if (mapDomain) return mapDomain;

    if (isSpecificDomain(layer)) return layer;

    if (isGenericLayer(layer)) {
        const fallbackDomain = extractDomainFromText(
            `${String(currentRegionRaw || '')} ${currentRegion} ${String(environmentDesc || '')}`,
        );
        if (fallbackDomain) return fallbackDomain;

        if (isSpecificDomain(prev)) return prev;
    }

    if (isSpecificDomain(prev)) return prev;

    return layer;
};
