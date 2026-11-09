<template>
  <div v-if="links.length" class="affairs-links" aria-label="相关人物地点与物品">
    <template v-for="link in links" :key="`${link.kind}:${link.id}`">
      <button v-if="link.known" type="button" @click="affairs.navigate(link.kind, link.id)">
        <i :class="link.icon"></i>{{ link.label }}
      </button>
      <span v-else><i :class="link.icon"></i>{{ link.label }}</span>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import catalog from '../atlas/generated/catalog';
import { useDataStore } from '../store';
import { useAffairsStore } from '../stores/affairs-store';
const atlasPlaceNames = new Set(catalog.map(place => place.id));
const props = defineProps<{ people?: string[]; places?: string[]; items?: string[] }>();
const data = useDataStore();
const affairs = useAffairsStore();
const links = computed(() => [
  ...(props.people ?? []).map(name => ({
    kind: 'person' as const,
    id: name,
    label: name,
    icon: 'fa-solid fa-user',
    known: !!data.红颜[name] || !!data.NPC图鉴[name],
  })),
  ...(props.places ?? []).filter(Boolean).map(name => ({
    kind: 'place' as const,
    id: name,
    label: name,
    icon: 'fa-solid fa-location-dot',
    known:
      name === data.本尊.行踪.当前区域 ||
      !!data.地点库[name] ||
      !!data.世界地图[name] ||
      data.本尊.行踪.可用通道.includes(name) ||
      atlasPlaceNames.has(name),
  })),
  ...(props.items ?? []).map(name => {
    const found = [data.本尊.法宝, data.本尊.背包, data.本尊.杂物袋]
      .flatMap(record => Object.entries(record ?? {}))
      .find(([id, item]) => id === name || item.名称 === name);
    return {
      kind: 'item' as const,
      id: found?.[1].名称 || name,
      label: name,
      icon: 'fa-solid fa-box-open',
      known: !!found,
    };
  }),
]);
</script>
<style scoped>
.affairs-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
button,
span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 16px;
  line-height: 1.5;
}
button {
  border: 1px solid var(--line-subtle);
  color: var(--gold);
  background: var(--surface-inset);
  cursor: pointer;
}
button:hover {
  border-color: var(--gold);
}
span {
  color: var(--text-secondary);
  opacity: 0.8;
}
i {
  font-size: 10px;
}
</style>
