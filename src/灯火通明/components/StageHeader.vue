<template>
  <header
    class="stage-header"
    :class="[`reading-${readingMode}`, { 'native-status-header': detached, 'status-summary-bar': isStatusSummary }]"
  >
    <button
      v-if="isStatusSummary"
      class="status-summary"
      type="button"
      :title="summaryTitle"
      @click="$emit('toggle-status')"
    >
      <strong>{{ pseudo.messageId }}层</strong>
      <span class="summary-realm">{{ data.本尊.境界描述 }}</span>
      <span class="summary-location"><i class="fa-solid fa-location-dot"></i>{{ compactLocation }}</span>
      <span :title="worldTimeTooltip"><i :class="timeIconClass"></i>{{ dayNightLabel }}</span>
      <span :style="{ color: dangerColor }">险{{ data.本尊.行踪.危险度 ?? 10 }}</span>
    </button>
    <div v-if="!isStatusSummary" class="turn-cluster">
      <img class="crane-mark" src="https://pub-4d14ab94aa29488b977bc5be9f2a06ef.r2.dev/picgo/仙鹤.png" alt="" />
      <div class="turn-copy">
        <span>灯火阑珊</span>
        <strong :title="stageTitle">{{ stageTitle }}</strong>
        <small v-if="!detached && pseudo.view.tokenCount !== undefined" class="turn-token-count" title="本层回复 Token">
          {{ pseudo.view.tokenCount }}t
        </small>
      </div>
      <div v-if="!detached && readingMode === 'paged'" class="turn-navigation">
        <button
          type="button"
          :disabled="history.previousMessageId === undefined || pseudo.isGenerating"
          title="上一回"
          @click="pseudo.navigate('previous', historyKind)"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span>{{ history.index || 1 }} / {{ history.total || 1 }}</span>
        <button
          type="button"
          :disabled="history.nextMessageId === undefined || pseudo.isGenerating"
          title="下一回"
          @click="pseudo.navigate('next', historyKind)"
        >
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <button
          v-if="!history.isLatest"
          type="button"
          :title="historyKind === 'dialogue' ? '返回最新交谈' : '返回最新正文'"
          @click="pseudo.returnHistoryLatest(historyKind)"
        >
          <i class="fa-solid fa-forward-step"></i>
        </button>
      </div>
      <div v-if="!detached" class="reading-mode-switch" role="group" aria-label="阅读模式">
        <button
          type="button"
          :class="{ active: readingMode === 'paged' }"
          title="翻页阅读"
          @click="$emit('set-reading-mode', 'paged')"
        >
          <i class="fa-solid fa-book-open"></i>
        </button>
        <button
          type="button"
          :class="{ active: readingMode === 'scroll' }"
          title="翻滚长卷"
          @click="$emit('set-reading-mode', 'scroll')"
        >
          <i class="fa-solid fa-scroll"></i>
        </button>
      </div>
    </div>

    <div v-if="!isStatusSummary" class="scene-hud">
      <button
        class="scene-location"
        type="button"
        :title="`当前位置：${currentLocation}（打开行踪地图）`"
        @click="$emit('open-map')"
      >
        <span class="scene-kicker">此刻所在</span>
        <strong class="scene-location-full">
          <i class="fa-solid fa-location-dot"></i>
          <template v-if="showParent"
            ><span>{{ parentRegion }}</span
            ><b>·</b></template
          >
          {{ currentLocation }}
        </strong>
        <strong class="scene-location-compact" :title="currentLocation">
          <i class="fa-solid fa-location-dot"></i>
          <span>{{ compactLocation }}</span>
        </strong>
      </button>
      <span class="world-time-pill" :title="worldTimeTooltip">
        <i :class="timeIconClass"></i>
        <span>{{ eraLabel }}·第{{ data.世界时钟.年份 }}年·{{ dayNightLabel }}</span>
      </span>
    </div>

    <div class="stage-utilities">
      <div v-if="!isStatusSummary" class="hud-badges">
        <span class="danger-badge" :style="{ '--danger-color': dangerColor }"
          >险 {{ data.本尊.行踪.危险度 ?? 10 }}</span
        >
        <span
          class="heaven-posture-badge"
          :class="[`sense-${data.难度感应}`, `tier-${data.难度档位}`]"
          tabindex="0"
          :aria-label="`天道态势：${data.难度感应} · ${data.难度档位}`"
          :aria-describedby="postureTooltipId"
        >
          <span class="posture-sense">{{ data.难度感应 }}</span>
          <b aria-hidden="true">·</b>
          <span class="posture-tier">{{ data.难度档位 }}</span>
          <i
            v-if="data.难度趋势 === 'up'"
            class="fa-solid fa-arrow-trend-up posture-trend is-up"
            aria-hidden="true"
          ></i>
          <i
            v-else-if="data.难度趋势 === 'down'"
            class="fa-solid fa-arrow-trend-down posture-trend is-down"
            aria-hidden="true"
          ></i>
          <span :id="postureTooltipId" class="posture-tooltip" role="tooltip">
            <strong>天道态势 · {{ data.难度感应 }}（{{ data.难度档位 }}）</strong>
            <span>{{ data.难度警告 }}</span>
          </span>
        </span>
      </div>
      <template v-if="!detached && readingMode === 'paged'">
        <button
          class="edit-button"
          type="button"
          title="查看与编辑当前楼层原文"
          :disabled="!pseudo.canEditMessage"
          @click="$emit('open-editor')"
        >
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button
          class="delete-button"
          type="button"
          :title="pseudo.canDelete ? deleteButtonTitle : '至少保留一个回合，且只能删除最新回合'"
          :disabled="!pseudo.canDelete"
          @click="deleteDialogOpen = true"
        >
          <i class="fa-solid fa-trash-can"></i>
        </button>
        <button
          class="reroll-button"
          type="button"
          :title="pseudo.view.stage.kind === 'dialogue' ? '重生成本次回应' : '重生成本回正文'"
          :disabled="!pseudo.canReroll"
          @click="pseudo.reroll()"
        >
          <i class="fa-solid fa-rotate-right"></i>
        </button>
      </template>
      <button class="greeting-index-button" type="button" title="开场白索引" @click="$emit('open-greeting-index')">
        <i class="fa-solid fa-list-ol"></i>
      </button>
      <button
        v-if="!isStatusSummary"
        class="preset-button"
        type="button"
        title="开局预设"
        @click="$emit('open-preset')"
      >
        <i class="fa-solid fa-sliders"></i>
      </button>
      <button v-if="!isStatusSummary" class="map-button" type="button" title="打开地图" @click="$emit('open-map')">
        <i class="fa-solid fa-map-location-dot"></i>
      </button>
      <button class="appearance-button" type="button" title="外观设置" @click="$emit('open-settings')">
        <i class="fa-solid fa-font"></i>
      </button>
      <button
        class="mode-toggle-button"
        type="button"
        :title="detached ? '开启伪同层模式' : '切换为原生楼层模式'"
        :disabled="pseudo.isGenerating || pseudo.isDeleting || pseudo.isUpdatingMessage"
        @click="pseudo.setDetached(!detached)"
      >
        <i class="fa-solid" :class="detached ? 'fa-layer-group' : 'fa-list'"></i>
      </button>
      <button
        v-if="detached"
        class="status-toggle-button"
        type="button"
        :title="statusCollapsed ? '展开状态栏' : '收起状态栏'"
        :aria-expanded="!statusCollapsed"
        @click="$emit('toggle-status')"
      >
        <i class="fa-solid" :class="statusCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
      </button>
      <div ref="mobileToolGroup" class="mobile-tool-group">
        <button
          class="mobile-tool-trigger"
          type="button"
          title="更多设置"
          aria-haspopup="menu"
          :aria-expanded="mobileToolsOpen"
          @click.stop="mobileToolsOpen = !mobileToolsOpen"
        >
          <i class="fa-solid" :class="mobileToolsOpen ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
        </button>
        <Transition name="mobile-tool-menu">
          <div v-if="mobileToolsOpen" class="mobile-tool-menu" role="menu" aria-label="界面与设置">
            <button
              v-if="!detached"
              type="button"
              role="menuitemradio"
              class="mobile-reading-mode"
              :class="{ active: readingMode === 'paged' }"
              :aria-checked="readingMode === 'paged'"
              @click="selectReadingMode('paged')"
            >
              <i class="fa-solid fa-book-open"></i>
              <span>翻页阅读</span>
            </button>
            <button
              v-if="!detached"
              type="button"
              role="menuitemradio"
              class="mobile-reading-mode"
              :class="{ active: readingMode === 'scroll' }"
              :aria-checked="readingMode === 'scroll'"
              @click="selectReadingMode('scroll')"
            >
              <i class="fa-solid fa-scroll"></i>
              <span>翻滚长卷</span>
            </button>
            <span v-if="!detached" class="mobile-tool-divider" role="separator"></span>
            <button type="button" role="menuitem" @click="openGreetingIndex">
              <i class="fa-solid fa-list-ol"></i>
              <span>开场白索引</span>
            </button>
            <button type="button" role="menuitem" @click="openPreset">
              <i class="fa-solid fa-sliders"></i>
              <span>开局预设</span>
            </button>
            <button type="button" role="menuitem" @click="openAppearance">
              <i class="fa-solid fa-font"></i>
              <span>外观设置</span>
            </button>
            <template v-if="!detached && readingMode === 'paged'">
              <button
                type="button"
                role="menuitem"
                :disabled="!pseudo.canEditMessage"
                @click="
                  mobileToolsOpen = false;
                  $emit('open-editor');
                "
              >
                <i class="fa-solid fa-pen-to-square"></i>
                <span>编辑当前楼层</span>
              </button>
              <button
                type="button"
                role="menuitem"
                :disabled="!pseudo.canDelete"
                @click="
                  mobileToolsOpen = false;
                  deleteDialogOpen = true;
                "
              >
                <i class="fa-solid fa-trash-can"></i>
                <span>删除本回</span>
              </button>
              <button
                type="button"
                role="menuitem"
                :disabled="!pseudo.canReroll"
                @click="
                  mobileToolsOpen = false;
                  pseudo.reroll();
                "
              >
                <i class="fa-solid fa-rotate-right"></i>
                <span>重生成本回</span>
              </button>
            </template>
            <button
              v-if="!detached"
              type="button"
              role="menuitem"
              @click="
                mobileToolsOpen = false;
                $emit('toggle-immersive');
              "
            >
              <i class="fa-solid" :class="immersive ? 'fa-compress' : 'fa-expand'"></i>
              <span>{{ immersive ? '退出沉浸阅读' : '沉浸阅读' }}</span>
            </button>
            <span class="mobile-tool-divider" role="separator"></span>
            <button
              type="button"
              role="menuitemcheckbox"
              :aria-checked="!detached"
              :disabled="pseudo.isGenerating || pseudo.isDeleting || pseudo.isUpdatingMessage"
              @click="toggleMobileMode"
            >
              <i class="fa-solid fa-layer-group"></i>
              <span>伪同层控制</span>
              <i class="fa-solid mode-switch-icon" :class="detached ? 'fa-toggle-off' : 'fa-toggle-on'"></i>
            </button>
            <button v-if="detached" type="button" role="menuitem" @click="toggleMobileStatus">
              <i class="fa-solid" :class="statusCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'"></i>
              <span>{{ statusCollapsed ? '展开状态栏' : '收起状态栏' }}</span>
            </button>
          </div>
        </Transition>
      </div>
      <button
        v-if="!detached"
        class="immersion-button"
        type="button"
        :title="immersive ? '退出沉浸阅读' : '进入沉浸阅读'"
        @click="$emit('toggle-immersive')"
      >
        <i class="fa-solid" :class="immersive ? 'fa-compress' : 'fa-expand'"></i>
      </button>
    </div>
  </header>

  <div
    v-if="deleteDialogOpen"
    class="delete-dialog-backdrop"
    role="presentation"
    @click.self="deleteDialogOpen = false"
  >
    <section class="delete-dialog" role="alertdialog" aria-modal="true" :aria-labelledby="deleteDialogTitleId">
      <span class="delete-dialog-mark"><i class="fa-solid fa-trash-can"></i></span>
      <div class="delete-dialog-copy">
        <h2 :id="deleteDialogTitleId">{{ deleteDialogTitle }}</h2>
        <p>{{ deleteDialogDescription }}</p>
      </div>
      <div class="delete-dialog-actions">
        <button type="button" class="cancel-delete" :disabled="pseudo.isDeleting" @click="deleteDialogOpen = false">
          取消
        </button>
        <button type="button" class="confirm-delete" :disabled="pseudo.isDeleting" @click="confirmDelete">
          <i class="fa-solid" :class="pseudo.isDeleting ? 'fa-circle-notch fa-spin' : 'fa-trash-can'"></i>
          {{ pseudo.isDeleting ? '正在删除' : '确认删除' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useDataStore, usePseudoLayerStore } from '../store';
import type { PseudoLayerHistoryKind } from '../pseudo-layer-protocol';
import type { ReadingMode } from '../stores/theme-store';

const props = defineProps<{
  activeView: string;
  immersive: boolean;
  parentRegion: string;
  dangerColor: string;
  readingMode: ReadingMode;
  detached: boolean;
  statusCollapsed: boolean;
}>();
const emit = defineEmits<{
  (event: 'open-map'): void;
  (event: 'open-greeting-index'): void;
  (event: 'open-preset'): void;
  (event: 'open-settings'): void;
  (event: 'open-editor'): void;
  (event: 'toggle-immersive'): void;
  (event: 'toggle-status'): void;
  (event: 'set-reading-mode', mode: ReadingMode): void;
}>();

const data = useDataStore();
const pseudo = usePseudoLayerStore();
const isStatusSummary = computed(() => props.detached && props.statusCollapsed);
const postureTooltipId = `heaven-posture-${pseudo.messageId}`;
const deleteDialogOpen = ref(false);
const mobileToolsOpen = ref(false);
const mobileToolGroup = ref<HTMLElement | null>(null);
const deleteDialogTitleId = `delete-stage-${Math.random().toString(36).slice(2, 8)}`;
const historyKind = computed<PseudoLayerHistoryKind>(() => {
  if (props.activeView === 'dialogue') return 'dialogue';
  if (props.activeView === 'story') return 'story';
  return pseudo.view.stage.kind;
});
const history = computed(
  () =>
    pseudo.view.histories?.[historyKind.value] ?? {
      selectedMessageId: pseudo.view.selectedMessageId,
      latestMessageId: pseudo.view.latestMessageId,
      index: pseudo.view.index,
      total: pseudo.view.total,
      previousMessageId: pseudo.view.previousMessageId,
      nextMessageId: pseudo.view.nextMessageId,
      isLatest: pseudo.view.isLatest,
    },
);
const stageTitle = computed(() => {
  if (props.detached) return `第 ${pseudo.messageId} 层 · ${data.本尊.境界描述}`;
  if (props.readingMode === 'scroll' && props.activeView === 'timeline') {
    return `历程 · ${pseudo.view.total || 1} 段`;
  }
  if (props.activeView === 'story') return `第 ${history.value.index || 1} 回`;
  if (props.activeView === 'dialogue') {
    const dialogue = pseudo.dialogueContext;
    if (!dialogue) return '交谈';
    const turnCount = pseudo.dialogueTurns.length > 0 ? ` · ${pseudo.dialogueTurns.length}轮` : '';
    return `与${dialogue.targetName}${turnCount}`;
  }
  return pseudo.view.stage.kind === 'dialogue'
    ? `与${pseudo.view.stage.targetName} · ${pseudo.view.stage.turnCount}轮`
    : `第 ${pseudo.view.histories?.story.index || pseudo.view.index || 1} 回`;
});
const deleteButtonTitle = computed(() => (pseudo.view.stage.kind === 'dialogue' ? '删除最后一轮交谈' : '删除本回正文'));
const deleteDialogTitle = computed(() =>
  pseudo.view.stage.kind === 'dialogue' ? '删除最后一轮交谈？' : '删除本回剧情？',
);
const deleteDialogDescription = computed(() =>
  pseudo.view.stage.kind === 'dialogue'
    ? '将同时删除最后一条用户发言与角色回应；会话中的其余轮次会保留。此操作无法恢复。'
    : '将同时删除本回起念与正文，避免留下无法看见的用户楼层。此操作无法恢复。',
);
const currentLocation = computed(() => String(data.本尊.行踪.当前区域 || '').trim() || '未知之地');
const compactLocation = computed(() => {
  const segments = currentLocation.value
    .split(/[·•›/]/)
    .map(segment => segment.trim())
    .filter(Boolean);
  return segments.at(-1) ?? currentLocation.value;
});
const eraLabel = computed(() => {
  const era = String(data.世界时钟.纪元 || '').trim();
  return era === '末法时代' ? '盛法时代' : era || '盛法时代';
});
const dayNightLabel = computed(() => {
  const shichen = String(data.世界时钟.时辰 || '');
  if (!shichen) return '夜';
  if (shichen.includes('夜') || shichen.includes('晚')) return '夜';
  if (shichen.includes('日') || shichen.includes('昼')) return '昼';
  const nightShichen = ['子', '丑', '寅', '卯', '酉', '戌', '亥'];
  if (nightShichen.some(token => shichen.includes(token))) return '夜';
  const dayShichen = ['辰', '巳', '午', '未', '申'];
  if (dayShichen.some(token => shichen.includes(token))) return '昼';
  return shichen;
});
const timeIconClass = computed(() =>
  dayNightLabel.value === '昼' ? 'fa-solid fa-sun is-day' : 'fa-solid fa-moon is-night',
);
const worldTimeTooltip = computed(() => {
  const clock = data.世界时钟;
  return `${eraLabel.value} · 第${clock.年份}年${clock.月份 ? `${clock.月份}月` : ''}${clock.日期 ? `${clock.日期}日` : ''} · ${clock.时辰 || dayNightLabel.value}`;
});
const summaryTitle = computed(
  () =>
    `第 ${pseudo.messageId} 层 · ${data.本尊.境界描述} · ${currentLocation.value} · ${worldTimeTooltip.value} · 险${data.本尊.行踪.危险度 ?? 10}（展开状态栏）`,
);
const confirmDelete = () => {
  if (!pseudo.canDelete) return;
  pseudo.deleteCurrent();
};
const openPreset = () => {
  mobileToolsOpen.value = false;
  emit('open-preset');
};
const openGreetingIndex = () => {
  mobileToolsOpen.value = false;
  emit('open-greeting-index');
};
const openAppearance = () => {
  mobileToolsOpen.value = false;
  emit('open-settings');
};
const selectReadingMode = (mode: ReadingMode) => {
  mobileToolsOpen.value = false;
  emit('set-reading-mode', mode);
};
const toggleMobileMode = () => {
  mobileToolsOpen.value = false;
  pseudo.setDetached(!props.detached);
};
const toggleMobileStatus = () => {
  mobileToolsOpen.value = false;
  emit('toggle-status');
};
const handleMobileToolPointerDown = (event: PointerEvent) => {
  if (!mobileToolsOpen.value || mobileToolGroup.value?.contains(event.target as Node)) return;
  mobileToolsOpen.value = false;
};
const handleMobileToolKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') mobileToolsOpen.value = false;
};

onMounted(() => {
  document.addEventListener('pointerdown', handleMobileToolPointerDown);
  document.addEventListener('keydown', handleMobileToolKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleMobileToolPointerDown);
  document.removeEventListener('keydown', handleMobileToolKeydown);
});

watch(
  () => pseudo.canDelete,
  canDelete => {
    if (!canDelete && !pseudo.isDeleting) deleteDialogOpen.value = false;
  },
);
const showParent = computed(() => {
  const parent = props.parentRegion.trim();
  const current = currentLocation.value;
  return Boolean(parent && current && parent !== current && !current.startsWith(`${parent}·`));
});
</script>

<style lang="scss" scoped>
.stage-header {
  position: relative;
  min-height: 66px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(260px, 1.1fr) minmax(260px, 1fr);
  align-items: center;
  gap: 18px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line-strong);
  background: var(--header-bg);
  box-shadow:
    inset 0 -1px 0 color-mix(in srgb, var(--gold) 12%, transparent),
    0 8px 26px color-mix(in srgb, var(--stage-shadow) 54%, transparent);
  overflow: visible;
  z-index: 15;
}

.stage-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      transparent 0 5%,
      color-mix(in srgb, var(--gold) 7%, transparent) 18%,
      transparent 34% 66%,
      color-mix(in srgb, var(--jade) 6%, transparent) 82%,
      transparent 95%
    ),
    var(--grain-material);
  pointer-events: none;
}

.stage-header::after {
  content: '';
  position: absolute;
  right: 50%;
  bottom: -1px;
  width: 76px;
  height: 2px;
  transform: translateX(50%);
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  opacity: 0.62;
}

.stage-header > * {
  position: relative;
  z-index: 1;
}

.turn-cluster,
.turn-navigation,
.reading-mode-switch,
.stage-utilities {
  display: flex;
  align-items: center;
}
.turn-cluster {
  min-width: 0;
  gap: 9px;
}
.crane-mark {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  object-fit: contain;
  filter: drop-shadow(0 3px 8px var(--stage-shadow)) sepia(0.16);
}
.turn-copy {
  min-width: 74px;
  display: grid;
  gap: 1px;
}
.turn-copy span {
  color: var(--gold-soft);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 10px;
}
.turn-copy strong {
  max-width: 150px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.turn-token-count {
  width: max-content;
  color: var(--text-secondary);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 9px;
  line-height: 1;
}
.turn-navigation {
  gap: 3px;
}
.reading-mode-switch {
  flex: 0 0 auto;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-inset) 68%, transparent);
}
.turn-navigation span {
  min-width: 36px;
  color: var(--text-secondary);
  font-size: 10px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.turn-navigation button,
.reading-mode-switch button,
.stage-utilities button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 4%, transparent);
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--line-strong);
    color: var(--gold);
    background: var(--button-hover);
  }
  &:disabled {
    opacity: 0.28;
    cursor: not-allowed;
  }
}
.reading-mode-switch button {
  width: 26px;
  height: 26px;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.reading-mode-switch button.active {
  color: var(--gold);
  background: var(--button-active);
}

.scene-hud {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.scene-location {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
  text-shadow: 0 1px 10px var(--stage-shadow);
  transition:
    border-color 0.2s ease,
    background 0.2s ease;

  &:hover {
    border-color: var(--line-subtle);
    background: color-mix(in srgb, var(--surface-inset) 56%, transparent);
  }
}
.scene-kicker {
  color: var(--text-secondary);
  font-size: 9px;
  letter-spacing: 0.08em;
}
.scene-location strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--gold);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scene-location-compact {
  display: none;
}
.scene-location strong i {
  margin-right: 5px;
  color: var(--jade);
}
.scene-location strong span {
  color: var(--text-accent);
  font-weight: 400;
}
.scene-location strong b {
  padding: 0 5px;
  color: var(--text-secondary);
  font-weight: 400;
}

.world-time-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-accent);
  background: color-mix(in srgb, var(--surface-inset) 68%, transparent);
  font-size: 11px;
  white-space: nowrap;

  i.is-night {
    color: var(--gold);
    filter: drop-shadow(0 0 5px var(--accent-glow));
  }
  i.is-day {
    color: var(--semantic-warning);
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--semantic-warning) 45%, transparent));
  }
}

.stage-utilities {
  min-width: 0;
  justify-content: flex-end;
  gap: 5px;
}
.hud-badges {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 3px;
}
.mobile-tool-group {
  display: none;
}
.danger-badge {
  padding: 4px 8px;
  border: 1px solid color-mix(in srgb, var(--danger-color) 60%, transparent);
  border-radius: 999px;
  color: var(--danger-color);
  background: color-mix(in srgb, var(--danger-color) 10%, transparent);
  font-size: 10px;
  white-space: nowrap;
}
.heaven-posture-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-accent);
  background: color-mix(in srgb, var(--surface-inset) 76%, transparent);
  font-size: 10px;
  white-space: nowrap;
  cursor: help;

  b {
    color: var(--text-secondary);
    font-weight: 400;
  }
  &.sense-顺遂 .posture-sense {
    color: var(--semantic-success);
  }
  &.sense-平稳 .posture-sense {
    color: var(--text-accent);
  }
  &.sense-受挫 .posture-sense {
    color: var(--semantic-warning);
  }
  &.tier-低压 .posture-tier {
    color: var(--jade);
  }
  &.tier-常态 .posture-tier {
    color: var(--text-secondary);
  }
  &.tier-高压 .posture-tier {
    color: var(--gold);
  }
  &.tier-极压 .posture-tier {
    color: var(--semantic-danger);
  }
  .posture-trend {
    font-size: 9px;
    &.is-up {
      color: var(--semantic-danger);
    }
    &.is-down {
      color: var(--jade);
    }
  }
  .posture-tooltip {
    position: absolute;
    z-index: 45;
    top: calc(100% + 8px);
    right: 0;
    width: max-content;
    max-width: 240px;
    padding: 8px 11px;
    display: grid;
    gap: 3px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    color: var(--text-primary);
    background: color-mix(in srgb, var(--surface-raised) 97%, transparent);
    box-shadow: 0 12px 28px var(--stage-shadow);
    font-size: 10px;
    line-height: 1.5;
    white-space: normal;
    overflow-wrap: anywhere;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-3px);
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;

    strong {
      color: var(--gold);
      font-size: 11px;
    }
    span {
      color: var(--text-secondary);
    }
  }
  &:hover .posture-tooltip,
  &:focus-visible .posture-tooltip {
    opacity: 1;
    transform: translateY(0);
  }
}
.delete-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--semantic-danger) 56%, var(--line-strong)) !important;
  color: var(--semantic-danger) !important;
}

.delete-dialog-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: color-mix(in srgb, var(--stage-shadow) 74%, transparent);
  backdrop-filter: blur(4px);
}
.delete-dialog {
  width: min(420px, 100%);
  padding: 20px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--semantic-danger) 42%, var(--line-strong));
  border-radius: 7px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
  box-shadow:
    0 26px 80px var(--stage-shadow),
    inset 0 0 0 1px var(--line-subtle);
}
.delete-dialog-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--semantic-danger) 40%, transparent);
  border-radius: 50%;
  color: var(--semantic-danger);
  background: color-mix(in srgb, var(--semantic-danger) 10%, var(--surface-inset));
}
.delete-dialog-copy h2 {
  margin: 0 0 6px;
  color: var(--text-accent);
  font-size: 15px;
}
.delete-dialog-copy p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.7;
}
.delete-dialog-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.delete-dialog-actions button {
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}
.delete-dialog-actions button:disabled {
  opacity: 0.48;
  cursor: wait;
}
.delete-dialog-actions .confirm-delete {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-color: color-mix(in srgb, var(--semantic-danger) 46%, var(--line-subtle));
  color: var(--text-primary);
  background: color-mix(in srgb, var(--semantic-danger) 18%, var(--surface-inset));
}
.delete-dialog-actions .confirm-delete:hover:not(:disabled) {
  color: #fff;
  background: var(--semantic-danger);
}

@media screen and (max-width: 760px) {
  .stage-header {
    min-height: 58px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
    gap: 6px;
    padding: 6px 8px;
    z-index: 40 !important;
    overflow: visible;
  }
  .scene-hud {
    grid-column: 2;
    gap: 5px;
    min-width: 0;
    justify-content: center;
  }
  .world-time-pill,
  .hud-badges,
  .crane-mark,
  .turn-copy {
    display: none;
  }
  .native-status-header .turn-cluster {
    display: none;
  }
  .scene-location {
    min-width: 0;
    padding: 4px 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .scene-kicker,
  .scene-location-full {
    display: none;
  }
  .scene-location-compact {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
  }
  .scene-location-compact i {
    margin-right: 0;
  }
  .scene-location .scene-location-compact span {
    min-width: 0;
    overflow: hidden;
    color: var(--gold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crane-mark {
    width: 28px;
    height: 28px;
  }
  .turn-copy span {
    display: none;
  }
  .turn-copy {
    min-width: 46px;
  }
  .turn-navigation span {
    display: none;
  }
  .stage-utilities {
    grid-column: 3;
    gap: 3px;
  }
  .stage-utilities .preset-button,
  .stage-utilities .greeting-index-button,
  .stage-utilities .appearance-button,
  .stage-utilities .mode-toggle-button,
  .stage-utilities .status-toggle-button,
  .stage-utilities .edit-button,
  .stage-utilities .delete-button,
  .stage-utilities .reroll-button,
  .stage-utilities .immersion-button {
    display: none;
  }
  .reading-mode-switch {
    display: none;
  }
  .mobile-tool-group {
    position: relative;
    display: block;
    flex: 0 0 auto;
  }
  .mobile-tool-menu {
    position: absolute;
    z-index: 30;
    top: calc(100% + 13px);
    right: 0;
    width: 176px;
    padding: 5px;
    display: grid;
    gap: 3px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
    box-shadow:
      0 14px 36px color-mix(in srgb, var(--stage-shadow) 78%, transparent),
      inset 0 0 0 1px var(--line-subtle);
  }
  .mobile-tool-menu::before {
    content: '';
    position: absolute;
    top: -5px;
    right: 12px;
    width: 8px;
    height: 8px;
    border-top: 1px solid var(--line-strong);
    border-left: 1px solid var(--line-strong);
    background: var(--surface-raised);
    transform: rotate(45deg);
  }
  .stage-utilities .mobile-tool-menu button {
    width: 100%;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 9px;
    padding: 0 10px;
    color: var(--text-secondary);
    white-space: nowrap;
  }
  .mobile-tool-menu button i {
    width: 16px;
    color: var(--gold);
    text-align: center;
  }
  .mobile-tool-menu button .mode-switch-icon {
    margin-left: auto;
    font-size: 16px;
  }
  .mobile-tool-menu button.active {
    border-color: color-mix(in srgb, var(--gold) 46%, var(--line-subtle));
    color: var(--text-primary);
    background: var(--button-active);
  }
  .mobile-tool-menu button.active i {
    color: var(--gold);
  }
  .mobile-tool-divider {
    height: 1px;
    margin: 2px 5px;
    background: linear-gradient(90deg, transparent, var(--line-strong), transparent);
  }
  .mobile-tool-menu-enter-active,
  .mobile-tool-menu-leave-active {
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    transform-origin: top right;
  }
  .mobile-tool-menu-enter-from,
  .mobile-tool-menu-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.96);
  }
  .danger-badge {
    padding: 3px 6px;
  }
  .stage-utilities .map-button {
    display: none;
  }
  .turn-navigation button,
  .stage-utilities button {
    width: 34px;
    height: 34px;
  }
}

@media screen and (max-width: 520px) {
  .stage-header {
    min-height: 58px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
    grid-template-rows: none;
    align-content: normal;
    gap: 4px;
  }
  .turn-cluster {
    min-width: 0;
  }
  .turn-copy {
    min-width: 0;
    flex: 0 1 auto;
  }
  .turn-navigation {
    margin-left: 0;
    flex: 0 0 auto;
  }
  .stage-utilities {
    min-width: 0;
    justify-content: flex-end;
    gap: 3px;
  }
}

@media screen and (max-width: 450px) {
  .crane-mark {
    display: none;
  }
}

@media screen and (max-width: 390px) {
  .crane-mark,
  .danger-badge {
    display: none;
  }
  .turn-cluster {
    gap: 4px;
  }
  .turn-navigation button,
  .stage-utilities button {
    width: 30px;
  }
  .scene-location-compact {
    gap: 3px;
    font-size: 13px;
  }
}
.stage-header.status-summary-bar {
  display: flex;
  min-height: 42px;
  gap: 6px;
  padding: 4px 8px;

  .stage-utilities {
    flex: none;
    gap: 3px;
  }
  .stage-utilities > button,
  .stage-utilities .mobile-tool-trigger {
    width: 28px;
    height: 28px;
  }
}
.status-summary {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 0;
  border: 0;
  color: var(--text-secondary);
  background: transparent;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;

  strong {
    color: var(--gold);
  }
  > * {
    flex-shrink: 0;
    white-space: nowrap;
  }
  i {
    margin-right: 3px;
  }
  .summary-realm {
    max-width: 85px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--jade);
  }
  .summary-location {
    flex: 1 1 50px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@media screen and (max-width: 760px) {
  .stage-header.status-summary-bar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
    align-items: flex-start;
  }
  .status-summary-bar .status-summary {
    grid-column: 2;
  }
  .status-summary > :not(.summary-location) {
    display: none;
  }
  .status-summary .summary-location {
    padding-top: 4px;
    color: var(--gold);
    font-size: 13px;
    text-align: center;
  }
  .status-summary-bar .mobile-tool-group {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  // 折叠楼层让菜单撑开自身高度，避免弹层被短 iframe 裁切。
  .status-summary-bar .mobile-tool-menu {
    position: relative;
    top: auto;
    right: auto;
    margin-top: 8px;
  }
}
</style>
