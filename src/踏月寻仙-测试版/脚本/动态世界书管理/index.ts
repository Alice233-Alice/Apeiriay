// ============================================================================
// 动态世界书管理脚本 - 根据上下文智能启用/禁用世界书条目
// 版本: 1.2
// 功能：根据当前区域、境界、人物等上下文自动启用/禁用世界书条目，节省 token
// ============================================================================

const VERSION = '1.2';

import { Schema } from '../../schema';
import { inferLayerFromTrack, normalizeRegionName } from '../../region-utils';

// ============================================================================
// 配置项
// ============================================================================

const CONFIG = {
    // 要管理的世界书名称（修改为你的世界书名）
    WORLDBOOK_NAME: 'current',  // 'current' 表示当前角色卡的主世界书

    // 是否启用调试日志
    DEBUG: true,

    // 上下文窗口（检查最近几条消息）
    CONTEXT_WINDOW: 5,
};

// ============================================================================
// 规则定义 - 根据你的角色卡自定义这些规则
// ============================================================================

interface WorldbookRule {
    /** 条目名称匹配模式 */
    entryPattern: string | RegExp;
    /** 启用条件（context: 上下文, entryName: 条目名称） */
    shouldEnable: (context: Context, entryName?: string) => boolean;
    /** 优先级（数字越大越优先，默认 0） */
    priority?: number;
}

interface Context {
    /** 当前所在区域 */
    currentRegion: string;
    /** 所属层级 */
    currentLayer: string;
    /** 环境描述 */
    environmentDesc: string;
    /** 最近消息内容 */
    recentMessages: string[];
    /** MVU 变量数据 */
    mvuData: ReturnType<typeof Schema.parse> | null;
    /** 当前聊天 ID */
    chatId: string;
}

// ============================================================================
// 角色别名配置 - 用于处理一个角色的多个名称
// ============================================================================

const CHARACTER_ALIASES: Record<string, string[]> = {
    '虞汐颜': ['虞汐', '虞颜'],
    '朔璃鸢': ['阿鸢', '血手飞鸢'],
    '朔望舒': ['赤月女帝', '幽影宗主'],
    // 可以在这里添加更多角色的别名，例如：
    // '某某': ['别名1', '别名2'],
};

// ============================================================================
// 好感度阶段映射 - 定义阶段名称对应的好感度范围
// ============================================================================

const FAVOR_STAGES: Record<string, [number, number]> = {
    '陌生期': [-200, 40],
    '疏离期': [-200, 40],
    '好感期': [41, 80],
    '留意期': [41, 80],
    '心动期': [81, 120],
    '确认期': [121, 160],
    '情定期': [121, 160],
    '深爱期': [161, 200],
};

function normalizeFavorStageLabel(stageLabel: string | undefined): string | null {
    const normalized = String(stageLabel || '').trim();
    if (!normalized) return null;

    for (const stageName of Object.keys(FAVOR_STAGES)) {
        if (normalized.includes(stageName)) {
            return stageName;
        }
    }

    return null;
}

type SectDomain = {
    name: string;
    aliases: string[];
};

type SectFaction = {
    name: string;
    domain: string;
    aliases: string[];
};

const SECT_DOMAINS: SectDomain[] = [
    { name: '神州', aliases: ['神州', '中州', '皇城', '问道峰', '剑门关', '龙门瀑布'] },
    { name: '东苍', aliases: ['东苍', '建木', '青帝陵', '百花秘境', '龙眠海'] },
    { name: '南炎', aliases: ['南炎', '无尽炎渊', '不灭火山', '地火窟', '涅槃台'] },
    { name: '西庚', aliases: ['西庚', '万剑古冢', '庚金矿脉', '白虎天堑', '潮音海'] },
    { name: '北冥与幽界', aliases: ['北冥', '幽界', '黄泉', '归墟', '冥海', '忘川', '冥河', '海眼', '归墟之海'] },
];

const SECT_FACTIONS: SectFaction[] = [
    { name: '大夏仙朝', domain: '神州', aliases: ['大夏', '仙朝', '皇城', '朝廷'] },
    { name: '忘机剑庐', domain: '神州', aliases: ['剑庐', '问剑', '剑门', '古剑'] },
    { name: '太虚蜃楼', domain: '神州', aliases: ['蜃楼', '天机', '推演', '命盘'] },
    { name: '万象森罗坊', domain: '神州', aliases: ['森罗坊', '坊市', '黑市', '交易'] },
    { name: '苍木龙吟阁', domain: '东苍', aliases: ['龙吟阁', '建木', '青帝陵'] },
    { name: '灵枢百草谷', domain: '东苍', aliases: ['百草谷', '药谷', '灵圃', '丹房'] },
    { name: '浮云朝露阁', domain: '东苍', aliases: ['朝露阁', '浮岛', '歌宴', '雅集'] },
    { name: '劫灰神祠', domain: '南炎', aliases: ['神祠', '劫灰', '祭火', '焚身'] },
    { name: '渊火灵族', domain: '南炎', aliases: ['火灵', '岩浆', '炎灵', '熔岩'] },
    { name: '大冶天工炉', domain: '南炎', aliases: ['天工炉', '熔炉', '器坊', '铸器'] },
    { name: '太白杀生冢', domain: '西庚', aliases: ['杀生冢', '万剑古冢', '白虎', '杀伐'] },
    { name: '折戟沉沙谷', domain: '西庚', aliases: ['沉沙谷', '战阵', '军阵', '兵戈'] },
    { name: '藏锋敛锷山庄', domain: '西庚', aliases: ['山庄', '矿脉', '庚金', '铸锋'] },
    { name: '坐忘冥海阁', domain: '北冥与幽界', aliases: ['冥海阁', '海眼', '静海', '冰海'] },
    { name: '泣珠幻海庭', domain: '北冥与幽界', aliases: ['幻海庭', '鲛人', '泣珠', '旧梦'] },
    { name: '渡厄幽帆', domain: '北冥与幽界', aliases: ['幽帆', '渡口', '摆渡', '冥河'] },
    { name: '彼岸提灯人', domain: '北冥与幽界', aliases: ['提灯人', '彼岸', '引魂', '黄泉路'] },
    { name: '无间轮回道', domain: '北冥与幽界', aliases: ['无间', '轮回', '业火', '救赎'] },
    { name: '忘川风月楼', domain: '北冥与幽界', aliases: ['风月楼', '忘川', '销金窟', '孟婆汤'] },
    { name: '镜花水月庵', domain: '北冥与幽界', aliases: ['镜花', '水月庵', '采补', '鼎炉'] },
    { name: '尸骨浮屠塔', domain: '北冥与幽界', aliases: ['浮屠塔', '尸骨', '炼尸', '换骨'] },
    { name: '蚀月血海宗', domain: '北冥与幽界', aliases: ['血海宗', '蚀月', '化血', '吞噬'] },
];

const DEFAULT_SECT_FACTION_BY_DOMAIN: Record<string, string> = {
    神州: '忘机剑庐',
    东苍: '苍木龙吟阁',
    南炎: '大冶天工炉',
    西庚: '太白杀生冢',
    '北冥与幽界': '渡厄幽帆',
};

type SectPromptState = {
    domainName: string;
    factionName: string;
};

function matchSectDomainByText(text: string): SectDomain | null {
    if (!text) return null;
    return SECT_DOMAINS.find(domain => [domain.name, ...domain.aliases].some(alias => text.includes(alias))) || null;
}

function matchSectFactionByText(text: string): SectFaction | null {
    if (!text) return null;
    return SECT_FACTIONS.find(faction => [faction.name, ...faction.aliases].some(alias => text.includes(alias))) || null;
}

function getSectMatchTexts(ctx: Context): string[] {
    const inferredLayer = inferLayerFromTrack(
        ctx.currentRegion,
        ctx.currentLayer,
        ctx.environmentDesc,
        ctx.mvuData?.地点库 as Record<string, { 域?: string }> | undefined,
        ctx.mvuData?.世界地图 as Record<string, { layer?: string }> | undefined,
    );
    const normalizedRegion = normalizeRegionName(ctx.currentRegion);
    const identityFaction = String(ctx.mvuData?.本尊?.身份?.宗门 || '').trim();
    const identityOrigin = String(ctx.mvuData?.本尊?.身份?.出身 || '').trim();
    const navigationInfo = String(ctx.mvuData?.本尊?.行踪?.导航信息 || '').trim();
    const currentSituation = String(ctx.mvuData?.当前处境 || '').trim();
    const locationLib = ctx.mvuData?.地点库 as Record<string, {
        域?: string;
        类?: string;
        特?: string;
        资?: string[];
    }> | undefined;
    const worldMap = ctx.mvuData?.世界地图 as Record<string, {
        layer?: string;
        desc?: string;
        connections?: string[];
    }> | undefined;

    const regionParts = String(ctx.currentRegion || '')
        .split(/[·•\-—_：:／/|]/)
        .map(part => part.trim())
        .filter(Boolean);

    const regionCandidates = Array.from(new Set([
        ctx.currentRegion,
        normalizedRegion,
        ...regionParts,
    ].filter(Boolean)));

    const locationTexts: string[] = [];
    const visitedPlaces = new Set<string>();
    const appendLocationContext = (placeName: string) => {
        if (!placeName || visitedPlaces.has(placeName)) return;
        visitedPlaces.add(placeName);

        const location = locationLib?.[placeName];
        if (location) {
            locationTexts.push(location.域 || '', location.类 || '', location.特 || '', ...(location.资 || []));
            if (location.域 && location.域 !== placeName) {
                appendLocationContext(location.域);
            }
        }

        const mapNode = worldMap?.[placeName];
        if (mapNode) {
            locationTexts.push(mapNode.layer || '', mapNode.desc || '', ...(mapNode.connections || []));
        }
    };

    regionCandidates.forEach(appendLocationContext);

    return [
        identityFaction,
        identityOrigin,
        currentSituation,
        navigationInfo,
        ctx.currentRegion,
        normalizedRegion,
        ctx.currentLayer,
        ctx.environmentDesc,
        inferredLayer,
        ...regionParts,
        ...locationTexts,
        ...ctx.recentMessages,
    ].filter(Boolean);
}

function getCurrentSectDomain(ctx: Context): SectDomain | null {
    const texts = getSectMatchTexts(ctx);
    for (const text of texts) {
        const domain = matchSectDomainByText(text);
        if (domain) return domain;
    }

    const faction = texts.map(matchSectFactionByText).find(Boolean) || null;
    if (faction) {
        return SECT_DOMAINS.find(domain => domain.name === faction.domain) || null;
    }

    return null;
}

function getCurrentSectFaction(ctx: Context, domain: SectDomain | null): SectFaction | null {
    const texts = getSectMatchTexts(ctx);
    for (const text of texts) {
        const faction = matchSectFactionByText(text);
        if (faction) return faction;
    }

    if (!domain) return null;

    const defaultFactionName = DEFAULT_SECT_FACTION_BY_DOMAIN[domain.name];
    return SECT_FACTIONS.find(faction => faction.name === defaultFactionName) || null;
}

function deriveSectPromptState(ctx: Context): SectPromptState {
    const domain = getCurrentSectDomain(ctx);
    const faction = getCurrentSectFaction(ctx, domain);
    return {
        domainName: domain?.name || '',
        factionName: faction?.name || '',
    };
}

function syncSectPromptState(ctx: Context): SectPromptState {
    const sectState = deriveSectPromptState(ctx);
    const variableOption = { type: 'message' as const, message_id: -1 };
    const variables = getVariables(variableOption);
    const currentDomain = String(_.get(variables, 'stat_data.$宗门推断.当前域', '') || '').trim();
    const currentFaction = String(_.get(variables, 'stat_data.$宗门推断.当前主势力', '') || '').trim();

    if (currentDomain !== sectState.domainName || currentFaction !== sectState.factionName) {
        _.set(variables, 'stat_data.$宗门推断.当前域', sectState.domainName);
        _.set(variables, 'stat_data.$宗门推断.当前主势力', sectState.factionName);
        replaceVariables(variables, variableOption);

        if (CONFIG.DEBUG) {
            console.log(`[动态世界书] 🧭 宗门推断已同步: 域="${sectState.domainName || '无'}", 主势力="${sectState.factionName || '无'}"`);
        }
    }

    return sectState;
}

function hasSectContext(ctx: Context): boolean {
    return getCurrentSectDomain(ctx) !== null;
}

/**
 * 根据角色名获取实际的好感度值
 * @param characterName 角色名（可能是主名或别名）
 * @param mvuData MVU 数据
 * @returns 好感度值，如果角色不在红颜列表中则返回 null
 */
function getCharacterFavor(characterName: string, mvuData: ReturnType<typeof Schema.parse> | null): number | null {
    if (!mvuData?.红颜) return null;

    // 1. 直接检查角色名
    if (mvuData.红颜[characterName] !== undefined) {
        return mvuData.红颜[characterName].好感度 ?? 0;
    }

    // 2. 检查是否是别名，找到主名称
    for (const [mainName, aliases] of Object.entries(CHARACTER_ALIASES)) {
        if (aliases.includes(characterName)) {
            if (mvuData.红颜[mainName] !== undefined) {
                return mvuData.红颜[mainName].好感度 ?? 0;
            }
        }
    }

    // 3. 反向检查：角色名是主名，看看别名是否在红颜列表中
    const aliases = CHARACTER_ALIASES[characterName];
    if (aliases) {
        for (const alias of aliases) {
            if (mvuData.红颜[alias] !== undefined) {
                return mvuData.红颜[alias].好感度 ?? 0;
            }
        }
    }

    return null;
}

/**
 * 检查角色是否在红颜列表中（包括别名检查）
 * @param characterName 角色名
 * @param mvuData MVU 数据
 * @returns 是否在红颜列表中
 */
function isInHongyanList(characterName: string, mvuData: ReturnType<typeof Schema.parse> | null): boolean {
    return getCharacterFavor(characterName, mvuData) !== null;
}

const RULES: WorldbookRule[] = [
    // ============================================================================
    // 系统设定 - 始终启用（蓝灯）
    // ============================================================================
    {
        entryPattern: /^\[系统\]/,
        shouldEnable: () => true,
        priority: 100,
    },
    {
        entryPattern: /^\[mvu_update\]/,
        shouldEnable: () => true,
        priority: 100,
    },
    {
        entryPattern: /^\[mvu\]变量列表$/,
        shouldEnable: () => true,
        priority: 100,
    },

    // ============================================================================
    // 宗门 ESJ - 由动态脚本主动调度
    // ============================================================================
    {
        entryPattern: /(?:宗门势力-低token底板|\[宗门\]\s*底板)/,
        shouldEnable: () => true,
        priority: 95,
    },
    {
        entryPattern: /(?:宗门势力-当前地域ESJ|\[宗门\]\s*当前地域)/,
        shouldEnable: ctx => {
            const domain = getCurrentSectDomain(ctx);
            if (CONFIG.DEBUG && domain) {
                console.log(`[动态世界书] ✅ 当前地域宗门: 命中域=${domain.name} (区域="${ctx.currentRegion}", 层级="${ctx.currentLayer}")`);
            }
            return domain !== null;
        },
        priority: 94,
    },
    {
        entryPattern: /(?:宗门势力-当前主势力ESJ|\[宗门\]\s*当前主势力)/,
        shouldEnable: ctx => {
            const hasContext = hasSectContext(ctx);
            if (CONFIG.DEBUG && hasContext) {
                console.log(`[动态世界书] ✅ 当前主势力宗门: 区域="${ctx.currentRegion}", 层级="${ctx.currentLayer}"`);
            }
            return hasContext;
        },
        priority: 93,
    },

    // ============================================================================
    // 地图相关 - 智能激活策略
    // ============================================================================

    // 天层区域 - 当在天层或最近提到天层时激活
    {
        entryPattern: /^\[地图\]\s*天层/,
        shouldEnable: ctx => {
            const layer = ctx.mvuData?.本尊?.行踪?.所属层级 || '';
            return (
                layer === '天层' ||
                ctx.recentMessages.some(msg =>
                    msg.includes('天渊') ||
                    msg.includes('罡风') ||
                    msg.includes('星辰')
                )
            );
        },
        priority: 10,
    },

    // 地层大陆 - 当在神州、北冥、南炎、西庚、东苍任一区域时激活
    {
        entryPattern: /^\[地图\]\s*地层/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            const validRegions = ['神州', '北冥', '南炎', '西庚', '东苍'];
            return (
                validRegions.includes(region) ||
                ctx.recentMessages.some(msg =>
                    validRegions.some(r => msg.includes(r))
                )
            );
        },
        priority: 10,
    },

    // 四海区域 - 当在海域或提到航海时激活
    {
        entryPattern: /^\[地图\]\s*四海/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            const seaRegions = ['潮音海', '龙眠海', '蓬莱幻海', '归墟之海'];
            return (
                seaRegions.includes(region) ||
                ctx.recentMessages.some(msg =>
                    msg.includes('海') ||
                    msg.includes('航') ||
                    msg.includes('船')
                )
            );
        },
        priority: 10,
    },

    // 下层禁地 - 当在下层或提到禁地时激活
    {
        entryPattern: /^\[地图\]\s*下层/,
        shouldEnable: ctx => {
            const layer = ctx.mvuData?.本尊?.行踪?.所属层级 || '';
            const region = ctx.currentRegion;
            const underworldRegions = ['归墟', '黄泉古迹', '无尽炎渊', '雷暴海'];
            return (
                layer === '下层' ||
                underworldRegions.includes(region) ||
                ctx.recentMessages.some(msg =>
                    msg.includes('归墟') ||
                    msg.includes('黄泉') ||
                    msg.includes('炎渊') ||
                    msg.includes('幽冥')
                )
            );
        },
        priority: 10,
    },

    // 具体区域条目 - 根据当前位置和周边区域智能激活
    {
        entryPattern: /^\[地图\]\s*神州$/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            // 在神州或相邻区域时激活
            const nearbyRegions = ['神州', '北冥', '南炎', '西庚', '东苍'];
            return nearbyRegions.includes(region);
        },
        priority: 8,
    },
    {
        entryPattern: /^\[地图\]\s*北冥$/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            return (
                region === '北冥' ||
                region === '神州' ||
                region === '玄冰山' ||
                ctx.recentMessages.some(msg => msg.includes('北冥') || msg.includes('玄武'))
            );
        },
        priority: 8,
    },
    {
        entryPattern: /^\[地图\]\s*南炎$/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            return (
                region === '南炎' ||
                region === '神州' ||
                region === '不灭火山' ||
                ctx.recentMessages.some(msg => msg.includes('南炎') || msg.includes('离火'))
            );
        },
        priority: 8,
    },
    {
        entryPattern: /^\[地图\]\s*西庚$/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            return (
                region === '西庚' ||
                region === '神州' ||
                region === '万剑冢' ||
                ctx.recentMessages.some(msg => msg.includes('西庚') || msg.includes('庚金'))
            );
        },
        priority: 8,
    },
    {
        entryPattern: /^\[地图\]\s*东苍$/,
        shouldEnable: ctx => {
            const region = ctx.currentRegion;
            return (
                region === '东苍' ||
                region === '神州' ||
                region === '建木森林' ||
                ctx.recentMessages.some(msg => msg.includes('东苍') || msg.includes('建木'))
            );
        },
        priority: 8,
    },

    // ============================================================================
    // 人物相关 - 只在提到时或在红颜列表中时启用
    // ============================================================================
    {
        entryPattern: /^\[角色\]\s*掌门/,
        shouldEnable: ctx => {
            // 当前在宗门且最近消息提到掌门时启用
            const currentRegion = ctx.mvuData?.本尊?.行踪?.当前区域 || '';
            const sectNames = ['万法宗', '剑阁', '药王谷', '金刚寺', '青龙殿', '玄武宗', '建木宗', '百花谷'];
            return (
                sectNames.some(sect => currentRegion.includes(sect)) &&
                ctx.recentMessages.some(msg => msg.includes('掌门'))
            );
        },
        priority: 5,
    },

    // 红颜角色 - 通用规则（匹配所有 [角色] 开头的条目）
    {
        entryPattern: /^\[角色\]\s*(.+)$/,
        shouldEnable: (ctx, entryName) => {
            if (!entryName) return false;

            // 提取角色名和可能的阶段后缀
            const stagePattern = /^\[角色\]\s*(.+?)(?:\s*-\s*(.+))?$/;
            const match = entryName.match(stagePattern);
            if (!match) return false;

            const characterName = match[1].trim();
            const rawStageName = match[2]?.trim(); // 可能为 undefined（非转阶段人设条目）
            const stageName = normalizeFavorStageLabel(rawStageName);

            // 检查是否在红颜列表或红颜角色库中
            const inHongyan = isInHongyanList(characterName, ctx.mvuData);
            const inHongyanLibrary = ctx.mvuData?.红颜角色库?.[characterName] !== undefined;

            // === 转阶段人设逻辑 ===
            if (rawStageName) {
                // 这是一个转阶段人设条目（如 [角色] 虞汐颜 - 好感期）
                
                if (!inHongyan) {
                    // 角色不在红颜列表中，不启用任何阶段
                    if (CONFIG.DEBUG) {
                        console.log(`[动态世界书] ❌ 转阶段人设跳过（角色不在红颜列表）: ${characterName} - ${rawStageName}`);
                    }
                    return false;
                }

                // 获取角色的实际好感度
                const favor = getCharacterFavor(characterName, ctx.mvuData);
                if (favor === null) {
                    if (CONFIG.DEBUG) {
                        console.log(`[动态世界书] ⚠️ 转阶段人设跳过（无法获取好感度）: ${characterName} - ${rawStageName}`);
                    }
                    return false;
                }

                // 检查好感度是否在该阶段的范围内
                if (!stageName) {
                    if (CONFIG.DEBUG) {
                        console.log(`[动态世界书] ⚠️ 未识别阶段标签: ${characterName} - ${rawStageName}`);
                    }
                    return false;
                }

                const stageRange = FAVOR_STAGES[stageName];
                if (!stageRange) {
                    if (CONFIG.DEBUG) {
                        console.log(`[动态世界书] ⚠️ 未知阶段: ${rawStageName}`);
                    }
                    return false;
                }

                const [minFavor, maxFavor] = stageRange;
                const inRange = favor >= minFavor && favor <= maxFavor;

                if (CONFIG.DEBUG) {
                    console.log(
                        `[动态世界书] ${inRange ? '✅' : '❌'} 转阶段人设: ${characterName} - ${rawStageName} (好感度=${favor}, 范围=[${minFavor},${maxFavor}])`
                    );
                }

                return inRange;
            }

            // === 非转阶段人设逻辑（普通角色条目）===
            
            // 如果在红颜列表中，直接启用
            if (inHongyan) {
                if (CONFIG.DEBUG) {
                    console.log(`[动态世界书] ✅ 红颜角色直接启用: ${characterName}`);
                }
                return true;
            }

            // 检查最近消息是否提到该角色（使用更精确的匹配）
            const escaped = characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const nameRegex = new RegExp(
                `(?:^|[^\\p{Script=Han}\\w])(${escaped})(?:[^\\p{Script=Han}\\w]|$)`,
                'u'
            );
            const mentionedRecently = ctx.recentMessages.some(msg => nameRegex.test(msg));

            if (CONFIG.DEBUG && (inHongyanLibrary || mentionedRecently)) {
                console.log(`[动态世界书] 角色检测: ${characterName}, 在库=${inHongyanLibrary}, 提及=${mentionedRecently}`);
            }

            // 在红颜角色库中或最近提到都启用
            return inHongyanLibrary || mentionedRecently;
        },
        priority: 6,
    },

    // ============================================================================
    // 境界相关 - 根据当前境界启用
    // ============================================================================
    {
        entryPattern: /^\[境界\]\s*练气/,
        shouldEnable: ctx => {
            const level = ctx.mvuData?.本尊?.等级 ?? 1;
            return level >= 1 && level <= 4;
        },
        priority: 7,
    },
    {
        entryPattern: /^\[境界\]\s*筑基/,
        shouldEnable: ctx => {
            const level = ctx.mvuData?.本尊?.等级 ?? 1;
            return level >= 5 && level <= 8;
        },
        priority: 7,
    },
    {
        entryPattern: /^\[境界\]\s*金丹/,
        shouldEnable: ctx => {
            const level = ctx.mvuData?.本尊?.等级 ?? 1;
            return level >= 9 && level <= 12;
        },
        priority: 7,
    },

    // ============================================================================
    // 事件相关 - 只在最近消息提到时启用
    // ============================================================================
    {
        entryPattern: /^\[事件\]/,
        shouldEnable: ctx => {
            // 提取事件名（假设格式为 [事件] 事件名）
            return ctx.recentMessages.join(' ').length > 0;
        },
        priority: 3,
    },
];

// ============================================================================
// 核心逻辑
// ============================================================================

let isProcessing = false;

async function getContext(): Promise<Context> {
    // 等待 MVU 初始化
    await waitGlobalInitialized('Mvu');

    // 获取最近的消息（简化逻辑）
    let recentMessages: string[];
    try {
        const messages = getChatMessages(-CONFIG.CONTEXT_WINDOW);
        recentMessages = messages.map(m => m.message || '');
    } catch (e) {
        if (CONFIG.DEBUG) {
            console.warn('[动态世界书] 获取消息失败', e);
        }
        recentMessages = [];
    }

    // 获取 MVU 数据
    let mvuData: ReturnType<typeof Schema.parse> | null = null;
    try {
        const variables = getVariables({ type: 'message', message_id: -1 });
        const statData = _.get(variables, 'stat_data', null);
        if (statData) {
            mvuData = Schema.parse(statData);
        }
    } catch (e) {
        if (CONFIG.DEBUG) {
            console.warn('[动态世界书] 无法获取 MVU 数据', e);
        }
    }

    const currentRegion = mvuData?.本尊?.行踪?.当前区域 ?? '未知';
    const currentLayer = mvuData?.本尊?.行踪?.所属层级 ?? '';
    const environmentDesc = mvuData?.本尊?.行踪?.环境描述 ?? '';
    const chatId = SillyTavern.getCurrentChatId();

    return {
        currentRegion,
        currentLayer,
        environmentDesc,
        recentMessages,
        mvuData,
        chatId,
    };
}

async function updateWorldbookEntries() {
    if (isProcessing) {
        if (CONFIG.DEBUG) {
            console.log('[动态世界书] 已有更新在进行中，跳过本次更新');
        }
        return;
    }
    isProcessing = true;

    try {
        const context = await getContext();
        const sectPromptState = syncSectPromptState(context);

        if (CONFIG.DEBUG) {
            console.log(`[动态世界书] 开始更新世界书条目`);
            console.log(`[动态世界书] 当前上下文: 区域="${context.currentRegion}", 层级="${context.currentLayer}", 聊天ID="${context.chatId}"`);
            console.log(`[动态世界书] 当前宗门推断: 域="${sectPromptState.domainName || '无'}", 主势力="${sectPromptState.factionName || '无'}"`);
            console.log(`[动态世界书] 红颜列表: ${Object.keys(context.mvuData?.红颜 || {}).join(', ') || '无'}`);
        }

        // 获取世界书名称
        let worldbookName = CONFIG.WORLDBOOK_NAME;
        if (worldbookName === 'current') {
            const charWorldbooks = getCharWorldbookNames('current');
            worldbookName = charWorldbooks.primary || '';
            if (!worldbookName) {
                console.warn('[动态世界书] 当前角色卡没有绑定主世界书');
                return;
            }
        }

        if (CONFIG.DEBUG) {
            console.log(`[动态世界书] 管理世界书: ${worldbookName}`);
        }

        let enabledCount = 0;
        let disabledCount = 0;
        let unchangedCount = 0;

        // 按优先级排序规则
        const sortedRules = [...RULES].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

        // 使用 updateWorldbookWith 更新世界书
        await updateWorldbookWith(worldbookName, worldbook => {
            if (CONFIG.DEBUG) {
                console.log(`[动态世界书] 世界书共有 ${worldbook.length} 个条目`);
            }

            for (const entry of worldbook) {
                const entryName = entry.name || '';

                // 跳过未启用的条目
                if (!entry.enabled) {
                    continue;
                }

                let matchedRule: WorldbookRule | null = null;

                // 查找匹配的规则
                for (const rule of sortedRules) {
                    const matches =
                        typeof rule.entryPattern === 'string'
                            ? entryName.includes(rule.entryPattern)
                            : rule.entryPattern.test(entryName);

                    if (matches) {
                        matchedRule = rule;
                        break; // 找到第一个匹配的规则就停止
                    }
                }

                // 如果没有匹配的规则，保持原状不变
                if (!matchedRule) {
                    if (CONFIG.DEBUG && entry.strategy.type === 'constant') {
                        console.log(`[动态世界书] ⏭️ 跳过（无规则匹配）: ${entryName}`);
                    }
                    continue;
                }

                const shouldBeConstant = matchedRule.shouldEnable(context, entryName);
                const currentType = entry.strategy.type;

                // 只在需要改变时才修改
                if (shouldBeConstant && currentType !== 'constant') {
                    entry.strategy.type = 'constant';
                    enabledCount++;
                    if (CONFIG.DEBUG) {
                        console.log(`[动态世界书] ✅ 绿→蓝: ${entryName}`);
                    }
                } else if (!shouldBeConstant && currentType === 'constant') {
                    entry.strategy.type = 'selective';
                    disabledCount++;
                    if (CONFIG.DEBUG) {
                        console.log(`[动态世界书] ⚠️ 蓝→绿: ${entryName}`);
                    }
                } else {
                    unchangedCount++;
                    if (CONFIG.DEBUG && currentType === 'constant') {
                        console.log(`[动态世界书] ✔️ 保持蓝: ${entryName}`);
                    }
                }
            }

            return worldbook;
        });

        if (enabledCount > 0 || disabledCount > 0) {
            const message = `启用 ${enabledCount} 个, 禁用 ${disabledCount} 个, 未变 ${unchangedCount} 个`;
            console.info(`[动态世界书] ${message}`);
            if (CONFIG.DEBUG) {
                toastr.info(message, '动态世界书');
            }
        } else if (CONFIG.DEBUG) {
            console.log(`[动态世界书] 本次无需更新 (未变 ${unchangedCount} 个)`);
        }
    } catch (e) {
        console.error('[动态世界书] 更新失败', e);
        if (CONFIG.DEBUG) {
            toastr.error(`更新失败: ${e instanceof Error ? e.message : '未知错误'}`, '动态世界书');
        }
    } finally {
        isProcessing = false;
    }
}

// ============================================================================
// 初始化
// ============================================================================

$(() => {
    errorCatched(async () => {
        console.info(`[动态世界书] 脚本已加载 (v${VERSION})`);

        // 等待 MVU 初始化
        await waitGlobalInitialized('Mvu');
        console.info('[动态世界书] MVU 框架已初始化');

        // 延迟初始检查，确保所有数据都已就绪
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (CONFIG.DEBUG) {
            console.log('[动态世界书] 执行初始检查...');
        }
        await updateWorldbookEntries();

        // 监听消息发送事件（用户输入前）
        eventOn(tavern_events.MESSAGE_SENT, async () => {
            if (CONFIG.DEBUG) {
                console.log('[动态世界书] 🟢 触发事件: MESSAGE_SENT (用户发送消息)');
            }
            await updateWorldbookEntries();
        });

        // 监听消息接收事件（AI 回复后）
        eventOn(tavern_events.MESSAGE_RECEIVED, async () => {
            if (CONFIG.DEBUG) {
                console.log('[动态世界书] 🔴 触发事件: MESSAGE_RECEIVED (收到AI回复)');
            }
            // 延迟一小段时间，确保消息完全接收
            await new Promise(resolve => setTimeout(resolve, 200));
            await updateWorldbookEntries();
        });

        // 监听聊天切换事件
        eventOn(tavern_events.CHAT_CHANGED, async () => {
            if (CONFIG.DEBUG) {
                console.log('[动态世界书] 🔄 触发事件: CHAT_CHANGED (切换聊天)');
            }
            // 延迟等待聊天加载完成
            await new Promise(resolve => setTimeout(resolve, 1500));
            await updateWorldbookEntries();
        });

        // 监听 MVU 变量更新（红颜列表变化时）
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async () => {
            if (CONFIG.DEBUG) {
                console.log('[动态世界书] 📊 触发事件: VARIABLE_UPDATE_ENDED (MVU变量更新)');
            }
            // 延迟100ms，避免在变量更新期间触发
            await new Promise(resolve => setTimeout(resolve, 100));
            await updateWorldbookEntries();
        });

        console.info(`[动态世界书] 监听器已设置，将自动管理世界书条目 (v${VERSION})`);
        toastr.success(`动态世界书管理已启用 (v${VERSION})`, '踏月寻仙');
    })();
});
