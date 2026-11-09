<template>
  <button
    v-if="card && visibleImage"
    type="button"
    class="mobile-portrait-command"
    :title="`查看${displayName}立绘`"
    :aria-label="`查看${displayName}立绘`"
    @click="openPreview"
  >
    <img :src="visibleImage" :alt="displayName" />
    <span class="portrait-shade" aria-hidden="true"></span>
    <span class="portrait-presence" aria-hidden="true"></span>
  </button>
</template>

<script setup lang="ts">
import { useDataStore, useGalleryUiStore } from '../store';

const data = useDataStore();
const galleryUi = useGalleryUiStore();
const selectedIndex = ref(0);

const normalizedIndex = computed(() => {
  if (!data.galleryCards.length) return 0;
  return Math.min(Math.max(selectedIndex.value, 0), data.galleryCards.length - 1);
});
const card = computed(() => data.galleryCards[normalizedIndex.value] ?? null);
const visibleImage = computed(() => {
  const value = card.value;
  if (!value) return '';
  return value.isFlipped ? value.back : value.front;
});
const displayName = computed(() => {
  const value = card.value;
  if (!value) return '';
  return value.isFlipped ? value.backName || value.name : value.frontName || value.name;
});

watch(
  () => galleryUi.previewCardIndex,
  index => {
    if (index !== null && data.galleryCards[index]) selectedIndex.value = index;
  },
);

watch(
  () => data.galleryCards.length,
  length => {
    if (!length) {
      selectedIndex.value = 0;
      return;
    }
    selectedIndex.value = Math.min(selectedIndex.value, length - 1);
  },
);

const openPreview = () => {
  galleryUi.openPreview(normalizedIndex.value);
};
</script>

<style lang="scss" scoped>
.mobile-portrait-command {
  position: relative;
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  flex: 0 0 44px;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--gold) 62%, var(--line-strong));
  border-radius: 7px;
  background: var(--surface-raised);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold-soft) 18%, transparent),
    0 0 12px color-mix(in srgb, var(--gold) 10%, transparent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.mobile-portrait-command:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

.mobile-portrait-command img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: 50% 18%;
}

.portrait-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, transparent 52%, rgba(1, 10, 15, 0.58)),
    linear-gradient(90deg, color-mix(in srgb, var(--gold-soft) 12%, transparent), transparent 44%);
  box-shadow: inset 0 0 0 2px rgba(4, 13, 18, 0.48);
}

.portrait-presence {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border: 1px solid rgba(221, 255, 245, 0.85);
  border-radius: 50%;
  background: var(--jade);
  box-shadow: 0 0 5px color-mix(in srgb, var(--jade) 80%, transparent);
}

@media (hover: hover) {
  .mobile-portrait-command:hover {
    border-color: var(--gold);
    filter: brightness(1.08);
  }
}
</style>
