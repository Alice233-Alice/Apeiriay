<template>
  <div v-if="visible" class="target-picker-layer" role="presentation" @click.self="$emit('close')">
      <section class="target-picker" role="dialog" aria-modal="true" aria-label="选择交谈对象">
        <header class="picker-header">
          <div>
            <span>择一人相谈</span>
            <strong>{{ activeSection === 'present' ? '此刻在场' : '千里传讯' }}</strong>
          </div>
          <button type="button" title="关闭" aria-label="关闭" @click="$emit('close')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div class="channel-segments" role="tablist" aria-label="交谈方式">
          <button
            type="button"
            role="tab"
            :aria-selected="activeSection === 'present'"
            :class="{ active: activeSection === 'present' }"
            @click="activeSection = 'present'"
          >
            <i class="fa-solid fa-comments"></i>
            当面
            <span>{{ presentTargets.length }}</span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeSection === 'transmission'"
            :class="{ active: activeSection === 'transmission' }"
            @click="activeSection = 'transmission'"
          >
            <i class="fa-solid fa-paper-plane"></i>
            传讯
            <span>{{ transmissionTargets.length }}</span>
          </button>
        </div>

        <div class="target-list">
          <button
            v-for="target in visibleTargets"
            :key="target.key"
            type="button"
            class="target-row"
            @click="choose(target)"
          >
            <span class="target-portrait">
              <img v-if="target.image" :src="target.image" :alt="target.targetName" />
              <b v-else>{{ target.targetName.slice(0, 1) }}</b>
            </span>
            <span class="target-copy">
              <strong>{{ target.targetName }}</strong>
              <small>{{ target.detail }}</small>
            </span>
            <span class="target-channel">
              <i class="fa-solid" :class="target.channel === 'present' ? 'fa-comment-dots' : 'fa-feather-pointed'"></i>
            </span>
          </button>

          <div v-if="visibleTargets.length === 0" class="empty-targets">
            <i class="fa-solid" :class="activeSection === 'present' ? 'fa-person-circle-question' : 'fa-signal'"></i>
            <span>{{ activeSection === 'present' ? '当前正文没有可交谈的在场角色。' : '本周目尚未结识可传讯的角色。' }}</span>
          </div>
        </div>

        <footer class="picker-footnote">
          <i class="fa-solid fa-circle-info"></i>
          <span>{{ activeSection === 'present' ? '角色会直接回应，不会扩写成长篇剧情。' : '传讯可能因闭关、战斗或隔绝区域暂时受阻。' }}</span>
        </footer>
      </section>
  </div>
</template>

<script setup lang="ts">
import { getCharacterImageCandidates } from '../character-assets';
import { useDataStore, usePseudoLayerStore } from '../store';
import type { DialogueTarget } from '../store';

type PickerTarget = DialogueTarget & {
  key: string;
  image: string;
  detail: string;
};

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const data = useDataStore();
const pseudo = usePseudoLayerStore();
const activeSection = ref<'present' | 'transmission'>('present');

const canonicalize = (name: string) => (name === '虞汐' || name === '虞颜' ? '虞汐颜' : name);
const dualSoulNames = (name: string) => (name === '虞汐颜' ? ['虞汐', '虞颜'] : [name]);

const companionDetail = (canonicalName: string, fallback: string) => {
  const companion = (data.红颜 as Record<string, any>)[canonicalName];
  if (!companion) return fallback;
  return [String(companion.关系 ?? '').trim(), String(companion.关系上下文?.当前情绪 ?? '').trim()]
    .filter(Boolean)
    .join(' · ');
};

const imageForKnownTarget = (targetName: string, canonicalName: string) => {
  const currentCard = data.galleryCards.find(card => canonicalize(card.name) === canonicalName);
  if (currentCard) {
    if (currentCard.frontName === targetName) return currentCard.front;
    if (currentCard.backName === targetName) return currentCard.back;
    return currentCard.front;
  }
  const custom = (data.红颜角色库 as Record<string, any>)[canonicalName]?.自定义立绘?.正面;
  return String(custom ?? '').trim() || String(getCharacterImageCandidates(targetName, 'front', targetName)[0] ?? '');
};

const presentTargets = computed<PickerTarget[]>(() => {
  const targets: PickerTarget[] = [];
  data.galleryCards.forEach((card, cardIndex) => {
    const canonicalName = canonicalize(card.name);
    if (canonicalName === '虞汐颜') {
      const souls = [
        { name: card.frontName || '虞汐', image: card.front },
        { name: card.backName || '虞颜', image: card.back },
      ];
      souls.forEach(soul => {
        if (targets.some(target => target.targetName === soul.name && target.canonicalName === canonicalName)) return;
        targets.push({
          key: `present-${canonicalName}-${soul.name}`,
          targetName: soul.name,
          canonicalName,
          channel: 'present',
          image: soul.image,
          detail: companionDetail(canonicalName, '此刻在场'),
        });
      });
      return;
    }

    const targetName = card.frontName || card.name;
    targets.push({
      key: `present-${canonicalName}-${cardIndex}`,
      targetName,
      canonicalName,
      channel: 'present',
      image: card.front,
      detail: companionDetail(canonicalName, '此刻在场'),
    });
  });
  return targets;
});

const transmissionTargets = computed<PickerTarget[]>(() => {
  const known = new Map<string, { source: '红颜' | 'NPC'; detail: string }>();
  Object.entries(data.红颜 as Record<string, any>).forEach(([name, companion]) => {
    known.set(name, {
      source: '红颜',
      detail:
        [String(companion.关系 ?? '').trim(), String(companion.关系上下文?.当前情绪 ?? '').trim()]
          .filter(Boolean)
          .join(' · ') || '已结识',
    });
  });
  Object.entries(data.NPC图鉴 as Record<string, any>).forEach(([name, npc]) => {
    if (known.has(name)) return;
    known.set(name, {
      source: 'NPC',
      detail: [String(npc.所在宗门 ?? '').trim(), String(npc.备注 ?? '').trim()].filter(Boolean).join(' · ') || '已结识',
    });
  });

  return [...known.entries()].flatMap(([canonicalNameRaw, info]) => {
    const canonicalName = canonicalize(canonicalNameRaw);
    return dualSoulNames(canonicalName).map(targetName => ({
      key: `transmission-${canonicalName}-${targetName}`,
      targetName,
      canonicalName,
      channel: 'transmission' as const,
      image: imageForKnownTarget(targetName, canonicalName),
      detail: info.detail,
    }));
  });
});

const visibleTargets = computed(() =>
  activeSection.value === 'present' ? presentTargets.value : transmissionTargets.value,
);

const choose = (target: PickerTarget) => {
  pseudo.beginDialogue(target);
  emit('close');
};

const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close');
};

onMounted(() => window.addEventListener('keydown', closeOnEscape));
onBeforeUnmount(() => window.removeEventListener('keydown', closeOnEscape));
</script>

<style lang="scss" scoped>
.target-picker-layer {
  position: fixed;
  z-index: 2147482000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: color-mix(in srgb, var(--stage-shadow, #05090b) 72%, transparent);
  backdrop-filter: blur(6px);
}

.target-picker {
  width: min(620px, 100%);
  max-height: min(720px, 88vh);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-raised) 97%, transparent);
  box-shadow: 0 28px 90px var(--stage-shadow), inset 0 0 0 1px var(--line-subtle);
}

.picker-header {
  min-height: 62px;
  flex: none;
  padding: 10px 12px 10px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line-subtle);
  background: var(--header-bg);
}
.picker-header > div { display: grid; gap: 2px; }
.picker-header span { color: var(--text-secondary); font-size: 10px; }
.picker-header strong { color: var(--gold); font-family: 'Songti SC', 'STSong', serif; font-size: 17px; }
.picker-header button,
.channel-segments button {
  border: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}
.picker-header button { width: 34px; height: 34px; border-radius: 5px; }

.channel-segments {
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
}
.channel-segments button {
  min-height: 38px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}
.channel-segments button.active {
  border-color: var(--line-strong);
  color: var(--gold);
  background: var(--button-active);
}
.channel-segments button span {
  min-width: 19px;
  padding: 1px 5px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-raised) 62%, transparent);
  font-size: 9px;
}

.target-list {
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px 14px;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}
.target-row {
  width: 100%;
  min-height: 66px;
  margin-top: 6px;
  padding: 7px 10px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 11px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-inset) 82%, transparent);
  text-align: left;
  cursor: pointer;
}
.target-row:hover { border-color: var(--line-strong); background: var(--button-hover); }
.target-portrait {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--gold);
  background: var(--surface);
}
.target-portrait img { width: 100%; height: 100%; object-fit: cover; }
.target-copy { min-width: 0; display: grid; gap: 4px; }
.target-copy strong { font-family: 'Songti SC', 'STSong', serif; font-size: 14px; }
.target-copy small { overflow: hidden; color: var(--text-secondary); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.target-channel { color: var(--jade); text-align: center; }

.empty-targets {
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--text-secondary);
  text-align: center;
}
.empty-targets i { color: var(--gold-soft); font-size: 24px; }
.picker-footnote {
  min-height: 38px;
  flex: none;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-top: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  background: var(--footer-bg);
  font-size: 10px;
}
.picker-footnote i { color: var(--jade); }

@media screen and (max-width: 600px) {
  .target-picker-layer { align-items: end; padding: 0; }
  .target-picker { width: 100%; max-height: 82vh; border-radius: 8px 8px 0 0; }
  .target-list { padding-inline: 8px; }
}
</style>
