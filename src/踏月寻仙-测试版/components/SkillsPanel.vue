<template>
  <div class="panel skills-panel">
    <div class="skills-list">
      <template v-for="(skill, key) in store.本尊.神通列表" :key="key">
        <div v-if="key && String(key).trim()" class="skill-item">
          <div class="skill-header">
            <div class="skill-name">{{ skill?.名称 || key }}</div>
            <div class="skill-rank">{{ skill?.品阶 || '未知' }}</div>
          </div>
          <div class="skill-desc">{{ skill?.描述 || '暂无描述' }}</div>
          <div class="skill-proficiency">熟练度: {{ skill?.熟练度 || '入门' }}</div>
        </div>
      </template>
      <div v-if="!store.本尊.神通列表 || Object.keys(store.本尊.神通列表).length === 0" class="empty-hint">
        尚未领悟任何神通
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';

const store = useDataStore();
</script>

<style lang="scss" scoped>
.skills-panel {
  padding: 16px;

  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skill-item {
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;

    .skill-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .skill-name {
      font-size: 14px;
      font-weight: bold;
      color: var(--accent-color);
    }

    .skill-rank {
      font-size: 11px;
      color: #ffc864;
      padding: 2px 8px;
      background: rgba(255, 200, 100, 0.1);
      border-radius: 4px;
    }

    .skill-desc {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 4px;
    }

    .skill-proficiency {
      font-size: 11px;
      color: var(--text-accent);
    }
  }

  .empty-hint {
    text-align: center;
    padding: 20px;
    color: #506070;
    font-style: italic;
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .skills-panel {
    padding: 12px;

    .skills-list {
      gap: 10px;
    }

    .skill-item {
      padding: 10px;

      .skill-name {
        font-size: 13px;
      }

      .skill-rank {
        font-size: 10px;
      }

      .skill-desc {
        font-size: 11px;
      }

      .skill-proficiency {
        font-size: 10px;
      }
    }
  }
}
</style>