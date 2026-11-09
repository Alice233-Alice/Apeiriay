<template>
  <div class="panel inventory-panel">
    <div class="inventory-section">
      <div class="section-title"><i class="fa-solid fa-gem"></i> 法宝</div>
      <div class="items-grid">
        <template v-for="(item, key) in store.本尊.法宝" :key="key">
          <div v-if="key && String(key).trim()" class="item-card treasure">
            <div class="item-name">{{ item?.名称 || key }}</div>
            <div class="item-rank">{{ item?.品阶 || '未知' }}</div>
            <div class="item-desc">{{ item?.描述 || '暂无描述' }}</div>
          </div>
        </template>
        <div v-if="!store.本尊.法宝 || Object.keys(store.本尊.法宝).length === 0" class="empty-hint">空空如也</div>
      </div>
    </div>

    <div class="inventory-section">
      <div class="section-title"><i class="fa-solid fa-box-open"></i> 储物戒</div>
      <div class="items-grid">
        <template v-for="(item, key) in store.本尊.背包" :key="key">
          <div v-if="key && String(key).trim()" class="item-card">
            <div class="item-header">
              <span class="item-name">{{ item?.名称 || key }}</span>
              <span class="item-count">×{{ item?.数量 || 1 }}</span>
            </div>
            <div class="item-rank">{{ item?.品阶 || '未知' }}</div>
            <div class="item-desc">{{ item?.描述 || '暂无描述' }}</div>
          </div>
        </template>
        <div v-if="!store.本尊.背包 || Object.keys(store.本尊.背包).length === 0" class="empty-hint">空空如也</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';

const store = useDataStore();
</script>

<style lang="scss" scoped>
.inventory-panel {
  padding: 16px;

  .inventory-section {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .section-title {
    font-size: 14px;
    font-weight: bold;
    color: var(--text-accent);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;

    i {
      color: var(--accent-color);
    }
  }

  .items-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item-card {
    padding: 10px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;

    &.treasure {
      border-color: var(--border-active);
      background: var(--button-active);
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .item-name {
      font-weight: 500;
      color: var(--text-primary);
    }

    .item-count {
      font-size: 12px;
      color: var(--accent-color);
    }

    .item-rank {
      font-size: 11px;
      color: #ffc864;
      margin: 4px 0;
    }

    .item-desc {
      font-size: 11px;
      color: var(--text-secondary);
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
  .inventory-panel {
    padding: 12px;

    .inventory-section {
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 13px;
    }

    .item-card {
      padding: 8px 10px;

      .item-name {
        font-size: 12px;
      }

      .item-count {
        font-size: 11px;
      }

      .item-rank {
        font-size: 10px;
      }

      .item-desc {
        font-size: 10px;
      }
    }
  }
}
</style>
