<template>
  <section class="world-atlas" aria-label="三界山海图">
    <aside class="traveler-bar" aria-label="行旅方位与地域索引">
      <div class="atlas-heading"><span>舆</span><strong>山海藏图</strong><small>行旅方位</small></div>
      <button
        class="locate-button"
        :disabled="!location.anchor || loading"
        :title="`${location.basis}；点击定位`"
        @click="focusLocation"
      >
        <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
        <span class="location-text"
          ><small>此刻所在 · {{ realmLabels[location.realm] }}</small
          ><strong>{{ currentLocation || '行踪未明' }}</strong></span
        >
        <span class="location-domain">{{ location.domain || '地域待明' }}</span>
      </button>
      <div v-if="focusVisible" class="focus-preview"><small>正在查看</small><strong>{{ focusPlace }}</strong><span>{{ requestedLocation.precise ? '图中地标' : requestedLocation.estimated ? '约位 · 地形推定' : requestedLocation.anchor ? '所属地域' : '暂无图上落点' }}</span></div>
      <div class="location-meta">
        <span class="location-accuracy">{{
          location.precise
            ? '地标定位'
            : location.estimated
              ? '约位 · 地形推定'
              : location.anchor
                ? '区域定位'
                : '暂无图上落点'
        }}</span>
        <span class="current-danger">险 {{ currentDanger }}</span>
      </div>
      <button class="connections-button" :aria-expanded="connectionsOpen" @click="connectionsOpen = !connectionsOpen">
        已知通路 <b>{{ availableConnections.length }}</b
        ><i :class="connectionsOpen ? 'fas fa-angle-up' : 'fas fa-angle-down'" aria-hidden="true"></i>
      </button>
      <div v-if="connectionsOpen" class="connections" aria-label="当前地点已知通路">
        <span v-for="connection in availableConnections" :key="connection">{{ connection }}</span>
        <span v-if="!availableConnections.length" class="empty-connections">尚未确认可直接抵达的地点</span>
      </div>
      <nav class="place-index" aria-label="地域索引">
        <div class="index-heading">
          <span>{{ realmLabels[realm] }}索引</span><small>{{ regionIndex.length }} 处</small>
        </div>
        <button
          v-for="place in regionIndex"
          :key="place.id"
          type="button"
          :class="{ 'current-place': location.realm === realm && location.domain === place.id }"
          :disabled="loading"
          @click="controller?.select(place.id, true)"
        >
          {{ place.id }}<i class="fas fa-angle-right" aria-hidden="true"></i>
        </button>
      </nav>
      <details v-if="sectIndex.length" class="sect-index">
        <summary>
          宗门势力 <small>{{ sectIndex.length }} 处</small>
        </summary>
        <p>放大近观山门；驻地为形势示意。</p>
        <button
          v-for="place in sectIndex"
          :key="place.id"
          type="button"
          :disabled="loading"
          @click="controller?.select(place.id, true)"
        >
          <span>{{ place.id }}</span
          ><small>{{ place.domain }}</small>
        </button>
      </details>
      <p class="atlas-reading-hint">点选地域查阅地志<br />放大展开宗门 · 拖动巡览</p>
    </aside>
    <div class="atlas-frame" :aria-busy="loading">
      <div ref="host" class="atlas-host" :data-realm="realm" :inert="loading || !!error"></div>
      <div v-if="loading || error" class="atlas-message" role="status">
        <i class="fas fa-compass" aria-hidden="true"></i>
        <span>{{ error || `正在展开${realmLabels[realm]}舆图…` }}</span>
        <button v-if="error" @click="openRealm({ realm })">重新展卷</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadAtlas } from '../atlas/assets';
import catalog from '../atlas/generated/catalog';
import { mountAtlas } from '../atlas/generated/runtime';
import { realmLabels, resolveAtlasLocation } from '../atlas/location';
import type { AtlasController, AtlasRealm, AtlasTarget } from '../atlas/types';

const props = withDefaults(
  defineProps<{
    active?: boolean;
    currentLocation: string;
    currentDomain?: string;
    currentLayer?: string;
    locationDescription?: string;
    currentDanger?: number;
    availableConnections?: string[];
    focusPlace?: string;
    focusNonce?: number;
    focusDomain?: string;
    focusDescription?: string;
  }>(),
  {
    active: true,
    currentDomain: '',
    currentLayer: '',
    locationDescription: '',
    currentDanger: 10,
    availableConnections: () => [],
    focusPlace: '',
    focusNonce: 0,
    focusDomain: '',
    focusDescription: '',
  },
);
const location = computed(() => resolveAtlasLocation(props));
const requestedLocation = computed(() => resolveAtlasLocation({ currentLocation: props.focusPlace, currentDomain: props.focusDomain, locationDescription: props.focusDescription }));
const focusVisible = ref(false);
let appliedFocusNonce = -1;
const realm = ref<AtlasRealm>(location.value.realm);
const regionIndex = computed(() => catalog.filter(place => place.realm === realm.value && place.kind === 'region'));
const sectIndex = computed(() => catalog.filter(place => place.realm === realm.value && place.kind === 'sect'));
const host = ref<HTMLElement>();
const loading = ref(false);
const error = ref('');
const connectionsOpen = ref(false);
let controller: AtlasController | undefined;
let loadingRequest: AbortController | undefined;
let root: ShadowRoot | undefined;
let revision = 0;
let pendingRealm: AtlasRealm | undefined;
let pendingOpen: { target: AtlasTarget; focus: boolean } | undefined;

async function openRealm(target: AtlasTarget, focus = false) {
  if (!props.active) {
    pendingOpen = { target, focus };
    return;
  }
  const request = ++revision;
  loadingRequest?.abort();
  const abort = new AbortController();
  loadingRequest = abort;
  realm.value = target.realm;
  loading.value = true;
  error.value = '';
  controller?.dispose();
  controller = undefined;
  try {
    const asset = await loadAtlas(target.realm, abort.signal);
    if (request !== revision || !root) return;
    if (!props.active) {
      pendingOpen = { target, focus };
      return;
    }
    root.innerHTML = asset.markup;
    controller = mountAtlas(root, asset.data, { navigate: next => void openRealm(next) });
    controller.locate(location.value, focus);
    const entryId =
      target.id || (target.realm === 'sky' ? (location.value.realm === 'sky' && location.value.domain) || '天渊' : '');
    if (entryId && !(focus && !target.id) && !controller.select(entryId, true) && target.realm === 'sky')
      controller.select('天渊', true);
    await controller.ready;
  } catch (cause) {
    if (request !== revision) return;
    console.error('[山海藏图] 展卷失败', cause);
    error.value = '地图暂未展开，请重试';
  } finally {
    if (request === revision) {
      loadingRequest = undefined;
      loading.value = false;
    }
  }
}
function focusLocation() {
  focusVisible.value = false;
  if (realm.value === location.value.realm && controller) controller.locate(location.value, true);
  else void openRealm({ realm: location.value.realm }, true);
}
async function showRequestedPlace() {
  if (!props.focusPlace || !props.active || appliedFocusNonce === props.focusNonce) return;
  const nonce = props.focusNonce;
  const target = requestedLocation.value;
  focusVisible.value = true;
  if (!target.anchor) return;
  if (!controller || realm.value !== target.realm) await openRealm({ realm: target.realm });
  if (nonce !== props.focusNonce || !props.active) return;
  appliedFocusNonce = nonce;
  controller?.locate(target, true);
  // 聚焦目的地只移动镜头，当前位置标记仍对应玩家的真实落点。
  controller?.locate(location.value);
}
watch(
  [() => props.focusPlace, () => props.focusNonce, () => props.active],
  () => {
    void showRequestedPlace();
  },
  { flush: 'post' },
);
watch(
  [location, () => props.active],
  ([next, active], [previous]) => {
    if (next.realm !== previous.realm) pendingRealm = next.realm;
    // Hidden maps have no layout bounds. Defer realm preparation until visible,
    // and keep the user's current view when only the tab visibility changes.
    if (!active || !root) return;
    const requested = pendingRealm ? { target: { realm: pendingRealm }, focus: false } : pendingOpen;
    pendingRealm = undefined;
    pendingOpen = undefined;
    if (requested && (requested.target.realm !== realm.value || !controller)) {
      void openRealm(requested.target, requested.focus);
    } else controller?.locate(next);
  },
  { flush: 'post' },
);
onMounted(() => {
  root = host.value!.attachShadow({ mode: 'open' });
  void openRealm({ realm: location.value.realm }).then(showRequestedPlace);
});
onBeforeUnmount(() => {
  ++revision;
  loadingRequest?.abort();
  controller?.dispose();
  controller = undefined;
  root = undefined;
});
</script>

<style scoped lang="scss">
.world-atlas {
  .focus-preview { display: grid; gap: 4px; padding: 6px 10px; border-left: 1px solid var(--gold); font-size: 11px; color: var(--text-secondary); }
  .focus-preview strong { color: var(--gold); font-size: 13px; }
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0c2028;
}
.traveler-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 9px 16px;
  border-bottom: 1px solid #b5a57c33;
  background: linear-gradient(100deg, #163532, #0b2029);
  color: #b9c7b7;
}
button {
  font: inherit;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid #d4b577;
  outline-offset: 2px;
}
.locate-button {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  color: #dac99f;
  border: 0;
  padding: 0;
  background: transparent;
  text-align: left;
}
.locate-button:disabled {
  cursor: default;
}
.locate-button > i {
  font-size: 19px;
  color: #a2c6ab;
}
.location-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.location-text small {
  color: #8fa798;
  font-size: 9px;
  letter-spacing: 1px;
}
.location-text strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 350px;
  font:
    17px 'KaiTi',
    serif;
}
.location-domain {
  color: #96ada1;
  padding-left: 12px;
  border-left: 1px solid #b5a57c33;
  font-size: 11px;
  white-space: nowrap;
}
.location-accuracy {
  color: #718e88;
  font-size: 10px;
  margin-left: auto;
  white-space: nowrap;
}
.current-danger {
  border: 1px solid #b5a57c44;
  border-radius: 3px;
  padding: 3px 8px;
  color: #d0bf98;
  white-space: nowrap;
  font-size: 11px;
}
.connections-button {
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
  padding: 6px 0 6px 10px;
  color: #98aaa0;
  border: 0;
  background: transparent;
  font-size: 11px;
}
.connections-button b {
  font-weight: normal;
  color: #d2bd8f;
}
.connections {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 7px;
  padding: 9px 16px;
  max-height: 90px;
  overflow-y: auto;
  border-bottom: 1px solid #b5a57c33;
}
.connections span {
  color: #b7c6b5;
  font-size: 11px;
  border: 1px solid #b5a57c30;
  border-radius: 3px;
  padding: 4px 9px;
}
.connections .empty-connections {
  border: 0;
  color: #7f9991;
}
.atlas-frame {
  flex: 1;
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
}
.atlas-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.atlas-message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
  justify-content: center;
  background: #0c2028;
  color: #a8b6a5;
  font-size: 12px;
}
.atlas-message > i {
  font-size: 26px;
  color: #c5b486;
}
.atlas-message button {
  padding: 7px 16px;
  border: 1px solid #b5a57c66;
  color: #dac99f;
  background: transparent;
}
@media (max-width: 600px) {
  .traveler-bar {
    padding: 7px 10px;
    gap: 8px;
  }
  .location-domain,
  .location-accuracy {
    display: none;
  }
  .locate-button {
    flex: 1;
    gap: 8px;
    overflow: hidden;
  }
  .location-text strong {
    font-size: 15px;
    max-width: 100%;
  }
  .connections-button {
    font-size: 10px;
    padding-left: 0;
    gap: 5px;
  }
  .current-danger {
    padding: 3px 5px;
    font-size: 10px;
  }
}
.world-atlas {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
}
.traveler-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  padding: 20px 16px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  border-bottom: 0;
  border-right: 1px solid #b5a57c33;
  background: linear-gradient(165deg, #15322f, #0b2028 65%);
}
.atlas-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid #b5a57c33;
  color: #d8c18f;
}
.atlas-heading > span {
  font:
    26px 'KaiTi',
    serif;
}
.atlas-heading strong {
  font:
    20px 'KaiTi',
    serif;
  letter-spacing: 2px;
}
.atlas-heading small {
  width: 100%;
  font-size: 10px;
  letter-spacing: 4px;
  color: #839b90;
}
.locate-button {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 8px;
  padding: 2px 0;
}
.location-text {
  gap: 6px;
}
.location-text strong {
  font-size: 18px;
}
.location-domain {
  grid-column: 2;
  padding: 0;
  border: 0;
}
.location-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.location-accuracy {
  margin: 0;
  font-size: 11px;
}
.connections-button {
  justify-content: space-between;
  padding: 10px 0;
  border-block: 1px solid #b5a57c25;
}
.connections {
  max-height: 120px;
  padding: 0 0 10px;
  gap: 6px;
}
.index-heading {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  color: #bccab9;
  font-size: 12px;
  margin: 5px 0 12px;
}
.index-heading small {
  color: #79968c;
  font-size: 10px;
}
.place-index {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
}
.sect-index {
  border-top: 1px solid #ccb88026;
  padding-top: 14px;
  margin-top: 12px;
}
.sect-index summary {
  cursor: pointer;
  color: #c8bd99;
  font-size: 12px;
}
.sect-index summary small {
  float: right;
  color: #72918a;
}
.sect-index p {
  font-size: 10px;
  color: #82968c;
  line-height: 1.8;
}
.sect-index button {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 9px 3px;
  border: 0;
  border-bottom: 1px solid #ccb88015;
  background: none;
  color: #b6c6b5;
  text-align: left;
  cursor: pointer;
  font-size: 11px;
}
.sect-index button:hover {
  color: #e0c995;
  background: #c3bc8610;
}
.sect-index button small {
  color: #7e9c96;
  font-size: 9px;
  margin-left: 4px;
}
.place-index button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  border: 1px solid transparent;
  background: transparent;
  padding: 8px 4px;
  color: #a9beb0;
  text-align: left;
  font-size: 12px;
  border-radius: 3px;
}
.place-index button:hover,
.place-index button.current-place {
  background: #b5a57c12;
  border-color: #b5a57c40;
  color: #e1d0a5;
}
.place-index i {
  color: #657f76;
  font-size: 10px;
}
.atlas-reading-hint {
  margin: auto 0 0;
  padding-top: 16px;
  color: #728e83;
  font-size: 10px;
  line-height: 1.9;
}
@media (max-width: 1399px) {
  .world-atlas {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
  .traveler-bar {
    flex-direction: row;
    align-items: center;
    padding: 6px 12px;
    gap: 14px;
    overflow: visible;
    border-right: 0;
    border-bottom: 1px solid #b5a57c33;
    position: relative;
  }
  .atlas-heading,
  .place-index,
  .sect-index,
  .atlas-reading-hint {
    display: none;
  }
  .locate-button {
    display: flex;
    flex: 1;
  }
  .location-text {
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
  }
  .location-text strong {
    font-size: 16px;
  }
  .location-text small {
    font-size: 10px;
  }
  .location-meta {
    gap: 10px;
  }
  .connections-button {
    padding: 3px 0;
    border: 0;
    gap: 6px;
  }
  .connections {
    position: absolute;
    right: 8px;
    top: 100%;
    z-index: 5;
    max-width: 320px;
    padding: 12px;
    background: #10292c;
    border: 1px solid #b5a57c55;
    box-shadow: 0 8px 22px #03151b88;
  }
}
@media (max-width: 600px) {
  .location-text small,
  .location-domain,
  .location-accuracy {
    display: none;
  }
  .traveler-bar {
    gap: 8px;
  }
  .location-text strong {
    font-size: 15px;
  }
}
</style>
