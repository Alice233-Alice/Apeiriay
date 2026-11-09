<template>
  <section class="inline-input-editor" :class="variant">
    <textarea
      ref="editorInput"
      v-model="draft"
      rows="3"
      aria-label="修改玩家输入"
      autocapitalize="off"
      autocomplete="off"
      spellcheck="false"
      @input="resizeEditor"
      @keydown.esc.stop.prevent="cancel"
      @keydown.ctrl.enter.prevent="save()"
      @keydown.meta.enter.prevent="save()"
      @keydown.ctrl.s.prevent="save()"
      @keydown.meta.s.prevent="save()"
    ></textarea>

    <p v-if="pseudo.editError" class="inline-edit-error" role="alert">
      <i class="fa-solid fa-circle-exclamation"></i>
      {{ pseudo.editError }}
    </p>

    <footer>
      <span :class="{ invalid: !draft.trim() }">
        {{ draft.trim() ? `${draft.length.toLocaleString()} 字符` : '输入不能为空' }}
      </span>
      <div>
        <button type="button" :disabled="saving" @click="cancel">取消</button>
        <button type="button" class="save-button" :disabled="!canSave" @click="save()">
          <i class="fa-solid" :class="saving ? 'fa-circle-notch fa-spin' : 'fa-check'"></i>
          {{ saving ? '保存中' : '保存' }}
        </button>
        <button v-if="canRerollAfterSave" type="button" class="save-button" :disabled="!canSave" @click="save(true)">
          <i class="fa-solid fa-rotate-right"></i> 保存并重答
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { usePseudoLayerStore } from '../store';

const props = withDefaults(
  defineProps<{
    content: string;
    userMessageId: number;
    assistantMessageId: number;
    variant?: 'story' | 'dialogue' | 'bar';
  }>(),
  { variant: 'story' },
);
const emit = defineEmits<{
  (event: 'cancel'): void;
  (event: 'saved'): void;
}>();
const pseudo = usePseudoLayerStore();
const editorInput = ref<HTMLTextAreaElement>();
const draft = ref(props.content);
const original = ref(props.content);
const saving = ref(false);
const rerollAfterSave = ref(false);
const canRerollAfterSave = computed(() => props.assistantMessageId === pseudo.latestStoryMessageId);

const canSave = computed(
  () => draft.value !== original.value && draft.value.trim().length > 0 && pseudo.canEditUserMessage && !saving.value,
);

const resizeEditor = () => {
  const element = editorInput.value;
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${Math.min(Math.max(element.scrollHeight, 86), 240)}px`;
};

const cancel = () => {
  if (saving.value) return;
  pseudo.clearEditError();
  emit('cancel');
};

const save = (reroll = false) => {
  if (!canSave.value) return;
  saving.value = true;
  rerollAfterSave.value = reroll;
  pseudo.updateUserMessage(draft.value, props.userMessageId, props.assistantMessageId);
};

watch(
  () => pseudo.editSavedNonce,
  () => {
    if (!saving.value) return;
    saving.value = false;
    emit('saved');
    if (rerollAfterSave.value) pseudo.reroll(props.assistantMessageId);
  },
);

watch(
  () => pseudo.editError,
  error => {
    if (saving.value && error) saving.value = false;
  },
);

onMounted(() => {
  pseudo.clearEditError();
  nextTick(() => {
    resizeEditor();
    const element = editorInput.value;
    element?.focus();
    element?.setSelectionRange(element.value.length, element.value.length);
  });
});
</script>

<style lang="scss" scoped>
.inline-input-editor {
  width: 100%;
  min-width: 0;
  padding: 7px;
  display: grid;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--gold) 42%, var(--line-strong));
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-inset) 92%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 6%, transparent),
    0 0 18px color-mix(in srgb, var(--accent-glow) 12%, transparent);
}

textarea {
  width: 100%;
  min-height: 86px;
  max-height: 240px;
  padding: 10px 11px;
  resize: vertical;
  overflow-y: auto;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  color: var(--text-primary);
  caret-color: var(--gold);
  background: color-mix(in srgb, var(--reading-surface) 86%, var(--surface-inset));
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: max(12px, calc(var(--reading-font-size) * 0.82));
  line-height: 1.7;
  overflow-wrap: anywhere;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

textarea:focus {
  border-color: color-mix(in srgb, var(--gold) 62%, var(--line-strong));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--gold) 15%, transparent);
}

.inline-edit-error {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--semantic-danger);
  font-size: 10px;
}

footer {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

footer > span {
  color: var(--text-secondary);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

footer > span.invalid {
  color: var(--semantic-danger);
}

footer > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

button {
  min-height: 29px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  color: var(--text-secondary);
  background: var(--button-bg);
  font-size: 10px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--text-primary);
  background: var(--button-hover);
}

button.save-button {
  border-color: color-mix(in srgb, var(--gold) 38%, var(--line-subtle));
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 9%, var(--button-active));
}

button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.inline-input-editor.dialogue textarea {
  font-size: var(--reading-font-size);
}

.inline-input-editor.bar {
  margin: 10px 14px 0;
  width: calc(100% - 28px);
}

@media screen and (max-width: 760px) {
  .inline-input-editor {
    padding: 6px;
  }

  .inline-input-editor.bar {
    margin: 8px 9px 0;
    width: calc(100% - 18px);
  }

  textarea {
    min-height: 96px;
    padding: 9px;
    font-size: max(13px, calc(var(--reading-font-size) * 0.82));
  }
}
</style>
