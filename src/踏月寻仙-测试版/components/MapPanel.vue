<template>
  <div class="panel map-panel">
    <div class="location-brief">
      <div class="brief-header">
        <div class="brief-label">当前落点</div>
        <div class="brief-title">{{ store.本尊.行踪.当前区域 }}</div>
        <div class="brief-domain">{{ displayLayer }}</div>
      </div>
      <div class="brief-desc">
        <i class="fa-solid fa-quote-left quote-icon"></i>
        {{ store.本尊.行踪.环境描述 || '周遭情势尚未明晰。' }}
        <i class="fa-solid fa-quote-right quote-icon"></i>
      </div>
      <div class="brief-routes">
        <div class="routes-title"><i class="fa-solid fa-compass"></i> 灵脉通路</div>
        <div class="connections-list">
          <span
            v-for="conn in availableConnections"
            :key="conn"
            class="connection-item"
            :style="{ '--conn-color': getRegionColor(conn) }"
          >
            <i class="fa-solid fa-location-dot"></i> {{ conn }}
          </span>
          <div v-if="availableConnections.length === 0" class="empty-hint compact">尚未探明通道</div>
        </div>
      </div>
    </div>

    <!-- 任务列表 -->
    <div class="tasks-section">
      <div class="section-title"><i class="fa-solid fa-scroll"></i> 任务</div>
      <div class="tasks-list">
        <template v-for="(task, taskId) in store.任务列表" :key="taskId">
          <div v-if="taskId && String(taskId).trim()" class="task-item" :class="`task-${task.状态}`">
            <div class="task-header">
              <span class="task-name">{{ getTaskDisplayName(task, String(taskId)) }}</span>
              <span class="task-type" :class="`type-${task.类型}`">{{ task.类型 }}</span>
            </div>
            <div class="task-target">{{ task.目标 }}</div>
            <div class="task-status">{{ task.状态 }}</div>
          </div>
        </template>
        <div v-if="!store.任务列表 || Object.keys(store.任务列表).length === 0" class="empty-hint">暂无任务</div>
      </div>
    </div>

    <!-- 声望系统 -->
    <div class="reputation-section">
      <div class="section-title"><i class="fa-solid fa-star"></i> 声望</div>
      <div class="reputation-list">
        <template v-for="(rep, faction) in store.声望系统" :key="faction">
          <div v-if="faction && String(faction).trim()" class="reputation-item">
            <div class="reputation-faction">{{ faction }}</div>
            <div class="reputation-bar">
              <div
                class="reputation-fill"
                :style="{
                  width: `${Math.abs(rep.值)}%`,
                  backgroundColor: rep.值 >= 0 ? '#44aa44' : '#ff4444',
                }"
              ></div>
            </div>
            <div class="reputation-info">
              <span class="reputation-value">{{ rep.值 }}</span>
              <span class="reputation-relation">{{ rep.关系 }}</span>
            </div>
          </div>
        </template>
        <div v-if="!store.声望系统 || Object.keys(store.声望系统).length === 0" class="empty-hint">暂无声望记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inferLayerFromTrack, normalizeRegionName } from '../region-utils';
import { getDangerColor } from '../schema';
import { useDataStore } from '../store';

const store = useDataStore();

// 智能提取任务显示名称
// AI 有时用 "MQ"、"SQ_炼器入门" 等 ID 格式作为 key 但不填名称字段
// 此函数从 taskId 中提取中文部分作为显示名，避免直接暴露英文 ID
const extractChineseQuestLabel = (input: unknown): string => {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  const strippedPrefix = raw
    .replace(/^(?:[A-Za-z][A-Za-z0-9]*)(?:[._:\-/\\\s]+[A-Za-z0-9]+)*[._:\-/\\\s]*/u, '')
    .trim();
  const candidate = strippedPrefix || raw;
  const firstCjkIndex = candidate.search(/[\u3400-\u4dbf\u4e00-\u9fff]/);
  if (firstCjkIndex < 0) return '';
  return candidate.slice(firstCjkIndex).trim();
};

const getTaskDisplayName = (task: { 名称: string; 类型: string }, taskId: string): string => {
  const normalizedName = extractChineseQuestLabel(task.名称);
  if (normalizedName) return normalizedName;

  const normalizedTaskId = extractChineseQuestLabel(taskId);
  if (normalizedTaskId) return normalizedTaskId;

  // 纯英文 ID 按类型给默认名
  const typeNames: Record<string, string> = {
    主线: '主线任务',
    支线: '支线任务',
    每日: '每日任务',
    临危受命: '紧急任务',
    秘境探索: '秘境任务',
  };
  return typeNames[task.类型] || '未命名任务';
};

const displayLayer = computed(() =>
  inferLayerFromTrack(
    store.本尊.行踪.当前区域,
    store.本尊.行踪.所属层级,
    store.本尊.行踪.环境描述,
    store.地点库 as Record<string, { 域?: string }>,
    store.世界地图 as Record<string, { layer?: string }>,
  ),
);

// 计算可通往的地点
const availableConnections = computed(() => {
  const manualConnections = store.本尊.行踪.可用通道;
  if (manualConnections && manualConnections.length > 0) {
    return manualConnections;
  }

  const currentRegionRaw = store.本尊.行踪.当前区域;
  const currentRegion = normalizeRegionName(currentRegionRaw);
  if (!currentRegion || !store.世界地图) {
    return [];
  }

  const mapData = store.世界地图[currentRegion] ?? store.世界地图[currentRegionRaw];
  return mapData?.connections || [];
});

// 获取区域颜色
const getRegionColor = (region: string) => {
  const map = store.世界地图;
  const info = map[region];
  if (!info) return '#888888';
  return getDangerColor(info.danger);
};
</script>

<style lang="scss" scoped>
.map-panel {
  padding: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);

  .location-brief {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 24px 0;
    padding: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
  }

  .brief-header {
    text-align: center;
  }

  .brief-label {
    font-size: 12px;
    color: var(--text-secondary);
    letter-spacing: 2px;
    margin-bottom: 8px;
  }

  .brief-title {
    font-size: 26px;
    font-weight: bold;
    color: var(--text-accent);
    margin-bottom: 6px;
    letter-spacing: 2px;
  }

  .brief-domain {
    font-size: 14px;
    color: var(--accent-color);
  }

  .brief-desc {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.8;
    text-align: center;
    padding: 16px 24px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;

    .quote-icon {
      color: var(--border-color);
      font-size: 12px;
      margin: 0 6px;
      vertical-align: super;
    }
  }

  .brief-routes {
    margin-top: 8px;
    
    .routes-title {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;

      i { color: var(--accent-color); }
    }
  }

  .connections-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;

    .connection-item {
      padding: 6px 16px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      font-size: 13px;
      color: var(--text-primary);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;

      i {
        font-size: 11px;
        color: var(--accent-color);
        opacity: 0.8;
      }

      &:hover {
        transform: translateY(-2px);
        border-color: var(--accent-color);
        color: var(--text-accent);
      }
    }
  }

  .section-title {
    font-size: 18px;
    font-weight: bold;
    color: var(--text-primary);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);

    i {
      color: var(--accent-color);
      font-size: 16px;
    }
  }

  .tasks-section {
    margin-bottom: 24px;

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .task-item {
      padding: 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      position: relative;
      overflow: hidden;
      transition: transform 0.2s;

      &:hover {
        border-color: var(--accent-color);
      }

      &::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0; width: 3px;
      }

      &.task-进行中::before { background: var(--accent-color); }
      &.task-已完成::before { background: #4ade80; }
      &.task-已失败::before { background: #f87171; }

      .task-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .task-name {
          font-size: 15px;
          font-weight: bold;
          color: var(--text-primary);
        }

        .task-type {
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 12px;
          border: 1px solid currentColor;
          background: var(--bg-primary);

          &.type-主线 { color: #fca5a5; }
          &.type-支线 { color: #93c5fd; }
          &.type-每日 { color: #86efac; }
          &.type-临危受命 { color: #fdba74; }
        }
      }

      .task-target {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.6;
      }

      .task-status {
        position: absolute;
        right: 16px;
        bottom: 16px;
        font-size: 12px;
        color: var(--text-secondary);
        opacity: 0.8;
      }
    }
  }

  .reputation-section {
    .reputation-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .reputation-item {
      padding: 14px 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 10px;

      .reputation-faction {
        font-size: 14px;
        color: var(--text-primary);
        margin-bottom: 10px;
        font-weight: bold;
      }

      .reputation-bar {
        height: 4px;
        background: var(--bg-primary);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 10px;

        .reputation-fill {
          height: 100%;
          border-radius: 2px;
        }
      }

      .reputation-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;

        .reputation-value {
          color: var(--text-accent);
          font-family: monospace;
        }

        .reputation-relation {
          color: var(--text-secondary);
        }
      }
    }
  }

  .empty-hint {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
    font-style: italic;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px dashed var(--border-color);

    &.compact {
      padding: 8px 16px;
      background: transparent;
      border: none;
    }
  }
}

@media screen and (max-width: 480px) {
  .map-panel {
    padding: 12px;

    .location-brief {
      padding: 16px;
      margin: 16px 0;
    }

    .brief-title { font-size: 22px; }
    .brief-desc { padding: 12px 16px; font-size: 13px; }
    
    .section-title { font-size: 16px; }
    
    .tasks-section .task-item {
      padding: 12px;
      .task-name { font-size: 14px; }
      .task-target { font-size: 12px; }
    }
  }
}
</style>
