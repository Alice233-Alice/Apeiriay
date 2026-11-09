<template>
  <div class="variable-diagnostics" :class="{ dense }">
    <section v-if="analysisSegments.length" class="variable-analysis">
      <h3>推演摘要</h3>
      <div class="analysis-segments">
        <span v-for="(segment, index) in analysisSegments" :key="`${index}-${segment}`">
          {{ segment }}
        </span>
      </div>
    </section>

    <div class="variable-overview">
      <span>
        <i class="fa-solid fa-list-check"></i>
        变量更新清单
      </span>
      <strong>{{ diagnostics.operations.length }} 项</strong>
      <span v-if="!diagnostics.isComplete" class="diagnostic-state receiving">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        接收中
      </span>
      <span v-else-if="diagnostics.parseError" class="diagnostic-state invalid">
        <i class="fa-solid fa-triangle-exclamation"></i>
        结构异常
      </span>
      <span v-else class="diagnostic-state valid">
        <i class="fa-solid fa-circle-check"></i>
        结构正常
      </span>
    </div>

    <ol v-if="diagnostics.operations.length" class="variable-operation-list">
      <li
        v-for="(operation, index) in diagnostics.operations"
        :key="`${index}-${operation.op}-${operation.path}`"
        class="variable-operation"
      >
        <div class="operation-heading">
          <span class="operation-index">{{ index + 1 }}</span>
          <span class="operation-kind" :class="`op-${normalizeOperation(operation.op)}`">
            {{ operationLabel(operation.op) }}
          </span>
          <code>{{ formatPatchPath(operation.path) }}</code>
        </div>
        <pre v-if="hasOperationValue(operation)">{{ formatPatchValue(operation.value) }}</pre>
        <p v-else-if="operation.from" class="operation-from">来源：{{ formatPatchPath(operation.from) }}</p>
        <p v-else class="operation-empty">该路径不携带新值</p>
      </li>
    </ol>

    <div v-else-if="diagnostics.isComplete && !diagnostics.parseError" class="variable-empty">
      本回未提交变量变更。
    </div>

    <div v-if="diagnostics.parseError" class="diagnostic-error" role="alert">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>{{ diagnostics.parseError }}</span>
    </div>

    <details v-if="diagnostics.rawPatch" class="raw-patch">
      <summary>原始 JSONPatch</summary>
      <pre>{{ diagnostics.rawPatch }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { VariablePatchOperation, VariableUpdateDiagnostics } from '../message-content';

const props = withDefaults(
  defineProps<{
    diagnostics: VariableUpdateDiagnostics;
    dense?: boolean;
  }>(),
  { dense: false },
);

const analysisSegments = computed(() =>
  props.diagnostics.analysis
    .split(/\s*\|\s*/)
    .map(segment => segment.trim())
    .filter(Boolean),
);

const operationLabels: Record<string, string> = {
  add: '新增',
  insert: '新增',
  replace: '覆盖',
  delta: '增减',
  remove: '移除',
  move: '移动',
  copy: '复制',
  test: '校验',
};
const normalizeOperation = (operation: string) =>
  operation
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '') || 'unknown';
const operationLabel = (operation: string) =>
  operationLabels[normalizeOperation(operation)] ?? (operation.trim() || '未知');
const decodePointerSegment = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~');
const formatPatchPath = (path: string) => {
  const segments = String(path ?? '')
    .replaceAll('／', '/')
    .split('/')
    .filter(Boolean)
    .map(decodePointerSegment);
  return segments.length ? segments.join(' › ') : '根节点';
};
const hasOperationValue = (operation: VariablePatchOperation) =>
  Object.prototype.hasOwnProperty.call(operation, 'value');
const formatPatchValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  const serialized = JSON.stringify(value, null, 2);
  return serialized ?? String(value);
};
</script>

<style lang="scss" scoped>
.variable-diagnostics {
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.variable-analysis {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-subtle);
  border-left: 2px solid var(--gold);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
}

.variable-analysis h3 {
  margin: 0 0 9px;
  color: var(--gold-soft);
  font-size: 11px;
  font-weight: 600;
}

.analysis-segments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.analysis-segments span {
  padding: 4px 8px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
  font-size: 11px;
  line-height: 1.45;
}

.variable-overview {
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}

.variable-overview > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-accent);
}

.variable-overview > span:first-child i {
  color: var(--jade);
}

.variable-overview strong {
  color: var(--gold-soft);
  font-weight: 600;
}

.diagnostic-state {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.diagnostic-state.valid {
  color: var(--semantic-success);
}

.diagnostic-state.receiving {
  color: var(--jade);
}

.diagnostic-state.invalid {
  color: var(--semantic-danger);
}

.variable-operation-list {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
  list-style: none;
}

.variable-operation {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line-subtle);
  background: color-mix(in srgb, var(--surface-inset) 58%, transparent);
}

.operation-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.operation-index {
  width: 20px;
  height: 20px;
  flex: none;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 9px;
}

.operation-kind {
  min-width: 34px;
  flex: none;
  color: var(--gold-soft);
  font-size: 10px;
  text-align: center;
}

.operation-kind.op-delta {
  color: var(--jade);
}

.operation-kind.op-remove {
  color: var(--semantic-danger);
}

.operation-kind.op-insert,
.operation-kind.op-add {
  color: var(--semantic-success);
}

.operation-heading code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary);
  font-family: 'Microsoft YaHei UI', system-ui, sans-serif;
  font-size: 11px;
}

.variable-operation pre,
.raw-patch pre {
  margin: 8px 0 0 28px;
  padding: 8px 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-left: 1px solid var(--line-strong);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
  font:
    11px/1.6 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
}

.operation-from,
.operation-empty {
  margin: 7px 0 0 28px;
  color: var(--text-secondary);
  font-size: 10px;
}

.variable-empty {
  padding: 22px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 11px;
}

.diagnostic-error {
  margin-top: 10px;
  padding: 9px 11px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--semantic-danger) 55%, var(--line-subtle));
  color: var(--semantic-danger);
  background: color-mix(in srgb, var(--semantic-danger) 8%, transparent);
  font-size: 11px;
}

.raw-patch {
  margin-top: 10px;
  border-top: 1px solid var(--line-subtle);
}

.raw-patch summary {
  padding: 10px 2px 0;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
}

.raw-patch pre {
  margin-left: 0;
  max-height: 220px;
}

.variable-diagnostics.dense {
  padding: 12px;
}

@media (max-width: 640px) {
  .variable-diagnostics {
    padding: 11px;
  }

  .analysis-segments {
    display: grid;
  }

  .analysis-segments span {
    border-radius: 4px;
  }

  .operation-heading {
    flex-wrap: wrap;
  }

  .variable-operation pre,
  .operation-from,
  .operation-empty {
    margin-left: 0;
  }
}
</style>
