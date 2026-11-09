<template>
  <details class="branch-choice-panel" open>
    <summary>
      <span class="choice-kicker">✣</span>
      <span>Make Your Choice</span>
      <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
    </summary>

    <div class="choice-list" role="list" aria-label="剧情选项">
      <button
        v-for="choice in choices"
        :key="choice.letter"
        type="button"
        class="choice-item"
        :disabled="!canChoose"
        :title="canChoose ? `选择 ${choice.letter}` : unavailableHint"
        @click="choose(choice.letter, choice.text)"
      >
        <strong>{{ choice.letter }}</strong>
        <span>{{ choice.text }}</span>
        <i class="fa-solid fa-feather-pointed" aria-hidden="true"></i>
      </button>
    </div>
    <p v-if="!canChoose" class="choice-hint">{{ unavailableHint }}</p>
  </details>
</template>

<script setup lang="ts">
import type { BranchChoice } from '../message-content';
import { usePseudoLayerStore } from '../store';

defineProps<{ choices: BranchChoice[] }>();

const pseudo = usePseudoLayerStore();
const canChoose = computed(() => !pseudo.isGenerating && pseudo.isStoryHistoryLatest);
const unavailableHint = computed(() => {
  if (pseudo.isGenerating) return '正在生成，待本回落定后再作选择。';
  return '请先回到最新正文，再作出新的选择。';
});

const choose = (letter: string, text: string) => {
  if (!canChoose.value) return;
  const prompt = [pseudo.draftPrompt.trim(), text.trim()].filter(Boolean).join('\n');
  pseudo.selectDraft(`选择 ${letter}`, prompt);
};
</script>

<style lang="scss" scoped>
.branch-choice-panel {
  margin: 26px auto 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--line-strong) 86%, transparent);
  border-radius: 10px;
  color: var(--text-primary);
  background:
    radial-gradient(circle at 72% 4%, color-mix(in srgb, var(--gold) 10%, transparent), transparent 26%),
    color-mix(in srgb, var(--surface-inset) 80%, transparent);
  box-shadow:
    0 16px 42px color-mix(in srgb, var(--stage-shadow) 34%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--jade) 7%, transparent);
}

.branch-choice-panel > summary {
  min-height: 46px;
  padding: 0 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-bottom: 1px solid var(--line-subtle);
  color: var(--text-accent);
  cursor: pointer;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  list-style: none;
  user-select: none;
}
.branch-choice-panel > summary::-webkit-details-marker {
  display: none;
}
.branch-choice-panel > summary > i {
  position: absolute;
  right: 16px;
  color: var(--text-secondary);
  font-size: 10px;
  transition: transform 0.18s ease;
}
.branch-choice-panel:not([open]) > summary {
  border-bottom-color: transparent;
}
.branch-choice-panel:not([open]) > summary > i {
  transform: rotate(180deg);
}
.choice-kicker {
  color: var(--gold-soft);
  font-size: 14px;
}

.choice-list {
  padding: 3px 14px 12px;
}
.choice-item {
  width: 100%;
  min-height: 54px;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 12px;
  border: 0;
  border-bottom: 1px dashed color-mix(in srgb, var(--line-subtle) 88%, transparent);
  color: var(--text-primary);
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    color 0.16s ease,
    background 0.16s ease,
    padding 0.16s ease;
}
.choice-item:last-child {
  border-bottom: 0;
}
.choice-item strong {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--gold) 48%, var(--line-subtle));
  border-radius: 50%;
  color: var(--gold-soft);
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 600;
}
.choice-item span {
  min-width: 0;
  color: var(--text-secondary);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.7;
}
.choice-item > i {
  color: transparent;
  font-size: 12px;
  transition:
    color 0.16s ease,
    transform 0.16s ease;
}
.choice-item:hover:not(:disabled),
.choice-item:focus-visible:not(:disabled) {
  padding-right: 8px;
  padding-left: 16px;
  outline: 0;
  color: var(--text-primary);
  background: linear-gradient(90deg, color-mix(in srgb, var(--jade) 12%, transparent), transparent 84%);
}
.choice-item:hover:not(:disabled) strong,
.choice-item:focus-visible:not(:disabled) strong {
  border-color: var(--gold);
  color: var(--gold);
  box-shadow: 0 0 13px color-mix(in srgb, var(--accent-glow) 46%, transparent);
}
.choice-item:hover:not(:disabled) span,
.choice-item:focus-visible:not(:disabled) span {
  color: var(--text-primary);
}
.choice-item:hover:not(:disabled) > i,
.choice-item:focus-visible:not(:disabled) > i {
  color: var(--jade);
  transform: translateX(2px);
}
.choice-item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.choice-hint {
  margin: 0;
  padding: 0 16px 12px;
  color: var(--text-secondary);
  font-size: 11px;
  text-align: center;
}

@media (max-width: 640px) {
  .branch-choice-panel {
    margin-top: 18px;
    border-radius: 7px;
  }
  .choice-list {
    padding-right: 8px;
    padding-left: 8px;
  }
  .choice-item {
    grid-template-columns: 27px minmax(0, 1fr) 16px;
    gap: 9px;
    min-height: 50px;
    padding-right: 8px;
    padding-left: 8px;
  }
  .choice-item span {
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .branch-choice-panel *,
  .branch-choice-panel *::before,
  .branch-choice-panel *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
