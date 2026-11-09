<template>
  <Transition name="settings-fade">
    <div v-if="visible" class="settings-scrim" @click="$emit('close')">
      <section class="settings-panel" role="dialog" aria-modal="true" aria-label="外观设置" @click.stop>
        <header>
          <div>
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span
              ><strong>外观设置</strong><small>{{ appearance.currentTheme.name }}</small></span
            >
          </div>
          <button type="button" title="关闭" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></button>
        </header>

        <div class="theme-setting">
          <div class="setting-heading">
            <span>界面模式</span>
            <small>{{ pseudo.isDetachedMode ? '状态随楼层，正文随酒馆' : '正文与状态同在一席' }}</small>
          </div>
          <div class="segmented-control" role="group" aria-label="界面模式">
            <button
              type="button"
              :class="{ active: !pseudo.isDetachedMode }"
              :disabled="pseudo.isGenerating || pseudo.isDeleting || pseudo.isUpdatingMessage"
              @click="pseudo.setDetached(false)"
            >
              <i class="fa-solid fa-layer-group"></i>伪同层舞台
            </button>
            <button
              type="button"
              :class="{ active: pseudo.isDetachedMode }"
              :disabled="pseudo.isGenerating || pseudo.isDeleting || pseudo.isUpdatingMessage"
              @click="pseudo.setDetached(true)"
            >
              <i class="fa-solid fa-list"></i>原生楼层
            </button>
          </div>
        </div>

        <div class="theme-setting">
          <div class="setting-heading">
            <span>界面主题</span>
            <small>四境随心，一念换景</small>
          </div>
          <div class="theme-grid">
            <button
              v-for="theme in appearance.availableThemes"
              :key="theme.id"
              type="button"
              class="theme-card"
              :class="{ active: appearance.currentThemeId === theme.id, light: theme.mode === 'light' }"
              :style="{
                '--preview-bg': theme.preview.background,
                '--preview-surface': theme.preview.surface,
                '--preview-accent': theme.preview.accent,
              }"
              @click="appearance.selectTheme(theme.id)"
            >
              <span class="theme-preview" aria-hidden="true">
                <i :class="theme.glyph"></i>
                <span class="preview-window"></span>
                <span class="preview-rail"></span>
              </span>
              <span class="theme-copy">
                <strong>{{ theme.name }}</strong>
                <small>{{ theme.description }}</small>
              </span>
              <i v-if="appearance.currentThemeId === theme.id" class="theme-check fa-solid fa-check"></i>
            </button>
          </div>
        </div>

        <div v-if="!pseudo.isDetachedMode" class="reading-settings">
          <div class="setting-heading">
            <span>阅读排版</span>
            <small>只影响正文阅读席</small>
          </div>

          <div class="setting-group">
            <span>阅读模式</span>
            <div class="segmented-control">
              <button
                v-for="item in readingModes"
                :key="item.value"
                type="button"
                :class="{ active: currentReadingMode === item.value }"
                @click="appearance.setReadingMode(viewportMode, item.value)"
              >
                <i :class="item.icon"></i> {{ item.label }}
              </button>
            </div>
          </div>

          <label class="range-setting">
            <span
              >正文字号 <output>{{ appearance.preferences.fontSize }}px</output></span
            >
            <input
              :value="appearance.preferences.fontSize"
              type="range"
              min="14"
              max="20"
              step="1"
              @input="updateNumber('fontSize', $event)"
            />
          </label>

          <label class="range-setting">
            <span
              >正文行距 <output>{{ appearance.preferences.lineHeight.toFixed(2) }}</output></span
            >
            <input
              :value="appearance.preferences.lineHeight"
              type="range"
              min="1.7"
              max="2.2"
              step="0.05"
              @input="updateNumber('lineHeight', $event)"
            />
          </label>

          <div class="dialogue-color-setting">
            <div class="dialogue-color-heading">
              <span>
                <strong>对白颜色</strong>
                <small>{{ appearance.currentTheme.name }}单独保存 · 点选推荐色即可生效</small>
              </span>
              <div class="dialogue-color-controls">
                <input
                  :value="appearance.currentDialogueColor"
                  type="color"
                  aria-label="精调对白颜色"
                  title="打开完整取色器精调"
                  @input="updateDialogueColor"
                />
                <output>{{ appearance.currentDialogueColor.toUpperCase() }}</output>
                <button
                  type="button"
                  :disabled="!appearance.hasCustomDialogueColor"
                  title="恢复当前主题预设的对白颜色"
                  @click="appearance.resetDialogueColor"
                >
                  <i class="fa-solid fa-arrow-rotate-left"></i>
                  恢复主题色
                </button>
              </div>
            </div>
            <div class="dialogue-color-palette" role="group" aria-label="推荐对白颜色">
              <button
                v-for="preset in dialogueColorPresets"
                :key="preset.color"
                type="button"
                :class="{ active: isDialogueColorSelected(preset.color) }"
                :aria-label="`使用${preset.label}${preset.recommended ? '推荐色' : ''} ${preset.color}`"
                :aria-pressed="isDialogueColorSelected(preset.color)"
                :title="`${preset.label} · ${preset.color}`"
                @click="appearance.setDialogueColor(preset.color)"
              >
                <span class="palette-swatch" :style="{ backgroundColor: preset.color }"></span>
                <span class="palette-label">
                  {{ preset.label }}
                  <small v-if="preset.recommended">推荐</small>
                </span>
              </button>
            </div>
          </div>

          <div class="reading-width-setting">
            <div class="reading-width-heading">
              <span>
                <strong>阅读宽度</strong>
                <small>调节正文占用内容区的比例</small>
              </span>
              <output>{{ appearance.preferences.measureWidth }}%</output>
            </div>
            <input
              :value="appearance.preferences.measureWidth"
              type="range"
              min="50"
              max="100"
              step="1"
              aria-label="阅读宽度"
              @input="updateMeasureWidth"
            />
            <div class="width-preset-row">
              <button
                v-for="item in measures"
                :key="item.value"
                type="button"
                :class="{ active: appearance.preferences.measureWidth === item.width }"
                @click="selectMeasure(item)"
              >
                <span>{{ item.label }}</span>
                <small>{{ item.width }}%</small>
              </button>
            </div>
          </div>

          <div class="setting-group reasoning-appearance-setting">
            <span>
              <strong>思维链外观</strong>
              <small>优先保留预设已有美化</small>
            </span>
            <div class="segmented-control">
              <button
                v-for="item in reasoningAppearances"
                :key="item.value"
                type="button"
                :title="item.description"
                :class="{ active: appearance.preferences.reasoningAppearance === item.value }"
                @click="appearance.updatePreferences({ reasoningAppearance: item.value })"
              >
                {{ item.label }}
              </button>
            </div>
          </div>

          <label class="toggle-setting">
            <span><strong>在场立绘</strong><small>手机端固定于命令栏，桌面端显示于正文旁</small></span>
            <input
              :checked="appearance.preferences.showPortraitRail"
              type="checkbox"
              @change="updateBoolean('showPortraitRail', $event)"
            />
          </label>
          <label class="toggle-setting">
            <span><strong>酒馆输入区</strong><small>在伪同层下方显示原生输入框</small></span>
            <input :checked="!pseudo.view.nativeInputCollapsed" type="checkbox" @change="pseudo.toggleNativeInput" />
          </label>
          <label class="toggle-setting">
            <span><strong>减少动效</strong><small>关闭灯影、雾气与星轨动画</small></span>
            <input
              :checked="appearance.preferences.reduceMotion"
              type="checkbox"
              @change="updateBoolean('reduceMotion', $event)"
            />
          </label>
        </div>

        <footer>
          <button type="button" @click="resetDefaults"><i class="fa-solid fa-rotate-left"></i> 恢复阅读默认值</button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { usePseudoLayerStore, useThemeStore } from '../store';
import type { ThemeId } from '../themes';
import type {
  ReasoningAppearanceMode,
  ReadingMeasure,
  ReadingMode,
  ReadingPreferences,
  ReadingViewportMode,
} from '../stores/theme-store';

const props = defineProps<{ visible: boolean; viewportMode: ReadingViewportMode }>();
defineEmits<{ (event: 'close'): void }>();
const appearance = useThemeStore();
const pseudo = usePseudoLayerStore();
const measures: Array<{ value: ReadingMeasure; label: string; width: number }> = [
  { value: 'narrow', label: '窄', width: 58 },
  { value: 'standard', label: '标准', width: 76 },
  { value: 'wide', label: '宽', width: 100 },
];
const readingModes: Array<{ value: ReadingMode; label: string; icon: string }> = [
  { value: 'paged', label: '翻页', icon: 'fa-solid fa-book-open' },
  { value: 'scroll', label: '翻滚', icon: 'fa-solid fa-scroll' },
];
const reasoningAppearances: Array<{ value: ReasoningAppearanceMode; label: string; description: string }> = [
  { value: 'auto', label: '自动适配', description: '有预设美化时原样保留，否则使用灯火主题' },
  { value: 'preset', label: '保留预设', description: '优先使用预设格式，普通内容保持基础排版' },
  { value: 'theme', label: '灯火主题', description: '统一使用随当前界面主题变化的心灯样式' },
];
type DialogueColorPreset = { label: string; color: string; recommended?: boolean };
const DIALOGUE_COLOR_PRESETS: Record<ThemeId, DialogueColorPreset[]> = {
  lantern: [
    { label: '玉青', color: '#7FD2C1', recommended: true },
    { label: '暖金', color: '#E6BD76' },
    { label: '月白', color: '#E5DED2' },
    { label: '天青', color: '#7FB9D0' },
    { label: '桃霞', color: '#D88C9D' },
    { label: '淡紫', color: '#BAA7D8' },
  ],
  duskInk: [
    { label: '青瓷', color: '#83C5B5', recommended: true },
    { label: '暮金', color: '#DEB66B' },
    { label: '绢白', color: '#DDD4C1' },
    { label: '雾蓝', color: '#86B5BE' },
    { label: '杏霞', color: '#D58F82' },
    { label: '藤紫', color: '#BCA7C6' },
  ],
  shanhai: [
    { label: '青墨', color: '#174F4C', recommended: true },
    { label: '黛蓝', color: '#244B5A' },
    { label: '松烟', color: '#334541' },
    { label: '赭石', color: '#70452F' },
    { label: '深金', color: '#72561F' },
    { label: '朱砂', color: '#843C35' },
  ],
  starAltar: [
    { label: '星玉', color: '#63D9C8', recommended: true },
    { label: '星金', color: '#D2AE65' },
    { label: '霜白', color: '#D7E7E2' },
    { label: '苍蓝', color: '#6AB8D0' },
    { label: '绯紫', color: '#CF83B1' },
    { label: '银紫', color: '#AAA6D8' },
  ],
};
const currentReadingMode = computed(() => appearance.readingModes[props.viewportMode]);
const viewportMode = computed(() => props.viewportMode);
const dialogueColorPresets = computed(() => DIALOGUE_COLOR_PRESETS[appearance.currentThemeId]);
const isDialogueColorSelected = (color: string) =>
  appearance.currentDialogueColor.toLowerCase() === color.toLowerCase();

const updateNumber = (key: 'fontSize' | 'lineHeight', event: Event) => {
  appearance.updatePreferences({ [key]: Number((event.target as HTMLInputElement).value) });
};
const updateMeasureWidth = (event: Event) => {
  appearance.updatePreferences({ measureWidth: Number((event.target as HTMLInputElement).value) });
};
const updateDialogueColor = (event: Event) => {
  appearance.setDialogueColor((event.target as HTMLInputElement).value);
};
const selectMeasure = (item: (typeof measures)[number]) => {
  appearance.updatePreferences({ measure: item.value, measureWidth: item.width });
};
const updateBoolean = (key: keyof Pick<ReadingPreferences, 'showPortraitRail' | 'reduceMotion'>, event: Event) => {
  appearance.updatePreferences({ [key]: (event.target as HTMLInputElement).checked });
};
const resetDefaults = () => {
  appearance.resetPreferences();
  appearance.resetReadingMode(props.viewportMode);
};
</script>

<style lang="scss" scoped>
.settings-scrim {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 7, 10, 0.74);
  backdrop-filter: blur(8px);
}

.settings-panel {
  width: min(94vw, 720px);
  max-height: min(90dvh, 820px);
  overflow: auto;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--surface-raised);
  box-shadow: 0 28px 70px var(--stage-shadow);
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.settings-panel > header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 58px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line-subtle);
  background: var(--header-bg);
  backdrop-filter: blur(12px);
}

.settings-panel > header > div {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--gold);
}
.settings-panel > header > div > span {
  display: grid;
  gap: 2px;
}
.settings-panel > header small {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 400;
}
.settings-panel header button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}

.theme-setting,
.reading-settings {
  padding: 16px 18px;
  border-bottom: 1px solid var(--line-subtle);
}
.setting-heading {
  margin-bottom: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.setting-heading > span {
  color: var(--text-accent);
  font-weight: 700;
}
.setting-heading small {
  color: var(--text-secondary);
  font-size: 10px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.theme-card {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  padding: 9px;
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 7px;
  color: var(--text-primary);
  background: var(--surface-inset);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.theme-card:hover {
  transform: translateY(-1px);
  border-color: var(--line-strong);
}
.theme-card.active {
  border-color: var(--preview-accent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--preview-accent) 25%, transparent),
    0 8px 24px var(--stage-shadow);
}
.theme-preview {
  position: relative;
  height: 66px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--preview-accent) 45%, transparent);
  border-radius: 5px;
  background: var(--preview-bg);
}
.theme-preview > i {
  position: absolute;
  top: 8px;
  left: 9px;
  z-index: 2;
  color: var(--preview-accent);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--preview-accent) 45%, transparent));
}
.preview-window {
  position: absolute;
  inset: 20px 30px 8px 8px;
  border: 1px solid color-mix(in srgb, var(--preview-accent) 45%, transparent);
  background: var(--preview-surface);
}
.preview-rail {
  position: absolute;
  top: 20px;
  right: 8px;
  bottom: 8px;
  width: 17px;
  border: 1px solid color-mix(in srgb, var(--preview-accent) 38%, transparent);
  background: color-mix(in srgb, var(--preview-surface) 88%, transparent);
}
.theme-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}
.theme-copy strong {
  color: var(--text-accent);
}
.theme-copy small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}
.theme-check {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--preview-accent);
  font-size: 10px;
}

.reading-settings {
  padding-bottom: 4px;
}
.range-setting,
.setting-group,
.reading-width-setting,
.dialogue-color-setting,
.toggle-setting {
  padding: 12px 0;
  border-bottom: 1px solid var(--line-subtle);
}
.range-setting {
  display: grid;
  gap: 9px;
}
.range-setting > span {
  display: flex;
  justify-content: space-between;
  color: var(--text-accent);
}
.range-setting output {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.range-setting input {
  width: 100%;
  accent-color: var(--gold);
}
.dialogue-color-setting {
  display: grid;
  gap: 10px;
}
.dialogue-color-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.dialogue-color-heading > span {
  display: grid;
  gap: 2px;
  color: var(--text-accent);
}
.dialogue-color-heading > span small {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 400;
}
.dialogue-color-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dialogue-color-controls input[type='color'] {
  width: 38px;
  height: 30px;
  padding: 2px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  background: var(--surface-inset);
  cursor: pointer;
}
.dialogue-color-controls output {
  min-width: 66px;
  color: var(--text-secondary);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.dialogue-color-controls button {
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--gold-soft);
  background: var(--surface-inset);
  cursor: pointer;
}
.dialogue-color-controls button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.dialogue-color-palette {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.dialogue-color-palette > button {
  min-width: 0;
  padding: 5px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}
.dialogue-color-palette > button:hover,
.dialogue-color-palette > button.active {
  border-color: var(--gold);
  color: var(--text-accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 18%, transparent);
}
.palette-swatch {
  width: 100%;
  height: 22px;
  border: 1px solid color-mix(in srgb, var(--text-primary) 28%, transparent);
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 18%, transparent);
}
.palette-label {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 10px;
  white-space: nowrap;
}
.palette-label small {
  padding: 1px 3px;
  border-radius: 3px;
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  font-size: 8px;
}
.reading-width-setting {
  display: grid;
  gap: 10px;
}
.reading-width-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.reading-width-heading > span {
  display: grid;
  gap: 2px;
}
.reading-width-heading small {
  color: var(--text-secondary);
  font-size: 10px;
}
.reading-width-heading output {
  min-width: 46px;
  color: var(--gold);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.reading-width-setting > input {
  width: 100%;
  accent-color: var(--gold);
}
.width-preset-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.width-preset-row button {
  min-height: 34px;
  padding: 5px 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}
.width-preset-row button small {
  color: color-mix(in srgb, var(--text-secondary) 76%, transparent);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 9px;
}
.width-preset-row button.active {
  border-color: color-mix(in srgb, var(--gold) 48%, var(--line-subtle));
  color: var(--gold);
  background: var(--button-active);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 8%, transparent);
}
.width-preset-row button.active small {
  color: var(--gold-soft);
}
.setting-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-accent);
}
.segmented-control {
  display: flex;
  padding: 2px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  background: var(--surface-inset);
}
.segmented-control button {
  min-width: 48px;
  padding: 6px 10px;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}
.segmented-control button.active {
  color: var(--gold);
  background: var(--button-active);
}
.reasoning-appearance-setting > span {
  display: grid;
  gap: 2px;
}
.reasoning-appearance-setting > span small {
  color: var(--text-secondary);
  font-size: 10px;
}
.reasoning-appearance-setting .segmented-control button {
  min-width: 66px;
}
.toggle-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}
.toggle-setting > span {
  display: grid;
  gap: 2px;
}
.toggle-setting small {
  color: var(--text-secondary);
}
.toggle-setting input {
  width: 18px;
  height: 18px;
  accent-color: var(--jade);
}
.settings-panel footer {
  padding: 12px 18px;
  display: flex;
  justify-content: flex-end;
}
.settings-panel footer button {
  padding: 7px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.18s ease;
}
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

@media screen and (max-width: 620px) {
  .settings-scrim {
    padding: 8px;
  }
  .settings-panel {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
  }
  .theme-setting,
  .reading-settings {
    padding: 14px 12px;
  }
  .theme-grid {
    grid-template-columns: 1fr;
  }
  .theme-card {
    grid-template-columns: 82px minmax(0, 1fr);
  }
  .dialogue-color-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .dialogue-color-palette {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .reasoning-appearance-setting {
    align-items: stretch;
    flex-direction: column;
  }
  .reasoning-appearance-setting .segmented-control {
    width: 100%;
  }
  .reasoning-appearance-setting .segmented-control button {
    min-width: 0;
    flex: 1;
    padding-inline: 6px;
  }
}
</style>
