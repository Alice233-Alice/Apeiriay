<template>
  <div class="action-menu-panel">
    <section v-if="store.当前处境" class="situation-section">
      <div class="section-title">
        <div class="title-left">
          <i class="fa-solid fa-compass"></i>
          <span>当前处境</span>
        </div>
        <span v-if="situationBadgeText" class="section-badge" :class="`mode-${situationRefreshState}`">
          {{ situationBadgeText }}
        </span>
      </div>
      <p class="situation-content">{{ store.当前处境 }}</p>
    </section>

    <section class="actions-section">
      <div class="section-title action-heading">
        <div class="title-left">
          <i class="fa-solid fa-list-check"></i>
          <span>可选行动</span>
        </div>

        <div class="title-right">
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: store.启用行动提示 }"
            :title="store.启用行动提示 ? '关闭动态行动生成' : '开启动态行动生成'"
            @click="store.toggleActionPrompt"
          >
            <i class="fa-solid" :class="store.启用行动提示 ? 'fa-toggle-on' : 'fa-toggle-off'"></i>
            <span>{{ store.启用行动提示 ? '已开启' : '已关闭' }}</span>
          </button>

          <button
            v-if="store.启用行动提示"
            type="button"
            class="refresh-btn"
            title="重新解析本轮行动"
            :disabled="isRefreshing"
            @click="refreshActions"
          >
            <i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': isRefreshing }"></i>
          </button>
        </div>
      </div>

      <div class="action-toolbar">
        <span v-if="store.启用行动提示" class="action-count">{{ actionSummaryLabel }}</span>
        <span v-else class="action-count muted">动态选项已停用，快捷行动仍可使用</span>

        <div class="submit-mode" role="group" aria-label="行动提交模式">
          <button
            type="button"
            :class="{ active: submitMode === 'confirm' }"
            :disabled="isSubmitting"
            title="先填入酒馆输入框，确认后再发送"
            @click="setSubmitMode('confirm')"
          >
            <i class="fa-solid fa-pen-to-square"></i>
            确认
          </button>
          <button
            type="button"
            :class="{ active: submitMode === 'direct' }"
            :disabled="isSubmitting"
            title="点击行动后立即作为玩家输入发送"
            @click="setSubmitMode('direct')"
          >
            <i class="fa-solid fa-paper-plane"></i>
            直发
          </button>
        </div>
      </div>

      <div v-if="!isSourceLatest" class="status-banner info">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <div>
          <strong>正在查看旧楼层行动</strong>
          <span>请回到最新消息再选择，避免把旧选项误作本轮输入。</span>
        </div>
      </div>

      <template v-if="store.启用行动提示">
        <div v-if="actionFeedMode === 'partial'" class="status-banner warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>本轮只刷新了部分选项</strong>
            <span>已隐藏 {{ hiddenInheritedActionCount }} 项上一轮残留内容。</span>
          </div>
        </div>

        <div v-else-if="actionFeedMode === 'fallback'" class="status-banner warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>本轮行动更新异常</strong>
            <span>已依据当前任务与处境提供临时行动。</span>
          </div>
        </div>

        <div v-else-if="actionFeedMode === 'none'" class="status-banner info">
          <i class="fa-solid fa-sparkles"></i>
          <div>
            <strong>本轮没有新的行动更新</strong>
            <span>旧选项不会沿用，可使用下方快捷行动继续。</span>
          </div>
        </div>

        <div v-else-if="actionFeedMode === 'cleared'" class="status-banner info">
          <i class="fa-solid fa-broom"></i>
          <div>
            <strong>本轮行动已清空</strong>
            <span>当前没有可信的新方向，可继续、随机或自行输入。</span>
          </div>
        </div>

        <div v-if="freshActions.length > 0" class="action-list">
          <button
            v-for="(action, index) in freshActions"
            :key="getActionKey(action, index)"
            type="button"
            class="action-row"
            :class="`type-${action.类型}`"
            :disabled="!canChooseAction"
            @click="selectAction(action)"
          >
            <span class="action-icon" aria-hidden="true">
              <i :class="getActionIcon(action.类型)"></i>
            </span>
            <span class="action-copy">
              <span class="action-text">{{ action.行动 }}</span>
              <span v-if="action.提示" class="action-hint">
                <i class="fa-solid fa-circle-info"></i>
                {{ action.提示 }}
              </span>
            </span>
            <span class="action-type">{{ action.类型 }}</span>
            <i
              class="action-affordance fa-solid"
              :class="submitMode === 'direct' ? 'fa-paper-plane' : 'fa-chevron-right'"
            ></i>
          </button>
        </div>

        <div v-else class="no-actions">
          <i class="fa-solid fa-hourglass-half"></i>
          <p>这一轮暂无可信的新行动</p>
        </div>
      </template>

      <div class="quick-actions">
        <span class="quick-label">快捷行动</span>
        <div class="quick-list">
          <button
            v-for="action in quickActions"
            :key="action.id"
            type="button"
            class="quick-action"
            :disabled="!canChooseAction"
            @click="selectQuickAction(action)"
          >
            <i :class="action.icon"></i>
            <span>{{ action.label }}</span>
          </button>
          <button type="button" class="quick-action custom" :disabled="!canChooseAction" @click="selectCustomAction">
            <i class="fa-solid fa-pen-nib"></i>
            <span>自定</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { OpportunitySchema, unwrapOpportunityPatchPayload } from '../schema';
import { useDataStore } from '../store';

type OpportunityType = '探索' | '交涉' | '战斗' | '修炼' | '整备' | '亲密';

type OpportunityAction = {
  行动: string;
  类型: OpportunityType;
  提示?: string;
};

type JsonPatchOperation = {
  op?: string;
  path?: string;
  value?: unknown;
};

type ActionFeedMode = 'full' | 'partial' | 'fallback' | 'none' | 'cleared';
type SituationRefreshState = 'fresh' | 'stale';
type SubmitMode = 'confirm' | 'direct';

type QuickAction = {
  id: 'continue' | 'random';
  label: string;
  prompt: string;
  icon: string;
};

const SUBMIT_MODE_STORAGE_KEY = 'dhl-action-submit-mode-v1';

const store = useDataStore();
const isRefreshing = ref(false);
const isSubmitting = ref(false);
const sourceMessageId = Number(getCurrentMessageId());
const latestMessageId = ref(getLastMessageId());
const currentMessageContent = ref('');
const currentMessagePatch = ref<JsonPatchOperation[]>([]);
const patchListeners: Array<(() => void) | undefined> = [];
let patchPollTimer: number | null = null;

const readSubmitMode = (): SubmitMode => {
  try {
    return localStorage.getItem(SUBMIT_MODE_STORAGE_KEY) === 'direct' ? 'direct' : 'confirm';
  } catch {
    return 'confirm';
  }
};

const submitMode = ref<SubmitMode>(readSubmitMode());

const setSubmitMode = (mode: SubmitMode) => {
  submitMode.value = mode;
  try {
    localStorage.setItem(SUBMIT_MODE_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('[行动提示] 无法保存行动提交模式', error);
  }
};

const quickActions: QuickAction[] = [
  {
    id: 'continue',
    label: '继续',
    prompt: '继续当前剧情。',
    icon: 'fa-solid fa-forward-step',
  },
  {
    id: 'random',
    label: '随机',
    prompt: '根据当前处境随机采取一个合理行动。',
    icon: 'fa-solid fa-dice',
  },
];

const isSourceLatest = computed(() => Number.isFinite(sourceMessageId) && sourceMessageId === latestMessageId.value);
const canChooseAction = computed(() => isSourceLatest.value && !isSubmitting.value);

const normalizeAction = (value: unknown): OpportunityAction | null => {
  const result = OpportunitySchema.safeParse(value);
  if (!result.success || !result.data.行动) return null;
  return result.data;
};

const normalizeActionPayload = (value: unknown): OpportunityAction[] | null => {
  const payload = unwrapOpportunityPatchPayload(value);
  if (!Array.isArray(payload)) return null;
  return payload.map(normalizeAction).filter((action): action is OpportunityAction => action !== null);
};

const buildFallbackActions = (): OpportunityAction[] => {
  type TaskSnapshot = { 名称?: unknown; 类型?: unknown; 目标?: unknown };
  const taskActions = Object.values(store.任务列表 as Record<string, TaskSnapshot>)
    .slice(0, 2)
    .flatMap(task => {
      const name = String(task.名称 ?? '').trim();
      const target = String(task.目标 ?? '').trim();
      if (!name || !target) return [];

      const typeByTask: Record<string, OpportunityType> = {
        每日: '修炼',
        临危受命: '战斗',
        秘境探索: '探索',
      };
      return [
        {
          行动: `继续推进「${name}」：${target}`,
          类型: typeByTask[String(task.类型 ?? '')] ?? '探索',
          提示: '依据进行中任务生成的临时行动',
        },
      ];
    });

  if (taskActions.length > 0) return taskActions;
  if (!store.当前处境) return [];

  return [
    {
      行动: '继续观察当前局势，并根据眼前变化决定下一步。',
      类型: '探索',
      提示: '本轮行动更新异常时的临时选项',
    },
  ];
};

const extractJsonPatch = (content: string): JsonPatchOperation[] => {
  const match = content.match(/<JSONPatch>\s*([\s\S]*?)\s*<\/JSONPatch>/i);
  if (!match) return [];

  const payload = match[1]
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[行动提示] 当前楼层 JSONPatch 解析失败', error);
    return [];
  }
};

const syncCurrentMessagePatch = () => {
  latestMessageId.value = getLastMessageId();
  if (!Number.isFinite(sourceMessageId) || sourceMessageId < 0) {
    currentMessageContent.value = '';
    currentMessagePatch.value = [];
    return;
  }

  try {
    const messages = getChatMessages(sourceMessageId);
    const content = String(messages?.[0]?.message ?? '');
    if (content === currentMessageContent.value) return;
    currentMessageContent.value = content;
    currentMessagePatch.value = extractJsonPatch(content);
  } catch (error) {
    console.warn('[行动提示] 读取当前楼层消息失败', error);
  }
};

const refreshActions = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;

  try {
    if (store.forceRefresh) {
      await store.forceRefresh();
    } else {
      store.refresh();
    }
  } catch (error) {
    console.error('[行动提示] 刷新行动列表失败', error);
    toastr.error('刷新失败', '行动提示');
  } finally {
    window.setTimeout(syncCurrentMessagePatch, 240);
    window.setTimeout(() => {
      isRefreshing.value = false;
    }, 500);
  }
};

onMounted(() => {
  syncCurrentMessagePatch();

  patchListeners.push(
    eventOn(tavern_events.MESSAGE_UPDATED, id => {
      if (Number(id) === sourceMessageId) syncCurrentMessagePatch();
    }).stop,
  );
  patchListeners.push(
    eventOn(tavern_events.MESSAGE_RECEIVED, () => {
      syncCurrentMessagePatch();
    }).stop,
  );
  patchListeners.push(
    eventOn(tavern_events.MESSAGE_DELETED, id => {
      if (Number(id) === sourceMessageId) {
        currentMessageContent.value = '';
        currentMessagePatch.value = [];
      }
      window.setTimeout(syncCurrentMessagePatch, 160);
    }).stop,
  );

  patchPollTimer = window.setInterval(syncCurrentMessagePatch, 1500);
  window.setTimeout(refreshActions, 500);
});

onBeforeUnmount(() => {
  patchListeners.forEach(dispose => {
    try {
      dispose?.();
    } catch {
      // ignore cleanup errors
    }
  });

  if (patchPollTimer !== null) window.clearInterval(patchPollTimer);
});

const hasSituationRefresh = computed(() =>
  currentMessagePatch.value.some(operation => operation.op === 'replace' && operation.path === '/当前处境'),
);

const situationRefreshState = computed<SituationRefreshState>(() => (hasSituationRefresh.value ? 'fresh' : 'stale'));
const situationBadgeText = computed(() => {
  if (!store.当前处境) return '';
  return hasSituationRefresh.value ? '本轮更新' : '沿用参考';
});

const freshActionState = computed<{ mode: ActionFeedMode; actions: OpportunityAction[] }>(() => {
  const operations = currentMessagePatch.value.filter(operation => typeof operation.path === 'string');
  const replaceAll = operations.find(
    operation => operation.op === 'replace' && (operation.path === '/$可参与机遇' || operation.path === '/可参与机遇'),
  );

  if (replaceAll) {
    const actions =
      normalizeActionPayload(replaceAll.value) ??
      (store.可参与机遇 as unknown[])
        .map(normalizeAction)
        .filter((action): action is OpportunityAction => action !== null);
    if (actions.length > 0) return { mode: 'full', actions };

    const fallbackActions = buildFallbackActions();
    return fallbackActions.length > 0
      ? { mode: 'fallback', actions: fallbackActions }
      : { mode: 'cleared', actions: [] };
  }

  const clearActionList = operations.some(
    operation => (operation.path === '/$可参与机遇' || operation.path === '/可参与机遇') && operation.op === 'remove',
  );
  if (clearActionList) {
    const fallbackActions = buildFallbackActions();
    return fallbackActions.length > 0
      ? { mode: 'fallback', actions: fallbackActions }
      : { mode: 'cleared', actions: [] };
  }

  const touchedIndices = [
    ...new Set(
      operations
        .map(operation => /^\/\$?可参与机遇\/(\d+)$/u.exec(String(operation.path))?.[1])
        .filter((index): index is string => index !== undefined)
        .map(Number)
        .filter(Number.isInteger),
    ),
  ];

  if (touchedIndices.length > 0) {
    const actions = touchedIndices
      .map(index => normalizeAction((store.可参与机遇 as unknown[])[index]))
      .filter((action): action is OpportunityAction => action !== null);
    return { mode: actions.length > 0 ? 'partial' : 'none', actions };
  }

  const fallbackActions = buildFallbackActions();
  return fallbackActions.length > 0 ? { mode: 'fallback', actions: fallbackActions } : { mode: 'none', actions: [] };
});

const actionFeedMode = computed(() => freshActionState.value.mode);
const freshActions = computed(() => freshActionState.value.actions);
const hiddenInheritedActionCount = computed(() => {
  if (actionFeedMode.value !== 'partial') return 0;
  return Math.max(store.可参与机遇.length - freshActions.value.length, 0);
});
const actionSummaryLabel = computed(() => {
  switch (actionFeedMode.value) {
    case 'full':
      return `${freshActions.value.length} 项本轮行动`;
    case 'partial':
      return `${freshActions.value.length} 项已刷新`;
    case 'cleared':
      return '本轮行动已清空';
    case 'fallback':
      return `${freshActions.value.length} 项临时行动`;
    default:
      return '等待本轮行动';
  }
});

const actionIconMap: Record<OpportunityType, string> = {
  探索: 'fa-solid fa-mountain-sun',
  交涉: 'fa-solid fa-comments',
  战斗: 'fa-solid fa-swords',
  修炼: 'fa-solid fa-yin-yang',
  整备: 'fa-solid fa-toolbox',
  亲密: 'fa-solid fa-heart',
};

const getActionIcon = (type: OpportunityType) => actionIconMap[type];
const getActionKey = (action: OpportunityAction, index: number) =>
  `${action.类型}|${action.行动}|${action.提示 ?? ''}|${index}`;

const getParentTextarea = (): HTMLTextAreaElement | null => {
  try {
    return window.parent.document.querySelector<HTMLTextAreaElement>('#send_textarea');
  } catch {
    return null;
  }
};

const writeReplyDraft = (text: string): boolean => {
  const textarea = getParentTextarea();
  if (!textarea) {
    toastr.warning('未找到酒馆输入框', '行动提示');
    return false;
  }

  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
  textarea.focus();
  return true;
};

const sendReplyDraft = (text: string) => {
  if (!writeReplyDraft(text)) return;

  let sendButton: HTMLButtonElement | null = null;
  try {
    sendButton = window.parent.document.querySelector<HTMLButtonElement>('#send_but');
  } catch {
    // handled below
  }

  if (!sendButton || sendButton.disabled) {
    toastr.warning('当前无法直发，行动已保留在酒馆输入框中', '行动提示');
    return;
  }

  isSubmitting.value = true;
  window.setTimeout(() => {
    sendButton?.click();
    window.setTimeout(() => {
      latestMessageId.value = getLastMessageId();
      isSubmitting.value = false;
    }, 1200);
  }, 0);
};

const ensureLatestMessage = (): boolean => {
  latestMessageId.value = getLastMessageId();
  if (isSourceLatest.value) return true;
  toastr.warning('请先回到最新消息再选择行动', '行动提示');
  return false;
};

const prepareAction = (prompt: string, allowDirect = true) => {
  if (isSubmitting.value || !ensureLatestMessage()) return;
  if (!allowDirect || submitMode.value !== 'direct') {
    if (writeReplyDraft(prompt)) toastr.info('行动已填入酒馆输入框，可继续修改后发送', '行动提示');
    return;
  }
  sendReplyDraft(prompt);
};

const selectAction = (action: OpportunityAction) => {
  prepareAction(action.行动);
  console.info('[行动提示] 选择行动:', action.行动, '提交模式:', submitMode.value);
};

const selectQuickAction = (action: QuickAction) => {
  prepareAction(action.prompt);
};

const selectCustomAction = () => {
  if (isSubmitting.value || !ensureLatestMessage()) return;
  const textarea = getParentTextarea();
  if (!textarea) {
    toastr.warning('未找到酒馆输入框', '行动提示');
    return;
  }
  textarea.focus();
  textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
</script>

<style lang="scss" scoped>
.action-menu-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px;
  color: var(--text-primary);
}

.situation-section,
.actions-section {
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.section-title,
.title-left,
.title-right,
.action-toolbar,
.toggle-btn,
.submit-mode,
.quick-list {
  display: flex;
  align-items: center;
}

.section-title {
  justify-content: space-between;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 650;
}

.title-left {
  gap: 8px;
  color: var(--text-accent);

  i {
    color: var(--accent-color);
  }
}

.title-right {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.section-badge,
.action-count {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.section-badge {
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;

  &.mode-fresh {
    color: var(--text-accent);
    border-color: color-mix(in srgb, var(--accent-color) 42%, var(--border-color));
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  }
}

.situation-content {
  margin: 11px 0 0;
  padding: 10px 12px;
  border-left: 2px solid var(--accent-color);
  border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.65;
}

button {
  font: inherit;
}

.toggle-btn,
.refresh-btn,
.submit-mode button,
.quick-action {
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--button-bg) 78%, transparent);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;

  &:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--border-active);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }
}

.toggle-btn {
  gap: 5px;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;

  &.active {
    color: var(--text-accent);
    border-color: var(--border-active);
    background: var(--button-active);
  }
}

.refresh-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 7px;
}

.action-toolbar {
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.action-count.muted {
  color: color-mix(in srgb, var(--text-secondary) 72%, transparent);
}

.submit-mode {
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);

  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font-size: 11px;

    &.active {
      color: var(--text-accent);
      background: var(--button-active);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 35%, transparent);
    }
  }
}

.status-banner {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 12px;
  padding: 9px 11px;
  border: 1px solid var(--border-color);
  border-radius: 9px;
  font-size: 11px;

  > i {
    margin-top: 2px;
  }

  div {
    display: grid;
    gap: 2px;
  }

  strong {
    color: var(--text-primary);
  }

  span {
    color: var(--text-secondary);
  }

  &.warn {
    border-color: color-mix(in srgb, #d6a44d 45%, var(--border-color));
    background: color-mix(in srgb, #d6a44d 9%, transparent);

    > i {
      color: #d6a44d;
    }
  }

  &.info {
    border-color: color-mix(in srgb, #69a9d6 38%, var(--border-color));
    background: color-mix(in srgb, #69a9d6 8%, transparent);

    > i {
      color: #69a9d6;
    }
  }
}

.action-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.action-row {
  --action-color: var(--accent-color);

  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto 14px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--action-color) 30%, var(--border-color));
  border-radius: 10px;
  color: var(--text-primary);
  text-align: left;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--action-color) 10%, transparent), transparent 36%),
    color-mix(in srgb, var(--bg-primary) 82%, transparent);
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--action-color) 58%, var(--border-color));
  }

  &:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--action-color) 60%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  &.type-探索 {
    --action-color: #62c6a7;
  }

  &.type-交涉 {
    --action-color: #74aee8;
  }

  &.type-战斗 {
    --action-color: #db786e;
  }

  &.type-修炼 {
    --action-color: #8dcfd1;
  }

  &.type-整备 {
    --action-color: #d8a85b;
  }

  &.type-亲密 {
    --action-color: #d782a6;
  }
}

.action-icon {
  display: grid;
  width: 34px;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 9px;
  color: color-mix(in srgb, var(--action-color) 92%, white);
  background: color-mix(in srgb, var(--action-color) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--action-color) 26%, transparent);
}

.action-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.action-text {
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 620;
  line-height: 1.45;
}

.action-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;

  i {
    color: var(--action-color);
    font-size: 9px;
  }
}

.action-type {
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--action-color);
  background: color-mix(in srgb, var(--action-color) 12%, transparent);
  font-size: 10px;
  white-space: nowrap;
}

.action-affordance {
  color: color-mix(in srgb, var(--action-color) 72%, var(--text-secondary));
  font-size: 10px;
}

.no-actions {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 18px 12px;
  border: 1px dashed var(--border-color);
  border-radius: 10px;
  color: var(--text-secondary);

  i {
    color: var(--accent-color);
  }

  p {
    margin: 0;
    font-size: 12px;
  }
}

.quick-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.quick-label {
  color: var(--text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.quick-list {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.quick-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;

  i {
    color: var(--accent-color);
  }
}

@media (max-width: 520px) {
  .action-menu-panel {
    gap: 10px;
    padding: 0;
  }

  .situation-section,
  .actions-section {
    padding: 10px;
    border-radius: 8px;
  }

  .action-heading,
  .action-toolbar,
  .quick-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .title-right,
  .quick-list {
    width: 100%;
    justify-content: flex-start;
  }

  .action-toolbar {
    gap: 8px;
  }

  .action-row {
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 7px;
    padding: 8px;
  }

  .action-icon {
    width: 30px;
  }

  .action-type {
    grid-column: 2;
    justify-self: start;
  }

  .action-affordance {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .quick-action {
    flex: 1 1 58px;
  }
}
</style>
