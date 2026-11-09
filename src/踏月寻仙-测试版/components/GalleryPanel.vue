<template>
  <div class="panel gallery-panel">
    <div v-if="store.hasGalleryCards" class="gallery-container">
      <div
        v-for="(card, index) in store.galleryCards"
        :key="index"
        class="gallery-card"
        :class="{ flipped: card.isFlipped }"
        @click="store.toggleCardFlip(index)"
      >
        <div class="card-inner">
          <!-- 正面 -->
          <div class="card-face card-front">
            <Transition name="portrait-fade">
              <img :key="card.front" :src="card.front" :alt="card.frontName || card.name" />
            </Transition>
            <div class="card-name-bar">{{ card.frontName || card.name }}</div>
          </div>
          <!-- 背面 -->
          <div class="card-face card-back">
            <div class="back-content">
              <Transition name="portrait-fade">
                <img :key="card.back" :src="card.back" :alt="card.backName || card.name" class="back-image" />
              </Transition>
              <div class="back-info-panel">
                <div class="back-name">{{ card.backName || card.name }}</div>
                <div class="back-text">「{{ card.backText }}」</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card-image-controls" @click.stop>
          <template v-if="getVisiblePool(card).length > 1">
            <button type="button" aria-label="上一张立绘" title="上一张" @click="browseCard(index, -1)">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button type="button" aria-label="随机更换立绘" title="随机更换" @click="browseCard(index, 'random')">
              <i class="fa-solid fa-shuffle"></i>
            </button>
            <button type="button" aria-label="下一张立绘" title="下一张" @click="browseCard(index, 1)">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </template>
          <button type="button" aria-label="放大查看立绘" title="查看大图" @click="openPreview(index)">
            <i class="fa-solid fa-magnifying-glass-plus"></i>
          </button>
        </div>
      </div>
    </div>
    <div v-else class="empty-hint">当前场景暂无角色卡片</div>

    <Teleport to="body">
      <Transition name="preview-fade">
        <div v-if="previewCard" class="preview-overlay" role="dialog" aria-modal="true" @click="closePreview">
          <div class="preview-dialog" @click.stop>
            <header class="preview-header">
              <div class="preview-identity">
                <strong>{{ getCardDisplayName(previewCard) }}</strong>
                <span>{{ previewCard.isFlipped ? '背面立绘' : '正面立绘' }}</span>
              </div>
              <button type="button" class="preview-close" aria-label="关闭大图预览" title="关闭" @click="closePreview">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </header>

            <nav v-if="store.galleryCards.length > 1" class="preview-character-tabs" aria-label="切换在场角色">
              <button
                v-for="(card, index) in store.galleryCards"
                :key="`${card.name}-${index}`"
                type="button"
                :class="{ active: previewCardIndex === index }"
                @click="selectPreviewCard(index)"
              >
                {{ card.frontName || card.name }}
              </button>
            </nav>

            <div class="preview-media">
              <Transition name="preview-portrait" mode="out-in">
                <img
                  :key="`${previewCard.isFlipped ? 'back' : 'front'}:${getVisibleImage(previewCard)}`"
                  :src="getVisibleImage(previewCard)"
                  :alt="getCardDisplayName(previewCard)"
                  class="preview-image"
                />
              </Transition>
              <div v-if="previewCard.isFlipped && previewCard.backText" class="preview-thought">
                「{{ previewCard.backText }}」
              </div>
            </div>

            <footer class="preview-actions">
              <template v-if="getVisiblePool(previewCard).length > 1">
                <button type="button" aria-label="上一张立绘" title="上一张" @click="browsePreview(-1)">
                  <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button type="button" aria-label="随机更换立绘" title="随机更换" @click="browsePreview('random')">
                  <i class="fa-solid fa-shuffle"></i>
                </button>
                <button type="button" aria-label="下一张立绘" title="下一张" @click="browsePreview(1)">
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              </template>
              <button type="button" aria-label="翻转立绘" title="翻转正反面" @click="togglePreviewFlip">
                <i class="fa-solid fa-rotate"></i>
              </button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';

const store = useDataStore();

type GalleryCard = (typeof store.galleryCards)[number];
type BrowseDirection = -1 | 1 | 'random';

const previewCardIndex = ref<number | null>(null);
let bodyOverflowBeforePreview = '';
let isBodyScrollLocked = false;

const getCardDisplayName = (card: GalleryCard) => {
  return card.isFlipped ? card.backName || card.name : card.frontName || card.name;
};

const getVisiblePool = (card: GalleryCard) => {
  return card.isFlipped ? card.backCandidates : card.frontCandidates;
};

const getVisibleImage = (card: GalleryCard) => {
  return card.isFlipped ? card.back : card.front;
};

const previewCard = computed(() => {
  if (previewCardIndex.value === null) return null;
  return store.galleryCards[previewCardIndex.value] ?? null;
});

const browseCard = (index: number, direction: BrowseDirection) => {
  store.changeGalleryCardImage(index, direction);
};

const browsePreview = (direction: BrowseDirection) => {
  if (previewCardIndex.value === null) return;
  browseCard(previewCardIndex.value, direction);
};

const openPreview = (index: number) => {
  if (!store.galleryCards[index]) return;
  previewCardIndex.value = index;
};

const selectPreviewCard = (index: number) => {
  if (!store.galleryCards[index]) return;
  previewCardIndex.value = index;
};

const togglePreviewFlip = () => {
  if (previewCardIndex.value === null) return;
  store.toggleCardFlip(previewCardIndex.value);
};

const closePreview = () => {
  previewCardIndex.value = null;
};

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closePreview();
  } else if (previewCard.value && event.key === 'ArrowLeft') {
    event.preventDefault();
    browsePreview(-1);
  } else if (previewCard.value && event.key === 'ArrowRight') {
    event.preventDefault();
    browsePreview(1);
  }
};

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
  if (isBodyScrollLocked) {
    document.body.style.overflow = bodyOverflowBeforePreview;
  }
});

watch(
  () => previewCard.value !== null,
  isOpen => {
    if (isOpen) {
      bodyOverflowBeforePreview = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      isBodyScrollLocked = true;
      return;
    }
    if (isBodyScrollLocked) {
      document.body.style.overflow = bodyOverflowBeforePreview;
      isBodyScrollLocked = false;
    }
  },
);

watch(
  () => store.galleryCards.length,
  length => {
    if (length <= 0) {
      closePreview();
      return;
    }
    if (previewCardIndex.value !== null && previewCardIndex.value >= length) {
      closePreview();
    }
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.gallery-panel {
  padding: 16px !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  .gallery-container {
    display: inline-flex;
    flex-direction: row;
    gap: 20px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 16px 0 10px;
    max-width: 100%;

    &::-webkit-scrollbar {
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--button-bg);
      border-radius: 4px;

      &:hover {
        background: var(--button-hover);
      }
    }
  }

  .gallery-card {
    flex-shrink: 0;
    width: 280px;
    perspective: 1000px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  }

  .card-inner {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    transition: transform 0.6s ease;
    transform-style: preserve-3d;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }

  .gallery-card.flipped .card-inner {
    transform: rotateY(180deg);
  }

  .card-image-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 8px;
    padding: 3px;
    border: 1px solid rgba(255, 235, 225, 0.2);
    border-radius: 6px;
    background: rgba(38, 14, 15, 0.76);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
    opacity: 0.76;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
    backdrop-filter: blur(6px);
    cursor: default;

    button {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: #f3d7cc;
      cursor: pointer;
      transition:
        color 0.16s ease,
        background 0.16s ease;

      &:hover,
      &:focus-visible {
        color: #fff;
        background: rgba(211, 119, 105, 0.24);
        outline: none;
      }
    }

  }

  .gallery-card:hover .card-image-controls,
  .gallery-card:focus-within .card-image-controls {
    opacity: 1;
    transform: translateY(1px);
  }

  .card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid var(--border-color);
  }

  .card-front {
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .card-name-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 12px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
    }
  }

  .card-back {
    transform: rotateY(180deg);
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);

    .back-content {
      width: 100%;
      height: 100%;
      position: relative;

      .back-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .back-info-panel {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 20px 16px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
        text-align: center;

        .back-name {
          font-size: 18px;
          font-weight: bold;
          color: #a0c0ff;
          margin-bottom: 8px;
          text-shadow:
            0 0 15px rgba(100, 150, 255, 0.6),
            0 2px 4px rgba(0, 0, 0, 0.8);
        }

        .back-text {
          font-size: 14px;
          color: #d0e0f0;
          line-height: 1.6;
          font-style: italic;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        }
      }
    }
  }

  .empty-hint {
    text-align: center;
    padding: 20px;
    color: #506070;
    font-style: italic;
  }

}

.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(10, 4, 6, 0.94);
  backdrop-filter: blur(10px);
}

.preview-dialog {
  width: min(94vw, 720px);
  height: min(94dvh, 920px);
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  padding: 14px;
  overflow: hidden;
  border: 1px solid rgba(240, 190, 172, 0.22);
  border-radius: 8px;
  background: rgba(35, 12, 14, 0.96);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.58);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.preview-identity {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;

  strong {
    overflow: hidden;
    color: #fff0e8;
    font-size: 18px;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    flex-shrink: 0;
    color: #cda99d;
    font-size: 12px;
  }
}

.preview-close,
.preview-actions button {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(244, 211, 199, 0.16);
  border-radius: 6px;
  background: rgba(91, 37, 38, 0.72);
  color: #f4d8cf;
  cursor: pointer;
  transition:
    color 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;

  &:hover,
  &:focus-visible {
    border-color: rgba(248, 213, 201, 0.36);
    background: rgba(126, 52, 51, 0.9);
    color: #fff;
    outline: none;
  }
}

.preview-close {
  width: 36px;
  height: 36px;
  font-size: 17px;
}

.preview-character-tabs {
  display: flex;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;

  button {
    flex-shrink: 0;
    min-height: 30px;
    padding: 5px 12px;
    border: 1px solid rgba(236, 191, 174, 0.14);
    border-radius: 5px;
    background: rgba(69, 26, 28, 0.56);
    color: #caa9a0;
    font-size: 12px;
    cursor: pointer;

    &.active {
      border-color: rgba(240, 166, 144, 0.48);
      background: rgba(118, 44, 43, 0.82);
      color: #fff1e9;
    }
  }
}

.preview-media {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(245, 220, 209, 0.12);
  border-radius: 6px;
  background: #12090a;
}

.preview-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.preview-thought {
  position: absolute;
  right: 12px;
  bottom: 12px;
  left: 12px;
  padding: 20px 14px 12px;
  overflow-wrap: anywhere;
  background: linear-gradient(to top, rgba(12, 6, 7, 0.88), transparent);
  color: #ead8d2;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  text-shadow: 0 1px 3px #000;
  pointer-events: none;
}

.preview-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  button {
    width: 38px;
    height: 36px;
  }
}

.portrait-fade-enter-active,
.portrait-fade-leave-active {
  transition: opacity 0.16s ease;
}

.portrait-fade-enter-from,
.portrait-fade-leave-to {
  opacity: 0;
}

.preview-portrait-enter-active,
.preview-portrait-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.preview-portrait-enter-from {
  opacity: 0;
  transform: scale(0.985);
}

.preview-portrait-leave-to {
  opacity: 0;
  transform: scale(1.01);
}

.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.22s ease;
}

.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

// 手机端适配
@media screen and (max-width: 480px) {
  .gallery-panel {
    padding: 12px !important;

    .gallery-container {
      gap: 14px;
      padding-top: 12px;
    }

    .gallery-card {
      width: 200px;
    }

    .card-front {
      .card-name-bar {
        padding: 10px;
        font-size: 14px;
      }
    }

    .card-back {
      .back-content {
        .back-info-panel {
          padding: 16px 12px;

          .back-name {
            font-size: 15px;
          }

          .back-text {
            font-size: 12px;
          }
        }
      }
    }

    .card-image-controls {
      margin-top: 6px;

      button {
        width: 26px;
        height: 26px;
      }

    }

  }

  .preview-overlay {
    padding: 8px;
  }

  .preview-dialog {
    width: calc(100vw - 16px);
    height: calc(100dvh - 16px);
    gap: 8px;
    padding: 10px;
  }

  .preview-identity {
    gap: 7px;

    strong {
      font-size: 16px;
    }

    span {
      font-size: 11px;
    }
  }

  .preview-character-tabs button {
    min-height: 28px;
    padding: 4px 10px;
    font-size: 11px;
  }

  .preview-thought {
    right: 6px;
    bottom: 6px;
    left: 6px;
    padding: 18px 10px 8px;
    font-size: 12px;
  }
}

@media (hover: none) {
  .gallery-panel .card-image-controls {
    opacity: 0.9;
  }
}

// 超小屏幕适配
@media screen and (max-width: 360px) {
  .gallery-panel {
    .gallery-card {
      width: 160px;
    }
  }
}
</style>
