<template>
    <div class="gallery-container" :style="themeStyles" :class="frameClass">
        <!-- 四角装饰（仅在 corner 模式下显示） -->
        <template v-if="CURRENT_THEME.frame?.type === 'corner'">
            <div class="corner-bottom-left"></div>
            <div class="corner-bottom-right"></div>
        </template>
        <!-- 标题栏 -->
        <div class="gallery-header">
            <div class="header-title">
                <i class="fa-solid fa-images"></i>
                <span>角色图鉴</span>
            </div>
            <div class="header-info">
                <span v-if="currentCharacter" class="current-char">
                    <i class="fa-solid fa-user"></i>
                    {{ currentCharacter }}
                </span>
                <span class="card-count">{{ displayCards.length }} 张卡片</span>
            </div>
        </div>

        <!-- 角色筛选（如果有多个角色） -->
        <div v-if="allCharacters.length > 1" class="character-filter">
            <button :class="['filter-btn', { active: selectedCharacter === null }]" @click="selectedCharacter = null">
                全部
            </button>
            <button v-for="char in allCharacters" :key="char"
                :class="['filter-btn', { active: selectedCharacter === char }]" @click="selectedCharacter = char">
                {{ char }}
            </button>
        </div>

        <!-- 图片网格 -->
        <div class="gallery-grid">
            <div v-for="(card, index) in displayCards" :key="`${card.character}-${index}`" class="flip-card"
                :class="{ flipped: card.isFlipped }" @click="toggleFlip(card)">
                <div class="flip-card-inner">
                    <!-- 正面 -->
                    <div class="flip-card-front">
                        <img :src="card.front" :alt="card.name || card.character" loading="lazy" />
                        <div class="card-overlay">
                            <div v-if="card.name" class="card-name">{{ card.name }}</div>
                            <div class="card-character">{{ card.character }}</div>
                        </div>
                    </div>
                    <!-- 背面 -->
                    <div class="flip-card-back">
                        <img :src="card.back" :alt="`${card.name || card.character} 背面`" loading="lazy" />
                    </div>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-if="displayCards.length === 0" class="empty-state">
            <i class="fa-solid fa-image"></i>
            <p>暂无图片</p>
            <p class="hint">请在代码中配置 GALLERY_CONFIG 添加图片</p>
        </div>

        <!-- 提示 -->
        <div class="gallery-footer">
            <span>点击卡片可翻转查看背面</span>
        </div>
    </div>
</template>

<script setup lang="ts">
// ============================================================================
// 🎨 主题配置区域 - 在这里自定义界面风格
// ============================================================================
// 修改下面的颜色值可以轻松更换整个界面的配色方案
// 支持：HEX颜色(#ff0000)、RGB(rgb(255,0,0))、RGBA(rgba(255,0,0,0.5))
// ============================================================================

interface ThemeConfig {
    // 主色调
    primary: string; // 主题色（用于标题、高亮等）
    primaryLight: string; // 主题色浅色版
    primaryDark: string; // 主题色深色版

    // 背景色
    bgMain: string; // 主背景渐变起始色
    bgSecondary: string; // 主背景渐变结束色
    bgHeader: string; // 标题栏背景渐变

    // 边框和卡片
    borderColor: string; // 边框颜色
    cardBorder: string; // 卡片边框颜色
    cardShadow: string; // 卡片阴影颜色
    cardHoverShadow: string; // 卡片悬停阴影

    // 文字颜色
    textPrimary: string; // 主要文字
    textSecondary: string; // 次要文字
    textMuted: string; // 弱化文字

    // 🖼️ 装饰边框配置（可选）
    frame?: FrameConfig;
}

// ============================================================================
// 🖼️ 装饰边框配置
// ============================================================================
// 支持多种边框样式：
// 1. 图片边框 - 使用 border-image 或四角装饰图
// 2. CSS 花纹 - 使用渐变或 SVG 图案
// 3. 发光效果 - 使用 box-shadow 实现
// ============================================================================

interface FrameConfig {
    // 边框类型: 'none' | 'image' | 'corner' | 'glow' | 'pattern'
    type: 'none' | 'image' | 'corner' | 'glow' | 'pattern';

    // 图片边框配置 (type: 'image')
    // 使用 CSS border-image，需要一张可拉伸的边框图片
    borderImage?: string; // 边框图片 URL
    borderImageSlice?: string; // 切片值，如 '30' 或 '30 fill'
    borderImageWidth?: string; // 边框宽度，如 '20px'

    // 四角装饰配置 (type: 'corner')
    // 在四个角落放置装饰图片
    cornerImage?: string; // 角落装饰图片 URL
    cornerSize?: string; // 角落图片尺寸，如 '40px'

    // 发光效果配置 (type: 'glow')
    glowColor?: string; // 发光颜色
    glowSize?: string; // 发光范围，如 '20px'
    glowAnimation?: boolean; // 是否启用呼吸动画

    // 图案边框配置 (type: 'pattern')
    patternSvg?: string; // SVG 图案（内联或 URL）
    patternColor?: string; // 图案颜色
}

// ============================================================================
// 🎨 预设主题 - 选择一个或自定义
// ============================================================================

// 深蓝主题（默认）- 带发光边框
const THEME_DEEP_BLUE: ThemeConfig = {
    primary: '#88aaff',
    primaryLight: 'rgba(100, 150, 200, 0.5)',
    primaryDark: 'rgba(60, 80, 120, 0.4)',
    bgMain: 'rgba(15, 20, 35, 0.95)',
    bgSecondary: 'rgba(10, 15, 30, 0.98)',
    bgHeader: 'linear-gradient(90deg, rgba(60, 80, 120, 0.4) 0%, rgba(100, 60, 120, 0.4) 100%)',
    borderColor: 'rgba(100, 150, 200, 0.2)',
    cardBorder: 'rgba(100, 150, 200, 0.3)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
    cardHoverShadow: 'rgba(100, 150, 255, 0.4)',
    textPrimary: '#e8f0ff',
    textSecondary: '#8090a0',
    textMuted: '#506070',
    // 发光边框效果
    frame: {
        type: 'glow',
        glowColor: '#4488ff',
        glowSize: '15px',
        glowAnimation: true,
    },
};

// 樱花粉主题 - 带图案边框
const THEME_SAKURA: ThemeConfig = {
    primary: '#ffaabb',
    primaryLight: 'rgba(255, 150, 180, 0.5)',
    primaryDark: 'rgba(180, 80, 120, 0.4)',
    bgMain: 'rgba(35, 20, 25, 0.95)',
    bgSecondary: 'rgba(25, 15, 20, 0.98)',
    bgHeader: 'linear-gradient(90deg, rgba(120, 60, 80, 0.4) 0%, rgba(150, 80, 100, 0.4) 100%)',
    borderColor: 'rgba(255, 150, 180, 0.2)',
    cardBorder: 'rgba(255, 150, 180, 0.3)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
    cardHoverShadow: 'rgba(255, 150, 200, 0.4)',
    textPrimary: '#fff0f5',
    textSecondary: '#c0a0a8',
    textMuted: '#806070',
    // 图案边框 - 使用 CSS 渐变模拟花纹
    frame: {
        type: 'pattern',
        patternColor: '#ffaabb',
    },
};

// 翡翠绿主题
const THEME_JADE: ThemeConfig = {
    primary: '#88ffaa',
    primaryLight: 'rgba(100, 200, 150, 0.5)',
    primaryDark: 'rgba(60, 120, 80, 0.4)',
    bgMain: 'rgba(15, 30, 20, 0.95)',
    bgSecondary: 'rgba(10, 25, 15, 0.98)',
    bgHeader: 'linear-gradient(90deg, rgba(60, 120, 80, 0.4) 0%, rgba(80, 150, 100, 0.4) 100%)',
    borderColor: 'rgba(100, 200, 150, 0.2)',
    cardBorder: 'rgba(100, 200, 150, 0.3)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
    cardHoverShadow: 'rgba(100, 255, 150, 0.4)',
    textPrimary: '#f0fff5',
    textSecondary: '#a0c0a8',
    textMuted: '#607068',
    // 无特殊边框
    frame: { type: 'none' },
};

// 紫金主题 - 带发光边框
const THEME_ROYAL: ThemeConfig = {
    primary: '#d4af37',
    primaryLight: 'rgba(200, 170, 100, 0.5)',
    primaryDark: 'rgba(120, 80, 60, 0.4)',
    bgMain: 'rgba(25, 15, 35, 0.95)',
    bgSecondary: 'rgba(20, 10, 30, 0.98)',
    bgHeader: 'linear-gradient(90deg, rgba(80, 60, 120, 0.4) 0%, rgba(120, 80, 100, 0.4) 100%)',
    borderColor: 'rgba(200, 170, 100, 0.2)',
    cardBorder: 'rgba(200, 170, 100, 0.3)',
    cardShadow: 'rgba(0, 0, 0, 0.5)',
    cardHoverShadow: 'rgba(200, 170, 100, 0.4)',
    textPrimary: '#fff8e8',
    textSecondary: '#c0b0a0',
    textMuted: '#706860',
    // 金色发光边框
    frame: {
        type: 'glow',
        glowColor: '#d4af37',
        glowSize: '12px',
        glowAnimation: true,
    },
};

// ============================================================================
// 🖼️ 图片边框主题示例 - 使用自定义边框图片
// ============================================================================
// 如果你有边框图片，可以这样配置：
// const THEME_CUSTOM_FRAME: ThemeConfig = {
//     ...THEME_DEEP_BLUE,
//     frame: {
//         type: 'image',
//         borderImage: 'https://your-image-host.com/frame.png',
//         borderImageSlice: '30 fill',
//         borderImageWidth: '30px',
//     },
// };

// ============================================================================
// 🖼️ 四角装饰主题示例 - 在四个角落添加装饰
// ============================================================================
// const THEME_CORNER_DECO: ThemeConfig = {
//     ...THEME_SAKURA,
//     frame: {
//         type: 'corner',
//         cornerImage: 'https://your-image-host.com/corner.png',
//         cornerSize: '50px',
//     },
// };

// ============================================================================
// 🎯 在这里选择当前使用的主题
// ============================================================================
// 可选: THEME_DEEP_BLUE | THEME_SAKURA | THEME_JADE | THEME_ROYAL
// 或者创建自己的主题对象
const CURRENT_THEME: ThemeConfig = THEME_SAKURA;

// ============================================================================
// 🖼️ 角色图鉴配置区域 - 在这里添加您的图片
// ============================================================================
// 配置说明：
// - character: 角色名称（用于分类和筛选，当该角色在场时才显示）
// - front: 正面图片 URL
// - back: 背面图片 URL
// - name: 可选的图片名称（显示在卡片底部）
// - alwaysShow: 设为 true 则始终显示，不受角色在场限制
// ============================================================================

interface GalleryCardConfig {
    character: string; // 角色名称
    front: string; // 正面图片URL
    back: string; // 背面图片URL
    name?: string; // 可选名称
    alwaysShow?: boolean; // 是否始终显示
}

const GALLERY_CONFIG: GalleryCardConfig[] = [
    // ============================================================================
    // 示例配置 - 请替换为您自己的图片
    // ============================================================================
    {
        character: '示例角色',
        front: 'https://files.catbox.moe/c1su29.jpg',
        back: 'https://files.catbox.moe/8doe0f.jpg',
        name: '神秘角色',
        alwaysShow: true, // 始终显示，用于演示
    },
    // ============================================================================
    // 添加更多图片示例：
    // ============================================================================
    // {
    //   character: '孟十七',  // 当孟十七在场时显示
    //   front: 'https://xxx.com/front.jpg',
    //   back: 'https://xxx.com/back.jpg',
    //   name: '红衣倩影',
    // },
    // {
    //   character: '白娅',
    //   front: 'https://xxx.com/front2.jpg',
    //   back: 'https://xxx.com/back2.jpg',
    //   name: '清冷少女',
    // },
];

// 将主题转换为 CSS 变量
const themeStyles = computed(() => {
    const frame = CURRENT_THEME.frame;
    const styles: Record<string, string> = {
        '--theme-primary': CURRENT_THEME.primary,
        '--theme-primary-light': CURRENT_THEME.primaryLight,
        '--theme-primary-dark': CURRENT_THEME.primaryDark,
        '--theme-bg-main': CURRENT_THEME.bgMain,
        '--theme-bg-secondary': CURRENT_THEME.bgSecondary,
        '--theme-bg-header': CURRENT_THEME.bgHeader,
        '--theme-border-color': CURRENT_THEME.borderColor,
        '--theme-card-border': CURRENT_THEME.cardBorder,
        '--theme-card-shadow': CURRENT_THEME.cardShadow,
        '--theme-card-hover-shadow': CURRENT_THEME.cardHoverShadow,
        '--theme-text-primary': CURRENT_THEME.textPrimary,
        '--theme-text-secondary': CURRENT_THEME.textSecondary,
        '--theme-text-muted': CURRENT_THEME.textMuted,
    };

    // 装饰边框相关变量
    if (frame) {
        styles['--frame-type'] = frame.type;
        if (frame.glowColor) styles['--frame-glow-color'] = frame.glowColor;
        if (frame.glowSize) styles['--frame-glow-size'] = frame.glowSize;
        if (frame.patternColor) styles['--frame-pattern-color'] = frame.patternColor;
        if (frame.borderImage) styles['--frame-border-image'] = `url(${frame.borderImage})`;
        if (frame.borderImageSlice) styles['--frame-border-slice'] = frame.borderImageSlice;
        if (frame.borderImageWidth) styles['--frame-border-width'] = frame.borderImageWidth;
        if (frame.cornerImage) styles['--frame-corner-image'] = `url(${frame.cornerImage})`;
        if (frame.cornerSize) styles['--frame-corner-size'] = frame.cornerSize;
    }

    return styles;
});

// 计算边框类名
const frameClass = computed(() => {
    const frame = CURRENT_THEME.frame;
    if (!frame || frame.type === 'none') return '';
    return `frame-${frame.type}${frame.glowAnimation ? ' frame-animated' : ''}`;
});

// ============================================================================
// 以下是逻辑代码，一般不需要修改
// ============================================================================

interface DisplayCard extends GalleryCardConfig {
    isFlipped: boolean;
}

// 当前角色卡名称
const currentCharacter = ref<string | null>(null);

// 用户选择的筛选角色
const selectedCharacter = ref<string | null>(null);

// 所有可用角色列表
const allCharacters = computed(() => {
    const chars = new Set<string>();
    GALLERY_CONFIG.forEach(c => chars.add(c.character));
    return Array.from(chars);
});

// 获取当前角色卡信息
const updateCurrentCharacter = () => {
    try {
        // 使用 SillyTavern.name2 获取当前角色卡名称
        const charName = SillyTavern.name2 || null;
        currentCharacter.value = charName;
    } catch {
        currentCharacter.value = null;
    }
};

// 初始化时获取角色信息
onMounted(() => {
    updateCurrentCharacter();

    // 监听角色切换事件
    eventOn(tavern_events.CHAT_CHANGED, () => {
        updateCurrentCharacter();
    });
});

// 显示的卡片列表（带翻转状态）
const displayCards = ref<DisplayCard[]>([]);

// 根据当前角色和筛选条件更新显示的卡片
const updateDisplayCards = () => {
    const cards: DisplayCard[] = [];

    GALLERY_CONFIG.forEach(config => {
        // 判断是否应该显示
        const shouldShow =
            config.alwaysShow || // 始终显示
            !currentCharacter.value || // 没有角色卡时全部显示
            config.character === currentCharacter.value; // 角色匹配

        // 应用用户筛选
        const matchesFilter = selectedCharacter.value === null || config.character === selectedCharacter.value;

        if (shouldShow && matchesFilter) {
            // 保留已有的翻转状态
            const existing = displayCards.value.find(
                c => c.character === config.character && c.front === config.front && c.back === config.back,
            );

            cards.push({
                ...config,
                isFlipped: existing?.isFlipped || false,
            });
        }
    });

    displayCards.value = cards;
};

// 监听变化
watch([currentCharacter, selectedCharacter], updateDisplayCards, { immediate: true });

// 翻转卡片
const toggleFlip = (card: DisplayCard) => {
    card.isFlipped = !card.isFlipped;
};
</script>

<style lang="scss" scoped>
.gallery-container {
    width: 100%;
    font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
    background: linear-gradient(180deg, var(--theme-bg-main) 0%, var(--theme-bg-secondary) 100%);
    border-radius: 12px;
    overflow: hidden;
    color: var(--theme-text-primary);
    position: relative;

    // ========================================================================
    // 🖼️ 发光边框效果
    // ========================================================================
    &.frame-glow {
        box-shadow:
            0 0 var(--frame-glow-size, 15px) var(--frame-glow-color, #4488ff),
            inset 0 0 calc(var(--frame-glow-size, 15px) / 2) rgba(255, 255, 255, 0.1);
        border: 2px solid var(--frame-glow-color, #4488ff);

        &.frame-animated {
            animation: glowPulse 3s ease-in-out infinite;
        }
    }

    // ========================================================================
    // 🖼️ 图案边框效果 - 使用 CSS 渐变模拟花纹
    // ========================================================================
    &.frame-pattern {
        border: 3px solid transparent;
        background-clip: padding-box;
        position: relative;

        &::before {
            content: '';
            position: absolute;
            top: -3px;
            left: -3px;
            right: -3px;
            bottom: -3px;
            border-radius: 14px;
            background: repeating-linear-gradient(45deg,
                    var(--frame-pattern-color, #ffaabb) 0px,
                    var(--frame-pattern-color, #ffaabb) 2px,
                    transparent 2px,
                    transparent 8px),
                repeating-linear-gradient(-45deg,
                    var(--frame-pattern-color, #ffaabb) 0px,
                    var(--frame-pattern-color, #ffaabb) 2px,
                    transparent 2px,
                    transparent 8px);
            opacity: 0.6;
            z-index: -1;
        }

        &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 12px;
            border: 2px solid var(--frame-pattern-color, #ffaabb);
            opacity: 0.8;
            pointer-events: none;
        }
    }

    // ========================================================================
    // 🖼️ 图片边框效果
    // ========================================================================
    &.frame-image {
        border: var(--frame-border-width, 20px) solid transparent;
        border-image: var(--frame-border-image) var(--frame-border-slice, 30) fill;
        border-image-repeat: stretch;
        border-radius: 0; // border-image 不支持圆角
    }

    // ========================================================================
    // 🖼️ 四角装饰效果
    // ========================================================================
    &.frame-corner {

        &::before,
        &::after {
            content: '';
            position: absolute;
            width: var(--frame-corner-size, 40px);
            height: var(--frame-corner-size, 40px);
            background-image: var(--frame-corner-image);
            background-size: contain;
            background-repeat: no-repeat;
            z-index: 10;
            pointer-events: none;
        }

        &::before {
            top: -5px;
            left: -5px;
        }

        &::after {
            top: -5px;
            right: -5px;
            transform: scaleX(-1);
        }

        // 使用额外元素实现底部两个角落
        .corner-bottom-left,
        .corner-bottom-right {
            position: absolute;
            width: var(--frame-corner-size, 40px);
            height: var(--frame-corner-size, 40px);
            background-image: var(--frame-corner-image);
            background-size: contain;
            background-repeat: no-repeat;
            z-index: 10;
            pointer-events: none;
        }

        .corner-bottom-left {
            bottom: -5px;
            left: -5px;
            transform: scaleY(-1);
        }

        .corner-bottom-right {
            bottom: -5px;
            right: -5px;
            transform: scale(-1, -1);
        }
    }
}

// 发光呼吸动画
@keyframes glowPulse {

    0%,
    100% {
        box-shadow:
            0 0 var(--frame-glow-size, 15px) var(--frame-glow-color, #4488ff),
            inset 0 0 calc(var(--frame-glow-size, 15px) / 2) rgba(255, 255, 255, 0.1);
    }

    50% {
        box-shadow:
            0 0 calc(var(--frame-glow-size, 15px) * 1.5) var(--frame-glow-color, #4488ff),
            0 0 calc(var(--frame-glow-size, 15px) * 2) var(--frame-glow-color, #4488ff),
            inset 0 0 var(--frame-glow-size, 15px) rgba(255, 255, 255, 0.15);
    }
}

// 标题栏
.gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--theme-bg-header);
    border-bottom: 1px solid var(--theme-border-color);

    .header-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 18px;
        font-weight: bold;
        color: var(--theme-text-primary);

        i {
            color: var(--theme-primary);
        }
    }

    .header-info {
        display: flex;
        align-items: center;
        gap: 16px;
        font-size: 13px;
        color: var(--theme-text-secondary);

        .current-char {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: var(--theme-primary-light);
            border-radius: 12px;

            i {
                color: var(--theme-primary);
            }
        }
    }
}

// 角色筛选
.character-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 20px;
    background: rgba(25, 30, 50, 0.5);
    border-bottom: 1px solid var(--theme-border-color);

    .filter-btn {
        padding: 6px 14px;
        background: rgba(50, 60, 80, 0.5);
        border: 1px solid var(--theme-border-color);
        border-radius: 16px;
        color: var(--theme-text-secondary);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
            background: var(--theme-primary-dark);
            color: var(--theme-text-primary);
        }

        &.active {
            background: var(--theme-primary-light);
            border-color: var(--theme-primary);
            color: var(--theme-text-primary);
        }
    }
}

// 图片网格 - 水平滚动布局
.gallery-grid {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center; // 当卡片少时居中显示
    gap: 20px;
    padding: 20px;
    min-height: 200px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;

    // 自定义滚动条样式
    &::-webkit-scrollbar {
        height: 8px;
    }

    &::-webkit-scrollbar-track {
        background: rgba(30, 40, 60, 0.5);
        border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
        background: rgba(100, 150, 200, 0.4);
        border-radius: 4px;

        &:hover {
            background: rgba(100, 150, 200, 0.6);
        }
    }
}

// 翻转卡片
// ============================================================================
// 🎨 卡片尺寸配置 - 修改这里的值可以调整卡片大小
// ============================================================================
.flip-card {
    flex-shrink: 0; // 防止卡片被压缩
    width: 320px; // 固定卡片宽度
    aspect-ratio: 2 / 3; // 使用宽高比代替固定高度，保持 2:3 比例
    perspective: 1000px;
    cursor: pointer;

    &:hover .flip-card-inner {
        box-shadow: 0 15px 40px var(--theme-card-hover-shadow);
        transform: scale(1.03);
    }
}

.flip-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s;
    transform-style: preserve-3d;
    border-radius: 14px;
    box-shadow: 0 8px 25px var(--theme-card-shadow);
}

.flip-card.flipped .flip-card-inner {
    transform: rotateY(180deg);
}

.flip-card-front,
.flip-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 14px;
    overflow: hidden;
    border: 2px solid var(--theme-card-border);

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s;
    }

    &:hover img {
        transform: scale(1.05);
    }
}

.flip-card-front {
    .card-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 16px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.5) 50%, transparent 100%);
    }

    .card-name {
        font-size: 16px;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
        margin-bottom: 4px;
    }

    .card-character {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
    }
}

.flip-card-back {
    transform: rotateY(180deg);
}

// 空状态
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--theme-text-muted);

    i {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    p {
        margin: 4px 0;
        font-size: 14px;
    }

    .hint {
        font-size: 12px;
        color: var(--theme-text-muted);
    }
}

// 底部提示
.gallery-footer {
    text-align: center;
    padding: 12px 20px;
    font-size: 12px;
    color: var(--theme-text-muted);
    background: var(--theme-bg-main);
    border-top: 1px solid var(--theme-border-color);
}
</style>