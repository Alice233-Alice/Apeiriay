<template>
  <Teleport to="body">
    <Transition name="preview-fade">
      <div
        v-if="card"
        class="preview-overlay"
        :data-theme="appearance.currentThemeId"
        :style="previewThemeStyles"
        role="dialog"
        aria-modal="true"
        @click="galleryUi.closePreview"
      >
        <div class="preview-dialog" @click.stop>
          <header class="preview-header">
            <div class="preview-identity">
              <strong>{{ displayName }}</strong>
              <span>{{ card.isFlipped ? '背面立绘' : '正面立绘' }}</span>
            </div>
            <button type="button" class="preview-close" aria-label="关闭大图预览" title="关闭" @click="galleryUi.closePreview">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </header>

          <nav v-if="data.galleryCards.length > 1" class="preview-character-tabs" aria-label="切换在场角色">
            <button
              v-for="(item, index) in data.galleryCards"
              :key="`${item.name}-${index}`"
              type="button"
              :class="{ active: galleryUi.previewCardIndex === index }"
              @click="galleryUi.selectPreviewCard(index)"
            >
              {{ item.frontName || item.name }}
            </button>
          </nav>

          <div class="preview-media">
            <Transition name="preview-portrait" mode="out-in">
              <img :key="visibleImage" :src="visibleImage" :alt="displayName" class="preview-image" />
            </Transition>
            <div v-if="card.isFlipped && card.backText" class="preview-thought">「{{ card.backText }}」</div>
          </div>

          <footer class="preview-actions">
            <template v-if="visiblePool.length > 1">
              <button type="button" aria-label="上一张立绘" title="上一张" @click="galleryUi.browsePreview(-1)">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <button type="button" aria-label="随机更换立绘" title="随机更换" @click="galleryUi.browsePreview('random')">
                <i class="fa-solid fa-shuffle"></i>
              </button>
              <button type="button" aria-label="下一张立绘" title="下一张" @click="galleryUi.browsePreview(1)">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </template>
            <button type="button" aria-label="翻转立绘" title="翻转正反面" @click="galleryUi.togglePreviewFlip">
              <i class="fa-solid fa-rotate"></i>
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useDataStore, useGalleryUiStore, useThemeStore } from '../store';

const data = useDataStore();
const galleryUi = useGalleryUiStore();
const appearance = useThemeStore();
const card = computed(() => galleryUi.previewCard);
const displayName = computed(() => {
  const value = card.value;
  if (!value) return '';
  return value.isFlipped ? value.backName || value.name : value.frontName || value.name;
});
const visibleImage = computed(() => {
  const value = card.value;
  if (!value) return '';
  return value.isFlipped ? value.back : value.front;
});
const visiblePool = computed(() => {
  const value = card.value;
  if (!value) return [];
  return value.isFlipped ? value.backCandidates : value.frontCandidates;
});
const previewThemeStyles = computed(() => {
  const { colors, materials } = appearance.currentTheme;
  return {
    '--line-strong': colors.lineStrong,
    '--line-subtle': colors.lineSubtle,
    '--surface-raised': colors.surfaceRaised,
    '--surface-inset': colors.surfaceInset,
    '--stage-shadow': colors.shadow,
    '--text-primary': colors.textPrimary,
    '--text-secondary': colors.textSecondary,
    '--text-accent': colors.textAccent,
    '--gold': colors.gold,
    '--button-bg': colors.buttonBg,
    '--button-active': colors.buttonActive,
    '--button-hover': colors.buttonHover,
    '--preview-material': materials.stage,
  };
});

let originalOverflow = '';
const onKeydown = (event: KeyboardEvent) => {
  if (!card.value) return;
  if (event.key === 'Escape') galleryUi.closePreview();
  if (event.key === 'ArrowLeft') galleryUi.browsePreview(-1);
  if (event.key === 'ArrowRight') galleryUi.browsePreview(1);
};

watch(
  () => Boolean(card.value),
  open => {
    if (open) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow;
    }
  },
);

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = originalOverflow;
});
</script>

<style lang="scss" scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 18px;
  background: color-mix(in srgb, var(--surface-inset) 86%, transparent);
  backdrop-filter: blur(10px);
}

.preview-dialog {
  width: min(94vw, 1100px);
  height: min(92dvh, 920px);
  max-width: 1100px;
  max-height: 920px;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  padding: 14px;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--preview-material), var(--surface-raised);
  box-shadow: 0 28px 80px var(--stage-shadow);
}

.preview-header,
.preview-identity,
.preview-actions {
  display: flex;
  align-items: center;
}

.preview-header { justify-content: space-between; gap: 16px; }
.preview-identity { min-width: 0; gap: 10px; }
.preview-identity strong { overflow: hidden; color: var(--text-primary); font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.preview-identity span { flex-shrink: 0; color: var(--text-secondary); font-size: 12px; }

.preview-close,
.preview-actions button {
  width: 38px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  color: var(--text-accent);
  background: var(--button-bg);
  cursor: pointer;
}

.preview-character-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}

.preview-character-tabs button {
  flex-shrink: 0;
  min-height: 30px;
  padding: 5px 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}

.preview-character-tabs button.active { border-color: var(--line-strong); color: var(--gold); background: var(--button-active); }
.preview-media { position: relative; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--line-subtle); border-radius: 6px; background: var(--surface-inset); }
.preview-image { display: block; min-width: 0; min-height: 0; width: 100%; height: 100%; object-fit: contain; object-position: center; }
.preview-thought { position: absolute; right: 12px; bottom: 12px; left: 12px; padding: 32px 14px 12px; color: #f4eee5; background: linear-gradient(to top, rgba(5, 7, 10, 0.94), transparent); text-align: center; }
.preview-actions { justify-content: center; gap: 6px; }
.preview-close:hover, .preview-actions button:hover { border-color: var(--line-strong); color: var(--gold); background: var(--button-hover); }
.preview-fade-enter-active, .preview-fade-leave-active { transition: opacity 0.2s ease; }
.preview-fade-enter-from, .preview-fade-leave-to { opacity: 0; }
.preview-portrait-enter-active, .preview-portrait-leave-active { transition: opacity 0.16s ease; }
.preview-portrait-enter-from, .preview-portrait-leave-to { opacity: 0; }

@media screen and (max-width: 480px) {
  .preview-overlay { padding: 8px; }
  .preview-dialog { width: calc(100vw - 16px); height: calc(100dvh - 16px); padding: 10px; }
}
</style>
