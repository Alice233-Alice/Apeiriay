<template>
  <div
    class="cultivation-status"
    :data-theme="themeStore.currentThemeId"
    :data-view="activeView"
    :class="{
      immersive: isImmersive,
      'mobile-layout': isMobileViewport,
      'map-expanded': activeView === 'map',
      'reduce-motion': themeStore.preferences.reduceMotion,
      'light-theme': themeStore.currentTheme.mode === 'light',
      'pseudo-stage-fit': isPseudoStage,
      'detached-status': isDetachedMode,
      'status-collapsed': isDetachedMode && isStatusCollapsed,
      'scroll-reading': readingMode === 'scroll',
    }"
    :style="themeStyles"
  >
    <div class="stage-backdrop"></div>
    <div class="pattern-overlay"></div>
    <div class="ambient-overlay"></div>
    <div class="frame-overlay"></div>

    <StageHeader
      :active-view="activeView"
      :immersive="isImmersive"
      :parent-region="parentRegion"
      :danger-color="dangerColor"
      :reading-mode="readingMode"
      :detached="isDetachedMode"
      :status-collapsed="isStatusCollapsed"
      @toggle-status="toggleStatusCollapsed"
      @open-map="openView('map')"
      @open-greeting-index="openGreetingIndex"
      @open-preset="openView('preset')"
      @open-settings="openReadingSettings"
      @open-editor="openCurrentEditor"
      @toggle-immersive="toggleImmersive"
      @set-reading-mode="setReadingMode"
    />

    <main v-if="!isDetachedMode || !isStatusCollapsed" class="stage-main">
      <div
        ref="modeViewport"
        class="stage-viewport"
        :class="{ 'reading-mode': readingViewActive }"
        @scroll="rememberScroll"
      >
        <TimelineReader
          v-if="!isDetachedMode && readingMode === 'scroll'"
          v-show="activeView === 'timeline'"
          :active="activeView === 'timeline'"
          :anchor-message-id="timelineAnchorMessageId"
          :initial-position="reloadedReading"
          :immersive="isImmersive"
          :mobile-layout="isMobileViewport"
          @active-entry="timelineActiveMessageId = $event"
          @edit-message="openTimelineEditor"
        />
        <PseudoStoryReader
          v-if="activeView === 'story'"
          :immersive="isImmersive"
          :mobile-layout="isMobileViewport"
          :initial-position="reloadedReading"
        />
        <PresetPanel v-else-if="activeView === 'preset'" />
        <CultivationPanel v-else-if="activeView === 'cultivation'" />
        <SkillsPanel v-else-if="activeView === 'skills'" />
        <InventoryPanel
          v-else-if="activeView === 'inventory'"
          :focus-name="itemFocus.name"
          :focus-nonce="itemFocus.nonce"
        />
        <CompanionsPanel
          v-else-if="activeView === 'companions'"
          :focus-name="personFocus.name"
          :focus-nonce="personFocus.nonce"
        />
        <AffairsPanel v-else-if="activeView === 'affairs'" :focus="affairsFocus" />
        <div v-else-if="activeView === 'tribulation'" class="panel tribulation-panel">
          <CombatPanel
            :combat-state="store.本尊.战斗状态"
            :current-enemies="store.本尊.当前敌人"
            :tribulation-state="store.本尊.渡劫状态"
            :player-level="store.本尊.等级"
          />
        </div>
        <GalleryPanel v-else-if="activeView === 'gallery'" />
        <div v-if="mapOpened" v-show="activeView === 'map'" class="panel full-map-panel">
          <WorldMapCanvas
            :active="activeView === 'map'"
            :current-location="store.本尊.行踪.当前区域"
            :current-domain="parentRegion"
            :current-layer="store.本尊.行踪.所属层级"
            :location-description="atlasLocationDescription"
            :current-danger="store.本尊.行踪.危险度 ?? 10"
            :available-connections="store.本尊.行踪.可用通道 || []"
            :focus-place="placeFocus.name"
            :focus-nonce="placeFocus.nonce"
            :focus-domain="focusedPlaceDomain"
            :focus-description="store.地点库[placeFocus.name]?.特 || ''"
          />
        </div>
      </div>
    </main>

    <div v-if="!isImmersive && (!isDetachedMode || !isStatusCollapsed)" class="stage-navigation">
      <TabNav v-model:active-tab="activeView" :tabs="tabs" />
    </div>
    <PseudoCommandDock
      v-if="!isDetachedMode"
      :active-view="activeView"
      :mobile-layout="isMobileViewport"
      :immersive="isImmersive"
      :reading-mode="readingMode"
      @open-view="openView"
    />
    <DialogueDrawer v-if="!isDetachedMode" />

    <ReadingSettingsPanel
      :visible="showReadingSettings"
      :viewport-mode="viewportMode"
      @close="showReadingSettings = false"
    />
    <GreetingIndexDialog :visible="showGreetingIndex" @close="showGreetingIndex = false" />
    <RawMessageEditor
      v-if="!isDetachedMode"
      :visible="showRawMessageEditor"
      :target-message-id="editorTarget?.messageId"
      :target-label="editorTarget?.label"
      @close="closeRawEditor"
    />
    <GalleryPreviewDialog v-if="!isDetachedMode || !isStatusCollapsed" />
  </div>
</template>

<script setup lang="ts">
import AffairsPanel from './components/AffairsPanel.vue';
import CombatPanel from './components/CombatPanel.vue';
import CompanionsPanel from './components/CompanionsPanel.vue';
import CultivationPanel from './components/CultivationPanel.vue';
import DialogueDrawer from './components/DialogueDrawer.vue';
import GalleryPanel from './components/GalleryPanel.vue';
import GalleryPreviewDialog from './components/GalleryPreviewDialog.vue';
import GreetingIndexDialog from './components/GreetingIndexDialog.vue';
import InventoryPanel from './components/InventoryPanel.vue';
import PresetPanel from './components/PresetPanel.vue';
import PseudoCommandDock from './components/PseudoCommandDock.vue';
import PseudoStoryReader from './components/PseudoStoryReader.vue';
import RawMessageEditor from './components/RawMessageEditor.vue';
import ReadingSettingsPanel from './components/ReadingSettingsPanel.vue';
import SkillsPanel from './components/SkillsPanel.vue';
import StageHeader from './components/StageHeader.vue';
import TabNav from './components/TabNav.vue';
import TimelineReader from './components/TimelineReader.vue';
import WorldMapCanvas from './components/WorldMapCanvas.vue';
import duskInkArt from './assets/dusk-ink-landscape.svg?url';
import lanternArt from './assets/lantern-water-town.svg?url';
import shanhaiArt from './assets/shanhai-scroll.svg?url';
import starAltarArt from './assets/star-altar-chart.svg?url';
import { resolveMapAnchor } from '../灯火阑珊/map-system';
import { createMovingPanelFit } from './moving-panel-fit';
import { scheduleAtlasPrefetch } from './atlas/assets';
import { resolveAtlasLocation } from './atlas/location';
import { loadReadingPosition, saveReadingPosition } from './reading-position';
import { inferLayerFromTrack } from './region-utils';
import { getDangerColor } from './schema';
import { useDataStore, usePseudoLayerStore, useThemeStore } from './store';
import type { ReadingMode } from './stores/theme-store';
import { readingViewForMode, type AffairsFocus } from './affairs';
import { useAffairsStore } from './stores/affairs-store';

export type StageView =
  | 'timeline'
  | 'story'
  | 'preset'
  | 'cultivation'
  | 'skills'
  | 'inventory'
  | 'companions'
  | 'trace'
  | 'map'
  | 'tribulation'
  | 'gallery'
  | 'actions'
  | 'affairs';

const store = useDataStore();
const pseudoLayerStore = usePseudoLayerStore();
const themeStore = useThemeStore();
const affairs = useAffairsStore();
const affairsFocus = ref<AffairsFocus | null>(null);
const personFocus = ref({ name: '', nonce: 0 });
const itemFocus = ref({ name: '', nonce: 0 });
const placeFocus = ref({ name: '', nonce: 0 });
const focusedPlaceDomain = computed(() => store.地点库[placeFocus.value.name]?.域 || parentRegion.value);
const MOBILE_BREAKPOINT = 760;
const IMMERSIVE_STORAGE_KEYS = {
  mobile: 'denghuolanshan:pseudo-layer:mobile-immersive',
  desktop: 'denghuolanshan:pseudo-layer:desktop-immersive',
} as const;
type ViewportMode = keyof typeof IMMERSIVE_STORAGE_KEYS;
const getViewportMode = (): ViewportMode => (window.parent.innerWidth <= MOBILE_BREAKPOINT ? 'mobile' : 'desktop');
const readImmersivePreference = (mode: ViewportMode) => {
  const stored = localStorage.getItem(IMMERSIVE_STORAGE_KEYS[mode]);
  if (stored !== null) return stored === 'true';
  return mode === 'mobile';
};
const viewportMode = ref<ViewportMode>(getViewportMode());
const readingMode = computed<ReadingMode>(() => themeStore.readingModes[viewportMode.value]);
const reloadedView = window.frameElement?.getAttribute('data-dhl-reload-view') as StageView | null;
const reloadedReading = shallowRef(
  loadReadingPosition(window.frameElement as HTMLIFrameElement | null, String(SillyTavern.getCurrentChatId() ?? '')),
);
const activeView = ref<StageView>(reloadedView || 'gallery');
window.frameElement?.removeAttribute('data-dhl-reload-view');
// Prepare the atlas only on first entry; tab changes retain its textures and camera.
const mapOpened = ref(reloadedView === 'map');
const isImmersive = ref(readImmersivePreference(viewportMode.value));
const showReadingSettings = ref(false);
const showGreetingIndex = ref(false);
const showRawMessageEditor = ref(false);
const editorTarget = ref<{ messageId: number; label: string } | null>(null);
const timelineAnchorMessageId = ref(reloadedReading.value?.messageId ?? -1);
const timelineActiveMessageId = ref(-1);
const modeViewport = ref<HTMLElement>();
const scrollPositions = new Map<StageView, number>();
const hasEnteredStreaming = ref(false);
const readParentViewportHeight = () => Math.round(window.parent.visualViewport?.height ?? window.parent.innerHeight);
const parentViewportHeight = ref(readParentViewportHeight());
const appViewportWidth = ref(window.parent.innerWidth);
const isMobileViewport = computed(() => viewportMode.value === 'mobile');
const isPseudoStage = computed(() => pseudoLayerStore.isPseudoStage);
const isDetachedMode = computed(() => pseudoLayerStore.isDetachedMode);
const statusPreferencePrefix = `denghuolanshan:status:${SillyTavern.getCurrentChatId()}:${pseudoLayerStore.messageId}`;
const readStatusCollapsedPreference = () => {
  const stored = localStorage.getItem(`${statusPreferencePrefix}:${viewportMode.value}`);
  if (stored !== null) return stored === 'true';
  if (!pseudoLayerStore.isNativeLatest) return true;
  return localStorage.getItem(`denghuolanshan:status:${viewportMode.value}:collapsed`) === 'true';
};
const isStatusCollapsed = ref(readStatusCollapsedPreference());
const toggleStatusCollapsed = () => {
  isStatusCollapsed.value = !isStatusCollapsed.value;
  localStorage.setItem(`${statusPreferencePrefix}:${viewportMode.value}`, String(isStatusCollapsed.value));
  if (pseudoLayerStore.isNativeLatest) {
    localStorage.setItem(`denghuolanshan:status:${viewportMode.value}:collapsed`, String(isStatusCollapsed.value));
  }
};
const openReadingSettings = () => {
  if (isDetachedMode.value && isStatusCollapsed.value) toggleStatusCollapsed();
  showReadingSettings.value = true;
};
const openGreetingIndex = () => {
  if (isDetachedMode.value && isStatusCollapsed.value) toggleStatusCollapsed();
  showGreetingIndex.value = true;
};
watch([viewportMode, () => pseudoLayerStore.isNativeLatest], () => {
  isStatusCollapsed.value = readStatusCollapsedPreference();
});
watch(
  [isDetachedMode, isStatusCollapsed],
  ([detached, collapsed]) => {
    store.setGalleryPreloadEnabled(!detached || !collapsed);
  },
  { immediate: true },
);
const nativeStageHeight = ref<number | null>(null);
const movingPanelFit = createMovingPanelFit();
let parentPanelFitRequested = true;

type StageTab = { id: StageView; label: string; icon: string; badge?: number };

const utilityTabs: Array<StageTab> = [
  { id: 'gallery', label: '图鉴', icon: 'fa-solid fa-images' },
  { id: 'affairs', label: '行事', icon: 'fa-solid fa-compass' },
  { id: 'cultivation', label: '修炼', icon: 'fa-solid fa-yin-yang' },
  { id: 'skills', label: '神通', icon: 'fa-solid fa-hand-sparkles' },
  { id: 'companions', label: '红尘', icon: 'fa-solid fa-feather-pointed' },
  { id: 'inventory', label: '储物', icon: 'fa-solid fa-box-open' },
  { id: 'map', label: '地图', icon: 'fa-solid fa-map-location-dot' },
  { id: 'tribulation', label: '历劫', icon: 'fa-solid fa-bolt' },
];
const tabs = computed<Array<StageTab>>(() => [
  ...(isDetachedMode.value
    ? []
    : readingMode.value === 'scroll'
      ? [{ id: 'timeline' as const, label: '历程', icon: 'fa-solid fa-scroll' }]
      : [{ id: 'story' as const, label: '正文', icon: 'fa-solid fa-book-open' }]),
  ...utilityTabs,
]);

const themeArtMap = {
  lantern: lanternArt,
  duskInk: duskInkArt,
  shanhai: shanhaiArt,
  starAltar: starAltarArt,
} as const;
const updateViewport = () => {
  const parentChat = window.parent.document.querySelector<HTMLElement>('#chat');
  const frame = window.frameElement;
  // Older controllers keep the stage in the selected native message instead
  // of the owned stage root. Fit that host to the actual chat space as well.
  const nativeHost = frame?.closest('#chat > .mes.dhl-pseudo-selected');
  if (parentChat && !isDetachedMode.value && (isPseudoStage.value || nativeHost)) {
    const parentWindow = window.parent;
    const visualViewport = parentWindow.visualViewport;
    movingPanelFit.sync(
      parentWindow.document.body.classList.contains('movingUI') ? parentChat.closest<HTMLElement>('#sheld') : null,
      (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? parentWindow.innerHeight),
      parentPanelFitRequested,
    );
    parentPanelFitRequested = false;
  } else movingPanelFit.dispose();
  // 缩放时酒馆可能临时滚动外层聊天区，先归零，避免把滚动偏移计入舞台高度。
  if (parentChat && !isDetachedMode.value && (isPseudoStage.value || nativeHost)) parentChat.scrollTop = 0;
  const availableNativeHeight =
    nativeHost && parentChat ? parentChat.getBoundingClientRect().bottom - frame!.getBoundingClientRect().top : 0;
  nativeStageHeight.value = availableNativeHeight > 0 ? Math.floor(availableNativeHeight) : null;
  parentViewportHeight.value = readParentViewportHeight();
  appViewportWidth.value = window.parent.innerWidth;
  const nextMode = getViewportMode();
  if (nextMode !== viewportMode.value) {
    viewportMode.value = nextMode;
    isImmersive.value =
      !isDetachedMode.value && isReadingView(activeView.value) ? readImmersivePreference(nextMode) : false;
  }
};
let viewportUpdateFrame: number | null = null;
const scheduleViewportUpdate = () => {
  if (viewportUpdateFrame !== null) return;
  viewportUpdateFrame = window.parent.requestAnimationFrame(() => {
    viewportUpdateFrame = null;
    updateViewport();
  });
};
const handleParentViewportResize = () => {
  parentPanelFitRequested = true;
  scheduleViewportUpdate();
};
const parentChatResizeObserver = new ResizeObserver(scheduleViewportUpdate);
watch(
  [
    () => pseudoLayerStore.controllerReady,
    () => pseudoLayerStore.view.hostMessageId,
    () => pseudoLayerStore.view.nativeInputCollapsed,
    isDetachedMode,
  ],
  scheduleViewportUpdate,
);

const stageHeight = computed(() => {
  if (nativeStageHeight.value !== null) return nativeStageHeight.value;
  const mobile = appViewportWidth.value <= MOBILE_BREAKPOINT;
  const mobileOffset = pseudoLayerStore.view.nativeInputCollapsed ? 42 : 118;
  const availableHeight = parentViewportHeight.value - (mobile ? mobileOffset : 132);
  const defaultHeight = _.clamp(availableHeight, mobile ? 480 : 640, mobile ? 820 : 900);
  if (activeView.value !== 'map') return Math.round(defaultHeight);

  const expandedHeight = _.clamp(parentViewportHeight.value * 1.12, mobile ? 700 : 840, mobile ? 900 : 1120);
  return Math.round(Math.max(defaultHeight, expandedHeight));
});

const themeStyles = computed(() => {
  const theme = themeStore.currentTheme;
  const colors = theme.colors;
  return {
    '--stage-height': `${stageHeight.value}px`,
    '--status-panel-height': `${Math.round(Math.min(parentViewportHeight.value * 0.68, 560) + (isMobileViewport.value ? 0 : 24))}px`,
    '--bg-primary': colors.bgPrimary,
    '--bg-secondary': colors.bgSecondary,
    '--border-color': colors.border,
    '--border-active': colors.borderActive,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-accent': colors.textAccent,
    '--story-dialogue-color': themeStore.currentDialogueColor,
    '--accent-color': colors.accent,
    '--accent-glow': colors.accentGlow,
    '--button-bg': colors.buttonBg,
    '--button-hover': colors.buttonHover,
    '--button-active': colors.buttonActive,
    '--progress-bg': colors.progressBg,
    '--header-bg': colors.headerBg,
    '--tab-bg': colors.tabBg,
    '--tab-active': colors.tabActive,
    '--footer-bg': colors.footerBg,
    '--stage-canvas': colors.canvas,
    '--surface': colors.surface,
    '--surface-raised': colors.surfaceRaised,
    '--surface-inset': colors.surfaceInset,
    '--reading-surface': colors.readingSurface,
    '--line-subtle': colors.lineSubtle,
    '--line-strong': colors.lineStrong,
    '--gold': colors.gold,
    '--gold-soft': colors.goldSoft,
    '--jade': colors.jade,
    '--jade-soft': colors.jadeSoft,
    '--crimson': colors.crimson,
    '--semantic-danger': colors.danger,
    '--semantic-success': colors.success,
    '--semantic-warning': colors.warning,
    '--semantic-info': colors.info,
    '--semantic-relation': colors.relation,
    '--stage-shadow': colors.shadow,
    '--focus-ring': colors.focusRing,
    '--stage-material': theme.materials.stage,
    '--ambient-material': theme.materials.ambient,
    '--frame-material': theme.materials.frame,
    '--reading-material': theme.materials.reading,
    '--portrait-material': theme.materials.portrait,
    '--grain-material': theme.materials.grain,
    '--theme-art': `url("${themeArtMap[theme.id]}")`,
    '--reading-font-size': `${themeStore.preferences.fontSize}px`,
    '--reading-line-height': String(themeStore.preferences.lineHeight),
    '--reading-measure': `${themeStore.preferences.measureWidth}%`,
  };
});

const inferredRegion = computed(
  () =>
    inferLayerFromTrack(
      String(store.本尊.行踪.当前区域 || '').trim(),
      String(store.本尊.行踪.所属层级 || '').trim(),
      String(store.本尊.行踪.环境描述 || ''),
      store.地点库 as Record<string, { 域?: string }>,
      store.世界地图 as Record<string, { layer?: string }>,
    ) || '',
);
const parentRegion = computed(
  () =>
    resolveMapAnchor({
      currentRegion: String(store.本尊.行踪.当前区域 || '').trim(),
      currentDomain: inferredRegion.value,
      environmentDesc: String(store.本尊.行踪.环境描述 || ''),
      anchors: store.$地图锚点,
      locationLib: store.地点库,
      worldMap: store.世界地图,
    }) || inferredRegion.value,
);
const atlasLocationDescription = computed(() => {
  const name = String(store.本尊.行踪.当前区域 || '').trim();
  return [store.地点库[name]?.特, store.世界地图[name]?.desc, store.本尊.行踪.环境描述].filter(Boolean).join('；');
});
const isReadingView = (view: StageView) => view === 'timeline' || view === 'story';
const dangerColor = computed(() => getDangerColor(store.本尊.行踪.危险度 ?? 10));
const readingViewActive = computed(() => isReadingView(activeView.value));
watch(
  isDetachedMode,
  detached => {
    if (detached) {
      isImmersive.value = false;
      if (isReadingView(activeView.value)) activeView.value = 'gallery';
      showRawMessageEditor.value = false;
      showGreetingIndex.value = false;
    } else {
      activeView.value = 'gallery';
      isImmersive.value = false;
    }
  },
  { immediate: true },
);

const setImmersivePreference = (value: boolean) => {
  isImmersive.value = value;
  localStorage.setItem(IMMERSIVE_STORAGE_KEYS[viewportMode.value], String(value));
};
const restoreReadingPreference = () => {
  isImmersive.value = readImmersivePreference(viewportMode.value);
};
const setReadingMode = (mode: ReadingMode) => {
  themeStore.setReadingMode(viewportMode.value, mode);
};
const openView = (view: StageView) => {
  if (isDetachedMode.value && isReadingView(view)) return;
  if (view === 'trace' || view === 'actions') {
    affairsFocus.value = { section: view === 'trace' ? 'tasks' : 'events', nonce: Date.now() };
    view = 'affairs';
  }
  const target = readingMode.value === 'scroll' && view === 'story' ? ('timeline' as const) : view;
  if (isReadingView(target)) restoreReadingPreference();
  else isImmersive.value = false;
  activeView.value = target;
};
watch(
  () => affairs.navigation,
  target => {
    if (!target) return;
    if (target.kind === 'journey') {
      affairsFocus.value = { section: 'journeys', id: target.id, nonce: target.nonce };
      openView('affairs');
    } else if (target.kind === 'task' || target.kind === 'event') {
      affairsFocus.value = {
        section: target.kind === 'event' ? 'events' : store.任务列表[target.id] ? 'tasks' : 'results',
        id: target.id,
        nonce: target.nonce,
      };
      openView('affairs');
    } else if (target.kind === 'person') {
      personFocus.value = { name: target.id, nonce: target.nonce };
      openView('companions');
    } else if (target.kind === 'item') {
      itemFocus.value = { name: target.id, nonce: target.nonce };
      openView('inventory');
    } else {
      placeFocus.value = { name: target.id, nonce: target.nonce };
      openView('map');
    }
  },
);
watch(
  isDetachedMode,
  (detached, previous) => {
    activeView.value =
      previous === undefined && !detached && reloadedView
        ? reloadedView
        : detached
          ? 'gallery'
          : readingViewForMode(readingMode.value);
    if (!detached) restoreReadingPreference();
  },
  { immediate: true },
);
const toggleImmersive = () => {
  if (!isImmersive.value && !isReadingView(activeView.value)) {
    activeView.value = readingMode.value === 'scroll' ? 'timeline' : 'story';
  }
  setImmersivePreference(!isImmersive.value);
};
const rememberScroll = () => {
  if (!isReadingView(activeView.value) && modeViewport.value) {
    scrollPositions.set(activeView.value, modeViewport.value.scrollTop);
  }
};
const openCurrentEditor = () => {
  editorTarget.value = null;
  showRawMessageEditor.value = true;
};
const openTimelineEditor = (messageId: number, label: string) => {
  editorTarget.value = { messageId, label };
  showRawMessageEditor.value = true;
};
const closeRawEditor = () => {
  showRawMessageEditor.value = false;
  editorTarget.value = null;
};

watch(activeView, (next, previous) => {
  if (isReadingView(previous)) {
    const position = saveReadingPosition(
      window.frameElement as HTMLIFrameElement | null,
      String(SillyTavern.getCurrentChatId() ?? ''),
    );
    if (position) reloadedReading.value = position;
  }
  if (next === 'map') mapOpened.value = true;
  if (!isReadingView(previous) && modeViewport.value) {
    scrollPositions.set(previous, modeViewport.value.scrollTop);
  }
  nextTick(() => {
    if (modeViewport.value) {
      modeViewport.value.scrollTop = isReadingView(next) ? 0 : (scrollPositions.get(next) ?? 0);
    }
  });
  if (!isDetachedMode.value && readingMode.value === 'paged' && next === 'story' && next !== previous) {
    pseudoLayerStore.selectHistory('story');
  }
});

watch(readingMode, (next, previous) => {
  if (isDetachedMode.value) return;
  if (next === previous) return;
  if (next === 'scroll') {
    const anchor =
      pseudoLayerStore.view.selectedMessageId >= 0
        ? pseudoLayerStore.view.selectedMessageId
        : pseudoLayerStore.view.latestMessageId;
    timelineAnchorMessageId.value = anchor;
    timelineActiveMessageId.value = anchor;
    if (activeView.value === 'story') activeView.value = 'timeline';
    return;
  }

  if (activeView.value !== 'timeline') return;
  const target =
    timelineActiveMessageId.value >= 0 ? timelineActiveMessageId.value : pseudoLayerStore.view.latestMessageId;
  pseudoLayerStore.selectTimelineEntry(target);
  activeView.value = 'story';
});

watch(
  () => pseudoLayerStore.generationState,
  (next, previous) => {
    if (isDetachedMode.value) return;
    if (previous === 'idle' && next !== 'idle') {
      hasEnteredStreaming.value = pseudoLayerStore.generationInteractionMode !== 'dialogue';
      if (hasEnteredStreaming.value) {
        activeView.value = readingViewForMode(readingMode.value);
        restoreReadingPreference();
      }
    }
    if (previous !== 'idle' && next === 'idle' && hasEnteredStreaming.value) {
      hasEnteredStreaming.value = false;
      if (pseudoLayerStore.isStoryHistoryLatest) {
        activeView.value = readingViewForMode(readingMode.value);
        restoreReadingPreference();
      }
    }
  },
);

watch(
  () => pseudoLayerStore.view.selectedMessageId,
  (messageId, previousMessageId) => {
    if (isDetachedMode.value) return;
    if (messageId < 0 || messageId === previousMessageId) return;
    if (readingMode.value === 'scroll') {
      if (isReadingView(activeView.value)) activeView.value = 'timeline';
      return;
    }
    if (isReadingView(activeView.value)) {
      activeView.value = 'story';
      restoreReadingPreference();
    }
  },
  { immediate: true },
);

watch(
  [
    () => pseudoLayerStore.view.hostMessageId,
    () => pseudoLayerStore.view.selectedMessageId,
    () => pseudoLayerStore.view.latestMessageId,
    () => pseudoLayerStore.view.latestStateMessageId,
    () => pseudoLayerStore.view.revision,
    readingMode,
    isDetachedMode,
  ],
  ([hostMessageId, selectedMessageId, latestMessageId, latestStateMessageId, , mode, detached]) => {
    if (detached) {
      store.viewMessage(pseudoLayerStore.messageId);
      return;
    }
    const targetMessageId = mode === 'scroll' ? latestMessageId : selectedMessageId;
    if (hostMessageId !== pseudoLayerStore.messageId || targetMessageId < 0) return;
    const stateMessageId =
      targetMessageId === latestMessageId && Number.isFinite(latestStateMessageId)
        ? Number(latestStateMessageId)
        : targetMessageId;
    if (stateMessageId !== targetMessageId) {
      store.viewMessage(stateMessageId, { preserveGallery: true });
      if (!pseudoLayerStore.dialogueDrawerOpen) store.parseCurrentMessageCards(targetMessageId);
      return;
    }
    store.viewMessage(targetMessageId);
  },
  { immediate: true },
);

let cancelAtlasPrefetch: (() => void) | undefined;
watch(
  [() => store.hasData, isDetachedMode],
  ([ready, detached]) => {
    cancelAtlasPrefetch?.();
    cancelAtlasPrefetch = undefined;
    if (ready && !detached) {
      cancelAtlasPrefetch = scheduleAtlasPrefetch(
        resolveAtlasLocation({
          currentLocation: store.本尊.行踪.当前区域,
          currentDomain: parentRegion.value,
          currentLayer: store.本尊.行踪.所属层级,
        }).realm,
      );
    }
  },
  { immediate: true },
);

onMounted(() => {
  pseudoLayerStore.start();
  const parentChat = window.parent.document.querySelector('#chat');
  if (parentChat) parentChatResizeObserver.observe(parentChat);
  window.parent.addEventListener('resize', handleParentViewportResize);
  window.parent.visualViewport?.addEventListener('resize', handleParentViewportResize);
  scheduleViewportUpdate();
});
onBeforeUnmount(() => {
  cancelAtlasPrefetch?.();
  saveReadingPosition(window.frameElement as HTMLIFrameElement | null, String(SillyTavern.getCurrentChatId() ?? ''));
  parentChatResizeObserver.disconnect();
  movingPanelFit.dispose();
  pseudoLayerStore.dispose();
  store.dispose();
  window.parent.removeEventListener('resize', handleParentViewportResize);
  window.parent.visualViewport?.removeEventListener('resize', handleParentViewportResize);
  if (viewportUpdateFrame !== null) window.parent.cancelAnimationFrame(viewportUpdateFrame);
});
</script>

<style lang="scss" scoped>
.cultivation-status {
  width: 100%;
  height: var(--stage-height);
  min-height: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--text-primary);
  isolation: isolate;
  background: var(--stage-canvas);
  box-shadow: 0 20px 60px var(--stage-shadow);
  transition:
    height 0.22s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  font-size: 13px;
}

.cultivation-status.pseudo-stage-fit {
  height: 100dvh;
}

.cultivation-status.detached-status {
  height: auto;
  max-width: 100%;
  box-shadow: 0 6px 22px var(--stage-shadow);

  @media screen and (min-width: 761px) {
    width: 94%;
  }

  .stage-main {
    flex: none;
    height: var(--status-panel-height);
    max-height: var(--status-panel-height);
  }
}

.cultivation-status.map-expanded {
  box-shadow: 0 24px 72px var(--stage-shadow);
}

.stage-backdrop,
.pattern-overlay,
.ambient-overlay,
.frame-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.stage-backdrop {
  background: var(--stage-material);
  transition: background 0.28s ease;
}
.pattern-overlay {
  background: var(--grain-material);
  opacity: 0.7;
  mix-blend-mode: soft-light;
}
.ambient-overlay {
  background: var(--ambient-material);
  background-size:
    100% 100%,
    100% 100%,
    100% 100%,
    100% 100%;
  opacity: 0.8;
  animation: ambient-drift 12s ease-in-out infinite alternate;
}
.frame-overlay {
  inset: 5px;
  border: 1px solid color-mix(in srgb, var(--line-strong) 58%, transparent);
  border-radius: 5px;
  background: var(--frame-material);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line-subtle) 48%, transparent);
}
.frame-overlay::before,
.frame-overlay::after {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  border-color: var(--gold-soft);
  opacity: 0.44;
}
.frame-overlay::before {
  top: 5px;
  left: 5px;
  border-top: 1px solid;
  border-left: 1px solid;
}
.frame-overlay::after {
  right: 5px;
  bottom: 5px;
  border-right: 1px solid;
  border-bottom: 1px solid;
}

.cultivation-status > :where(.stage-header, .stage-main, .stage-navigation, .command-dock) {
  position: relative;
  z-index: 1;
}
.cultivation-status > :deep(.stage-header) {
  z-index: 40;
}
.stage-navigation {
  display: contents;
}
.stage-main {
  min-height: 0;
  flex: 1;
  display: flex;
}
.stage-viewport {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
  transition: background 0.25s ease;
}
.stage-viewport.reading-mode {
  overflow: hidden;
}
.stage-viewport > :deep(.panel) {
  box-sizing: border-box;
  width: 100%;
  max-width: 1180px;
  min-height: 100%;
  margin: 0 auto;
  padding: 24px 28px;
  background: transparent;
}
.stage-viewport > :deep(.panel > section),
.stage-viewport > :deep(.panel > div) {
  border-color: var(--line-subtle);
}
.stage-viewport > :deep(*:not(.story-reader, .panel)) {
  color-scheme: dark;
}
.light-theme .stage-viewport > :deep(*:not(.story-reader, .panel)) {
  color-scheme: light;
}
.full-map-panel {
  max-width: none !important;
  height: 100%;
  min-height: 0;
  padding: 0 !important;
  display: flex;
  flex-direction: column;
}
.stage-viewport > :deep(.gallery-panel) {
  max-width: none !important;
  height: 100%;
}
.tribulation-panel {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 28px !important;
}
@media screen and (max-width: 760px) {
  .stage-viewport > :deep(.panel),
  .tribulation-panel {
    padding: 14px 12px !important;
  }
}

.stage-viewport :deep(.section-title),
.stage-viewport :deep(.panel-title),
.stage-viewport :deep(.section-header),
.stage-viewport :deep(.panel-header) {
  color: var(--text-accent);
  border-color: var(--line-subtle);
}
.stage-viewport :deep(.section-title i),
.stage-viewport :deep(.panel-title i),
.stage-viewport :deep(.section-header i),
.stage-viewport :deep(.panel-header i) {
  color: var(--gold);
}
.stage-viewport :deep(.empty-hint),
.stage-viewport :deep(.empty-state),
.stage-viewport :deep(.no-data) {
  color: var(--text-secondary);
}
.stage-viewport :deep(.progress-bar),
.stage-viewport :deep(.progress-track) {
  background: var(--progress-bg);
}

.cultivation-status[data-view='cultivation'],
.cultivation-status[data-view='skills'] {
  --view-accent: var(--jade);
}
.cultivation-status[data-view='dialogue'] {
  --view-accent: var(--jade);
}
.cultivation-status[data-view='timeline'] {
  --view-accent: var(--gold);
}
.cultivation-status[data-view='inventory'],
.cultivation-status[data-view='map'] {
  --view-accent: var(--gold);
}
.cultivation-status[data-view='companions'],
.cultivation-status[data-view='gallery'] {
  --view-accent: var(--semantic-relation);
}
.cultivation-status[data-view='tribulation'] {
  --view-accent: var(--semantic-danger);
}
.cultivation-status[data-view='trace'],
.cultivation-status[data-view='affairs'],
.cultivation-status[data-view='actions'] {
  --view-accent: var(--semantic-info);
}

.cultivation-status:not([data-view='story']):not([data-view='dialogue']):not([data-view='timeline'])
  .stage-viewport::before {
  content: '';
  position: sticky;
  top: 0;
  z-index: 8;
  display: block;
  width: 100%;
  height: 2px;
  margin-bottom: -2px;
  background: linear-gradient(90deg, transparent, var(--view-accent, var(--gold)) 22% 78%, transparent);
  opacity: 0.38;
  pointer-events: none;
}

.cultivation-status[data-theme='lantern'] .frame-overlay {
  background:
    linear-gradient(90deg, var(--line-subtle) 1px, transparent 1px) 18px 18px / 46px 46px,
    linear-gradient(var(--line-subtle) 1px, transparent 1px) 18px 18px / 46px 46px,
    var(--frame-material);
  border: 3px double color-mix(in srgb, var(--gold) 56%, transparent);
  border-radius: 2px;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.72),
    inset 0 0 34px rgba(0, 0, 0, 0.34),
    0 0 18px color-mix(in srgb, var(--gold) 8%, transparent);
  opacity: 0.82;
}
.cultivation-status[data-theme='lantern'] .stage-backdrop {
  background:
    var(--theme-art) center / cover no-repeat,
    var(--stage-material);
}
.cultivation-status[data-theme='lantern'] {
  border-radius: 2px;
  border-color: color-mix(in srgb, var(--gold) 55%, #15262d);
}
.cultivation-status[data-theme='lantern'] .stage-main {
  margin: 7px 9px 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--gold) 36%, transparent);
  box-shadow:
    0 12px 36px rgba(0, 0, 0, 0.36),
    inset 0 0 0 1px rgba(0, 0, 0, 0.52);
}
.cultivation-status[data-theme='lantern'] :deep(.stage-header) {
  margin: 8px 9px 0;
  border: 1px solid color-mix(in srgb, var(--gold) 34%, transparent);
  border-bottom-color: color-mix(in srgb, var(--gold) 58%, transparent);
  border-radius: 1px 1px 0 0;
}
.cultivation-status[data-theme='lantern'] :deep(.stage-header)::before {
  background:
    linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--gold) 16%, transparent) 18%,
      transparent 35% 65%,
      color-mix(in srgb, var(--gold) 14%, transparent) 82%,
      transparent
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0 40px,
      color-mix(in srgb, var(--gold) 12%, transparent) 41px,
      transparent 42px
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 22px,
      color-mix(in srgb, var(--gold) 7%, transparent) 23px,
      transparent 24px
    ),
    var(--grain-material);
}
.cultivation-status[data-theme='lantern'] :deep(.story-reader) {
  box-shadow:
    inset 0 0 90px rgba(0, 0, 0, 0.28),
    inset 0 -30px 80px rgba(8, 64, 76, 0.12);
}
.cultivation-status[data-theme='lantern'] :deep(.story-reader)::before {
  background: var(--reading-material);
  opacity: 1;
}
.cultivation-status[data-theme='lantern'] :deep(.story-scroll) {
  background:
    linear-gradient(90deg, rgba(2, 15, 23, 0.15), rgba(2, 15, 23, 0.48) 20% 80%, rgba(2, 15, 23, 0.16)),
    linear-gradient(180deg, rgba(2, 15, 23, 0.34), rgba(2, 15, 23, 0.55)),
    var(--theme-art) center bottom / cover no-repeat;
}
.cultivation-status[data-theme='lantern'] .stage-viewport {
  background: rgba(2, 16, 24, 0.7);
}
.cultivation-status[data-theme='lantern'] :deep(.portrait-rail) {
  margin: 8px;
  border: 3px double color-mix(in srgb, var(--gold) 42%, transparent);
  background-color: rgba(2, 13, 19, 0.76);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.72),
    0 12px 34px rgba(0, 0, 0, 0.38);
}
.cultivation-status[data-theme='lantern'] :deep(.portrait-stage) {
  border-radius: 1px;
  border-color: color-mix(in srgb, var(--gold) 45%, transparent);
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.58),
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 16%, transparent);
}
.cultivation-status[data-theme='lantern'] :deep(.tab-nav),
.cultivation-status[data-theme='lantern'] :deep(.footer),
.cultivation-status[data-theme='lantern'] :deep(.command-dock) {
  margin-right: 9px;
  margin-left: 9px;
  border-right: 1px solid color-mix(in srgb, var(--gold) 24%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--gold) 24%, transparent);
}
.cultivation-status[data-theme='lantern'] :deep(.command-dock) {
  margin-bottom: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
}
.cultivation-status[data-theme='lantern'] :deep(.tab-btn.active) {
  border-color: color-mix(in srgb, var(--gold) 26%, transparent);
  box-shadow:
    inset 0 8px 20px color-mix(in srgb, var(--gold) 11%, transparent),
    0 0 14px color-mix(in srgb, var(--gold) 5%, transparent);
}
.cultivation-status[data-theme='lantern'] :deep(.primary-command:not(.stop)) {
  box-shadow:
    inset 0 0 14px color-mix(in srgb, var(--gold) 10%, transparent),
    0 0 12px color-mix(in srgb, var(--gold) 6%, transparent);
}
.cultivation-status[data-theme='duskInk'] .stage-backdrop {
  background:
    var(--theme-art) center / cover no-repeat,
    var(--stage-material);
}
.cultivation-status[data-theme='duskInk'] .frame-overlay {
  border-style: double;
  border-width: 4px;
  opacity: 0.82;
  box-shadow: inset 0 0 50px rgba(11, 24, 23, 0.24);
}
.cultivation-status[data-theme='duskInk'] :deep(.story-reader)::after {
  left: 18px;
  width: 2px;
  opacity: 0.34;
}
.cultivation-status[data-theme='duskInk'] :deep(.story-reader)::before {
  background:
    var(--reading-material),
    var(--theme-art) center bottom / 100% 100% no-repeat;
}
.cultivation-status[data-theme='duskInk'] :deep(.story-scroll) {
  background:
    radial-gradient(circle at 7% 74%, rgba(242, 183, 86, 0.36) 0 2px, transparent 24px),
    radial-gradient(circle at 93% 68%, rgba(242, 183, 86, 0.3) 0 2px, transparent 22px),
    linear-gradient(180deg, rgba(25, 49, 51, 0.25), rgba(12, 34, 38, 0.42)),
    var(--theme-art) center bottom / cover no-repeat;
}
.cultivation-status[data-theme='duskInk'] .stage-viewport {
  background: rgba(22, 44, 46, 0.72);
}
.cultivation-status[data-theme='duskInk'] :deep(.stage-header) {
  box-shadow:
    inset 0 -2px 0 color-mix(in srgb, var(--gold) 14%, transparent),
    0 8px 26px var(--stage-shadow);
}
.cultivation-status[data-theme='shanhai'] {
  border: 3px solid color-mix(in srgb, var(--jade) 82%, #132d2d);
  border-radius: 1px;
  box-shadow:
    0 18px 48px var(--stage-shadow),
    inset 0 0 0 2px color-mix(in srgb, var(--gold) 24%, transparent),
    inset 0 0 0 6px color-mix(in srgb, var(--jade) 12%, transparent);
}
.cultivation-status[data-theme='shanhai'] .stage-backdrop {
  background:
    var(--theme-art) center / cover no-repeat,
    var(--stage-material);
}
.cultivation-status[data-theme='shanhai'] .frame-overlay {
  inset: 7px;
  border: 4px double color-mix(in srgb, var(--jade) 74%, transparent);
  border-radius: 0;
  opacity: 0.74;
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--gold) 20%, transparent),
    inset 0 0 42px rgba(35, 52, 47, 0.14);
}
.cultivation-status[data-theme='shanhai'] .frame-overlay::before,
.cultivation-status[data-theme='shanhai'] .frame-overlay::after {
  width: 42px;
  height: 42px;
  border-width: 6px;
  opacity: 0.88;
}
.cultivation-status[data-theme='shanhai'] .frame-overlay::before {
  border-top: 6px double;
  border-left: 6px double;
}
.cultivation-status[data-theme='shanhai'] .frame-overlay::after {
  border-right: 6px double;
  border-bottom: 6px double;
}
.cultivation-status[data-theme='shanhai'] .stage-main {
  margin: 8px 10px 0;
  overflow: hidden;
  border: 2px solid var(--line-strong);
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--gold) 17%, transparent),
    0 8px 20px rgba(35, 50, 46, 0.16);
}
.cultivation-status[data-theme='shanhai'] :deep(.story-copy) {
  text-shadow: none;
}
.cultivation-status[data-theme='shanhai'] :deep(.stage-header),
.cultivation-status[data-theme='shanhai'] :deep(.tab-nav),
.cultivation-status[data-theme='shanhai'] :deep(.footer),
.cultivation-status[data-theme='shanhai'] :deep(.command-dock) {
  backdrop-filter: saturate(0.74) blur(3px);
}
.cultivation-status[data-theme='shanhai'] :deep(.stage-header) {
  margin: 9px 10px 0;
  border: 2px solid var(--line-strong);
  border-radius: 0;
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--gold) 13%, transparent),
    0 5px 12px rgba(31, 48, 44, 0.16);
}
.cultivation-status[data-theme='shanhai'] :deep(.stage-header)::before {
  background:
    radial-gradient(ellipse at 6% 100%, rgba(38, 78, 72, 0.19) 0 9%, transparent 20%),
    radial-gradient(ellipse at 94% 0%, rgba(40, 76, 70, 0.14) 0 8%, transparent 18%), var(--grain-material);
}
.cultivation-status[data-theme='shanhai'] :deep(.story-reader) {
  box-shadow:
    inset 0 0 70px rgba(72, 64, 45, 0.1),
    inset 0 0 0 1px rgba(255, 250, 229, 0.2);
}
.cultivation-status[data-theme='shanhai'] :deep(.story-reader)::before {
  background:
    var(--reading-material),
    var(--theme-art) center bottom / cover no-repeat;
  opacity: 1;
}
.cultivation-status[data-theme='shanhai'] :deep(.story-reader)::after {
  left: 18px;
  width: 2px;
  background: linear-gradient(transparent, var(--jade) 13%, var(--line-strong) 82%, transparent);
  opacity: 0.72;
}
.cultivation-status[data-theme='shanhai'] :deep(.story-scroll) {
  background:
    repeating-linear-gradient(2deg, transparent 0 5px, rgba(57, 66, 57, 0.025) 6px),
    repeating-linear-gradient(88deg, transparent 0 7px, rgba(84, 66, 43, 0.018) 8px),
    linear-gradient(rgba(216, 206, 181, 0.46), rgba(196, 191, 170, 0.5)),
    linear-gradient(90deg, rgba(35, 79, 74, 0.07), transparent 12%, transparent 88%, rgba(35, 79, 74, 0.07)),
    var(--theme-art) center bottom / cover no-repeat;
  background-position:
    0 0,
    0 0,
    0 0,
    0 0,
    center bottom;
  background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat;
  background-size:
    auto,
    auto,
    auto,
    auto,
    100% 68%;
}
.cultivation-status[data-theme='shanhai'] .stage-viewport {
  background: rgba(198, 192, 170, 0.7);
}
.cultivation-status[data-theme='shanhai'] :deep(.story-scroll)::after {
  content: '';
  position: sticky;
  bottom: -48px;
  display: block;
  height: 66px;
  margin: 0 -4vw -48px;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 9% 100%, rgba(35, 76, 70, 0.28) 0 9%, transparent 10%),
    radial-gradient(ellipse at 18% 105%, rgba(48, 83, 70, 0.2) 0 12%, transparent 13%),
    radial-gradient(ellipse at 86% 108%, rgba(45, 78, 68, 0.16) 0 13%, transparent 14%);
  opacity: 0.74;
}
.cultivation-status[data-theme='shanhai'] :deep(.portrait-rail) {
  margin: 8px;
  padding: 12px;
  border: 3px double var(--line-strong);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface) 82%, transparent),
      color-mix(in srgb, var(--surface-inset) 72%, transparent)
    ),
    var(--theme-art) 78% 50% / auto 100% no-repeat;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--gold) 12%, transparent);
}
.cultivation-status[data-theme='shanhai'] :deep(.portrait-stage) {
  border: 2px solid var(--line-strong);
  border-radius: 0;
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--gold) 13%, transparent),
    0 7px 16px rgba(34, 49, 45, 0.2);
}
.cultivation-status[data-theme='shanhai'] :deep(.portrait-caption) {
  color: #f3ead7;
  background: linear-gradient(to top, rgba(24, 49, 48, 0.92), rgba(34, 64, 61, 0.28) 62%, transparent);
}
.cultivation-status[data-theme='shanhai'] :deep(.tab-nav),
.cultivation-status[data-theme='shanhai'] :deep(.footer),
.cultivation-status[data-theme='shanhai'] :deep(.command-dock) {
  margin-right: 10px;
  margin-left: 10px;
  border-right: 2px solid var(--line-strong);
  border-left: 2px solid var(--line-strong);
}
.cultivation-status[data-theme='shanhai'] :deep(.tab-nav) {
  border-top: 2px solid var(--line-strong);
  border-bottom: 2px solid var(--line-strong);
}
.cultivation-status[data-theme='shanhai'] :deep(.tab-btn) {
  border-radius: 0;
}
.cultivation-status[data-theme='shanhai'] :deep(.tab-btn.active) {
  border-right-color: var(--line-strong);
  border-left-color: var(--line-strong);
  box-shadow: inset 0 0 18px color-mix(in srgb, var(--jade) 9%, transparent);
}
.cultivation-status[data-theme='shanhai'] :deep(.command-dock) {
  margin-bottom: 9px;
  border-bottom: 2px solid var(--line-strong);
}
.cultivation-status[data-theme='shanhai'] :deep(textarea),
.cultivation-status[data-theme='shanhai'] :deep(.primary-command),
.cultivation-status[data-theme='shanhai'] :deep(.native-input-command) {
  border-radius: 1px;
  border-width: 2px;
}
.cultivation-status[data-theme='shanhai'] :deep(textarea::-webkit-scrollbar-button) {
  display: none;
}
.cultivation-status[data-theme='starAltar'] .frame-overlay {
  background:
    radial-gradient(
      circle at 28px 28px,
      transparent 0 11px,
      color-mix(in srgb, var(--jade) 44%, transparent) 12px 13px,
      transparent 14px 24px,
      color-mix(in srgb, var(--gold) 18%, transparent) 25px 26px,
      transparent 27px
    ),
    radial-gradient(
      circle at calc(100% - 28px) calc(100% - 28px),
      transparent 0 11px,
      color-mix(in srgb, var(--gold) 42%, transparent) 12px 13px,
      transparent 14px 24px,
      color-mix(in srgb, var(--jade) 16%, transparent) 25px 26px,
      transparent 27px
    ),
    var(--frame-material);
  border-width: 2px;
  box-shadow:
    inset 0 0 42px rgba(0, 5, 11, 0.42),
    0 0 18px color-mix(in srgb, var(--jade) 8%, transparent);
}
.cultivation-status[data-theme='starAltar'] .stage-backdrop {
  background:
    var(--theme-art) center / cover no-repeat,
    var(--stage-material);
}
.cultivation-status[data-theme='starAltar'] :deep(.story-reader)::before {
  background: var(--reading-material);
}
.cultivation-status[data-theme='starAltar'] :deep(.story-scroll) {
  background:
    radial-gradient(circle at 82% 18%, rgba(81, 205, 190, 0.07), transparent 24%),
    linear-gradient(90deg, rgba(2, 15, 23, 0.18), rgba(2, 15, 23, 0.48) 22% 78%, rgba(2, 15, 23, 0.2)),
    linear-gradient(180deg, rgba(2, 15, 23, 0.28), rgba(1, 9, 15, 0.46)),
    var(--theme-art) center / cover no-repeat;
}
.cultivation-status[data-theme='starAltar'] .stage-viewport {
  background: rgba(2, 16, 24, 0.74);
}
.cultivation-status[data-theme='starAltar'] :deep(.tab-btn.active i) {
  filter: drop-shadow(0 0 7px var(--jade));
}
.cultivation-status[data-theme='starAltar'] :deep(.stage-header)::after {
  width: 140px;
  background: linear-gradient(90deg, transparent, var(--jade), var(--gold), var(--jade), transparent);
}
.cultivation-status[data-theme='starAltar'] :deep(.portrait-stage) {
  border-color: color-mix(in srgb, var(--jade) 28%, var(--line-subtle));
  box-shadow:
    0 12px 34px var(--stage-shadow),
    0 0 24px color-mix(in srgb, var(--jade) 8%, transparent);
}

.cultivation-status.immersive :deep(.stage-header) {
  border-bottom-color: var(--line-subtle);
}
.cultivation-status.reduce-motion,
.cultivation-status.reduce-motion :deep(*) {
  scroll-behavior: auto !important;
  animation: none !important;
  transition-duration: 0.01ms !important;
}

// 手机阅读时保留背景构图，避免大面积背景动画持续占用合成与绘制资源。
.cultivation-status.mobile-layout .ambient-overlay {
  animation: none;
}
.cultivation-status.mobile-layout {
  transition: none;
}

.cultivation-status[data-theme='lantern'] .ambient-overlay {
  animation-name: lantern-breathe;
}
.cultivation-status[data-theme='duskInk'] .ambient-overlay {
  animation-name: ink-breathe;
}
.cultivation-status[data-theme='shanhai'] .ambient-overlay {
  opacity: 0.55;
  animation-name: ink-breathe;
}
.cultivation-status[data-theme='starAltar'] .ambient-overlay {
  animation-name: star-drift;
}
.cultivation-status[data-view='map'] .ambient-overlay,
.cultivation-status[data-view='gallery'] .ambient-overlay {
  opacity: 0.28;
}

@keyframes lantern-breathe {
  0% {
    opacity: 0.58;
    filter: brightness(0.94);
  }
  100% {
    opacity: 0.9;
    filter: brightness(1.08);
  }
}
@keyframes ink-breathe {
  0% {
    opacity: 0.5;
    transform: translate3d(-0.3%, 0, 0);
  }
  100% {
    opacity: 0.76;
    transform: translate3d(0.3%, -0.25%, 0);
  }
}
@keyframes star-drift {
  0% {
    opacity: 0.56;
    transform: translate3d(0, 0, 0);
  }
  100% {
    opacity: 0.88;
    transform: translate3d(0.2%, -0.35%, 0);
  }
}

.cultivation-status :deep(.story-copy .dhl-story-dialogue),
.cultivation-status :deep(.story-prose .dhl-story-dialogue) {
  color: var(--story-dialogue-color);
  font-family: inherit;
  font-weight: 600;
  letter-spacing: 0.015em;
}

.cultivation-status :deep(:is(.story-copy, .story-prose) .dhl-story-notice) {
  box-sizing: border-box;
  display: block;
  margin: 1.35em 0;
  padding: 0.8em 1em;
  border-block: 1px solid var(--line-subtle);
  border-inline-start: 2px solid color-mix(in srgb, var(--gold) 60%, var(--line-subtle));
  border-radius: 0 6px 6px 0;
  background: linear-gradient(105deg, color-mix(in srgb, var(--gold) 6%, var(--surface-inset)), var(--surface-inset));
  color: var(--text-primary);
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  text-align: start;
  text-indent: 0;
  text-shadow: none;
  overflow-wrap: anywhere;
}

.cultivation-status :deep(.dhl-story-notice__heading) {
  display: flex;
  align-items: center;
  gap: 0.55em;
  margin-bottom: 0.3em;
  color: var(--gold);
  font-family: inherit;
  font-size: 0.86em;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.1em;
}

.cultivation-status :deep(.dhl-story-notice__mark) {
  flex: 0 0 auto;
  font-size: 0.95em;
  line-height: 1;
}

.cultivation-status :deep(.dhl-story-notice__body) {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  letter-spacing: inherit;
}

:deep(button:focus-visible),
:deep(input:focus-visible),
:deep(textarea:focus-visible),
:deep(summary:focus-visible) {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--focus-ring);
}

@media screen and (max-width: 760px) {
  .cultivation-status {
    border-radius: 4px;
    font-size: 13px;
    box-shadow: 0 10px 30px var(--stage-shadow);
  }

  .cultivation-status .frame-overlay {
    inset: 3px;
  }

  .cultivation-status[data-theme] .stage-main {
    margin: 4px 5px 0 !important;
  }

  .cultivation-status[data-theme] :deep(.stage-header) {
    margin: 5px 5px 0 !important;
  }

  .cultivation-status[data-theme] :deep(.tab-nav),
  .cultivation-status[data-theme] :deep(.footer),
  .cultivation-status[data-theme] :deep(.command-dock) {
    margin-right: 5px !important;
    margin-left: 5px !important;
  }

  .cultivation-status[data-theme] :deep(.command-dock) {
    margin-bottom: 5px !important;
  }
}
// Map browsing gets a compact shell without changing the reading layouts.
.cultivation-status.map-expanded[data-theme] :deep(.stage-header) {
  min-height: 44px;
  padding-top: 4px;
  padding-bottom: 4px;
  margin-top: 5px;
}
.map-expanded :deep(.scene-kicker),
.map-expanded :deep(.turn-copy > span) {
  display: none;
}
.map-expanded :deep(.crane-mark) {
  width: 28px;
  height: 28px;
}
.cultivation-status.map-expanded[data-theme] .stage-main {
  margin-top: 4px;
}
.map-expanded .stage-viewport {
  overflow: hidden;
}
.map-expanded :deep(.command-dock) {
  padding-top: 4px;
  padding-bottom: 4px;
}
@media (min-width: 1100px) {
  .map-expanded .stage-navigation {
    display: flex;
    flex: 0 0 auto;
    align-items: stretch;
    min-width: 0;
    margin: 0 10px;
    background: var(--tab-bg);
    border-top: 1px solid var(--line-strong);
    border-bottom: 1px solid var(--line-subtle);
  }
  .map-expanded .stage-navigation :deep(.tab-nav-shell) {
    flex: 1;
  }
  .cultivation-status.map-expanded[data-theme] .stage-navigation :deep(.tab-nav) {
    margin: 0;
    border: 0;
  }
  .map-expanded .stage-navigation :deep(.tab-nav) {
    height: 40px;
    padding: 2px 4px;
  }
  .map-expanded .stage-navigation :deep(.tab-btn) {
    min-height: 34px;
    padding: 4px 6px;
  }
}
</style>
