<template>
  <div class="cultivation-status" :class="{ collapsed: isCollapsed }" :style="themeStyles">
    <!-- 背景图案层 -->
    <div class="pattern-overlay"></div>

    <!-- 仙鹤装饰 - 顶部中央 -->
    <div class="crane-decoration">
      <img src="https://pub-4d14ab94aa29488b977bc5be9f2a06ef.r2.dev/picgo/仙鹤.png" alt="仙鹤" />
    </div>

    <!-- 头部区域 -->
    <HeaderSection
      :is-collapsed="isCollapsed"
      :parent-region="parentRegion"
      :danger-color="dangerColor"
      :location-color="locationColor"
      @toggle-collapse="toggleCollapse"
      @toggle-theme-selector="toggleThemeSelector"
      @toggle-preset-editor="activeTab = 'preset'"
      @open-map="openMapPanel"
    />

    <!-- 主题选择器弹窗 -->
    <ThemeSelector :visible="showThemeSelector" @close="showThemeSelector = false" @select="selectTheme" />

    <!-- 标签页导航 -->
    <TabNav v-model:active-tab="activeTab" :tabs="tabs" />

    <!-- 内容区域 -->
    <div class="content">
      <!-- 预设面板 -->
      <PresetPanel v-if="activeTab === 'preset'" />

      <!-- 修炼面板 -->
      <CultivationPanel v-else-if="activeTab === 'cultivation'" />

      <!-- 神通面板 -->
      <SkillsPanel v-else-if="activeTab === 'skills'" />

      <!-- 储物面板 -->
      <InventoryPanel v-else-if="activeTab === 'inventory'" />

      <!-- 红颜面板 -->
      <CompanionsPanel v-else-if="activeTab === 'companions'" />

      <!-- 行踪面板 -->
      <MapPanel v-else-if="activeTab === 'trace'" />

      <!-- 地图面板 (独立全屏) -->
      <div v-else-if="activeTab === 'map'" class="panel full-map-panel">
        <WorldMapCanvas
          :current-location="store.本尊.行踪.当前区域"
          :current-domain="parentRegion"
          :current-danger="store.本尊.行踪.危险度 ?? 10"
          :available-connections="store.本尊.行踪.可用通道 || []"
        />
      </div>

      <!-- 历劫面板 -->
      <div v-else-if="activeTab === 'tribulation'" class="panel tribulation-panel">
        <CombatPanel
          :combat-state="store.本尊.战斗状态"
          :current-enemies="store.本尊.当前敌人"
          :tribulation-state="store.本尊.渡劫状态"
          :player-combat-power="(store.本尊 as any).战力值 ?? 0"
        />
      </div>

      <!-- 图鉴面板 -->
      <GalleryPanel v-else-if="activeTab === 'gallery'" />

      <!-- 行动提示面板 -->
      <ActionMenuPanel v-else-if="activeTab === 'actions'" />
    </div>

    <!-- 底部区域 -->
    <FooterSection @open-actions="activeTab = 'actions'" />
  </div>
</template>

<script setup lang="ts">
// 组件导入
import ActionMenuPanel from './components/ActionMenuPanel.vue';
import CombatPanel from './components/CombatPanel.vue';
import CompanionsPanel from './components/CompanionsPanel.vue';
import CultivationPanel from './components/CultivationPanel.vue';
import FooterSection from './components/FooterSection.vue';
import GalleryPanel from './components/GalleryPanel.vue';
import HeaderSection from './components/HeaderSection.vue';
import InventoryPanel from './components/InventoryPanel.vue';
import MapPanel from './components/MapPanel.vue';
import PresetPanel from './components/PresetPanel.vue';
import SkillsPanel from './components/SkillsPanel.vue';
import TabNav from './components/TabNav.vue';
import ThemeSelector from './components/ThemeSelector.vue';
import WorldMapCanvas from './components/WorldMapCanvas.vue';
import { inferLayerFromTrack } from './region-utils';
import { getDangerColor } from './schema';
import { useDataStore, useThemeStore } from './store';

const store = useDataStore();
const themeStore = useThemeStore();

// 标签页配置
const tabs = [
  { id: 'cultivation', label: '修炼', icon: 'fa-solid fa-yin-yang' },
  { id: 'skills', label: '神通', icon: 'fa-solid fa-hand-sparkles' },
  { id: 'inventory', label: '储物', icon: 'fa-solid fa-box-open' },
  { id: 'companions', label: '红颜', icon: 'fa-solid fa-heart' },
  { id: 'trace', label: '行踪', icon: 'fa-solid fa-shoe-prints' },
  { id: 'map', label: '地图', icon: 'fa-solid fa-map-location-dot' },
  { id: 'tribulation', label: '历劫', icon: 'fa-solid fa-bolt' },
  { id: 'gallery', label: '图鉴', icon: 'fa-solid fa-images' },
];

const activeTab = ref('gallery'); // 初始显示图鉴
const isCollapsed = ref(false);
const showThemeSelector = ref(false);

// 切换折叠状态
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

// 切换主题选择器
const toggleThemeSelector = () => {
  showThemeSelector.value = !showThemeSelector.value;
};

const openMapPanel = () => {
  activeTab.value = 'map';
  isCollapsed.value = false;
};

// 选择主题
const selectTheme = (themeId: string) => {
  themeStore.setTheme(themeId);
  showThemeSelector.value = false;
};

// 应用主题的CSS变量
const themeStyles = computed(() => {
  const theme = themeStore.currentTheme;
  return {
    '--bg-primary': theme.colors.bgPrimary,
    '--bg-secondary': theme.colors.bgSecondary,
    '--border-color': theme.colors.border,
    '--border-active': theme.colors.borderActive,
    '--text-primary': theme.colors.textPrimary,
    '--text-secondary': theme.colors.textSecondary,
    '--text-accent': theme.colors.textAccent,
    '--accent-color': theme.colors.accent,
    '--accent-glow': theme.colors.accentGlow,
    '--button-bg': theme.colors.buttonBg,
    '--button-hover': theme.colors.buttonHover,
    '--button-active': theme.colors.buttonActive,
    '--progress-bg': theme.colors.progressBg,
    '--header-bg': theme.colors.headerBg,
    '--tab-bg': theme.colors.tabBg,
    '--tab-active': theme.colors.tabActive,
    '--footer-bg': theme.colors.footerBg,
    '--pattern-overlay': theme.patterns.overlay || 'none',
  };
});

// 计算属性
// 计算父级区域（上级地域）- 优先使用地点库/世界地图中的具体域名（东苍/南炎等），再回退到所属层级
const parentRegion = computed(() => {
  const currentRegionRaw = String(store.本尊.行踪.当前区域 || '').trim();
  const layerRaw = String(store.本尊.行踪.所属层级 || '').trim();
  return (
    inferLayerFromTrack(
      currentRegionRaw,
      layerRaw,
      String(store.本尊.行踪.环境描述 || ''),
      store.地点库 as Record<string, { 域?: string }>,
      store.世界地图 as Record<string, { layer?: string }>,
    ) || ''
  );
});

const dangerColor = computed(() => getDangerColor(store.本尊.行踪.危险度 ?? 10));
const locationColor = computed(() => {
  const domainColors: Record<string, string> = {
    天层: '#88ddff',
    天渊: '#88ddff',
    神州: '#ffdd44',
    东苍: '#44aa44',
    南炎: '#ff6644',
    西庚: '#cccccc',
    北冥: '#4488ff',
    四海: '#44cccc',
    下层: '#ff4444',
    归墟: '#9944cc',
    黄泉古迹: '#cc8844',
    无尽炎渊: '#ff3300',
    雷暴海: '#6644ff',
  };
  // 优先使用 parentRegion（已包含完整回退链）
  const region = parentRegion.value;
  if (region && domainColors[region]) {
    return domainColors[region];
  }
  return '#44aa44';
});
</script>

<style lang="scss" scoped>
.cultivation-status {
  width: 100%;
  margin: 0 auto;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  position: relative;

  // 背景图案层 - 优化祥云排布
  .pattern-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: var(--pattern-overlay);
    // 祥云图案尺寸和位置优化
    background-size:
      100px 65px,
      85px 55px,
      110px 70px,
      90px 60px,
      75px 50px;
    background-position:
      5% 15%,
      // 左上
      85% 25%,
      // 右上
      15% 65%,
      // 左下
      75% 70%,
      // 右下
      45% 85%; // 底部中央
    background-repeat: no-repeat;
    pointer-events: none;
    opacity: 0.25;
    z-index: 0;
  }

  // 仙鹤装饰 - 移到顶部中央
  .crane-decoration {
    position: absolute;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    width: 60px;
    height: 60px;
    z-index: 3;
    pointer-events: none;
    animation: crane-float 4s ease-in-out infinite;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 3px 12px rgba(0, 0, 0, 0.4));
    }
  }

  @keyframes crane-float {
    0%,
    100% {
      transform: translateX(-50%) translateY(0);
    }

    50% {
      transform: translateX(-50%) translateY(-8px);
    }
  }

  // 确保所有内容在图案层之上
  > * {
    position: relative;
    z-index: 1;
  }

  // 折叠状态
  &.collapsed {
    :deep(.tab-nav),
    .content {
      display: none;
    }

    :deep(.header) {
      border-bottom: none;
    }
  }
}

// 内容区域
.content {
  flex: 1;
  min-height: 280px;
  max-height: 600px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--button-bg);
    border-radius: 3px;

    &:hover {
      background: var(--button-hover);
    }
  }
}

.panel {
  padding: 16px;
}

.full-map-panel {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

// 手机端响应式适配
@media screen and (max-width: 480px) {
  .cultivation-status {
    font-size: 13px;
    border-radius: 8px;

    // 仙鹤装饰 - 手机端缩小
    .crane-decoration {
      width: 45px;
      height: 45px;
      top: 18px;
    }
  }

  // 内容区域适配
  .content {
    min-height: 220px;
    max-height: 450px;
  }

  .panel {
    padding: 12px;
  }
}

// 动画
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
