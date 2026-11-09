<template>
  <div v-if="links.length" class="affairs-links" aria-label="相关人物地点与物品">
    <template v-for="link in links" :key="`${link.kind}:${link.id}`">
      <button v-if="link.known" :data-kind="link.kind" type="button" @click="affairs.navigate(link.kind, link.id)">
        <i :class="link.icon"></i>{{ link.label }}
      </button>
      <span v-else :data-kind="link.kind"><i :class="link.icon"></i>{{ link.label }}</span>
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
<style scoped lang="scss">
.affairs-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 12px;
}
button,
span {
  --link-tone: var(--gold);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1.6;
  text-align: left;
  overflow-wrap: anywhere;
}
[data-kind='person'] {
  --link-tone: var(--semantic-relation);
}
[data-kind='place'] {
  --link-tone: var(--jade);
}
button {
  border: 1px solid color-mix(in srgb, var(--link-tone) 25%, var(--line-subtle));
  background: color-mix(in srgb, var(--link-tone) 4%, transparent);
  color: color-mix(in srgb, var(--link-tone) 65%, var(--text-primary));
  cursor: pointer;
}
button:hover {
  border-color: var(--link-tone);
}
button:focus-visible {
  outline: 2px solid var(--link-tone);
  outline-offset: 3px;
}
span {
  padding-inline: 2px;
  color: var(--text-secondary);
}
i {
  flex: none;
  color: var(--link-tone);
  font-size: 10px;
}
</style>
