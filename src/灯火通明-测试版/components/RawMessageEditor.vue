<template>
  <Transition name="editor-fade">
    <div v-if="visible" class="editor-scrim" @click.self="requestClose">
      <section
        class="raw-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="raw-editor-title"
        aria-describedby="raw-editor-note"
        @keydown.esc.stop.prevent="requestClose"
      >
        <header class="editor-header">
          <div class="editor-heading">
            <span class="editor-mark"><i class="fa-solid fa-pen"></i></span>
            <span>
              <strong id="raw-editor-title">楼层原文</strong>
              <small>{{ floorLabel }} · 消息 #{{ editingMessageId }}</small>
            </span>
          </div>
          <button type="button" title="关闭原文编辑器" :disabled="pseudo.isUpdatingMessage" @click="requestClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <div id="raw-editor-note" class="editor-note">
          <i class="fa-solid fa-code"></i>
          <span
            >这里是未经折叠的完整回复，包含正文、变量指令与立绘数据；若两种渲染标记都被删掉，保存时会补上伪同层标记。</span
          >
        </div>

        <div class="editor-body">
          <textarea
            ref="editorInput"
            v-model="draft"
            aria-label="当前楼层完整原文"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            wrap="soft"
            @keydown.ctrl.s.prevent="save"
            @keydown.meta.s.prevent="save"
          ></textarea>
        </div>

        <p v-if="pseudo.editError" class="editor-error" role="alert">
          <i class="fa-solid fa-circle-exclamation"></i>
          {{ pseudo.editError }}
        </p>

        <footer class="editor-footer">
          <span class="editor-count">{{ draft.length.toLocaleString() }} 字符</span>
          <div class="editor-actions">
            <button type="button" class="secondary-action" :disabled="pseudo.isUpdatingMessage" @click="copyRaw">
              <i class="fa-solid" :class="copied ? 'fa-check' : 'fa-copy'"></i>
              {{ copied ? '已复制' : '复制原文' }}
            </button>
            <button type="button" class="secondary-action" :disabled="pseudo.isUpdatingMessage" @click="requestClose">
              取消
            </button>
            <button
              type="button"
              class="save-action"
              :disabled="!isDirty || !pseudo.canEditMessage || pseudo.isUpdatingMessage"
              @click="save"
            >
              <i class="fa-solid" :class="pseudo.isUpdatingMessage ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'"></i>
              {{ pseudo.isUpdatingMessage ? '正在保存' : '保存修改' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { usePseudoLayerStore } from '../store';

const props = withDefaults(
  defineProps<{
    visible: boolean;
    targetMessageId?: number;
    targetLabel?: string;
  }>(),
  {
    targetMessageId: undefined,
    targetLabel: undefined,
  },
);
const emit = defineEmits<{ (event: 'close'): void }>();
const pseudo = usePseudoLayerStore();
const editorInput = ref<HTMLTextAreaElement>();
const draft = ref('');
const original = ref('');
const editingMessageId = ref(-1);
const copied = ref(false);
let copiedResetTimer: number | undefined;

const isDirty = computed(() => draft.value !== original.value);
const floorLabel = computed(() => {
  if (props.targetLabel) return props.targetLabel;
  const timelineEntry = pseudo.timelineEntries.find(entry => entry.messageIds.includes(editingMessageId.value));
  if (timelineEntry?.stage.kind === 'dialogue') {
    return `与${timelineEntry.stage.targetName}交谈`;
  }
  if (timelineEntry) return `第 ${timelineEntry.historyIndex} 回`;
  const stage = pseudo.view.stage;
  if (stage.kind === 'dialogue') {
    return `与${stage.targetName}交谈 · ${stage.turnCount}轮`;
  }
  return `第 ${pseudo.view.histories?.story.index || pseudo.view.index || 1} 回`;
});

const loadCurrentMessage = () => {
  const messageId =
    typeof props.targetMessageId === 'number' && Number.isFinite(props.targetMessageId)
      ? props.targetMessageId
      : pseudo.view.selectedMessageId;
  pseudo.clearEditError();
  editingMessageId.value = messageId;
  const content = pseudo.readMessageContent(messageId);
  draft.value = content;
  original.value = content;
  nextTick(() => {
    editorInput.value?.focus();
    editorInput.value?.setSelectionRange(0, 0);
  });
};

const requestClose = () => {
  if (pseudo.isUpdatingMessage) return;
  if (isDirty.value && !window.confirm('原文尚未保存，确定放弃这次修改吗？')) return;
  pseudo.clearEditError();
  emit('close');
};

const save = () => {
  if (!isDirty.value || !pseudo.canEditMessage || pseudo.isUpdatingMessage) return;
  pseudo.updateCurrentMessage(draft.value, editingMessageId.value);
};

const copyRaw = async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
  } catch {
    editorInput.value?.focus();
    editorInput.value?.select();
    document.execCommand('copy');
  }
  copied.value = true;
  if (copiedResetTimer !== undefined) window.clearTimeout(copiedResetTimer);
  copiedResetTimer = window.setTimeout(() => {
    copied.value = false;
  }, 1600);
};

watch([() => props.visible, () => props.targetMessageId], ([visible]) => {
  if (visible) loadCurrentMessage();
});

watch(
  () => pseudo.editSavedNonce,
  () => {
    if (!props.visible) return;
    original.value = draft.value;
    emit('close');
  },
);

onBeforeUnmount(() => {
  if (copiedResetTimer !== undefined) window.clearTimeout(copiedResetTimer);
});
</script>

<style lang="scss" scoped>
.editor-scrim {
  position: fixed;
  inset: 0;
  z-index: 9200;
  display: grid;
  place-items: center;
  padding: clamp(10px, 2.4vw, 28px);
  background: rgba(1, 6, 10, 0.82);
  backdrop-filter: blur(9px);
}

.raw-editor {
  width: min(1040px, 100%);
  height: min(88dvh, 880px);
  min-height: 420px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--surface-raised);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 8%, transparent),
    0 30px 80px var(--stage-shadow);
}

.editor-header {
  min-height: 60px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line-subtle);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 6%, transparent), transparent 44%), var(--header-bg);
}

.editor-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-heading > span:last-child {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.editor-heading strong {
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
}

.editor-heading small {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-mark {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 42%, var(--line-subtle));
  border-radius: 50%;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 9%, var(--surface-inset));
  box-shadow: 0 0 18px color-mix(in srgb, var(--jade) 9%, transparent);
}

.editor-header > button {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}

.editor-header > button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--gold);
}

.editor-header > button:disabled {
  opacity: 0.4;
  cursor: wait;
}

.editor-note {
  padding: 9px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--line-subtle);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 80%, transparent);
  font-size: 11px;
  line-height: 1.55;
}

.editor-note i {
  flex: 0 0 auto;
  color: var(--gold);
}

.editor-body {
  min-height: 0;
  padding: 12px 14px;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--jade) 3%, transparent),
      transparent 18% 82%,
      color-mix(in srgb, var(--gold) 3%, transparent)
    ),
    var(--surface);
}

.editor-body textarea {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 15px 17px;
  resize: none;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-primary);
  caret-color: var(--gold);
  background: color-mix(in srgb, var(--surface-inset) 88%, transparent);
  box-shadow: inset 0 6px 22px color-mix(in srgb, var(--stage-shadow) 38%, transparent);
  font-family: 'Cascadia Mono', 'Microsoft YaHei UI', monospace;
  font-size: 13px;
  line-height: 1.7;
  tab-size: 2;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.editor-body textarea:focus {
  border-color: color-mix(in srgb, var(--jade) 58%, var(--line-strong));
}

.editor-error {
  margin: 0;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-top: 1px solid color-mix(in srgb, var(--semantic-danger) 32%, transparent);
  color: var(--semantic-danger);
  background: color-mix(in srgb, var(--semantic-danger) 8%, var(--surface-inset));
  font-size: 11px;
}

.editor-footer {
  min-height: 60px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--line-subtle);
  background: var(--footer-bg);
}

.editor-count {
  color: var(--text-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.editor-actions button {
  min-height: 36px;
  padding: 0 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  cursor: pointer;
}

.editor-actions button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--text-primary);
  background: var(--button-hover);
}

.editor-actions .save-action {
  border-color: color-mix(in srgb, var(--gold) 38%, var(--line-subtle));
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 10%, var(--button-active));
}

.editor-actions button:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.editor-fade-enter-active,
.editor-fade-leave-active {
  transition: opacity 0.18s ease;
}

.editor-fade-enter-active .raw-editor,
.editor-fade-leave-active .raw-editor {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.editor-fade-enter-from,
.editor-fade-leave-to {
  opacity: 0;
}

.editor-fade-enter-from .raw-editor,
.editor-fade-leave-to .raw-editor {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
}

@media screen and (max-width: 760px) {
  .editor-scrim {
    padding: 0;
  }

  .raw-editor {
    width: 100%;
    height: 100dvh;
    min-height: 0;
    border-width: 0;
    border-radius: 0;
  }

  .editor-header {
    min-height: 54px;
    padding: 0 11px;
  }

  .editor-mark {
    width: 30px;
    height: 30px;
  }

  .editor-note {
    padding: 8px 12px;
    align-items: flex-start;
    font-size: 10px;
  }

  .editor-body {
    padding: 7px;
  }

  .editor-body textarea {
    padding: 12px;
    border-radius: 3px;
    font-size: 12px;
    line-height: 1.65;
  }

  .editor-footer {
    min-height: 58px;
    padding: 8px;
  }

  .editor-count {
    display: none;
  }

  .editor-actions {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto minmax(112px, 1fr);
  }

  .editor-actions button {
    min-width: 0;
    padding: 0 10px;
  }
}
</style>
