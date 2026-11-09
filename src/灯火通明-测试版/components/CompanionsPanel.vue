<template>
  <div ref="companionsRoot" class="panel companions-panel">
    <template v-if="companionNames.length || npcEntries.length">
      <header class="companions-topbar">
        <div v-if="companionNames.length" class="roster-strip" role="group" aria-label="红颜名册">
          <button
            v-for="name in companionNames"
            :key="name"
            type="button"
            class="roster-chip"
            :class="{ active: activeLedger === 'companions' && selectedName === name }"
            :aria-pressed="activeLedger === 'companions' && selectedName === name"
            @click="selectCompanion(name)"
          >
            <span class="roster-portrait" aria-hidden="true">
              <img v-if="getPortrait(name)" :src="getPortrait(name)" alt="" />
              <span v-else>{{ name.slice(0, 1) }}</span>
            </span>
            <span class="roster-name">{{ name }}</span>
            <span class="roster-favor" :class="{ neutral: !normalizeFavor(getCompanion(name)?.好感度) }">
              <i class="fa-solid fa-heart" aria-hidden="true"></i>
              <span class="sr-only">好感</span>{{ normalizeFavor(getCompanion(name)?.好感度) }}
            </span>
          </button>
        </div>
        <span v-else class="ledger-title">尘缘客录</span>

        <div v-if="npcEntries.length" class="ledger-switch" role="group" aria-label="切换人物名录">
          <button
            type="button"
            :class="{ active: activeLedger === 'companions' }"
            :aria-pressed="activeLedger === 'companions'"
            @click="activeLedger = 'companions'"
          >
            情谱 <span>{{ companionNames.length }}</span>
          </button>
          <span class="ledger-divider" aria-hidden="true">/</span>
          <button
            type="button"
            :class="{ active: activeLedger === 'npcs' }"
            :aria-pressed="activeLedger === 'npcs'"
            @click="activeLedger = 'npcs'"
          >
            客录 <span>{{ npcEntries.length }}</span>
          </button>
        </div>
      </header>

      <section v-if="activeLedger === 'npcs' && npcEntries.length" class="npc-ledger" aria-label="尘缘客录">
        <div class="npc-ledger-list" role="list">
          <article
            v-for="npc in npcEntries"
            :key="npc.name"
            class="npc-entry"
            role="listitem"
            :data-npc-name="npc.name"
            tabindex="-1"
          >
            <header>
              <h3>{{ npc.name }}</h3>
              <span class="realm-text" :style="{ '--realm-color': getRealmColor(npc.level) }">{{
                getRealmDescription(npc.level, '')
              }}</span>
            </header>
            <span class="npc-affiliation"><i class="fa-solid fa-landmark" aria-hidden="true"></i>{{ npc.sect }}</span>
            <p>{{ npc.note || '此人旧闻尚待补记。' }}</p>
          </article>
        </div>
      </section>

      <article v-else-if="selectedCompanion" class="companion-scroll" :aria-label="`${selectedName}的人物画卷`">
        <div class="scroll-left-column">
          <div class="portrait-seat">
            <div class="portrait-frame">
              <img v-if="selectedPortrait" :src="selectedPortrait" :alt="`${selectedName}立绘`" />
              <span v-else class="portrait-monogram" aria-hidden="true">{{ selectedName.slice(0, 1) }}</span>
              <span class="relation-badge">{{ selectedCompanion.关系 || '缘分未明' }}</span>
              <button
                v-if="isCustomCompanion(selectedName)"
                type="button"
                class="portrait-edit"
                title="自定义立绘"
                aria-label="自定义立绘"
                @click="portraitDialog?.showModal()"
              >
                <i class="fa-solid fa-camera" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div class="identity-block">
            <div class="identity-heading">
              <h2>{{ selectedName }}</h2>
              <span class="realm-text" :style="{ '--realm-color': getRealmColor(selectedCompanion.等级) }">
                {{ getRealmDescription(selectedCompanion.等级, selectedCompanion.境界描述) }}
              </span>
            </div>
            <p class="current-mood">{{ selectedCompanion.关系上下文?.当前情绪 || '心湖未起波澜' }}</p>
            <div class="affinity-inline">
              <div class="affinity-heading">
                <span>缘契 · {{ selectedFavorStage }}</span>
                <strong>{{ selectedFavor }} <small>/ 200</small></strong>
              </div>
              <div
                class="affinity-track"
                role="progressbar"
                aria-label="好感度"
                aria-valuemin="0"
                aria-valuemax="200"
                :aria-valuenow="selectedFavor"
              >
                <span :style="{ width: `${selectedFavor / 2}%` }"></span>
              </div>
            </div>
            <div class="talk-actions">
              <button
                v-for="target in dialogueTargets"
                :key="`${target.channel}-${target.targetName}`"
                type="button"
                class="talk-btn"
                :disabled="interactionDisabled"
                :title="interactionStatus || (target.channel === 'present' ? '开始当面交谈' : '向她传讯')"
                @click="startDialogue(target)"
              >
                <span>{{ getDialogueButtonLabel(target) }}</span>
                <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="scroll-right-column">
          <div class="scroll-tabs" role="tablist" aria-label="人物分卷">
            <button
              v-for="(tab, index) in subTabs"
              :id="`companion-tab-${tab.id}`"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="activeSubTab === tab.id"
              :aria-controls="`companion-page-${tab.id}`"
              :tabindex="activeSubTab === tab.id ? 0 : -1"
              :class="{ active: activeSubTab === tab.id }"
              @click="activeSubTab = tab.id"
              @keydown="onSubTabKeydown($event, index)"
            >
              {{ tab.label
              }}<small v-if="tab.id === 'chronicle' && chronicleEntries.length">{{ chronicleEntries.length }}</small>
            </button>
          </div>

          <section
            v-if="activeSubTab === 'heart'"
            id="companion-page-heart"
            class="scroll-page heart-page"
            role="tabpanel"
            aria-labelledby="companion-tab-heart"
            tabindex="0"
          >
            <template v-if="hasRelationshipProfile">
              <div v-if="relationshipProfile.impression" class="impression-block">
                <h3>她眼中的你</h3>
                <p>{{ relationshipProfile.impression }}</p>
              </div>
              <div v-if="relationshipProfile.desire || relationshipProfile.taboo" class="notes-stack">
                <div v-if="relationshipProfile.desire" class="relationship-note desire-note">
                  <h3>心愿</h3>
                  <p>{{ relationshipProfile.desire }}</p>
                </div>
                <div v-if="relationshipProfile.taboo" class="relationship-note taboo-note">
                  <h3>避讳</h3>
                  <p>{{ relationshipProfile.taboo }}</p>
                </div>
              </div>
              <div v-if="relationshipProfile.promise" class="relationship-promise">
                <h3><i class="fa-regular fa-bookmark" aria-hidden="true"></i> 未竟之约</h3>
                <p>{{ relationshipProfile.promise }}</p>
              </div>
            </template>
            <div v-else class="volume-empty">
              <strong>心意尚隐</strong>
              <p>同行渐深，心迹渐明。</p>
            </div>
          </section>

          <section
            v-else-if="activeSubTab === 'cultivation'"
            id="companion-page-cultivation"
            class="scroll-page cultivation-page"
            role="tabpanel"
            aria-labelledby="companion-tab-cultivation"
            tabindex="0"
          >
            <div class="cultivation-progress">
              <div class="cultivation-heading">
                <span>{{ selectedCompanion.修炼状态?.阶段 || '修炼中' }}</span>
                <strong>{{ selectedCompanion.修为 }} / {{ selectedCompanion.突破阈值 || '待明' }}</strong>
              </div>
              <div
                class="cultivation-track"
                role="progressbar"
                aria-label="修为进度"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="getCultivationProgress(selectedCompanion)"
              >
                <span :style="{ width: `${getCultivationProgress(selectedCompanion)}%` }"></span>
              </div>
              <p v-if="selectedCompanion.修炼状态?.瓶颈原因">{{ selectedCompanion.修炼状态.瓶颈原因 }}</p>
              <p v-if="selectedCompanion.修炼状态?.根基描述">{{ selectedCompanion.修炼状态.根基描述 }}</p>
              <p v-if="selectedCompanion.积累已足">
                积累已足，可择机破境<span v-if="selectedCompanion.盈余修为 > 0"
                  >；盈余 {{ selectedCompanion.盈余修为 }}</span
                >。
              </p>
            </div>
            <dl class="cultivation-grid">
              <div v-for="stat in companionStats" :key="stat.label" class="cultivation-stat">
                <dt>{{ stat.label }}</dt>
                <dd>
                  <strong>{{ stat.title }}</strong>
                  <p v-if="stat.detail">{{ stat.detail }}</p>
                </dd>
              </div>
            </dl>
            <div class="skill-record">
              <h3>神通</h3>
              <div v-if="skillNames.length" class="skill-tags">
                <span v-for="skill in skillNames" :key="skill">{{ skill }}</span>
              </div>
              <p v-else>尚无已记录神通</p>
            </div>
          </section>

          <section
            v-else
            id="companion-page-chronicle"
            class="scroll-page chronicle-page"
            role="tabpanel"
            aria-labelledby="companion-tab-chronicle"
            tabindex="0"
          >
            <div v-if="chronicleEntries.length" class="chronicle-timeline">
              <article
                v-for="(entry, index) in chronicleEntries"
                :key="entry.title"
                class="chronicle-entry"
                :class="{ latest: index === 0 }"
              >
                <span class="chronicle-mark" aria-hidden="true"
                  ><i class="fa-solid" :class="CHRONICLE_ICONS[entry.type] || CHRONICLE_ICONS.其他"></i
                ></span>
                <div class="chronicle-copy">
                  <header>
                    <h3>{{ entry.title }}</h3>
                    <time v-if="entry.timePlace">{{ entry.timePlace }}</time>
                  </header>
                  <span class="chronicle-type">{{ entry.type }}</span>
                  <p>{{ entry.summary || '此段往事尚待补记。' }}</p>
                </div>
              </article>
            </div>
            <div v-else class="volume-empty">
              <strong>旧页尚白</strong>
              <p>同行往事，待续于此。</p>
            </div>
          </section>
        </div>
      </article>

      <div v-else class="companions-empty">
        <strong>红尘情谱尚无一页</strong>
        <p>待与谁真正相识，她的名字便会在这里落笔。</p>
      </div>

      <dialog
        v-if="selectedCompanion && isCustomCompanion(selectedName)"
        ref="portraitDialog"
        class="portrait-dialog"
        aria-labelledby="portrait-dialog-title"
        @click.self="portraitDialog?.close()"
      >
        <header class="portrait-dialog-heading">
          <h3 id="portrait-dialog-title">{{ selectedName }} · 自定义立绘</h3>
          <button
            type="button"
            class="portrait-dialog-close"
            aria-label="关闭立绘设置"
            @click="portraitDialog?.close()"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <p class="portrait-hint">图片仅用于此自定义红颜；未设置背面时，图鉴沿用正面图。</p>
        <div class="portrait-grid">
          <div v-for="side in portraitSides" :key="side.key" class="portrait-slot">
            <div class="portrait-preview">
              <img
                v-if="getCustomPortrait(selectedName)[side.field]"
                :src="getCustomPortrait(selectedName)[side.field]"
                :alt="`${selectedName}${side.label}立绘`"
              />
              <span v-else>未上传</span>
            </div>
            <strong>{{ side.label }}立绘</strong>
            <div class="portrait-actions">
              <label class="portrait-button" :class="{ uploading: isUploading(selectedName, side.side) }">
                {{ isUploading(selectedName, side.side) ? '上传中…' : `上传${side.label}` }}
                <input
                  class="portrait-input"
                  type="file"
                  accept="image/*"
                  :aria-label="`上传${side.label}立绘`"
                  :disabled="isUploading(selectedName, side.side)"
                  @change="onPortraitSelected(selectedName, side.side, $event)"
                />
              </label>
              <button
                v-if="getCustomPortrait(selectedName)[side.field]"
                type="button"
                class="portrait-button ghost"
                :disabled="isUploading(selectedName, side.side)"
                @click="clearPortrait(selectedName, side.side)"
              >
                清除
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </template>
    <div v-else class="companions-empty">
      <strong>红尘情谱尚无一页</strong>
      <p>待与谁真正相识，她的名字、心绪与同行往事便会在这里落笔。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { focusStageElement } from '../affairs';
import { getCharacterImageCandidates } from '../character-assets';
import { REALM_NAMES, REALM_STAGES, getRealmColor } from '../schema';
import { useDataStore, usePseudoLayerStore } from '../store';
import type { DialogueTarget } from '../store';

type CompanionRecord = Record<string, any>;
const props = defineProps<{ focusName?: string; focusNonce?: number }>();
const companionsRoot = ref<HTMLElement>();
type NpcRecord = { 等级?: unknown; 所在宗门?: unknown; 备注?: unknown };

const store = useDataStore();
const pseudo = usePseudoLayerStore();
const selectedName = ref('');
const activeLedger = ref<'companions' | 'npcs'>('companions');
const activeSubTab = ref<'heart' | 'cultivation' | 'chronicle'>('heart');
const portraitDialog = ref<HTMLDialogElement | null>(null);
const subTabs = [
  { id: 'heart', label: '心迹' },
  { id: 'cultivation', label: '道基' },
  { id: 'chronicle', label: '纪事' },
] as const;
const uploadStates = ref<Record<string, { 正面: boolean; 背面: boolean }>>({});

const portraitSides = [
  { key: 'front', field: 'front' as const, side: '正面' as const, label: '正面' },
  { key: 'back', field: 'back' as const, side: '背面' as const, label: '背面' },
] as const;

const CHRONICLE_ICONS: Record<string, string> = {
  相识: 'fa-seedling',
  共患难: 'fa-shield-heart',
  交心: 'fa-comments',
  护道: 'fa-hands-holding-circle',
  承诺: 'fa-knot',
  分歧: 'fa-code-branch',
  定情: 'fa-heart',
  离别: 'fa-person-walking-arrow-right',
  重逢: 'fa-people-arrows-left-right',
  其他: 'fa-feather',
};

const FAVOR_STAGES = [
  { value: 0, label: '缘起' },
  { value: 50, label: '相识' },
  { value: 100, label: '相知' },
  { value: 150, label: '相契' },
  { value: 200, label: '同心' },
] as const;

const companionNames = computed(() => Object.keys(store.红颜 as Record<string, CompanionRecord>));
const npcEntries = computed(() =>
  Object.entries(store.NPC图鉴 as Record<string, NpcRecord>).map(([name, npc]) => ({
    name,
    level: normalizeRealmLevel(npc.等级),
    sect: String(npc.所在宗门 ?? '').trim() || '散修',
    note: String(npc.备注 ?? '').trim(),
  })),
);
const selectedCompanion = computed<CompanionRecord | null>(() => getCompanion(selectedName.value));
const selectedPortrait = computed(() => getPortrait(selectedName.value));
const selectedFavor = computed(() => normalizeFavor(selectedCompanion.value?.好感度));
const selectedFavorStage = computed(
  () => [...FAVOR_STAGES].reverse().find(stage => selectedFavor.value >= stage.value)?.label ?? FAVOR_STAGES[0].label,
);
const relationshipProfile = computed(() => {
  const context = selectedCompanion.value?.关系上下文 ?? {};
  return {
    impression: String(context.态度缘由 ?? '').trim(),
    desire: String(context.关系诉求 ?? '').trim(),
    taboo: String(context.相处禁忌 ?? '').trim(),
    promise: String(context.未了约定 ?? '').trim(),
  };
});
const hasRelationshipProfile = computed(() => Object.values(relationshipProfile.value).some(Boolean));
const chronicleEntries = computed(() => {
  const chronicle = selectedCompanion.value?.羁绊纪事 ?? {};
  return Object.entries(chronicle)
    .map(([title, raw]) => {
      const entry = raw as Record<string, unknown>;
      return {
        title,
        type: String(entry?.类型 ?? '其他'),
        summary: String(entry?.摘要 ?? '').trim(),
        timePlace: String(entry?.时地 ?? '').trim(),
      };
    })
    .reverse();
});
const skillNames = computed(() => {
  const skills = selectedCompanion.value?.神通列表 ?? {};
  return Object.entries(skills).map(([name, raw]) => String((raw as Record<string, unknown>)?.名称 ?? name));
});

function splitParenText(raw: unknown, fallback: string): { title: string; detail: string } {
  const text = String(raw ?? '').trim() || fallback;
  const match = /^([^（(]+?)\s*[（(]([\s\S]+)[）)]$/.exec(text);
  if (match) {
    return {
      title: match[1].trim() || text,
      detail: match[2].replace(/[）)]$/u, '').trim(),
    };
  }
  return { title: text, detail: '' };
}

const companionStats = computed(() =>
  [
    ['灵根', '未知'],
    ['体质', '未知'],
    ['功法', '无'],
    ['本命兵器', '无'],
  ].map(([label, fallback]) => ({ label, ...splitParenText(selectedCompanion.value?.[label], fallback) })),
);

const interactionDisabled = computed(
  () => pseudo.isGenerating || (!pseudo.isDetachedMode && !pseudo.isStoryHistoryLatest),
);
const interactionStatus = computed(() => {
  if (pseudo.isGenerating) return '推演尚未结束';
  if (pseudo.isDetachedMode) return '交谈起念将填入酒馆输入框';
  if (!pseudo.isStoryHistoryLatest) return '阅览旧章时不可交谈';
  return '';
});

const dialogueTargets = computed<DialogueTarget[]>(() => {
  const canonicalName = selectedName.value;
  if (!canonicalName) return [];
  const sceneCard = getSceneCard(canonicalName);
  const names =
    canonicalName === '虞汐颜'
      ? [sceneCard?.frontName || '虞汐', sceneCard?.backName || '虞颜']
      : [sceneCard?.frontName || canonicalName];
  return [...new Set(names)].map(targetName => ({
    targetName,
    canonicalName,
    channel: sceneCard ? 'present' : 'transmission',
  }));
});

watch(
  [companionNames, npcEntries],
  ([names, entries]) => {
    if (!names.includes(selectedName.value)) selectedName.value = names[0] ?? '';
    if (!entries.length) activeLedger.value = 'companions';
    else if (!names.length) activeLedger.value = 'npcs';
  },
  { immediate: true },
);

watch(selectedName, () => portraitDialog.value?.close());

function selectCompanion(name: string): void {
  selectedName.value = name;
  activeLedger.value = 'companions';
}
watch(
  [() => props.focusName, () => props.focusNonce],
  async () => {
    const name = props.focusName;
    if (!name) return;
    if (companionNames.value.includes(name)) selectCompanion(name);
    else if (npcEntries.value.some(npc => npc.name === name)) {
      activeLedger.value = 'npcs';
      await nextTick();
      focusStageElement(
        Array.from(companionsRoot.value?.querySelectorAll<HTMLElement>('[data-npc-name]') ?? []).find(
          element => element.dataset.npcName === name,
        ),
      );
    }
  },
  { immediate: true, flush: 'post' },
);

function onSubTabKeydown(event: KeyboardEvent, index: number): void {
  let next: number;
  if (event.key === 'ArrowRight') next = (index + 1) % subTabs.length;
  else if (event.key === 'ArrowLeft') next = (index + subTabs.length - 1) % subTabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = subTabs.length - 1;
  else return;
  event.preventDefault();
  activeSubTab.value = subTabs[next].id;
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>(
    '[role="tab"]',
  );
  buttons?.[next]?.focus();
}

function getCompanion(name: string): CompanionRecord | null {
  return (store.红颜 as Record<string, CompanionRecord>)[name] ?? null;
}

function canonicalize(name: string): string {
  if (name === '虞汐' || name === '虞颜') return '虞汐颜';
  return name;
}

function getSceneCard(name: string) {
  const canonicalName = canonicalize(name);
  return store.galleryCards.find(card => canonicalize(card.name) === canonicalName);
}

function getPortrait(name: string): string {
  if (!name) return '';
  const sceneCard = getSceneCard(name);
  if (sceneCard?.front) return sceneCard.front;

  const custom = getCustomPortrait(name).front;
  if (custom) return custom;

  const preferredSoul = canonicalize(name) === '虞汐颜' ? '虞汐' : undefined;
  return String(getCharacterImageCandidates(canonicalize(name), 'front', preferredSoul)[0] ?? '');
}

function getRealmDescription(levelRaw: unknown, fallbackRaw: unknown): string {
  const fallback = String(fallbackRaw ?? '').trim();
  const level = Number(levelRaw);
  const maxLevel = REALM_NAMES.length * REALM_STAGES.length;
  if (!Number.isFinite(level) || level < 1) return fallback || '练气初期';

  const normalizedLevel = Math.min(Math.floor(level), maxLevel);
  const major = REALM_NAMES[Math.floor((normalizedLevel - 1) / REALM_STAGES.length)];
  const minor = REALM_STAGES[(normalizedLevel - 1) % REALM_STAGES.length];
  return major && minor ? `${major}${minor}` : fallback || '练气初期';
}

function normalizeRealmLevel(value: unknown): number {
  const level = Number(value);
  const maxLevel = REALM_NAMES.length * REALM_STAGES.length;
  return Number.isFinite(level) ? _.clamp(Math.floor(level), 1, maxLevel) : 1;
}

function normalizeFavor(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? _.clamp(number, 0, 200) : 0;
}

function getCultivationProgress(companion: CompanionRecord): number {
  const cultivation = Number(companion?.修为);
  const threshold = Number(companion?.突破阈值);
  if (!Number.isFinite(cultivation) || !Number.isFinite(threshold) || threshold <= 0) return 0;
  return _.clamp((cultivation / threshold) * 100, 0, 100);
}

function startDialogue(target: DialogueTarget): void {
  if (interactionDisabled.value) return;
  pseudo.beginDialogue(target);
}

function getDialogueButtonLabel(target: DialogueTarget): string {
  if (dialogueTargets.value.length > 1) {
    return target.channel === 'present' ? `与${target.targetName}交谈` : `传讯给${target.targetName}`;
  }
  return target.channel === 'present' ? '此刻在场 · 与她交谈' : '传讯联络';
}

function isCustomCompanion(name: string): boolean {
  return !!name && !store.isBuiltinCompanionName(name);
}

function getCustomPortrait(name: string): { front: string; back: string } {
  const portraitConfig = (store.红颜角色库 as Record<string, any>)?.[name]?.自定义立绘 ?? {};
  return {
    front: String(portraitConfig?.正面 ?? '').trim(),
    back: String(portraitConfig?.背面 ?? '').trim(),
  };
}

function isUploading(name: string, side: '正面' | '背面'): boolean {
  return uploadStates.value[name]?.[side] ?? false;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function onPortraitSelected(name: string, side: '正面' | '背面', event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;

  const uploadState = (uploadStates.value[name] ??= { 正面: false, 背面: false });
  uploadState[side] = true;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const saved = await store.updateCustomCompanionPortrait(name, side, dataUrl);
    if (saved) toastr.success(`${name}的${side}立绘已保存`, '自定义立绘');
  } catch (error) {
    console.error('[踏月寻仙] 读取自定义立绘失败', error);
    toastr.error(`读取${side}立绘失败`, '自定义立绘');
  } finally {
    uploadState[side] = false;
    if (input) input.value = '';
  }
}

async function clearPortrait(name: string, side: '正面' | '背面') {
  const cleared = await store.clearCustomCompanionPortrait(name, side);
  if (cleared) toastr.success(`${name}的${side}立绘已清除`, '自定义立绘');
}
</script>

<style lang="scss" scoped>
.companions-panel {
  --companion-muted: color-mix(in srgb, var(--text-secondary) 50%, var(--text-primary));
  --romance: var(--semantic-relation);
  --romance-faint: color-mix(in srgb, var(--romance) 6%, transparent);
  --romance-line: color-mix(in srgb, var(--romance) 30%, var(--line-subtle));
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: var(--text-primary);
}
button {
  font: inherit;
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
button:focus-visible,
.scroll-page:focus-visible,
.portrait-button:focus-within {
  outline: 2px solid var(--gold);
  outline-offset: 3px;
}
.companions-topbar {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  flex: none;
}
.roster-strip {
  min-width: 0;
  flex: 1;
  display: flex;
  gap: 8px;
  padding: 3px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: var(--romance-line) transparent;
}
.roster-chip {
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 5px;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--companion-muted);
  background: transparent;
  transition:
    color 0.18s,
    border-color 0.18s;
}
.roster-chip:hover {
  color: var(--text-primary);
  background: var(--romance-faint);
}
.roster-chip.active {
  color: var(--text-primary);
  border-color: var(--romance-line);
  border-bottom-color: var(--romance);
}
.roster-portrait {
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: var(--romance);
  background: var(--romance-faint);
  font-family: 'Songti SC', 'STSong', serif;
}
.roster-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 20%;
}
.roster-name {
  font-size: 13px;
  white-space: nowrap;
}
.roster-favor {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--romance);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.roster-favor.neutral {
  color: var(--companion-muted);
}
.roster-favor i {
  font-size: 9px;
}
.ledger-title {
  flex: 1;
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
}
.ledger-switch {
  flex: none;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--line-strong);
}
.ledger-switch button {
  padding: 7px 4px;
  border: 0;
  background: transparent;
  color: var(--companion-muted);
  font-size: 12px;
  white-space: nowrap;
}
.ledger-switch button.active {
  color: var(--romance);
}
.ledger-switch button span {
  margin-left: 3px;
  font-variant-numeric: tabular-nums;
}
.ledger-divider {
  font-size: 11px;
}

.companion-scroll {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 28px;
}
.scroll-left-column {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding-right: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.scroll-left-column::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, var(--line-subtle) 15% 85%, transparent);
}
.portrait-seat {
  min-height: 0;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}
.portrait-frame {
  position: relative;
  height: 100%;
  max-height: 330px;
  max-width: 220px;
  aspect-ratio: 2 / 3;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--line-subtle));
  border-radius: 3px;
  color: var(--romance);
  background: var(--romance-faint);
}
.portrait-frame::after {
  content: '';
  position: absolute;
  inset: 5px;
  border: 1px solid color-mix(in srgb, var(--gold) 42%, transparent);
  pointer-events: none;
  mask:
    linear-gradient(90deg, #000 12px, transparent 12px calc(100% - 12px), #000 calc(100% - 12px)),
    linear-gradient(#000 12px, transparent 12px calc(100% - 12px), #000 calc(100% - 12px));
  mask-composite: intersect;
}
.portrait-frame > img {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: cover;
  border-radius: inherit;
}
.portrait-monogram {
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 48px;
}
.relation-badge {
  position: absolute;
  bottom: 10px;
  left: 9px;
  max-width: calc(100% - 18px);
  box-sizing: border-box;
  padding: 5px 8px;
  border-left: 2px solid var(--gold);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  backdrop-filter: blur(8px);
  font-size: 10px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.portrait-edit {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--romance-line);
  border-radius: 50%;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(8px);
  font-size: 12px;
}
.identity-block {
  flex: none;
  min-width: 0;
}
.identity-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.identity-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.identity-heading > span {
  font-size: 12px;
}
.realm-text {
  color: var(--realm-color);
}
.light-theme .realm-text {
  color: color-mix(in srgb, var(--realm-color) 20%, var(--text-primary));
}
.current-mood {
  margin: 8px 0 12px;
  color: var(--companion-muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.affinity-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--companion-muted);
}
.affinity-heading strong {
  color: var(--romance);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.affinity-heading small {
  font-size: 11px;
  font-weight: 400;
}
.affinity-track {
  height: 4px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--progress-bg);
}
.affinity-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--romance) 60%, var(--gold)), var(--romance));
  transition: width 0.3s ease;
}
.talk-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.talk-btn {
  min-width: 0;
  flex: 1;
  min-height: 36px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: 1px solid var(--romance-line);
  border-radius: 6px;
  color: var(--text-primary);
  background: var(--romance-faint);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  transition:
    border-color 0.18s,
    background 0.18s;
}
.talk-btn:hover:enabled {
  border-color: var(--romance);
  background: color-mix(in srgb, var(--romance) 12%, transparent);
}
.talk-btn i {
  color: var(--romance);
  font-size: 10px;
}

.scroll-right-column {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.scroll-tabs {
  display: flex;
  flex: none;
  align-items: center;
  gap: 28px;
  border-bottom: 1px solid var(--line-subtle);
}
.scroll-tabs button {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 9px 2px 13px;
  border: 0;
  color: var(--companion-muted);
  background: transparent;
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
}
.scroll-tabs button.active {
  color: var(--text-primary);
}
.scroll-tabs button.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--romance), var(--gold));
}
.scroll-tabs small {
  font-family: sans-serif;
  font-size: 10px;
  color: var(--romance);
}
.scroll-page {
  min-width: 0;
  min-height: 0;
  flex: 1;
  padding: 20px 6px 4px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--line-subtle) transparent;
  overflow-wrap: anywhere;
  color: var(--companion-muted);
  font-size: 12px;
  line-height: 1.65;
}
.scroll-page p {
  white-space: pre-line;
}
.scroll-page h3 {
  margin: 0;
  font-size: 11px;
  font-weight: 500;
}
.impression-block {
  margin-bottom: 20px;
}
.impression-block p {
  margin: 9px 0 0;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 14.5px;
  line-height: 1.9;
}
.notes-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.relationship-note {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--romance);
}
.relationship-note p,
.relationship-promise p {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
}
.relationship-note p {
  color: var(--text-primary);
}
.taboo-note {
  border-color: var(--semantic-warning);
}
.relationship-promise {
  margin-top: 22px;
  padding: 3px 0 3px 12px;
  border-left: 2px solid color-mix(in srgb, var(--gold) 60%, transparent);
}
.relationship-promise h3 {
  color: var(--gold);
}
.relationship-promise p {
  margin: 7px 0 0;
}
.cultivation-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.cultivation-heading strong {
  color: var(--jade);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.cultivation-track {
  height: 5px;
  margin-top: 9px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--progress-bg);
}
.cultivation-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--jade), var(--gold));
}
.cultivation-progress > p {
  margin: 8px 0 0;
}
.cultivation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 24px;
  margin: 24px 0;
}
.cultivation-stat {
  min-width: 0;
}
.cultivation-stat dt {
  margin-bottom: 7px;
  font-size: 11px;
}
.cultivation-stat dd {
  margin: 0;
}
.cultivation-stat strong {
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 14px;
  font-weight: 600;
}
.cultivation-stat p {
  margin: 7px 0 0;
}
.skill-record {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
}
.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.skill-tags span {
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--jade) 26%, var(--line-subtle));
  border-radius: 3px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 5%, transparent);
  font-size: 11px;
  line-height: 1.5;
}
.skill-record p {
  margin: 0;
}
.chronicle-timeline {
  padding: 0 0 0 10px;
}
.chronicle-entry {
  position: relative;
  padding: 0 0 22px 24px;
  border-left: 1px solid var(--line-subtle);
}
.chronicle-entry:last-child {
  padding-bottom: 4px;
}
.chronicle-mark {
  position: absolute;
  top: 0;
  left: -10px;
  width: 19px;
  height: 23px;
  display: grid;
  place-items: center;
  background: var(--surface);
  font-size: 10px;
}
.chronicle-entry.latest .chronicle-mark {
  color: var(--romance);
}
.chronicle-copy header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 14px;
}
.chronicle-copy h3 {
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 14px;
  font-weight: 600;
}
.chronicle-copy time {
  font-size: 11px;
  line-height: 1.6;
}
.chronicle-type {
  display: inline-block;
  margin-top: 5px;
  color: var(--romance);
  font-size: 10px;
}
.chronicle-copy p {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.75;
}

.npc-ledger {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
}
.npc-ledger-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 32px;
}
.npc-entry {
  min-width: 0;
  padding: 14px 0;
  border-bottom: 1px solid var(--line-subtle);
}
.npc-entry header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.npc-entry h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 16px;
  overflow-wrap: anywhere;
}
.npc-entry header > span {
  font-size: 12px;
}
.npc-affiliation {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 8px;
  color: var(--gold);
  font-size: 11px;
}
.npc-entry p {
  margin: 8px 0 0;
  color: var(--companion-muted);
  font-size: 13px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.volume-empty,
.companions-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 16px;
  color: var(--companion-muted);
  text-align: center;
}
.companions-empty {
  flex: 1;
}
.volume-empty strong,
.companions-empty strong {
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 16px;
  font-weight: 500;
}
.volume-empty p,
.companions-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.75;
}

.portrait-dialog {
  box-sizing: border-box;
  width: min(460px, calc(100% - 32px));
  max-height: calc(100% - 32px);
  padding: 22px;
  border: 1px solid var(--romance-line);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--surface);
  box-shadow: 0 16px 48px color-mix(in srgb, var(--stage-shadow) 45%, transparent);
}
.portrait-dialog::backdrop {
  background: rgb(0 0 0 / 38%);
  backdrop-filter: blur(3px);
}
.portrait-dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.portrait-dialog-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 16px;
}
.portrait-dialog-close {
  width: 28px;
  height: 28px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--companion-muted);
  background: transparent;
}
.portrait-dialog-close:hover {
  color: var(--romance);
  background: var(--romance-faint);
}
.portrait-hint {
  margin: 12px 0 18px;
  color: var(--companion-muted);
  font-size: 12px;
  line-height: 1.65;
}
.portrait-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
.portrait-slot {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.portrait-preview {
  width: 100%;
  aspect-ratio: 2 / 3;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  color: var(--companion-muted);
  background: var(--romance-faint);
  font-size: 11px;
}
.portrait-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.portrait-slot > strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}
.portrait-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.portrait-button {
  position: relative;
  box-sizing: border-box;
  min-height: 32px;
  padding: 6px 9px;
  border: 1px solid var(--romance-line);
  border-radius: 4px;
  color: var(--text-primary);
  background: var(--romance-faint);
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
}
.portrait-button.ghost {
  color: var(--companion-muted);
  background: transparent;
}
.portrait-button.uploading {
  opacity: 0.55;
  cursor: wait;
}
.portrait-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: inherit;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.reduce-motion .companions-panel *,
.reduce-motion .companions-panel *::after {
  transition: none !important;
  scroll-behavior: auto;
}

@media screen and (max-width: 760px) {
  .companions-panel {
    height: auto;
    gap: 14px;
  }
  .companions-topbar {
    gap: 6px;
  }
  .roster-strip {
    gap: 5px;
  }
  .roster-chip {
    gap: 6px;
    padding-right: 7px;
  }
  .ledger-switch {
    gap: 2px;
  }
  .ledger-switch button {
    padding: 7px 2px;
    font-size: 11px;
  }
  .companion-scroll {
    flex: none;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  .scroll-left-column {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    padding: 0;
  }
  .scroll-left-column::after {
    display: none;
  }
  .portrait-seat {
    display: block;
  }
  .portrait-frame {
    width: 96px;
    height: auto;
    max-height: none;
  }
  .relation-badge {
    bottom: 6px;
    left: 5px;
    max-width: calc(100% - 10px);
    padding: 4px;
    font-size: 9px;
  }
  .portrait-edit {
    top: 5px;
    right: 5px;
  }
  .identity-heading h2 {
    font-size: 21px;
  }
  .identity-heading > span {
    font-size: 11px;
  }
  .current-mood {
    margin: 6px 0 10px;
  }
  .talk-actions {
    margin-top: 10px;
  }
  .talk-btn {
    padding: 6px 8px;
    font-size: 11px;
  }
  .scroll-tabs {
    gap: 30px;
  }
  .scroll-page {
    flex: none;
    overflow: visible;
    padding: 16px 0 4px;
  }
  .cultivation-grid {
    gap: 18px;
  }
  .npc-ledger {
    overflow: visible;
  }
  .npc-ledger-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media screen and (max-width: 480px) {
  .cultivation-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .relationship-note {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 6px;
    padding-left: 9px;
  }
  .portrait-dialog {
    padding: 16px;
  }
  .portrait-grid {
    gap: 12px;
  }
}
</style>
