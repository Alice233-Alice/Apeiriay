import { getCharacterImageCandidates, getCharacterImages, resetDualSoulSession } from '../character-assets';

export interface VisualCard {
    name: string;
    img_code: string;
    back_img_code?: string;
    back_text: string;
}

export interface GalleryCard {
    name: string;
    front: string;
    back: string;
    frontCandidates: string[];
    backCandidates: string[];
    backText: string;
    isFlipped: boolean;
    frontName?: string;
    backName?: string;
}

export interface CustomPortraitOverride {
    front?: string;
    back?: string;
}

const imagePreloadCache = new Map<string, Promise<void>>();

const VISUAL_CARDS_TAG_REGEX = /<visual_cards>\s*([\s\S]*?)\s*<\/visual_cards>/i;
const STRUCTURAL_CHAR_MAP: Record<string, string> = {
    '【': '[',
    '】': ']',
    '｛': '{',
    '｝': '}',
    '：': ':',
    '，': ',',
};
const QUOTE_PAIRS: Record<string, string> = {
    '"': '"',
    "'": "'",
    '“': '”',
    '”': '”',
    '‘': '’',
    '’': '’',
};

type VisualCardInput = Partial<Record<keyof VisualCard, unknown>>;
type ParsedStringResult = {
    value: string;
    nextIndex: number;
};

function stripMarkdownCodeFence(content: string): string {
    return content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
}

function normalizeVisualCards(cards: VisualCardInput[]): VisualCard[] {
    return cards.flatMap(card => {
        const name = typeof card.name === 'string' ? card.name.trim() : '';
        const imgCode = typeof card.img_code === 'string' ? card.img_code.trim() : '';
        const backImgCode = typeof card.back_img_code === 'string' ? card.back_img_code.trim() : undefined;
        const backText = typeof card.back_text === 'string' ? card.back_text.trim() : null;

        if (!name || !imgCode || backText === null) {
            return [];
        }

        return [
            {
                name,
                img_code: imgCode,
                ...(backImgCode ? { back_img_code: backImgCode } : {}),
                back_text: backText,
            },
        ];
    });
}

function normalizeVisualCardsStructure(content: string): string {
    return stripMarkdownCodeFence(content).replace(/[【】｛｝：，]/g, char => STRUCTURAL_CHAR_MAP[char] ?? char);
}

function isQuoteChar(char: string | undefined): char is keyof typeof QUOTE_PAIRS {
    return !!char && char in QUOTE_PAIRS;
}

function skipWhitespace(input: string, startIndex: number): number {
    let index = startIndex;
    while (index < input.length && /\s/.test(input[index])) {
        index += 1;
    }
    return index;
}

function readQuotedString(input: string, startIndex: number): ParsedStringResult | null {
    const openingQuote = input[startIndex];
    if (!isQuoteChar(openingQuote)) {
        return null;
    }

    const closingQuote = QUOTE_PAIRS[openingQuote];
    let value = '';

    for (let index = startIndex + 1; index < input.length; index += 1) {
        const char = input[index];
        if (char === '\\' && index + 1 < input.length) {
            const escapedChar = input[index + 1];
            switch (escapedChar) {
                case 'n':
                    value += '\n';
                    break;
                case 'r':
                    value += '\r';
                    break;
                case 't':
                    value += '\t';
                    break;
                default:
                    value += escapedChar;
                    break;
            }
            index += 1;
            continue;
        }

        if (char === closingQuote) {
            return {
                value,
                nextIndex: index + 1,
            };
        }

        value += char;
    }

    return null;
}

function readUnquotedValue(input: string, startIndex: number): ParsedStringResult {
    let index = startIndex;
    while (index < input.length && input[index] !== ',' && input[index] !== '}' && input[index] !== ']') {
        index += 1;
    }

    return {
        value: input.slice(startIndex, index).trim(),
        nextIndex: index,
    };
}

function parseVisualCardObjectLike(
    input: string,
    startIndex: number,
): { card: VisualCardInput; nextIndex: number } | null {
    if (input[startIndex] !== '{') {
        return null;
    }

    const card: VisualCardInput = {};
    let index = startIndex + 1;

    while (index < input.length) {
        index = skipWhitespace(input, index);

        if (input[index] === '}') {
            return { card, nextIndex: index + 1 };
        }

        const keyResult = readQuotedString(input, index);
        if (!keyResult) {
            return null;
        }

        const key = keyResult.value.trim();
        index = skipWhitespace(input, keyResult.nextIndex);

        if (input[index] !== ':') {
            return null;
        }

        index = skipWhitespace(input, index + 1);
        const valueResult = isQuoteChar(input[index]) ? readQuotedString(input, index) : readUnquotedValue(input, index);
        if (!valueResult) {
            return null;
        }

        if (key === 'name' || key === 'img_code' || key === 'back_img_code' || key === 'back_text') {
            card[key] = valueResult.value;
        }

        index = skipWhitespace(input, valueResult.nextIndex);

        if (input[index] === ',') {
            index += 1;
            continue;
        }

        if (input[index] === '}') {
            return { card, nextIndex: index + 1 };
        }
    }

    return null;
}

function parseVisualCardsLenient(jsonLike: string): VisualCard[] {
    const normalized = normalizeVisualCardsStructure(jsonLike);
    if (!normalized) {
        return [];
    }

    const cards: VisualCardInput[] = [];
    let index = skipWhitespace(normalized, 0);

    if (normalized[index] === '[') {
        index += 1;
    } else if (normalized[index] !== '{') {
        return [];
    }

    while (index < normalized.length) {
        index = skipWhitespace(normalized, index);

        if (normalized[index] === ']') {
            break;
        }

        if (normalized[index] === ',') {
            index += 1;
            continue;
        }

        if (normalized[index] !== '{') {
            index += 1;
            continue;
        }

        const parsedCard = parseVisualCardObjectLike(normalized, index);
        if (!parsedCard) {
            return [];
        }

        cards.push(parsedCard.card);
        index = parsedCard.nextIndex;
    }

    return normalizeVisualCards(cards);
}

function parseVisualCards(content: string): VisualCard[] {
    try {
        const match = content.match(VISUAL_CARDS_TAG_REGEX);
        if (!match) return [];

        const jsonStr = stripMarkdownCodeFence(match[1]);
        if (!jsonStr) return [];

        const parsed = JSON.parse(jsonStr) as unknown;
        if (Array.isArray(parsed)) {
            return normalizeVisualCards(parsed as VisualCardInput[]);
        }

        console.warn('[图鉴] visual_cards 不是标准数组，尝试宽容解析');
        return parseVisualCardsLenient(jsonStr);
    } catch (e) {
        const match = content.match(VISUAL_CARDS_TAG_REGEX);
        const jsonStr = match ? stripMarkdownCodeFence(match[1]) : '';
        const lenientCards = parseVisualCardsLenient(jsonStr);

        if (lenientCards.length > 0) {
            console.info('[图鉴] 已通过宽容模式解析 visual_cards', lenientCards.length, '张');
            return lenientCards;
        }

        console.error('[图鉴] 解析 visual_cards 失败', e, jsonStr.slice(0, 200));
        return [];
    }
}

function convertToGalleryCards(
    visualCards: VisualCard[],
    customPortraits: Record<string, CustomPortraitOverride> = {},
): GalleryCard[] {
    resetDualSoulSession();
    const result: GalleryCard[] = [];

    for (const card of visualCards) {
        const images = getCharacterImages(card.name, card.img_code, card.back_img_code);
        if (images === null) {
            console.info(`[图鉴] 跳过重复的 ${card.name} 卡片`);
            continue;
        }

        const portraitOverride = customPortraits[card.name];
        const front = String(portraitOverride?.front ?? '').trim() || images.front;
        const back = String(portraitOverride?.back ?? '').trim() || String(portraitOverride?.front ?? '').trim() || images.back;
        const frontCandidates = portraitOverride
            ? [front]
            : createCandidateList(front, getCharacterImageCandidates(card.name, 'front', images.frontName));
        const backCandidates = portraitOverride
            ? [back]
            : createCandidateList(back, getCharacterImageCandidates(card.name, 'back', images.backName));

        result.push({
            name: card.name,
            front,
            back,
            frontCandidates,
            backCandidates,
            backText: card.back_text || '',
            isFlipped: false,
            frontName: images.frontName,
            backName: images.backName,
        });
    }

    return result;
}

function createCandidateList(selectedImage: string, candidates: readonly string[]): string[] {
    const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
    if (!uniqueCandidates.includes(selectedImage)) {
        uniqueCandidates.unshift(selectedImage);
    }
    return uniqueCandidates;
}

export function extractGalleryCardsFromContent(
    content: string,
    customPortraits: Record<string, CustomPortraitOverride> = {},
): GalleryCard[] {
    const visualCards = parseVisualCards(content);
    if (visualCards.length === 0) return [];
    return convertToGalleryCards(visualCards, customPortraits);
}

export function preloadGalleryCardImages(cards: GalleryCard[]): void {
    const preloadUrls = new Set<string>();

    cards.forEach(card => {
        collectNearbyImages(card.frontCandidates, card.front).forEach(url => preloadUrls.add(url));
        collectNearbyImages(card.backCandidates, card.back).forEach(url => preloadUrls.add(url));
    });

    preloadUrls.forEach(url => void preloadGalleryImage(url));
    console.info('[图鉴] 开始预加载', preloadUrls.size, '张当前及相邻图片');
}

export function preloadGalleryImage(url: string): Promise<void> {
    const cachedPromise = imagePreloadCache.get(url);
    if (cachedPromise) return cachedPromise;

    const preloadPromise = new Promise<void>(resolve => {
        const image = new Image();
        image.onload = () => {
            if (typeof image.decode === 'function') {
                image.decode().catch(() => undefined).finally(() => resolve());
                return;
            }
            resolve();
        };
        image.onerror = () => resolve();
        image.src = url;
    });

    imagePreloadCache.set(url, preloadPromise);
    return preloadPromise;
}

function collectNearbyImages(candidates: string[], currentImage: string): string[] {
    if (candidates.length <= 1) return [currentImage];

    const currentIndex = Math.max(0, candidates.indexOf(currentImage));
    return [
        currentImage,
        candidates[(currentIndex - 1 + candidates.length) % candidates.length],
        candidates[(currentIndex + 1) % candidates.length],
    ];
}
