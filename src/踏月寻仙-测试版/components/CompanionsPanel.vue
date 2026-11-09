<template>
  <div class="panel companions-panel">
    <div class="companions-list">
      <div v-for="(companion, name) in store.红颜" :key="name" class="companion-card" :class="{ expanded: isExpanded(name) }">
        <button class="companion-header" type="button" @click="toggleExpanded(name)">
          <div class="header-main">
            <span class="companion-name">{{ name }}</span>
            <div class="companion-badges">
              <span class="relation-badge">{{ companion.关系 }}</span>
              <span v-if="companion.关系上下文?.当前情绪" class="context-badge">
                {{ companion.关系上下文.当前情绪 }}
              </span>
            </div>
          </div>

          <div class="header-side">
            <span class="companion-realm" :style="{ color: getRealmColor(companion.等级) }">
              {{ getRealmDescription(companion.等级, companion.境界描述) }}
            </span>
            <i class="fa-solid" :class="isExpanded(name) ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </div>
        </button>

        <div class="companion-favor">
          <div class="favor-label"><i class="fa-solid fa-heart" style="font-size: 10px; margin-right: 4px; opacity: 0.8;"></i>好感</div>
          <div class="favor-bar">
            <div
              class="favor-fill"
              :class="{ 'is-negative': companion.好感度 < 0 }"
              :style="{ width: `${Math.min(Math.abs(companion.好感度) / 2, 100)}%` }"
            ></div>
          </div>
          <div class="favor-value" :class="{ 'is-negative': companion.好感度 < 0 }">{{ companion.好感度 }}</div>
        </div>

        <div v-if="isExpanded(name)" class="context-section">
          <div class="context-title">
            <i class="fa-solid fa-feather-pointed"></i>
            <span>心迹微澜</span>
          </div>

          <div
            v-if="getContextEntries(companion).length > 0"
            class="context-list"
            :class="{ 'context-list--triple': getContextEntries(companion).length === 3 }"
          >
            <div v-for="entry in getContextEntries(companion)" :key="entry.label" class="context-item">
              <div class="context-label">{{ entry.label }}</div>
              <div class="context-value">{{ entry.value }}</div>
            </div>
          </div>

          <div v-else class="context-empty">
            眼下尚无可书之绪。待相与日深，此间自会渐记其心念、所求、所忌与未竟之约。
          </div>
        </div>

        <div v-if="isExpanded(name) && isCustomCompanion(name)" class="portrait-section">
          <div class="portrait-title">
            <i class="fa-solid fa-image-portrait"></i>
            <span>自定义立绘</span>
          </div>

          <div class="portrait-hint">
            此角色不在预设红颜库中，可自行上传立绘。若只上传正面，图鉴背面会优先沿用正面图。
          </div>

          <div class="portrait-grid">
            <div class="portrait-slot">
              <div class="portrait-label">正面立绘</div>
              <div class="portrait-preview">
                <img v-if="getCustomPortrait(name).front" :src="getCustomPortrait(name).front" :alt="`${name}正面立绘`" />
                <div v-else class="portrait-empty">未上传</div>
              </div>
              <div class="portrait-actions">
                <label class="portrait-button" :for="`portrait-front-${name}`">
                  {{ isUploading(name, '正面') ? '上传中...' : '上传正面' }}
                </label>
                <button
                  v-if="getCustomPortrait(name).front"
                  class="portrait-button portrait-button--ghost"
                  type="button"
                  @click="clearPortrait(name, '正面')"
                >
                  清除
                </button>
              </div>
              <input
                :id="`portrait-front-${name}`"
                class="portrait-input"
                type="file"
                accept="image/*"
                @change="onPortraitSelected(name, '正面', $event)"
              />
            </div>

            <div class="portrait-slot">
              <div class="portrait-label">背面立绘</div>
              <div class="portrait-preview">
                <img v-if="getCustomPortrait(name).back" :src="getCustomPortrait(name).back" :alt="`${name}背面立绘`" />
                <div v-else class="portrait-empty">未上传</div>
              </div>
              <div class="portrait-actions">
                <label class="portrait-button" :for="`portrait-back-${name}`">
                  {{ isUploading(name, '背面') ? '上传中...' : '上传背面' }}
                </label>
                <button
                  v-if="getCustomPortrait(name).back"
                  class="portrait-button portrait-button--ghost"
                  type="button"
                  @click="clearPortrait(name, '背面')"
                >
                  清除
                </button>
              </div>
              <input
                :id="`portrait-back-${name}`"
                class="portrait-input"
                type="file"
                accept="image/*"
                @change="onPortraitSelected(name, '背面', $event)"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="Object.keys(store.红颜).length === 0" class="empty-hint">孑然一身，尚无红颜知己</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { REALM_NAMES, REALM_STAGES, getRealmColor } from '../schema';
import { useDataStore } from '../store';

const store = useDataStore();
const expandedName = ref('');
const uploadStates = ref<Record<string, { 正面: boolean; 背面: boolean }>>({});

const CONTEXT_LABELS = {
  态度缘由: '此念所起',
  关系诉求: '心中所求',
  相处禁忌: '所忌',
  未了约定: '未竟之约',
} as const;

watch(
  () => Object.keys(store.红颜),
  names => {
    if (names.length === 0) {
      expandedName.value = '';
      return;
    }

    if (!expandedName.value || !names.includes(expandedName.value)) {
      expandedName.value = names[0] ?? '';
    }
  },
  { immediate: true },
);

function getRealmDescription(levelRaw: unknown, fallbackRaw: unknown): string {
  const fallback = String(fallbackRaw ?? '').trim();
  const level = Number(levelRaw);
  const maxLevel = REALM_NAMES.length * REALM_STAGES.length;

  if (!Number.isFinite(level) || level < 1) {
    return fallback || '练气初期';
  }

  const normalizedLevel = Math.min(Math.floor(level), maxLevel);
  const majorIdx = Math.floor((normalizedLevel - 1) / REALM_STAGES.length);
  const minorIdx = (normalizedLevel - 1) % REALM_STAGES.length;

  const major = REALM_NAMES[majorIdx];
  const minor = REALM_STAGES[minorIdx];

  if (!major || !minor) {
    return fallback || '练气初期';
  }

  return `${major}${minor}`;
}

function isExpanded(name: string): boolean {
  return expandedName.value === name;
}

function toggleExpanded(name: string): void {
  expandedName.value = expandedName.value === name ? '' : name;
}

function getContextEntries(companion: Record<string, any>) {
  const context = companion.关系上下文 ?? {};
  return Object.entries(CONTEXT_LABELS)
    .map(([key, label]) => ({
      label,
      value: String(context[key] ?? '').trim(),
    }))
    .filter(entry => entry.value);
}

function isCustomCompanion(name: string): boolean {
  return !store.isBuiltinCompanionName(name);
}

function getCustomPortrait(name: string): { front: string; back: string } {
  const portraitConfig = (store.红颜角色库 as Record<string, any>)?.[name]?.自定义立绘 ?? {};
  return {
    front: String(portraitConfig?.正面 ?? '').trim(),
    back: String(portraitConfig?.背面 ?? '').trim(),
  };
}

function ensureUploadState(name: string) {
  if (!uploadStates.value[name]) {
    uploadStates.value[name] = { 正面: false, 背面: false };
  }
  return uploadStates.value[name];
}

function isUploading(name: string, side: '正面' | '背面'): boolean {
  return ensureUploadState(name)[side];
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

  const uploadState = ensureUploadState(name);
  uploadState[side] = true;

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const saved = await store.updateCustomCompanionPortrait(name, side, dataUrl);
    if (saved) {
      toastr.success(`${name}的${side}立绘已保存`, '自定义立绘');
    }
  } catch (error) {
    console.error('[踏月寻仙] 读取自定义立绘失败', error);
    toastr.error(`读取${side}立绘失败`, '自定义立绘');
  } finally {
    uploadState[side] = false;
    if (input) {
      input.value = '';
    }
  }
}

async function clearPortrait(name: string, side: '正面' | '背面') {
  const cleared = await store.clearCustomCompanionPortrait(name, side);
  if (cleared) {
    toastr.success(`${name}的${side}立绘已清除`, '自定义立绘');
  }
}
</script>

<style lang="scss" scoped>
.companions-panel {
  padding: 16px;

  .companions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .companion-card {
    padding: 16px;
    background: rgba(255, 176, 192, 0.02);
    border: 1px solid rgba(255, 176, 192, 0.08);
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

    &:hover {
      border-color: rgba(255, 176, 192, 0.15);
      background: rgba(255, 176, 192, 0.04);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.expanded {
      border-color: rgba(255, 176, 192, 0.2);
      background: linear-gradient(180deg, rgba(255, 176, 192, 0.05) 0%, rgba(255, 176, 192, 0.01) 100%);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.02);
    }

    .companion-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0;
      margin-bottom: 14px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
    }

    .header-main {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .companion-name {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: 1px;
      background: linear-gradient(120deg, #ffb0c0, #fff0f5);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 2px 4px rgba(255, 176, 192, 0.15);
    }

    .companion-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .relation-badge,
    .context-badge {
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.2;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(4px);
    }

    .relation-badge {
      color: #ffe0e6;
      background: linear-gradient(90deg, rgba(255, 176, 192, 0.12), rgba(255, 176, 192, 0.04));
      border: 1px solid rgba(255, 176, 192, 0.1);
    }

    .context-badge {
      color: #ffe4b5;
      background: linear-gradient(90deg, rgba(255, 211, 138, 0.12), rgba(255, 211, 138, 0.04));
      border: 1px solid rgba(255, 211, 138, 0.1);
    }

    .header-side {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 12px;
    }

    .companion-realm {
      font-size: 12px;
    }

    .header-side i {
      color: var(--text-secondary);
      font-size: 13px;
    }

    .companion-favor {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;

      .favor-label {
        font-size: 12px;
        color: #e0b0c0;
        min-width: 46px;
        display: flex;
        align-items: center;
      }

      .favor-bar {
        flex: 1;
        height: 8px;
        background: rgba(255, 176, 192, 0.12);
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid rgba(255, 176, 192, 0.15);
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);

        .favor-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          background: linear-gradient(90deg, #ff6b9d, #ff9ebf);
          box-shadow: 0 0 10px rgba(255, 107, 157, 0.5);
          position: relative;

          &::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
            border-radius: 4px;
          }

          &.is-negative {
            background: linear-gradient(90deg, #6b7fff, #9eb3ff);
            box-shadow: 0 0 10px rgba(107, 127, 255, 0.5);
          }
        }
      }

      .favor-value {
        font-size: 13px;
        font-weight: bold;
        color: #ff9ebf;
        min-width: 32px;
        text-align: right;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);

        &.is-negative {
          color: #9eb3ff;
        }
      }
    }

    .context-section {
      margin-top: 16px;
      padding-top: 16px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 5%;
        right: 5%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 176, 192, 0.1), transparent);
      }
    }

    .context-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 15px;
      color: #f3b4c8;
      font-weight: 600;
      letter-spacing: 1px;

      i {
        color: #f58ca8;
        font-size: 14px;
      }

      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 176, 192, 0.1), transparent);
        margin-left: 8px;
      }
    }

    .context-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px 24px;
      position: relative;

      /* 中间的垂直分割线 */
      &::after {
        content: '';
        position: absolute;
        top: 10%;
        bottom: 10%;
        left: 50%;
        width: 1px;
        background: linear-gradient(180deg, transparent, rgba(255, 176, 192, 0.15), transparent);
        transform: translateX(-50%);
      }
    }

    .context-list--triple {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

      &::after {
        display: none;
      }
    }

    .context-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 4px 8px;
      position: relative;

      /* 若为奇数个，最后一个占满整行以保持对称，并隐藏其上方的垂直分割线（如果需要的话，这里用CSS较难完美处理，但通常是4个） */
      &:last-child:nth-child(odd) {
        grid-column: 1 / -1;
        align-items: center; /* 独占一行时居中对齐更好看 */
        
        .context-value {
          text-align: center;
        }
      }
    }

    .context-list--triple .context-item:last-child:nth-child(odd) {
      grid-column: auto;
      align-items: flex-start;

      .context-value {
        text-align: justify;
      }
    }

    .context-label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 13px;
      color: #f3b4c8;
      font-weight: 600;
      letter-spacing: 1px;

      /* 标题前的小点缀 */
      &::before {
        content: '';
        width: 4px;
        height: 4px;
        background: #ffb0c0;
        border-radius: 50%;
        box-shadow: 0 0 4px rgba(255, 176, 192, 0.8);
      }
    }

    .context-value {
      font-size: 13px;
      line-height: 1.7;
      color: rgba(255, 255, 255, 0.85);
      text-align: justify;
      width: 100%;
      letter-spacing: 0.5px;
    }

    .context-empty {
      padding: 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.7;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(255, 176, 192, 0.12);
    }

    .portrait-section {
      margin-top: 16px;
      padding-top: 16px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 5%;
        right: 5%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 211, 138, 0.14), transparent);
      }
    }

    .portrait-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 15px;
      color: #ffd38a;
      font-weight: 600;
      letter-spacing: 1px;

      i {
        font-size: 14px;
        color: #ffc76b;
      }
    }

    .portrait-hint {
      margin-bottom: 14px;
      font-size: 12px;
      line-height: 1.7;
      color: rgba(255, 236, 205, 0.72);
    }

    .portrait-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .portrait-slot {
      padding: 12px;
      border-radius: 10px;
      background: rgba(255, 211, 138, 0.04);
      border: 1px solid rgba(255, 211, 138, 0.12);
    }

    .portrait-label {
      margin-bottom: 10px;
      font-size: 13px;
      color: #ffe0b5;
      font-weight: 600;
    }

    .portrait-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      aspect-ratio: 2 / 3;
      border-radius: 10px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.18);
      border: 1px dashed rgba(255, 226, 181, 0.18);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .portrait-empty {
      font-size: 12px;
      color: rgba(255, 236, 205, 0.48);
      letter-spacing: 1px;
    }

    .portrait-actions {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }

    .portrait-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 86px;
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 211, 138, 0.22);
      background: linear-gradient(180deg, rgba(255, 211, 138, 0.14), rgba(255, 211, 138, 0.06));
      color: #fff1d8;
      font-size: 12px;
      cursor: pointer;
      transition:
        transform 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 223, 166, 0.34);
        background: linear-gradient(180deg, rgba(255, 211, 138, 0.2), rgba(255, 211, 138, 0.08));
      }
    }

    .portrait-button--ghost {
      background: transparent;
      color: rgba(255, 236, 205, 0.8);
    }

    .portrait-input {
      display: none;
    }
  }

  .empty-hint {
    text-align: center;
    padding: 20px;
    color: #506070;
    font-style: italic;
  }
}

@media screen and (max-width: 480px) {
  .companions-panel {
    padding: 12px;

    .companion-card {
      padding: 12px;

      .companion-name {
        font-size: 14px;
      }

      .header-side {
        gap: 8px;
      }

      .companion-realm {
        font-size: 11px;
      }

      .favor-label {
        font-size: 10px;
      }

      .favor-bar {
        height: 5px;
      }

      .favor-value {
        font-size: 11px;
      }

      .context-title {
        font-size: 13px;
      }

      .context-list {
        grid-template-columns: 1fr;
        gap: 16px;

        /* 手机端隐藏垂直分割线 */
        &::after {
          display: none;
        }
      }

      .context-item {
        padding: 0 4px;

        &:last-child:nth-child(odd) {
          grid-column: auto;
          align-items: flex-start;
          
          .context-value {
            text-align: justify;
          }
        }
      }

      .context-label {
        font-size: 12px;
        margin-bottom: 6px;
      }

      .context-value {
        font-size: 12px;
      }

      .portrait-grid {
        grid-template-columns: 1fr;
      }
    }
  }
}
</style>
