<template>
  <div
    class="reasoning-presentation"
    :class="{ 'is-streaming': streaming, 'is-editing': editing }"
    :data-presentation="presentationKind"
  >
    <button
      v-if="editable && !streaming && !editing && presentationKind !== 'theme'"
      type="button"
      class="reasoning-edit-button reasoning-floating-edit"
      :disabled="!pseudo.canEditReasoning"
      title="编辑灵台观照"
      @click="startEditing"
    >
      <i class="fa-solid fa-pen"></i>
      <span>编辑</span>
    </button>

    <section v-if="editing" class="reasoning-editor">
      <textarea
        ref="editorRef"
        v-model="draft"
        aria-label="编辑灵台观照"
        :disabled="saving"
        @keydown.ctrl.enter.prevent="save"
        @keydown.meta.enter.prevent="save"
        @keydown.esc.prevent="cancelEditing"
      ></textarea>
      <p v-if="pseudo.editError" class="reasoning-edit-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        {{ pseudo.editError }}
      </p>
      <div class="reasoning-editor-actions">
        <small>Ctrl / ⌘ + Enter 保存</small>
        <button type="button" :disabled="saving" @click="cancelEditing">取消</button>
        <button type="button" class="primary" :disabled="!canSave" @click="save">
          <i :class="saving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i>
          {{ saving ? '保存中' : '保存' }}
        </button>
      </div>
    </section>

    <template v-else-if="presentationKind === 'preset'">
      <!-- `.mes_text` keeps preset regex CSS such as `.mes_text .custom-*` working inside the iframe. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div ref="presetHost" class="reasoning-preset-host mes_text" v-html="presetHtml"></div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-if="supplementalHtml" class="reasoning-supplement" v-html="supplementalHtml"></div>
    </template>

    <article v-else-if="presentationKind === 'theme'" class="reasoning-theme-card">
      <div class="reasoning-theme-orbit" aria-hidden="true"></div>
      <header class="reasoning-theme-heading">
        <span class="reasoning-theme-glyph"><i class="fa-solid fa-fire-flame-curved"></i></span>
        <span>
          <small>灵台微明</small>
          <strong>心灯推演</strong>
        </span>
        <span v-if="streaming" class="reasoning-theme-live">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          推演中
        </span>
        <button
          v-if="editable && !streaming"
          type="button"
          class="reasoning-edit-button reasoning-theme-edit"
          :disabled="!pseudo.canEditReasoning"
          title="编辑灵台观照"
          @click="startEditing"
        >
          <i class="fa-solid fa-feather-pointed"></i>
          <span>修订</span>
        </button>
        <i v-else class="fa-solid fa-feather-pointed reasoning-theme-mark" aria-hidden="true"></i>
      </header>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="reasoning-theme-copy" v-html="plainHtml"></div>
      <span v-if="streaming" class="reasoning-stream-caret" aria-hidden="true"></span>
    </article>

    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="reasoning-plain-copy" v-html="plainHtml"></div>
  </div>
</template>

<script setup lang="ts">
import {
  extractInlineReasoning,
  formatMessageHtml,
  formatReasoningHtml,
  hasReasoningFrontendBootstrap,
  isRichPresetHtml,
} from '../message-content';
import { usePseudoLayerStore, useThemeStore } from '../store';

const props = withDefaults(
  defineProps<{
    text: string;
    rawMessage?: string;
    messageId: number;
    openPresetDisclosure?: boolean;
    streaming?: boolean;
    editable?: boolean;
  }>(),
  {
    rawMessage: '',
    openPresetDisclosure: true,
    streaming: false,
    editable: false,
  },
);

const appearance = useThemeStore();
const pseudo = usePseudoLayerStore();
const presetHost = ref<HTMLElement | null>(null);
const editorRef = ref<HTMLTextAreaElement | null>(null);
const presetDisclosureOpened = ref(false);
const editing = ref(false);
const saving = ref(false);
const draft = ref(props.text);
const inlineReasoning = computed(() => extractInlineReasoning(props.rawMessage));
const plainHtml = computed(() => formatReasoningHtml(props.text));
const presetHtml = computed(() => {
  const inline = inlineReasoning.value;
  if (!inline?.source || !inline.isComplete) return '';
  return formatMessageHtml(inline.source, props.messageId);
});

const hasPresetPresentation = computed(() => {
  const inline = inlineReasoning.value;
  if (
    !inline?.source ||
    /<!doctype\s+html|<html(?=[\s>])/i.test(inline.source) ||
    hasReasoningFrontendBootstrap(inline.source)
  ) {
    return false;
  }
  return isRichPresetHtml(presetHtml.value);
});

const supplementalText = computed(() => {
  const inlineText = inlineReasoning.value?.text.trim() ?? '';
  const fullText = props.text.trim();
  if (!inlineText || !fullText || inlineText === fullText || inlineText.includes(fullText)) return '';
  if (fullText.includes(inlineText)) return fullText.replace(inlineText, '').trim();
  return fullText;
});
const supplementalHtml = computed(() =>
  hasPresetPresentation.value && supplementalText.value
    ? formatReasoningHtml(supplementalText.value)
    : '',
);

const presentationKind = computed<'preset' | 'theme' | 'plain'>(() => {
  const mode = appearance.preferences.reasoningAppearance;
  if (mode === 'theme') return 'theme';
  if (mode === 'preset') return hasPresetPresentation.value ? 'preset' : 'plain';
  return hasPresetPresentation.value ? 'preset' : 'theme';
});

const canSave = computed(
  () =>
    !saving.value &&
    pseudo.canEditReasoning &&
    draft.value.trim().length > 0 &&
    draft.value.trim() !== props.text.trim(),
);

const startEditing = async () => {
  if (!props.editable || props.streaming || !pseudo.canEditReasoning) return;
  pseudo.clearEditError();
  draft.value = props.text;
  editing.value = true;
  await nextTick();
  editorRef.value?.focus();
  editorRef.value?.setSelectionRange(draft.value.length, draft.value.length);
};

const cancelEditing = () => {
  if (saving.value) return;
  editing.value = false;
  draft.value = props.text;
  pseudo.clearEditError();
};

const save = () => {
  if (!canSave.value) return;
  saving.value = true;
  pseudo.updateReasoning(draft.value, props.messageId);
};

const openPrimaryPresetDisclosure = async () => {
  if (!props.openPresetDisclosure || presentationKind.value !== 'preset' || presetDisclosureOpened.value) return;
  await nextTick();

  // The pseudo layer already has its own "灵台观照" entrance. Open only the
  // preset's first independent disclosure so reading does not require a second
  // click, while any task/log details inside it retain their original state.
  const disclosure = [...(presetHost.value?.querySelectorAll<HTMLDetailsElement>('details') ?? [])].find(
    (item) => !item.parentElement?.closest('details'),
  );
  if (!disclosure) return;
  disclosure.open = true;
  presetDisclosureOpened.value = true;
};

watch(
  presentationKind,
  (kind) => {
    if (kind !== 'preset') {
      presetDisclosureOpened.value = false;
      return;
    }
    void openPrimaryPresetDisclosure();
  },
  { immediate: true, flush: 'post' },
);

watch(
  () => props.text,
  text => {
    if (!editing.value) draft.value = text;
  },
);

watch(
  () => pseudo.editSavedNonce,
  () => {
    if (!saving.value) return;
    saving.value = false;
    editing.value = false;
  },
);

watch(
  () => pseudo.editError,
  error => {
    if (saving.value && error) saving.value = false;
  },
);
</script>

<style lang="scss" scoped>
.reasoning-presentation {
  position: relative;
  min-width: 0;
  max-width: 100%;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.reasoning-edit-button,
.reasoning-editor-actions button {
  min-height: 27px;
  padding: 4px 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--button-bg) 82%, transparent);
  cursor: pointer;
}

.reasoning-edit-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--gold-soft);
}

.reasoning-edit-button:hover:not(:disabled),
.reasoning-editor-actions button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--text-accent);
  background: var(--button-hover);
}

.reasoning-edit-button:disabled,
.reasoning-editor-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.reasoning-floating-edit {
  position: absolute;
  z-index: 4;
  top: 8px;
  right: 8px;
  min-height: 25px;
  padding: 3px 9px;
  backdrop-filter: blur(8px);
}

.reasoning-presentation[data-presentation='plain']:has(.reasoning-floating-edit) .reasoning-plain-copy {
  padding-top: 38px;
}

.reasoning-editor {
  padding: 12px;
  display: grid;
  gap: 9px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background:
    radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--jade) 10%, transparent), transparent 32%),
    color-mix(in srgb, var(--surface-raised) 92%, transparent);
}

.reasoning-editor textarea {
  width: 100%;
  min-height: clamp(220px, 42vh, 520px);
  padding: 13px 14px;
  resize: vertical;
  border: 1px solid color-mix(in srgb, var(--jade) 34%, var(--line-subtle));
  border-radius: 7px;
  outline: none;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-inset) 92%, transparent);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  box-sizing: border-box;
}

.reasoning-editor textarea:focus {
  border-color: var(--jade);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--jade) 12%, transparent);
}

.reasoning-edit-error {
  margin: 0;
  color: var(--semantic-danger);
  font-size: 11px;
}

.reasoning-editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.reasoning-editor-actions small {
  margin-right: auto;
  color: var(--text-secondary);
  font-size: 9px;
}

.reasoning-editor-actions button.primary {
  border-color: color-mix(in srgb, var(--jade) 48%, var(--line-strong));
  color: var(--jade);
}

.reasoning-preset-host {
  min-width: 0;
  max-width: 100%;
}

.reasoning-preset-host :deep(img),
.reasoning-preset-host :deep(video),
.reasoning-preset-host :deep(canvas),
.reasoning-preset-host :deep(svg) {
  max-width: 100%;
}

.reasoning-preset-host :deep(details),
.reasoning-preset-host :deep([class]) {
  max-width: 100%;
  box-sizing: border-box;
}

.reasoning-supplement {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  font-size: 0.92em;
}

.reasoning-theme-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background:
    radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--jade) 13%, transparent), transparent 32%),
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--surface-raised) 92%, transparent),
      color-mix(in srgb, var(--surface-inset) 88%, transparent)
    );
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 8%, transparent);
  isolation: isolate;
}

.reasoning-theme-card::before,
.reasoning-theme-card::after {
  content: '';
  position: absolute;
  z-index: -1;
  pointer-events: none;
}

.reasoning-theme-card::before {
  inset: 0;
  background:
    repeating-linear-gradient(
      90deg,
      transparent 0 44px,
      color-mix(in srgb, var(--gold) 4%, transparent) 45px,
      transparent 46px
    ),
    var(--grain-material);
  opacity: 0.72;
}

.reasoning-theme-card::after {
  right: -36px;
  bottom: -52px;
  width: 156px;
  height: 156px;
  border: 1px solid color-mix(in srgb, var(--jade) 16%, transparent);
  border-radius: 50%;
  box-shadow:
    0 0 0 18px color-mix(in srgb, var(--gold) 4%, transparent),
    0 0 0 38px color-mix(in srgb, var(--jade) 3%, transparent);
}

.reasoning-theme-orbit {
  position: absolute;
  top: 15px;
  right: 18px;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--jade) 28%, transparent);
  border-radius: 50%;
  opacity: 0.7;
  animation: reasoning-orbit 12s linear infinite;
  pointer-events: none;
}

.reasoning-theme-orbit::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 9px var(--accent-glow);
}

.reasoning-theme-heading {
  min-height: 52px;
  padding: 10px 54px 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--line-subtle);
  background: linear-gradient(90deg, color-mix(in srgb, var(--button-bg) 76%, transparent), transparent 72%);
}

.reasoning-theme-glyph {
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 42%, transparent);
  border-radius: 50%;
  color: var(--jade);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--jade) 8%, transparent);
}

.reasoning-theme-heading > span:nth-child(2) {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.reasoning-theme-heading small {
  color: var(--text-secondary);
  font-size: 9px;
  letter-spacing: 0.2em;
}

.reasoning-theme-heading strong {
  color: var(--text-accent);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.reasoning-theme-mark {
  color: var(--gold-soft);
  opacity: 0.58;
  transform: rotate(-18deg);
}

.reasoning-theme-edit {
  position: relative;
  min-height: 30px;
  margin-left: auto;
  margin-right: 5px;
  padding: 4px 12px 4px 33px;
  overflow: hidden;
  border: 0;
  border-radius: 2px 11px 2px 11px;
  color: color-mix(in srgb, var(--jade) 76%, var(--gold-soft));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 9%, transparent), transparent 86%),
    color-mix(in srgb, var(--surface-inset) 36%, transparent);
  box-shadow:
    inset 1px 0 color-mix(in srgb, var(--jade) 34%, transparent),
    inset 0 -1px color-mix(in srgb, var(--gold) 18%, transparent);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: 10px;
  letter-spacing: 0.16em;
  isolation: isolate;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.reasoning-theme-edit::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 9px;
  width: 14px;
  height: 14px;
  border: 1px solid color-mix(in srgb, var(--gold) 42%, transparent);
  background: color-mix(in srgb, var(--jade) 7%, transparent);
  box-shadow: inset 0 0 7px color-mix(in srgb, var(--jade) 10%, transparent);
  transform: translateY(-50%) rotate(45deg);
}

.reasoning-theme-edit::after {
  content: '';
  position: absolute;
  right: 8px;
  bottom: 3px;
  left: 31px;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--jade) 58%, transparent), transparent);
  opacity: 0.65;
}

.reasoning-theme-edit > i {
  position: absolute;
  left: 12px;
  color: var(--gold-soft);
  font-size: 8px;
  transform: rotate(-14deg);
}

.reasoning-theme-edit:hover:not(:disabled) {
  border-color: transparent;
  color: var(--text-accent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 15%, transparent), transparent 90%),
    color-mix(in srgb, var(--surface-inset) 48%, transparent);
  box-shadow:
    inset 1px 0 color-mix(in srgb, var(--jade) 56%, transparent),
    inset 0 -1px color-mix(in srgb, var(--gold) 32%, transparent),
    0 0 16px color-mix(in srgb, var(--jade) 9%, transparent);
  transform: translateY(-1px);
}

.reasoning-theme-live {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--jade);
  font-size: 10px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.reasoning-theme-copy {
  position: relative;
  padding: 16px 18px 18px;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: 13px;
  line-height: 1.85;
}

.reasoning-theme-copy::before {
  content: '';
  position: absolute;
  top: 15px;
  bottom: 17px;
  left: 8px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(transparent, var(--jade), var(--gold-soft), transparent);
  opacity: 0.52;
}

.reasoning-theme-copy :deep(p) {
  margin: 0 0 0.9em;
}

.reasoning-theme-copy :deep(p:last-child) {
  margin-bottom: 0;
}

.reasoning-theme-copy :deep(ul),
.reasoning-theme-copy :deep(ol) {
  padding-left: 1.5em;
}

.reasoning-stream-caret {
  position: absolute;
  right: 14px;
  bottom: 13px;
  width: 6px;
  height: 14px;
  border-radius: 2px;
  background: var(--jade);
  box-shadow: 0 0 10px color-mix(in srgb, var(--jade) 50%, transparent);
  animation: reasoning-caret 0.9s steps(1, end) infinite;
}

.reasoning-plain-copy {
  color: var(--text-primary);
  line-height: 1.85;
}

.reasoning-plain-copy :deep(p:first-child) {
  margin-top: 0;
}

.reasoning-plain-copy :deep(p:last-child) {
  margin-bottom: 0;
}

@keyframes reasoning-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes reasoning-caret {
  50% {
    opacity: 0.18;
  }
}

@media screen and (max-width: 760px) {
  .reasoning-theme-card {
    border-radius: 6px;
  }

  .reasoning-theme-heading {
    min-height: 46px;
    padding: 8px 46px 8px 10px;
  }

  .reasoning-theme-glyph {
    width: 28px;
    height: 28px;
  }

  .reasoning-theme-copy {
    padding: 13px 14px 15px;
    font-size: 12px;
    line-height: 1.78;
  }

  .reasoning-theme-edit span,
  .reasoning-floating-edit span {
    display: none;
  }

  .reasoning-floating-edit {
    width: 27px;
    padding: 3px;
    justify-content: center;
  }

  .reasoning-theme-edit {
    width: 30px;
    min-height: 30px;
    margin-right: 3px;
    padding: 0;
  }

  .reasoning-theme-edit::before {
    left: 8px;
    width: 13px;
    height: 13px;
  }

  .reasoning-theme-edit::after {
    display: none;
  }

  .reasoning-theme-edit > i {
    left: 11px;
  }
}
</style>
