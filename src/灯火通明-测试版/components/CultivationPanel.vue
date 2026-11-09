<template>
  <div class="panel cultivation-panel" :class="{ 'archive-visible': archiveOpen }" :style="panelStyle">
    <div class="cultivation-shell">
      <header class="identity-masthead">
        <div class="identity-eyebrow"><span></span>本尊道基<span></span></div>
        <div class="identity-name-row">
          <span aria-hidden="true"></span>
          <h2>{{ store.本尊.身份.姓名 }}</h2>
          <button
            type="button"
            class="archive-trigger"
            :class="{ 'has-entry': hasArchive }"
            aria-haspopup="dialog"
            :aria-expanded="archiveOpen"
            title="查看并编辑本尊档案"
            @click="openArchive"
          >
            <i class="fa-solid fa-book-open"></i>
            <span>命籍</span>
            <b aria-hidden="true"></b>
          </button>
        </div>
        <p>
          <span>{{ store.本尊.身份.宗门 }}</span>
          <i></i>
          <span>{{ store.本尊.身份.出身 }}</span>
        </p>
      </header>

      <section class="sanctum-grid" aria-label="修炼根基总览">
        <div class="foundation-column foundation-left">
          <div v-for="item in leftFoundation" :key="item.label" class="foundation-item">
            <div class="foundation-icon"><i :class="item.icon"></i></div>
            <div class="foundation-copy">
              <div class="foundation-topline">
                <span>{{ item.label }}</span>
                <strong :class="item.toneClass">{{ item.title }}</strong>
              </div>
              <p v-if="item.detail" class="foundation-detail">{{ item.detail }}</p>
            </div>
          </div>
        </div>

        <div class="realm-core">
          <div
            class="realm-orbit"
            role="progressbar"
            aria-label="当前修为进度"
            aria-valuemin="0"
            :aria-valuemax="store.本尊.突破阈值"
            :aria-valuenow="Math.min(store.本尊.修为, store.本尊.突破阈值)"
            :aria-valuetext="`修为 ${store.本尊.修为}，所需积累 ${store.本尊.突破阈值}，盈余 ${store.本尊.盈余修为}`"
          >
            <div class="orbit-mark orbit-mark-top"></div>
            <div class="orbit-mark orbit-mark-bottom"></div>
            <div class="realm-disc">
              <i class="fa-solid fa-yin-yang realm-emblem"></i>
              <span class="realm-caption">当前境界</span>
              <strong>{{ store.本尊.境界描述 }}</strong>
              <span class="realm-percent">{{ displayProgress }}</span>
            </div>
          </div>
          <div class="status-seal">
            <span class="status-dot"></span>
            {{ store.本尊.状态 }}
          </div>
        </div>

        <div class="foundation-column foundation-right">
          <div v-for="item in rightFoundation" :key="item.label" class="foundation-item">
            <div class="foundation-icon"><i :class="item.icon"></i></div>
            <div class="foundation-copy">
              <div class="foundation-topline">
                <span>{{ item.label }}</span>
                <strong :class="item.toneClass">{{ item.title }}</strong>
              </div>
              <p v-if="item.detail" class="foundation-detail">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="progress-belt" aria-label="周天积累">
        <div class="progress-heading">
          <div class="progress-title-group">
            <i class="fa-solid fa-wind"></i>
            <span>周天积累</span>
            <strong>
              {{ formatNumber(store.本尊.修为) }} <small>/ {{ formatNumber(store.本尊.突破阈值) }}</small>
            </strong>
          </div>
          <div class="progress-actions">
            <button
              v-if="canBreakthrough"
              type="button"
              class="cultivation-action-btn is-breakthrough"
              :disabled="pseudo.isGenerating || (!pseudo.isDetachedMode && !pseudo.isStoryHistoryLatest)"
              :title="pseudo.isDetachedMode ? '将破境意图填入酒馆输入框' : '将破境意图填入底部行动栏'"
              @click="draftBreakthrough"
            >
              <i class="fa-solid fa-bolt"></i>
              <span>尝试破境</span>
            </button>
            <button
              type="button"
              class="cultivation-action-btn"
              :disabled="pseudo.isGenerating || (!pseudo.isDetachedMode && !pseudo.isStoryHistoryLatest)"
              :title="pseudo.isDetachedMode ? '将吐纳修持意图填入酒馆输入框' : '将吐纳修持意图填入底部行动栏'"
              @click="draftMeditate"
            >
              <i class="fa-solid fa-yin-yang"></i>
              <span>吐纳修持</span>
            </button>
          </div>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill"></div>
          <span v-for="marker in 4" :key="marker" :style="{ left: `${marker * 20}%` }"></span>
        </div>
        <div class="progress-foot">
          <span>灵机循行，周天不息</span>
          <span v-if="remainingCultivation > 0">距圆满尚需 {{ formatNumber(remainingCultivation) }}</span>
          <span v-else-if="store.本尊.盈余修为 > 0">积累已足 · 盈余 {{ formatNumber(store.本尊.盈余修为) }}</span>
          <span v-else-if="store.本尊.积累已足">积累已足，可择机破境</span>
          <span v-else>气机已臻圆满</span>
        </div>
      </section>

      <section v-if="pathNotes.length" class="path-notes" aria-label="当前修炼要点">
        <div class="path-heading">
          <i class="fa-solid fa-compass"></i>
          <span>道途记</span>
        </div>
        <div class="path-note-list">
          <div v-for="note in pathNotes" :key="note.label" class="path-note">
            <span>{{ note.label }}</span>
            <strong>{{ note.value }}</strong>
          </div>
        </div>
      </section>
    </div>

    <Transition name="archive-sheet">
      <div
        v-if="archiveOpen"
        class="archive-overlay"
        tabindex="-1"
        @click.self="closeArchive"
        @keydown.esc="closeArchive"
      >
        <section class="archive-dialog" role="dialog" aria-modal="true" aria-labelledby="protagonist-archive-title">
          <header class="archive-header">
            <div class="archive-heading">
              <span><i class="fa-solid fa-feather-pointed"></i> 本尊命籍</span>
              <h3 id="protagonist-archive-title">{{ store.本尊.身份.姓名 }} · 个人档案</h3>
            </div>
            <button
              type="button"
              class="archive-close"
              aria-label="关闭档案"
              :disabled="archiveSaving"
              @click="closeArchive"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </header>

          <div class="archive-body">
            <p class="archive-lead">在这里记录来历、性情、经历与想让故事始终记得的事。</p>
            <textarea
              ref="archiveInput"
              v-model="archiveDraft"
              aria-label="本尊个人档案"
              placeholder="例如：故乡与家世、成长经历、性格习惯、执念、秘密，或其他希望 AI 始终知晓的背景……"
              spellcheck="false"
            ></textarea>
            <div class="archive-meta">
              <span><i class="fa-solid fa-lock"></i> 仅玩家可改，AI 可读取</span>
              <span>{{ archiveDraft.length }} 字</span>
            </div>
          </div>

          <footer class="archive-actions">
            <button type="button" class="archive-cancel" :disabled="archiveSaving" @click="closeArchive">取消</button>
            <button type="button" class="archive-save" :disabled="archiveSaving || !archiveDirty" @click="saveArchive">
              <i :class="archiveSaving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i>
              {{ archiveSaving ? '写入中' : '收录档案' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed, nextTick, ref } from 'vue';

import { getRealmColor, getRootColor, getSpiritStoneTotal } from '../schema';
import { useDataStore, usePseudoLayerStore } from '../store';

interface FoundationItem {
  label: string;
  title: string;
  detail: string;
  icon: string;
  toneClass?: string;
}

interface PathNote {
  label: string;
  value: string;
}

const store = useDataStore();
const pseudo = usePseudoLayerStore();
const archiveOpen = ref(false);
const archiveDraft = ref('');
const archiveSaving = ref(false);
const archiveInput = ref<HTMLTextAreaElement | null>(null);

const archiveContent = computed(() => String(store.本尊._档案 ?? ''));
const hasArchive = computed(() => archiveContent.value.trim().length > 0);
const archiveDirty = computed(() => archiveDraft.value.replace(/\r\n?/g, '\n').trim() !== archiveContent.value);

const realmColor = computed(() => getRealmColor(store.本尊.等级));
const rootColor = computed(() => getRootColor(store.本尊.灵根));
const progressValue = computed(() => {
  const parsed = Number.parseFloat(String(store.本尊.进度));
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
});
const displayProgress = computed(() => `${progressValue.value.toFixed(1)}%`);
const remainingCultivation = computed(() => Math.max(0, store.本尊.突破阈值 - store.本尊.修为));
const canBreakthrough = computed(() => Boolean(store.本尊.积累已足 || remainingCultivation.value <= 0));

function splitFoundationValue(rawValue: unknown): { title: string; detail: string } {
  const text = String(rawValue ?? '').trim() || '未知';
  const match = /^([^（(]+?)\s*[（(]([\s\S]+)[）)]$/.exec(text);
  if (match) {
    return {
      title: match[1].trim() || text,
      detail: match[2].replace(/[）)]$/u, '').trim(),
    };
  }
  return { title: text, detail: '' };
}

const panelStyle = computed(
  () =>
    ({
      '--realm-tone': realmColor.value,
      '--root-tone': rootColor.value,
      '--progress-angle': `${progressValue.value * 3.6}deg`,
      '--progress-value': `${progressValue.value}%`,
    }) as CSSProperties,
);

const leftFoundation = computed<FoundationItem[]>(() => {
  const root = splitFoundationValue(store.本尊.灵根);
  const body = splitFoundationValue(store.本尊.体质);
  const art = splitFoundationValue(store.本尊.功法);
  return [
    {
      label: '灵根',
      title: root.title,
      detail: root.detail,
      icon: 'fa-solid fa-seedling',
      toneClass: 'root-tone',
    },
    {
      label: '体质',
      title: body.title,
      detail: body.detail,
      icon: 'fa-solid fa-person-rays',
    },
    {
      label: '功法',
      title: art.title,
      detail: art.detail,
      icon: 'fa-solid fa-scroll',
    },
  ];
});

const rightFoundation = computed<FoundationItem[]>(() => {
  const weapon = splitFoundationValue(store.本尊.本命兵器);
  const lifespan = splitFoundationValue(store.本尊.寿元状态);
  return [
    {
      label: '本命兵器',
      title: weapon.title,
      detail: weapon.detail,
      icon: 'fa-solid fa-khanda',
    },
    {
      label: '灵石（折合下品）',
      title: formatNumber(getSpiritStoneTotal(store.本尊.灵石)),
      detail: '',
      icon: 'fa-solid fa-gem',
      toneClass: 'gold-tone',
    },
    {
      label: '寿元',
      title: lifespan.title,
      detail: lifespan.detail,
      icon: 'fa-solid fa-hourglass-half',
    },
  ];
});

function draftMeditate(): void {
  const method =
    String(store.本尊.功法 || '')
      .split(/[（(]/)[0]
      ?.trim() || '本门心法';
  pseudo.performAction('吐纳修持', `寻一处清静之地盘膝坐定，缓缓运转《${method}》，纳周遭灵机入体，行功打磨修为。`);
}

function draftBreakthrough(): void {
  const target = store.本尊.修炼状态.突破目标 || '下一境界';
  pseudo.performAction(
    '尝试破境',
    `眼下气机已蓄至圆满，收敛心神、闭目定息，催动周天真元一鼓作气叩击「${target}」关隘。`,
  );
}

const pathNotes = computed<PathNote[]>(() => {
  const cultivation = store.本尊.修炼状态;
  const notes: PathNote[] = [];

  if (cultivation.突破目标) notes.push({ label: '破境所向', value: cultivation.突破目标 });
  if (cultivation.方式) notes.push({ label: '行功之法', value: cultivation.方式 });
  if (cultivation.地点) notes.push({ label: '修行所在', value: cultivation.地点 });
  if (cultivation.计划年数 > 0 || cultivation.已修炼年数 > 0) {
    notes.push({
      label: '修行岁月',
      value: `已修 ${formatNumber(cultivation.已修炼年数)} 年${cultivation.计划年数 > 0 ? `，计划 ${formatNumber(cultivation.计划年数)} 年` : ''}`,
    });
  }
  if (cultivation.瓶颈原因) notes.push({ label: '瓶颈所在', value: cultivation.瓶颈原因 });
  if (cultivation.根基描述) notes.push({ label: '根基调养', value: cultivation.根基描述 });
  if (cultivation.上次结果 !== '无') notes.push({ label: '上次问道', value: cultivation.上次结果 });
  if (cultivation.最近突破.依据) notes.push({ label: '破境纪要', value: cultivation.最近突破.依据 });

  return notes;
});

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function openArchive(): void {
  archiveDraft.value = archiveContent.value;
  archiveOpen.value = true;
  void nextTick(() => archiveInput.value?.focus());
}

function closeArchive(): void {
  if (archiveSaving.value) return;
  archiveOpen.value = false;
}

async function saveArchive(): Promise<void> {
  if (archiveSaving.value) return;
  if (!archiveDirty.value) {
    archiveOpen.value = false;
    return;
  }

  archiveSaving.value = true;
  const saved = await store.saveProtagonistArchive(archiveDraft.value);
  archiveSaving.value = false;
  if (saved) archiveOpen.value = false;
}
</script>

<style lang="scss" scoped>
.cultivation-panel {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--text-primary);
}

.cultivation-panel::before,
.cultivation-panel::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.cultivation-panel::before {
  width: min(68vw, 760px);
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--jade) 12%, transparent);
  border-radius: 50%;
  box-shadow:
    0 0 0 70px color-mix(in srgb, var(--line-subtle) 16%, transparent),
    0 0 0 150px color-mix(in srgb, var(--gold) 4%, transparent);
  opacity: 0.42;
  transform: rotate(12deg);
}

.cultivation-panel::after {
  inset: 7% 5%;
  border-top: 1px solid color-mix(in srgb, var(--line-strong) 34%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--line-strong) 24%, transparent);
  opacity: 0.42;
}

.cultivation-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 1080px);
  min-height: min(100%, 650px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: 12px 20px;
}

.identity-masthead {
  text-align: center;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif;
}

.identity-name-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
}

.identity-eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  font-family: system-ui, sans-serif;
  font-size: 11px;
  letter-spacing: 0;
}

.identity-eyebrow span {
  width: 42px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-soft));
}

.identity-eyebrow span:last-child {
  transform: scaleX(-1);
}

.identity-masthead h2 {
  margin: 5px 0 3px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  text-shadow: 0 0 22px color-mix(in srgb, var(--gold) 14%, transparent);
}

.archive-trigger {
  position: relative;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 3px 0 0 10px;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--gold) 28%, var(--line-subtle));
  border-radius: 999px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
  font-family: system-ui, sans-serif;
  font-size: 10px;
  line-height: 1.2;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.archive-trigger:hover,
.archive-trigger:focus-visible {
  border-color: color-mix(in srgb, var(--gold) 62%, var(--line-strong));
  color: var(--gold);
  background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 12%, transparent);
  outline: none;
}

.archive-trigger i {
  font-size: 9px;
}

.archive-trigger b {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-secondary);
  opacity: 0.3;
}

.archive-trigger.has-entry b {
  background: var(--jade);
  box-shadow: 0 0 7px var(--jade);
  opacity: 1;
}

.identity-masthead p {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.identity-masthead p i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--gold-soft);
  box-shadow: 0 0 8px var(--gold);
}

.sanctum-grid {
  display: grid;
  grid-template-columns: minmax(210px, 1fr) minmax(230px, 286px) minmax(210px, 1fr);
  grid-template-areas: 'left core right';
  align-items: center;
  gap: 30px;
}

.foundation-left {
  grid-area: left;
}
.foundation-right {
  grid-area: right;
}
.realm-core {
  grid-area: core;
}

.foundation-column {
  display: grid;
  gap: 12px;
}

.foundation-item {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 9px;
  background:
    linear-gradient(125deg, color-mix(in srgb, var(--surface-raised) 82%, transparent), transparent 72%),
    color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--stage-shadow) 18%, transparent);
}

.foundation-icon {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  margin-top: 2px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--line-strong) 64%, transparent);
  border-radius: 50%;
  color: var(--jade);
  background:
    radial-gradient(circle, color-mix(in srgb, var(--jade) 12%, transparent), transparent 68%),
    color-mix(in srgb, var(--surface-raised) 78%, transparent);
  box-shadow: inset 0 0 12px color-mix(in srgb, var(--jade) 7%, transparent);
}

.foundation-icon i {
  font-size: 14px;
}

.foundation-copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 5px;
  text-align: left;
}

.foundation-topline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 10px;
}

.foundation-topline span {
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.foundation-topline strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
}

.foundation-detail {
  margin: 0;
  padding-top: 5px;
  border-top: 1px dashed color-mix(in srgb, var(--line-subtle) 78%, transparent);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.62;
  text-align: left;
  overflow-wrap: anywhere;
}

.foundation-copy .root-tone {
  color: color-mix(in srgb, var(--root-tone) 78%, var(--text-primary));
  text-shadow: 0 0 12px color-mix(in srgb, var(--root-tone) 20%, transparent);
}

.foundation-copy .gold-tone {
  color: var(--gold);
}

.realm-core {
  display: grid;
  place-items: center;
  gap: 12px;
}

.realm-orbit {
  position: relative;
  width: 218px;
  aspect-ratio: 1;
  padding: 8px;
  border-radius: 50%;
  background: conic-gradient(
    from -90deg,
    var(--realm-tone) 0deg var(--progress-angle),
    color-mix(in srgb, var(--line-subtle) 72%, transparent) var(--progress-angle) 360deg
  );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--realm-tone) 30%, transparent),
    0 0 30px color-mix(in srgb, var(--realm-tone) 10%, transparent);
}

.realm-orbit::before,
.realm-orbit::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.realm-orbit::before {
  inset: -12px;
  border: 1px solid color-mix(in srgb, var(--gold) 26%, transparent);
  border-right-color: transparent;
  border-left-color: transparent;
  transform: rotate(36deg);
}

.realm-orbit::after {
  inset: 17px;
  border: 1px dashed color-mix(in srgb, var(--jade) 15%, transparent);
}

.realm-disc {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--line-strong) 58%, transparent);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--realm-tone) 11%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-inset) 94%, transparent);
  box-shadow:
    inset 0 0 34px color-mix(in srgb, var(--realm-tone) 8%, transparent),
    0 0 0 5px color-mix(in srgb, var(--surface) 88%, transparent);
}

.realm-emblem {
  margin-bottom: 8px;
  color: color-mix(in srgb, var(--realm-tone) 76%, var(--text-primary));
  font-size: 27px;
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--realm-tone) 28%, transparent));
  animation: realm-breathe 4s ease-in-out infinite;
}

.realm-caption {
  color: var(--text-secondary);
  font-size: 10px;
}

.realm-disc strong {
  max-width: 150px;
  margin-top: 3px;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
}

.realm-percent {
  margin-top: 7px;
  color: var(--gold);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.orbit-mark {
  position: absolute;
  z-index: 3;
  left: 50%;
  width: 7px;
  height: 7px;
  border: 1px solid var(--gold-soft);
  background: var(--surface-inset);
  transform: translateX(-50%) rotate(45deg);
  box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 32%, transparent);
}

.orbit-mark-top {
  top: -15px;
}
.orbit-mark-bottom {
  bottom: -15px;
}

.status-seal {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  padding: 4px 10px;
  border: 1px solid color-mix(in srgb, var(--gold) 34%, var(--line-subtle));
  border-radius: 4px;
  color: var(--text-accent);
  background: color-mix(in srgb, var(--surface-raised) 84%, transparent);
  font-size: 12px;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--jade);
  box-shadow: 0 0 8px var(--jade);
}

.progress-belt {
  width: min(100%, 820px);
  margin: 0 auto;
  padding: 12px 16px 11px;
  border-top: 1px solid var(--line-subtle);
  border-bottom: 1px solid var(--line-subtle);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--surface-raised) 58%, transparent),
    transparent
  );
}

.progress-heading,
.progress-title-group,
.progress-actions,
.progress-foot {
  display: flex;
  align-items: center;
}

.progress-heading {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 9px;
}

.progress-title-group {
  gap: 8px;
}
.progress-title-group i {
  color: var(--jade);
  font-size: 12px;
}
.progress-title-group span {
  color: var(--text-secondary);
  font-size: 12px;
}
.progress-title-group strong {
  margin-left: 4px;
  color: var(--text-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.progress-title-group small {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 400;
}

.progress-actions {
  gap: 7px;
}

.cultivation-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 11px;
  border: 1px solid color-mix(in srgb, var(--jade) 42%, var(--line-subtle));
  border-radius: 999px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 10%, var(--surface-inset));
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    border-color: var(--gold);
    color: var(--gold);
    background: var(--button-active);
  }
  &.is-breakthrough {
    border-color: color-mix(in srgb, var(--gold) 58%, var(--line-strong));
    color: var(--gold);
    background: color-mix(in srgb, var(--gold) 15%, var(--surface-inset));
    box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 18%, transparent);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.progress-track {
  position: relative;
  height: 8px;
  overflow: visible;
  border: 1px solid color-mix(in srgb, var(--line-strong) 52%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--progress-bg) 88%, transparent);
  box-shadow: inset 0 1px 3px color-mix(in srgb, var(--stage-shadow) 60%, transparent);
}

.progress-fill {
  width: var(--progress-value);
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--jade) 72%, var(--realm-tone)),
    var(--realm-tone),
    var(--gold)
  );
  box-shadow: 0 0 12px color-mix(in srgb, var(--realm-tone) 30%, transparent);
  transition: width 0.5s ease;
}

.progress-track > span {
  position: absolute;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-secondary) 54%, transparent);
  transform: translate(-50%, -50%);
}

.progress-foot {
  justify-content: space-between;
  gap: 12px;
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 10px;
}

.path-notes {
  width: min(100%, 820px);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: stretch;
  margin: 0 auto;
  padding-top: 1px;
}

.path-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border-right: 1px solid var(--line-subtle);
  color: var(--gold);
  font-size: 12px;
}

.path-note-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.path-note {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 3px;
  padding: 6px 0;
}

.path-note span {
  color: var(--text-secondary);
  font-size: 10px;
}
.path-note strong {
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
}

.cultivation-panel.archive-visible {
  overflow: hidden;
}

.archive-overlay {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--jade) 6%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-inset) 76%, transparent);
  backdrop-filter: blur(7px);
}

.archive-dialog {
  position: relative;
  width: min(100%, 610px);
  max-height: calc(100% - 12px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--gold) 42%, var(--line-strong));
  border-radius: 8px;
  color: var(--text-primary);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--jade) 5%, transparent), transparent 42%),
    color-mix(in srgb, var(--surface-raised) 97%, transparent);
  box-shadow:
    0 22px 64px color-mix(in srgb, var(--stage-shadow) 82%, transparent),
    inset 0 0 32px color-mix(in srgb, var(--gold) 3%, transparent);
}

.archive-dialog::before {
  content: '';
  position: absolute;
  z-index: 2;
  top: 0;
  right: 12%;
  left: 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 42%, transparent);
}

.archive-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 22px 15px;
  border-bottom: 1px solid var(--line-subtle);
}

.archive-heading {
  min-width: 0;
}

.archive-heading > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--gold);
  font-family: system-ui, sans-serif;
  font-size: 10px;
  letter-spacing: 0.12em;
}

.archive-heading h3 {
  margin: 6px 0 0;
  overflow-wrap: anywhere;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
}

.archive-close {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.archive-close:hover,
.archive-close:focus-visible {
  border-color: var(--line-strong);
  color: var(--text-primary);
  outline: none;
  transform: rotate(6deg);
}

.archive-body {
  min-height: 0;
  padding: 17px 22px 12px;
  overflow-y: auto;
}

.archive-lead {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.6;
}

.archive-body textarea {
  box-sizing: border-box;
  width: 100%;
  height: clamp(176px, 23vw, 280px);
  display: block;
  resize: vertical;
  padding: 14px 15px;
  border: 1px solid color-mix(in srgb, var(--line-strong) 62%, transparent);
  border-radius: 5px;
  outline: none;
  color: var(--text-primary);
  background:
    linear-gradient(color-mix(in srgb, var(--line-subtle) 14%, transparent) 1px, transparent 1px),
    color-mix(in srgb, var(--surface-inset) 88%, transparent);
  background-size: 100% 1.75em;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif;
  font-size: 13px;
  line-height: 1.75;
  caret-color: var(--gold);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.archive-body textarea::placeholder {
  color: color-mix(in srgb, var(--text-secondary) 64%, transparent);
}

.archive-body textarea:focus {
  border-color: color-mix(in srgb, var(--gold) 60%, var(--line-strong));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--gold) 7%, transparent),
    inset 0 0 18px color-mix(in srgb, var(--jade) 3%, transparent);
}

.archive-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 10px;
}

.archive-meta span:first-child {
  color: color-mix(in srgb, var(--jade) 72%, var(--text-secondary));
}

.archive-meta i {
  margin-right: 4px;
  font-size: 8px;
}

.archive-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  padding: 13px 22px 17px;
  border-top: 1px solid var(--line-subtle);
}

.archive-actions button {
  min-height: 30px;
  padding: 5px 13px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.archive-actions button:disabled {
  cursor: default;
  opacity: 0.46;
}

.archive-cancel {
  border: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  background: transparent;
}

.archive-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--gold) 54%, var(--line-strong));
  color: color-mix(in srgb, var(--gold) 82%, var(--text-primary));
  background: color-mix(in srgb, var(--gold) 9%, var(--surface-raised));
  box-shadow: inset 0 0 12px color-mix(in srgb, var(--gold) 5%, transparent);
}

.archive-cancel:not(:disabled):hover,
.archive-cancel:focus-visible,
.archive-save:not(:disabled):hover,
.archive-save:focus-visible {
  border-color: var(--gold-soft);
  color: var(--text-primary);
  outline: none;
}

.archive-sheet-enter-active,
.archive-sheet-leave-active {
  transition: opacity 0.2s ease;
}

.archive-sheet-enter-active .archive-dialog,
.archive-sheet-leave-active .archive-dialog {
  transition:
    opacity 0.2s ease,
    transform 0.24s ease;
}

.archive-sheet-enter-from,
.archive-sheet-leave-to {
  opacity: 0;
}

.archive-sheet-enter-from .archive-dialog,
.archive-sheet-leave-to .archive-dialog {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
}

@keyframes realm-breathe {
  0%,
  100% {
    opacity: 0.78;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}

@media screen and (max-width: 780px) {
  .cultivation-panel {
    overflow-y: auto;
  }

  .cultivation-shell {
    min-height: 100%;
    justify-content: flex-start;
    gap: 15px;
    padding: 8px 4px 14px;
  }

  .identity-masthead h2 {
    font-size: 23px;
  }

  .archive-trigger {
    margin-left: 8px;
  }

  .sanctum-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'core core'
      'left right';
    align-items: start;
    gap: 18px;
  }

  .realm-orbit {
    width: 176px;
  }
  .realm-disc strong {
    font-size: 16px;
  }
  .realm-emblem {
    font-size: 22px;
  }

  .foundation-column {
    gap: 5px;
  }
  .foundation-item,
  .foundation-item.is-left {
    min-height: 58px;
    flex-direction: row;
    padding: 7px 2px;
    text-align: left;
  }

  .foundation-item.is-left::after,
  .foundation-item::after {
    background: linear-gradient(90deg, var(--line-strong), var(--line-subtle) 66%, transparent);
  }

  .foundation-icon {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
  }

  .foundation-copy strong {
    font-size: 13px;
  }
  .progress-belt {
    padding-inline: 10px;
  }

  .path-notes {
    grid-template-columns: 1fr;
    gap: 5px;
  }

  .path-heading {
    justify-content: center;
    padding: 6px;
    border-right: 0;
    border-bottom: 1px solid var(--line-subtle);
  }

  .archive-overlay {
    place-items: end center;
    padding: 8px 6px 0;
  }

  .archive-dialog {
    width: 100%;
    max-height: calc(100% - 8px);
    border-radius: 14px 14px 0 0;
  }

  .archive-header {
    padding: 16px 17px 12px;
  }

  .archive-body {
    padding: 14px 17px 10px;
  }

  .archive-body textarea {
    height: clamp(164px, 44vw, 250px);
  }

  .archive-actions {
    padding: 11px 17px 14px;
  }
}

@media screen and (max-width: 480px) {
  .cultivation-shell {
    gap: 12px;
  }
  .identity-masthead h2 {
    font-size: 21px;
  }
  .identity-eyebrow {
    font-size: 10px;
  }
  .archive-trigger {
    gap: 4px;
    margin-left: 6px;
    padding-inline: 6px;
  }
  .archive-trigger b {
    display: none;
  }
  .realm-orbit {
    width: 158px;
  }
  .sanctum-grid {
    gap: 11px;
  }
  .foundation-item {
    gap: 7px;
  }
  .foundation-icon {
    display: none;
  }
  .foundation-copy strong {
    font-size: 12px;
  }
  .progress-heading {
    gap: 8px;
  }
  .progress-foot {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
  .path-note-list {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .archive-heading h3 {
    font-size: 17px;
  }

  .archive-lead {
    font-size: 10px;
  }

  .archive-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .archive-actions button {
    flex: 1;
  }
}
</style>
