<template>
  <section class="generation-recovery" role="status">
    <p>
      <i class="fa-solid fa-triangle-exclamation"></i>
      {{ notice || '本回未形成可显示的正文，输入与回复原文仍保留在此。' }}
    </p>
    <div v-if="isLatest" class="recovery-actions">
      <button type="button" :disabled="!pseudo.canRerollLatest" @click="pseudo.reroll(messageId)">
        <i class="fa-solid fa-rotate-right"></i> 重新生成
      </button>
      <button type="button" :disabled="!pseudo.canDeleteLatest" @click="deleteTurn">
        <i class="fa-solid fa-trash-can"></i> 删除本回
      </button>
    </div>
    <details v-if="rawMessage.trim()">
      <summary>查看收到的原文</summary>
      <pre>{{ rawMessage }}</pre>
    </details>
  </section>
</template>

<script setup lang="ts">
import { usePseudoLayerStore } from '../store';

const props = defineProps<{ messageId: number; rawMessage: string; notice?: string }>();
const pseudo = usePseudoLayerStore();
const isLatest = computed(() => props.messageId === pseudo.latestStoryMessageId);
const deleteTurn = () => {
  if (!pseudo.canDeleteLatest) return;
  if (window.confirm('删除本回回复及对应的输入？此操作无法撤销。')) pseudo.deleteCurrent(props.messageId);
};
</script>

<style scoped lang="scss">
.generation-recovery {
  margin: 14px 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--semantic-warning) 40%, var(--line-subtle));
  border-radius: 6px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--semantic-warning) 6%, var(--surface-inset));
  font-size: 13px;
  line-height: 1.7;
}
p {
  margin: 0;
}
p > i {
  color: var(--semantic-warning);
}
.recovery-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
button {
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  background: var(--surface-inset);
  color: var(--gold);
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
details {
  margin-top: 8px;
}
summary {
  cursor: pointer;
}
pre {
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
}
</style>
