<template>
  <div class="cloud-stories" aria-label="云端故事">
    <header class="cloud-toolbar">
      <p>挑一篇愿意亲历的故事，让眼前因缘通向新的去处。</p>
      <div class="cloud-actions">
        <button type="button" :disabled="loading" @click="refresh">{{ loading ? '正在读取……' : '刷新故事库' }}</button>
        <button type="button" :aria-expanded="managing" @click="managing = !managing">
          {{ managing ? '收起管理' : '故事管理' }}
        </button>
      </div>
    </header>
    <CloudStoryManager v-if="managing" @close="managing = false" @published="receivePublished" />
    <p v-if="error" class="cloud-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="cloud-note" role="status">正在翻阅云端的故事……</p>
    <p v-else-if="loaded && !library.stories.length" class="cloud-note">故事集暂时留白，日后再来看看。</p>
    <div v-if="library.stories.length" class="cloud-grid">
      <article v-for="story in library.stories" :key="story.id" class="cloud-story">
        <span class="story-genres">{{ story.genres.join(' · ') }} · {{ story.length }}</span>
        <h3>{{ story.name }}</h3>
        <p>{{ story.lead }}</p>
        <p class="story-goal"><span>所求</span>{{ story.goal }}</p>
        <p><span>入手</span>{{ story.step }}</p>
        <small v-if="savedStory(story)">已存入行旅 · {{ savedStory(story)?.状态 }}</small>
        <button type="button" :disabled="journeys.disabled" @click="journeys.chooseStory(story)">
          {{ savedStory(story) ? '翻开此篇' : '由此启程' }}
        </button>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue';
import CloudStoryManager from './CloudStoryManager.vue';
import {
  cloudJourneyId,
  emptyStoryLibrary,
  loadPublicStories,
  type CloudStory,
  type StoryLibrary,
} from '../cloud-stories';
import { useJourneyStore } from '../stores/journey-store';

const journeys = useJourneyStore();
const library = ref(emptyStoryLibrary());
const loading = ref(false);
const loaded = ref(false);
const error = ref('');
const managing = ref(false);
let controller: AbortController | undefined;
const savedStory = (story: CloudStory) => journeys.archive.旅程[cloudJourneyId(story.id)];
const refresh = async () => {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  loading.value = true;
  error.value = '';
  try {
    const result = await loadPublicStories(current.signal);
    if (current.signal.aborted) return;
    library.value = result;
    loaded.value = true;
  } catch (cause) {
    if (!current.signal.aborted) error.value = cause instanceof Error ? cause.message : '故事暂时未载入，请重试。';
  } finally {
    if (controller === current) loading.value = false;
  }
};
const receivePublished = (next: StoryLibrary) => {
  controller?.abort();
  library.value = next;
  loaded.value = true;
  loading.value = false;
  error.value = '';
};
onMounted(refresh);
onScopeDispose(() => controller?.abort());
</script>

<style scoped lang="scss">
.cloud-stories {
  margin-top: 16px;
}
.cloud-toolbar,
.cloud-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.cloud-toolbar {
  justify-content: space-between;
}
.cloud-toolbar p,
.cloud-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.9;
}
button {
  padding: 10px 13px;
  border: 1px solid var(--line-subtle);
  border-radius: 3px;
  background: color-mix(in srgb, var(--gold) 4%, transparent);
  color: var(--gold);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:hover:not(:disabled) {
  background: var(--button-hover);
}
button:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
.cloud-note,
.cloud-error {
  margin-top: 14px;
  line-height: 1.9;
}
.cloud-error {
  color: var(--semantic-danger);
  font-size: 13px;
}
.cloud-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.cloud-story {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--surface-inset) 65%, transparent), transparent);
  overflow-wrap: anywhere;
}
.story-genres,
.cloud-story p > span {
  color: var(--gold-soft);
  font-size: 12px;
}
.cloud-story h3,
.cloud-story p {
  margin: 0;
}
.cloud-story h3 {
  font:
    600 17px 'Noto Serif SC',
    STSong,
    serif;
  letter-spacing: 0.035em;
  line-height: 1.6;
}
.cloud-story p {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.9;
}
.cloud-story .story-goal {
  color: var(--text-primary);
}
.cloud-story p > span {
  margin-right: 8px;
}
.cloud-story small {
  color: var(--text-secondary);
}
.cloud-story button {
  margin-top: auto;
}
@media (max-width: 650px) {
  .cloud-grid {
    grid-template-columns: 1fr;
  }
}
</style>
