<template>
  <aside v-if="card" class="portrait-rail" aria-label="当前在场角色">
    <nav v-if="data.galleryCards.length > 1" class="portrait-tabs">
      <button
        v-for="(item, index) in data.galleryCards"
        :key="`${item.name}-${index}`"
        type="button"
        :class="{ active: selectedIndex === index }"
        @click="selectedIndex = index"
      >
        {{ item.frontName || item.name }}
      </button>
    </nav>

    <button
      class="portrait-stage"
      type="button"
      title="翻转角色立绘"
      :style="{ aspectRatio: portraitAspectRatio }"
      @click="toggleFlip"
    >
      <div
        class="portrait-backdrop-echo"
        :style="{ backgroundImage: visibleImage ? `url('${visibleImage}')` : 'none' }"
        aria-hidden="true"
      ></div>
      <Transition name="portrait-shift" mode="out-in">
        <img :key="visibleImage" :src="visibleImage" :alt="displayName" @load="updatePortraitAspectRatio" />
      </Transition>
      <span class="portrait-side-tag">
        <i class="fa-solid" :class="card.isFlipped ? 'fa-heart-pulse' : 'fa-eye'"></i>
        {{ card.isFlipped ? '心声背面' : '在场立绘' }}
      </span>
      <span class="portrait-caption">
        <small>{{ card.isFlipped ? '心中所念' : '此刻在场' }}</small>
        <strong>{{ displayName }}</strong>
      </span>
    </button>

    <div class="portrait-persona-card">
      <div class="persona-tags">
        <span class="persona-relation">{{ companionRelation }}</span>
        <span v-if="companionRealm" class="persona-realm">{{ companionRealm }}</span>
        <span v-if="companionFavor !== null" class="persona-favor" :title="`好感度 ${companionFavor}`">
          <i class="fa-solid fa-heart"></i> {{ companionFavor }}
        </span>
      </div>
      <p class="persona-mood" :title="personaMoodText">
        <i class="fa-solid fa-feather-pointed"></i>
        <span>{{ personaMoodText }}</span>
      </p>
    </div>

    <div class="portrait-controls">
      <button
        type="button"
        class="talk-primary-btn"
        :title="`与${displayName}交谈`"
        :disabled="!pseudo.isStoryHistoryLatest || pseudo.isGenerating"
        @click="startDialogue"
      >
        <i class="fa-solid fa-comment-dots"></i>
        <span>与她交谈</span>
      </button>
      <div class="scroll-tool-group" role="group" aria-label="画卷控制">
        <template v-if="visibleCandidates.length > 1">
          <button type="button" title="上一张立绘" @click="browse(-1)">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button type="button" title="随机更换立绘" @click="browse('random')">
            <i class="fa-solid fa-shuffle"></i>
          </button>
          <button type="button" title="下一张立绘" @click="browse(1)">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </template>
        <button type="button" title="翻转角色立绘" :class="{ active: card.isFlipped }" @click="toggleFlip">
          <i class="fa-solid fa-rotate"></i>
        </button>
        <button type="button" title="查看大图" @click="galleryUi.openPreview(selectedIndex)">
          <i class="fa-solid fa-expand"></i>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useDataStore, useGalleryUiStore, usePseudoLayerStore } from '../store';
import type { GalleryBrowseDirection } from '../stores/gallery-ui-store';

const data = useDataStore();
const galleryUi = useGalleryUiStore();
const pseudo = usePseudoLayerStore();
const selectedIndex = ref(0);
const portraitAspectRatio = ref('7 / 9');
const updatePortraitAspectRatio = (event: Event) => {
  const image = event.target as HTMLImageElement;
  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
    portraitAspectRatio.value = `${image.naturalWidth} / ${image.naturalHeight}`;
  }
};
const card = computed(() => data.galleryCards[selectedIndex.value] ?? data.galleryCards[0] ?? null);
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
const visibleCandidates = computed(() => {
  const value = card.value;
  if (!value) return [];
  return value.isFlipped ? value.backCandidates : value.frontCandidates;
});
const canonicalName = computed(() => {
  const value = card.value;
  if (!value) return '';
  return ['虞汐', '虞颜', '虞汐颜'].includes(value.name) ? '虞汐颜' : value.name;
});
const companionRecord = computed(() => {
  const name = canonicalName.value;
  if (!name) return null;
  return ((data.红颜 as Record<string, any>)?.[name] as Record<string, any> | undefined) ?? null;
});
const companionRelation = computed(() => String(companionRecord.value?.关系 || '在场同行').trim());
const companionRealm = computed(() => String(companionRecord.value?.境界描述 || '').trim());
const companionFavor = computed<number | null>(() => {
  const raw = companionRecord.value?.好感度;
  const num = Number(raw);
  return Number.isFinite(num) ? Math.round(num) : null;
});
const personaMoodText = computed(() => {
  const value = card.value;
  if (value?.isFlipped && value.backText?.trim()) {
    return `「${value.backText.trim()}」`;
  }
  const emotion = String(companionRecord.value?.关系上下文?.当前情绪 ?? '').trim();
  if (emotion) return emotion;
  if (value?.backText?.trim()) return `「${value.backText.trim()}」`;
  return '眸光流转，静观此间事态。';
});

const browse = (direction: GalleryBrowseDirection) => {
  void data.changeGalleryCardImage(selectedIndex.value, direction);
};
const toggleFlip = () => data.toggleCardFlip(selectedIndex.value);
const startDialogue = () => {
  const value = card.value;
  const targetName = displayName.value.trim();
  if (!value || !targetName) return;
  const canonicalName = ['虞汐', '虞颜', '虞汐颜'].includes(value.name) ? '虞汐颜' : value.name;
  pseudo.beginDialogue({ targetName, canonicalName, channel: 'present' });
};

watch(
  [() => pseudo.messageId, () => data.galleryCards.length],
  () => {
    if (!data.galleryCards[selectedIndex.value]) selectedIndex.value = 0;
  },
);
</script>

<style lang="scss" scoped>
.portrait-rail {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, auto) auto auto;
  align-content: start;
  gap: 10px;
  padding: 14px 16px;
  border-left: 1px solid color-mix(in srgb, var(--line-subtle) 65%, transparent);
  background: var(--portrait-material), color-mix(in srgb, var(--surface) 74%, transparent);
  box-shadow: inset 12px 0 28px color-mix(in srgb, var(--stage-shadow) 12%, transparent);
}

.portrait-rail:not(:has(.portrait-tabs)) {
  grid-template-rows: minmax(0, auto) auto auto;
}

.portrait-rail::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid color-mix(in srgb, var(--line-subtle) 45%, transparent);
  border-radius: 7px;
  pointer-events: none;
  opacity: 0.5;
}
.portrait-rail > * {
  position: relative;
  z-index: 1;
}

.portrait-tabs {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  button {
    flex-shrink: 0;
    padding: 4px 10px;
    border: 1px solid var(--line-subtle);
    border-radius: 999px;
    color: var(--text-secondary);
    background: color-mix(in srgb, var(--surface-inset) 65%, transparent);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.18s ease;

    &.active {
      border-color: color-mix(in srgb, var(--gold) 52%, var(--line-strong));
      color: var(--gold);
      background: var(--button-active);
    }
  }
}

.portrait-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  align-self: start;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--gold) 28%, var(--line-subtle));
  border-radius: 8px;
  background: var(--surface-inset);
  box-shadow:
    0 12px 30px color-mix(in srgb, var(--stage-shadow) 64%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 10%, transparent);
  cursor: pointer;

  img {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    object-position: center;
  }
}

.portrait-backdrop-echo {
  position: absolute;
  inset: -18px;
  z-index: 0;
  background-position: center;
  background-size: cover;
  filter: blur(22px) saturate(0.8) brightness(0.52);
  opacity: 0.65;
  pointer-events: none;
}

.portrait-side-tag {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--gold) 34%, transparent);
  border-radius: 999px;
  color: #f4eee5;
  background: rgba(6, 16, 22, 0.58);
  backdrop-filter: blur(6px);
  font-size: 9px;
  letter-spacing: 0.06em;

  i {
    color: var(--gold);
  }
}

.portrait-caption {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 40px 14px 11px;
  color: #f4eee5;
  background: linear-gradient(to top, rgba(4, 12, 18, 0.92), rgba(4, 12, 18, 0.35) 62%, transparent);
  text-align: left;

  small {
    color: #e6bd76;
    font-size: 9px;
    letter-spacing: 0.08em;
  }
  strong {
    font-family: 'Songti SC', 'STSong', serif;
    font-size: 18px;
    letter-spacing: 0.06em;
  }
}

.portrait-persona-card {
  padding: 9px 11px;
  display: grid;
  gap: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 7px;
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--gold) 6%, transparent), transparent 60%),
    color-mix(in srgb, var(--surface-inset) 82%, transparent);
}

.persona-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  font-size: 10px;
}

.persona-relation {
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--semantic-relation) 36%, var(--line-subtle));
  border-radius: 999px;
  color: var(--semantic-relation);
  background: color-mix(in srgb, var(--semantic-relation) 10%, transparent);
  font-weight: 600;
}

.persona-realm {
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 10%, transparent);
}

.persona-favor {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--gold);
  font-weight: 600;

  i {
    color: var(--semantic-relation);
    font-size: 9px;
  }
}

.persona-mood {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;

  i {
    flex: none;
    color: var(--gold-soft);
    font-size: 9px;
  }
  span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
}

.portrait-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.talk-primary-btn {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--jade) 48%, var(--line-strong));
  border-radius: 999px;
  color: var(--jade);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 16%, transparent), transparent 75%),
    color-mix(in srgb, var(--surface-inset) 88%, transparent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--button-active);
  }
  &:disabled {
    opacity: 0.36;
    cursor: not-allowed;
  }
}

.scroll-tool-group {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  gap: 2px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-inset) 84%, transparent);

  button {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: var(--text-secondary);
    background: transparent;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.16s ease;

    &:hover,
    &.active {
      color: var(--gold);
      background: var(--button-hover);
    }
  }
}

.portrait-shift-enter-active, .portrait-shift-leave-active { transition: opacity 0.16s ease; }
.portrait-shift-enter-from, .portrait-shift-leave-to { opacity: 0; }

@media screen and (max-width: 760px) {
  .portrait-rail {
    height: 184px;
    grid-template-columns: 124px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line-subtle);
    border-left: 0;
  }

  .portrait-tabs {
    grid-column: 2;
    grid-row: 1;
    align-content: start;
  }
  .portrait-stage {
    grid-column: 1;
    grid-row: 1 / 4;
  }
  .portrait-persona-card {
    grid-column: 2;
    grid-row: 2;
    padding: 6px 8px;
  }
  .portrait-controls {
    grid-column: 2;
    grid-row: 3;
    justify-content: flex-start;
  }
  .portrait-caption {
    padding: 30px 9px 8px;
  }
  .portrait-caption strong {
    font-size: 14px;
  }
}
</style>
