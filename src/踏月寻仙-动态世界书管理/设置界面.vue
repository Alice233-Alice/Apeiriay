<template>
  <div class="dynamic-worldbook-settings">
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>动态世界书管理 V2</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <div class="dw-grid">
          <section class="dw-card dw-hero">
            <div class="dw-card-title">当前状态</div>
            <div class="dw-status-row">
              <span class="dw-pill" :class="`is-${runtime.bootStatus}`">{{ bootStatusText }}</span>
              <span class="dw-pill" :class="runtime.processing ? 'is-busy' : 'is-idle'">{{
                runtime.processing ? '处理中' : '空闲'
              }}</span>
              <span class="dw-pill" :class="settings.enabled ? 'is-on' : 'is-off'">{{
                settings.enabled ? '已启用' : '已停用'
              }}</span>
              <span class="dw-pill" :class="settings.auto_apply ? 'is-on' : 'is-off'">{{
                settings.auto_apply ? '自动应用' : '手动模式'
              }}</span>
            </div>
            <div class="dw-meta-list">
              <div>策略：默认最优</div>
              <div>世界书：{{ runtime.worldbookName || '未绑定 / 未读取' }}</div>
              <div>最后原因：{{ runtime.lastReason || '暂无' }}</div>
              <div>最后时间：{{ lastUpdatedAtText }}</div>
              <div v-if="runtime.generationMessage">{{ runtime.generationMessage }}</div>
            </div>
            <div v-if="runtime.lastMessage" class="dw-tip">{{ runtime.lastMessage }}</div>
            <div v-if="runtime.lastError" class="dw-error">{{ runtime.lastError }}</div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">控制台</div>
            <label class="dw-toggle">
              <input v-model="settings.enabled" type="checkbox" />
              <span>启用动态世界书管理</span>
            </label>
            <label class="dw-toggle">
              <input v-model="settings.auto_apply" type="checkbox" />
              <span>监听事件后自动应用</span>
            </label>
            <label class="dw-toggle">
              <input v-model="settings.show_toasts" type="checkbox" />
              <span>显示通知弹窗</span>
            </label>
            <label class="dw-toggle">
              <input v-model="settings.debug" type="checkbox" />
              <span>调试日志</span>
            </label>

            <label class="dw-field">
              <span>上下文窗口</span>
              <input v-model.number="settings.context_window" class="text_pole" type="number" min="1" max="8" />
            </label>

            <label class="dw-field">
              <span>防抖毫秒</span>
              <input
                v-model.number="settings.debounce_delay"
                class="text_pole"
                type="number"
                min="100"
                max="5000"
                step="100"
              />
            </label>

            <label class="dw-field">
              <span>地图延续轮数</span>
              <input v-model.number="settings.map_sticky_cycles" class="text_pole" type="number" min="0" max="8" />
            </label>

            <label class="dw-field">
              <span>人物正文窗口（最近楼层）</span>
              <input
                v-model.number="settings.character_context_window"
                class="text_pole"
                type="number"
                min="1"
                max="8"
              />
            </label>

            <div class="dw-tip">
              人物仅按窗口内的正文与实际输入开灯；思考、变量、候选行动及“泠泠”等歧义昵称不单独触发。
              超出窗口即恢复绿灯，不因加入红颜表或曾经亮灯而常驻。手动覆盖仍优先。
            </div>

            <div class="dw-actions">
              <input
                class="menu_button"
                type="button"
                value="立即开灯刷新"
                :disabled="busy"
                @click="runEnableRefresh"
              />
              <input class="menu_button" type="button" value="执行收灯" :disabled="busy" @click="runDisableRefresh" />
              <input class="menu_button" type="button" value="同步上下文" :disabled="busy" @click="handleSyncRuntime" />
            </div>

            <div class="dw-actions">
              <input class="menu_button" type="button" value="重读设置" :disabled="busy" @click="reloadSettings" />
              <input class="menu_button" type="button" value="重置设置" :disabled="busy" @click="handleResetSettings" />
            </div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">上下文</div>
            <div class="dw-meta-list">
              <div>当前区域：{{ runtime.context?.currentRegion || '未知' }}</div>
              <div>所属层级：{{ runtime.context?.currentLayer || '未知' }}</div>
              <div>当前宗门域：{{ runtime.context?.domainName || '未推断' }}</div>
              <div>当前主势力：{{ runtime.context?.factionName || '未推断' }}</div>
            </div>
            <div v-if="runtime.context?.environmentDesc" class="dw-tip">{{ runtime.context.environmentDesc }}</div>
            <div class="dw-subtitle">最近消息</div>
            <div v-if="runtime.context?.recentMessages?.length" class="dw-list">
              <div
                v-for="(message, index) in runtime.context.recentMessages.slice(0, 4)"
                :key="`${index}-${message}`"
                class="dw-list-item"
              >
                {{ message }}
              </div>
            </div>
            <div v-else class="dw-empty">暂无可用消息上下文</div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">最近一次刷新</div>
            <div class="dw-metrics">
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.summary.enabledCount }}</div>
                <div class="dw-metric-label">开启</div>
              </div>
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.summary.disabledCount }}</div>
                <div class="dw-metric-label">关闭</div>
              </div>
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.summary.totalProcessed }}</div>
                <div class="dw-metric-label">处理条目</div>
              </div>
            </div>

            <div class="dw-subtitle">变更条目</div>
            <div v-if="runtime.summary.changedEntries.length" class="dw-list">
              <div
                v-for="item in runtime.summary.changedEntries.slice(0, 10)"
                :key="`${item.name}-${item.mode}-${item.to}`"
                class="dw-list-item"
              >
                <div class="dw-item-main">{{ item.name }}</div>
                <div class="dw-item-sub">{{ item.from }} → {{ item.to }} · {{ item.mode }}</div>
              </div>
            </div>
            <div v-else class="dw-empty">最近一次没有条目切换</div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">手动覆盖</div>
            <label class="dw-textarea">
              <span>强制开启条目</span>
              <textarea
                v-model="forcedEnableText"
                class="text_pole"
                rows="5"
                placeholder="[地图] 天渊&#10;[角色] 羽岚"
              ></textarea>
            </label>
            <label class="dw-textarea">
              <span>强制关闭条目</span>
              <textarea
                v-model="forcedDisableText"
                class="text_pole"
                rows="5"
                placeholder="[地图] 东苍&#10;[角色] 羽岚 - 陌生期"
              ></textarea>
            </label>
            <div class="dw-tip">每行一个完整条目名，保存后会立刻参与判定。强制覆盖优先级高于评分和布尔规则。</div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">地图判定</div>
            <div v-if="mapDecisionEntries.length" class="dw-list">
              <div
                v-for="item in mapDecisionEntries"
                :key="`map-score-${item.name}-${item.score}`"
                class="dw-list-item"
              >
                <div class="dw-item-head">
                  <div class="dw-item-main">{{ item.name }}</div>
                  <div class="dw-score-badge" :class="item.matched ? 'is-match' : 'is-wait'">
                    {{ item.score }} / {{ item.threshold }}
                  </div>
                </div>
                <div class="dw-item-sub">
                  {{ item.category }} ·
                  {{ item.source === 'override' ? '手动覆盖' : item.source === 'score' ? '评分决策' : '布尔规则' }}
                </div>
                <div class="dw-reasons">
                  <div v-for="reason in item.reasons" :key="`map-reason-${item.name}-${reason}`" class="dw-reason">
                    {{ reason }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="dw-empty">还没有收集到地图判定</div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">评分解释</div>
            <div v-if="runtime.summary.topScoredEntries.length" class="dw-list">
              <div
                v-for="item in runtime.summary.topScoredEntries.slice(0, 10)"
                :key="`${item.name}-${item.score}-${item.category}`"
                class="dw-list-item"
              >
                <div class="dw-item-head">
                  <div class="dw-item-main">{{ item.name }}</div>
                  <div class="dw-score-badge" :class="item.matched ? 'is-match' : 'is-wait'">
                    {{ item.score }} / {{ item.threshold }}
                  </div>
                </div>
                <div class="dw-item-sub">
                  {{ item.category }} ·
                  {{ item.source === 'override' ? '手动覆盖' : item.source === 'score' ? '评分决策' : '布尔规则' }}
                </div>
                <div class="dw-reasons">
                  <div v-for="reason in item.reasons" :key="`${item.name}-${reason}`" class="dw-reason">
                    {{ reason }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="dw-empty">还没有收集到评分解释</div>
          </section>

          <section class="dw-card">
            <div class="dw-card-title">规则体检</div>
            <div class="dw-actions">
              <input
                class="menu_button"
                type="button"
                value="运行体检"
                :disabled="busy"
                @click="handleRunDiagnostics"
              />
              <input
                class="menu_button"
                type="button"
                value="上下文填入沙盒"
                :disabled="busy"
                @click="hydrateSandboxFromRuntime"
              />
            </div>
            <div v-if="runtime.diagnostics" class="dw-metrics dw-metrics-dense">
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.diagnostics.totalEntries }}</div>
                <div class="dw-metric-label">启用条目</div>
              </div>
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.diagnostics.managedEntries }}</div>
                <div class="dw-metric-label">已纳管</div>
              </div>
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.diagnostics.unmanagedEntries }}</div>
                <div class="dw-metric-label">未纳管</div>
              </div>
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.diagnostics.unmappedMapEntries.length }}</div>
                <div class="dw-metric-label">未映射地图</div>
              </div>
              <div class="dw-metric">
                <div class="dw-metric-value">{{ runtime.diagnostics.orphanOverrideEntries.length }}</div>
                <div class="dw-metric-label">失效覆盖</div>
              </div>
            </div>
            <div v-if="runtime.diagnostics" class="dw-list">
              <div v-if="runtime.diagnostics.unmanagedSamples.length" class="dw-list-item">
                <div class="dw-item-main">未纳管条目样本</div>
                <div class="dw-reasons">
                  <div
                    v-for="entry in runtime.diagnostics.unmanagedSamples"
                    :key="`unmanaged-${entry}`"
                    class="dw-reason"
                  >
                    {{ entry }}
                  </div>
                </div>
              </div>
              <div v-if="runtime.diagnostics.unmappedMapEntries.length" class="dw-list-item">
                <div class="dw-item-main">未建立映射的地图条目</div>
                <div class="dw-reasons">
                  <div v-for="entry in runtime.diagnostics.unmappedMapEntries" :key="`map-${entry}`" class="dw-reason">
                    {{ entry }}
                  </div>
                </div>
              </div>
              <div v-if="runtime.diagnostics.unknownCharacterEntries.length" class="dw-list-item">
                <div class="dw-item-main">未在红颜或角色库中找到的角色条目</div>
                <div class="dw-reasons">
                  <div
                    v-for="entry in runtime.diagnostics.unknownCharacterEntries"
                    :key="`character-${entry}`"
                    class="dw-reason"
                  >
                    {{ entry }}
                  </div>
                </div>
              </div>
              <div
                v-if="runtime.diagnostics.overrideConflicts.length || runtime.diagnostics.orphanOverrideEntries.length"
                class="dw-list-item"
              >
                <div class="dw-item-main">手动覆盖异常</div>
                <div class="dw-reasons">
                  <div
                    v-for="entry in runtime.diagnostics.overrideConflicts"
                    :key="`conflict-${entry}`"
                    class="dw-reason"
                  >
                    开启/关闭同时写入：{{ entry }}
                  </div>
                  <div
                    v-for="entry in runtime.diagnostics.orphanOverrideEntries"
                    :key="`orphan-${entry}`"
                    class="dw-reason"
                  >
                    世界书中未找到：{{ entry }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="dw-empty">还没有执行规则体检</div>
          </section>

          <section class="dw-card dw-card-span">
            <div class="dw-card-title">测试沙盒</div>
            <div class="dw-tip">先把当前上下文填进沙盒，再改区域、层级或消息文本做预演，就能提前看到会开哪些条目。</div>

            <div class="dw-grid dw-inner-grid">
              <label class="dw-field">
                <span>测试区域</span>
                <input v-model="sandboxRegion" class="text_pole" type="text" placeholder="例如：神木枯冢" />
              </label>

              <label class="dw-field">
                <span>所属层级</span>
                <input v-model="sandboxLayer" class="text_pole" type="text" placeholder="例如：东苍" />
              </label>
            </div>

            <label class="dw-textarea">
              <span>环境描述</span>
              <textarea
                v-model="sandboxEnvironment"
                class="text_pole"
                rows="3"
                placeholder="例如：藤海深处，岁月灰烬飘散，木瘴弥漫。"
              ></textarea>
            </label>

            <label class="dw-textarea">
              <span>测试消息</span>
              <textarea
                v-model="sandboxMessages"
                class="text_pole"
                rows="6"
                placeholder="每行一条消息，例如：羽岚邀你前往渊缘察气接坠。"
              ></textarea>
            </label>

            <div class="dw-actions">
              <input
                class="menu_button"
                type="button"
                value="预演命中结果"
                :disabled="busy"
                @click="handleRunPreview"
              />
              <input
                class="menu_button"
                type="button"
                value="用当前上下文填充"
                :disabled="busy"
                @click="hydrateSandboxFromRuntime"
              />
            </div>

            <template v-if="runtime.preview">
              <div class="dw-subtitle">预演命中条目</div>
              <div v-if="runtime.preview.matchedEntries.length" class="dw-tag-list">
                <span v-for="entry in runtime.preview.matchedEntries" :key="`preview-${entry}`" class="dw-tag">{{
                  entry
                }}</span>
              </div>
              <div v-else class="dw-empty">这组上下文暂时没有命中可常亮条目</div>

              <div class="dw-subtitle">预演评分明细</div>
              <div v-if="runtime.preview.topScoredEntries.length" class="dw-list">
                <div
                  v-for="item in runtime.preview.topScoredEntries"
                  :key="`preview-score-${item.name}-${item.score}`"
                  class="dw-list-item"
                >
                  <div class="dw-item-head">
                    <div class="dw-item-main">{{ item.name }}</div>
                    <div class="dw-score-badge" :class="item.matched ? 'is-match' : 'is-wait'">
                      {{ item.score }} / {{ item.threshold }}
                    </div>
                  </div>
                  <div class="dw-item-sub">
                    {{ item.category }} ·
                    {{ item.source === 'override' ? '手动覆盖' : item.source === 'score' ? '评分决策' : '布尔规则' }}
                  </div>
                  <div class="dw-reasons">
                    <div
                      v-for="reason in item.reasons"
                      :key="`preview-reason-${item.name}-${reason}`"
                      class="dw-reason"
                    >
                      {{ reason }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="dw-empty">还没有预演评分数据</div>
            </template>
          </section>

          <section class="dw-card dw-card-span">
            <div class="dw-card-title">当前常亮条目</div>
            <div v-if="runtime.summary.activeEntries.length" class="dw-tag-list">
              <span v-for="entry in runtime.summary.activeEntries.slice(0, 24)" :key="entry" class="dw-tag">{{
                entry
              }}</span>
            </div>
            <div v-else class="dw-empty">暂无常亮条目快照</div>
          </section>
        </div>

        <hr class="sysHR" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import {
  getRuntimeSnapshot,
  onRuntimeSnapshotChange,
  refreshRuntimeSnapshot,
  runManualRefresh,
  runPreviewSimulation,
  runRuntimeDiagnostics,
  type DynamicWorldbookPreviewInput,
} from './runtime';
import { useSettingsStore } from './settings';

const settingsStore = useSettingsStore();
const { settings } = storeToRefs(settingsStore);

const runtime = ref(getRuntimeSnapshot());
const busy = ref(false);
const sandboxRegion = ref('');
const sandboxLayer = ref('');
const sandboxEnvironment = ref('');
const sandboxMessages = ref('');

const bootStatusText = computed(() => {
  const map = {
    idle: '待机',
    initializing: '初始化中',
    ready: '就绪',
    waiting_mvu: '等待 MVU',
  } as const;
  return map[runtime.value.bootStatus] ?? runtime.value.bootStatus;
});

const mapDecisionEntries = computed(() =>
  [...runtime.value.summary.decisionTraces]
    .filter(item => item.category === '地图')
    .sort((a, b) => b.score - a.score)
    .slice(0, 8),
);

const lastUpdatedAtText = computed(() => {
  if (!runtime.value.lastUpdatedAt) return '暂无';
  return new Date(runtime.value.lastUpdatedAt).toLocaleString();
});

const parseEntryText = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map(item => item.trim())
        .filter(Boolean),
    ),
  );

const parseSandboxMessages = (value: string) =>
  value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);

const forcedEnableText = computed({
  get: () => settings.value.forced_enable_entries.join('\n'),
  set: value => {
    settings.value.forced_enable_entries = parseEntryText(value);
  },
});

const forcedDisableText = computed({
  get: () => settings.value.forced_disable_entries.join('\n'),
  set: value => {
    settings.value.forced_disable_entries = parseEntryText(value);
  },
});

let stopRuntimeSync = () => {};

async function withBusy(task: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await task();
  } finally {
    busy.value = false;
  }
}

async function handleSyncRuntime() {
  await withBusy(async () => {
    runtime.value = await refreshRuntimeSnapshot();
  });
}

async function runEnableRefresh() {
  await withBusy(async () => {
    runtime.value = await runManualRefresh('enable');
  });
}

async function runDisableRefresh() {
  await withBusy(async () => {
    runtime.value = await runManualRefresh('disable');
  });
}

async function handleRunDiagnostics() {
  await withBusy(async () => {
    runtime.value = await runRuntimeDiagnostics();
  });
}

function hydrateSandboxFromRuntime() {
  sandboxRegion.value = runtime.value.context?.currentRegion || '';
  sandboxLayer.value = runtime.value.context?.currentLayer || '';
  sandboxEnvironment.value = runtime.value.context?.environmentDesc || '';
  sandboxMessages.value = runtime.value.context?.recentMessages?.join('\n') || '';
}

async function handleRunPreview() {
  await withBusy(async () => {
    const payload: DynamicWorldbookPreviewInput = {
      currentRegion: sandboxRegion.value,
      currentLayer: sandboxLayer.value,
      environmentDesc: sandboxEnvironment.value,
      recentMessages: parseSandboxMessages(sandboxMessages.value),
    };
    runtime.value = await runPreviewSimulation(payload);
  });
}

function reloadSettings() {
  settingsStore.reloadSettings();
}

function handleResetSettings() {
  settingsStore.resetSettings();
}

onMounted(() => {
  stopRuntimeSync = onRuntimeSnapshotChange(snapshot => {
    runtime.value = snapshot;
  });
  void handleSyncRuntime().then(() => {
    if (!sandboxRegion.value && !sandboxMessages.value) {
      hydrateSandboxFromRuntime();
    }
  });
});

onUnmounted(() => {
  stopRuntimeSync();
});
</script>

<style scoped>
.dynamic-worldbook-settings {
  color: var(--SmartThemeBodyColor);
}

.dw-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.dw-card {
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 68%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--SmartThemeBlurTintColor) 90%, transparent) 0%, transparent 100%),
    color-mix(in srgb, var(--SmartThemeQuoteColor) 9%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
}

.dw-card-span {
  grid-column: 1 / -1;
}

.dw-inner-grid {
  margin-top: 12px;
}

.dw-hero {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, #e0a26f 18%, transparent), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--SmartThemeBlurTintColor) 92%, transparent) 0%, transparent 100%),
    color-mix(in srgb, var(--SmartThemeQuoteColor) 10%, transparent);
}

.dw-card-title,
.dw-subtitle {
  font-weight: 700;
}

.dw-subtitle {
  margin: 14px 0 8px;
}

.dw-status-row,
.dw-actions,
.dw-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dw-pill,
.dw-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 78%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--SmartThemeQuoteColor) 12%, transparent);
  font-size: 12px;
}

.dw-pill.is-ready,
.dw-pill.is-on {
  border-color: color-mix(in srgb, #72c59a 42%, var(--SmartThemeBorderColor));
}

.dw-pill.is-waiting_mvu,
.dw-pill.is-busy {
  border-color: color-mix(in srgb, #e1b56b 42%, var(--SmartThemeBorderColor));
}

.dw-pill.is-off {
  border-color: color-mix(in srgb, #d07a7a 42%, var(--SmartThemeBorderColor));
}

.dw-meta-list {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  opacity: 0.92;
}

.dw-toggle,
.dw-field,
.dw-textarea {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 10px 0;
}

.dw-toggle,
.dw-field {
  align-items: center;
}

.dw-toggle input[type='checkbox'] {
  margin-right: 8px;
}

.dw-field span {
  flex: 0 0 110px;
}

.dw-field .text_pole {
  flex: 1 1 auto;
}

.dw-textarea {
  flex-direction: column;
  align-items: stretch;
}

.dw-textarea span {
  font-weight: 600;
}

.dw-textarea textarea {
  width: 100%;
  min-height: 108px;
  resize: vertical;
}

.dw-tip,
.dw-error,
.dw-empty,
.dw-item-sub {
  margin-top: 10px;
  opacity: 0.88;
}

.dw-error {
  color: color-mix(in srgb, #ff8d8d 72%, var(--SmartThemeBodyColor));
}

.dw-list {
  display: grid;
  gap: 8px;
}

.dw-list-item {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 45%, transparent);
  background: color-mix(in srgb, var(--SmartThemeQuoteColor) 7%, transparent);
}

.dw-item-main {
  font-weight: 600;
}

.dw-item-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.dw-score-badge {
  flex: 0 0 auto;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
  font-size: 12px;
}

.dw-score-badge.is-match {
  border-color: color-mix(in srgb, #72c59a 42%, var(--SmartThemeBorderColor));
}

.dw-score-badge.is-wait {
  border-color: color-mix(in srgb, #d8a66d 42%, var(--SmartThemeBorderColor));
}

.dw-reasons {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.dw-reason {
  opacity: 0.88;
}

.dw-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.dw-metric {
  padding: 10px;
  border-radius: 12px;
  text-align: center;
  background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 60%, transparent);
}

.dw-metric-value {
  font-size: 24px;
  font-weight: 700;
}

.dw-metric-label {
  margin-top: 4px;
  opacity: 0.82;
}

.dw-metrics-dense .dw-metric-value {
  font-size: 18px;
}

@media (max-width: 900px) {
  .dw-grid {
    grid-template-columns: 1fr;
  }

  .dw-card-span {
    grid-column: auto;
  }
}
</style>
