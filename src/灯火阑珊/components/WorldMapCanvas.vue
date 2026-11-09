<template>
  <section class="world-map-panel has-painted-map">
    <div class="map-heading">
      <div>
        <div class="map-title">
          <i class="fa-solid fa-map-location-dot"></i>
          三界山海图
        </div>
        <div class="map-subtitle">{{ activeMapView.label }} · {{ currentRealmLabel }} · {{ currentDomainLabel }}</div>
      </div>
      <div class="map-status">
        <span class="danger-pill" :style="{ backgroundColor: dangerColor }">险度 {{ currentDanger }}</span>
        <span class="current-pill">{{ currentLocationLabel }}</span>
      </div>
    </div>

    <div class="map-stage">
      <Transition name="map-view-fade" mode="out-in">
      <svg
        :key="activeViewId"
        :class="['map-canvas', 'expanded-map-canvas', `map-canvas-${activeViewId}`]"
        viewBox="0 0 420 300"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        :aria-label="activeMapView.ariaLabel"
      >
        <defs>
          <radialGradient id="expandedWorldGlow" cx="50%" cy="48%" r="72%">
            <stop offset="0%" stop-color="rgba(255, 205, 140, 0.18)" />
            <stop offset="58%" stop-color="rgba(128, 84, 74, 0.08)" />
            <stop offset="100%" stop-color="rgba(28, 8, 10, 0)" />
          </radialGradient>
          <linearGradient id="expandedMapTone" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(29, 13, 25, 0.08)" />
            <stop offset="62%" stop-color="rgba(64, 28, 24, 0.02)" />
            <stop offset="100%" stop-color="rgba(26, 8, 12, 0.22)" />
          </linearGradient>
          <radialGradient id="expandedMapVignette" cx="50%" cy="48%" r="70%">
            <stop offset="62%" stop-color="rgba(18, 8, 10, 0)" />
            <stop offset="100%" stop-color="rgba(15, 5, 8, 0.42)" />
          </radialGradient>
          <linearGradient id="expandedEarthMass" x1="0" x2="1" y1="0.1" y2="1">
            <stop offset="0%" stop-color="rgba(211, 168, 107, 0.16)" />
            <stop offset="54%" stop-color="rgba(137, 91, 56, 0.2)" />
            <stop offset="100%" stop-color="rgba(72, 36, 35, 0.1)" />
          </linearGradient>
          <linearGradient id="expandedAbyssFade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="rgba(71, 71, 158, 0.15)" />
            <stop offset="52%" stop-color="rgba(73, 35, 78, 0.22)" />
            <stop offset="100%" stop-color="rgba(146, 59, 44, 0.13)" />
          </linearGradient>
          <pattern id="expandedMapGrid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0 H0 V8" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="0.22" />
          </pattern>
          <filter id="expandedSoftGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="1.3" flood-color="rgba(255,190,150,0.35)" />
          </filter>
        </defs>

        <rect class="expanded-map-bg" x="0" y="0" width="420" height="300" />
        <rect class="expanded-map-grid" x="0" y="0" width="420" height="300" />
        <image
          class="painted-map-bg"
          :href="activeMapView.image"
          x="0"
          y="0"
          width="420"
          height="300"
          preserveAspectRatio="xMidYMid slice"
        />
        <rect class="painted-map-tone" x="0" y="0" width="420" height="300" />
        <rect class="painted-map-vignette" x="0" y="0" width="420" height="300" />
        <path
          v-if="activeMapView.showRealmLayers"
          class="expanded-layer expanded-layer-sky"
          d="M0 18 C48 1 116 9 172 14 C247 0 352 0 419 24 L418 66 C286 63 137 60 5 67Z"
        />
        <path
          v-if="activeMapView.showRealmLayers"
          class="expanded-layer expanded-layer-earth"
          :d="earthOuterPath"
        />
        <path
          v-if="activeMapView.showRealmLayers"
          class="expanded-layer expanded-layer-abyss"
          d="M0 249 C71 213 156 216 208 233 C280 207 380 214 420 248 L420 300 L0 300Z"
        />

        <g class="expanded-layer-labels">
          <text v-for="label in activeMapView.layerLabels" :key="label.text" :x="label.x" :y="label.y">
            {{ label.text }}
          </text>
        </g>

        <g class="expanded-sea-labels" aria-hidden="true">
          <text v-for="label in activeMapView.seaLabels" :key="label.text" :x="label.x" :y="label.y">
            {{ label.text }}
          </text>
        </g>

        <g class="expanded-areas">
          <g
            v-for="area in expandedMapAreas"
            :key="area.id"
            class="expanded-area"
            :class="[
              `expanded-kind-${area.kind}`,
              {
                current: area.id === currentAreaId,
                selected: area.id === selectedAreaId,
              },
            ]"
            :style="areaPaintStyle(area)"
            role="button"
            tabindex="0"
            @click="selectArea(area.id)"
            @keydown.enter.prevent="selectArea(area.id)"
            @keydown.space.prevent="selectArea(area.id)"
          >
            <path class="expanded-area-shape" :d="area.path" />
          </g>
        </g>

        <g class="expanded-earth-boundaries" aria-hidden="true">
          <path
            v-for="boundary in activeRegionBoundaries"
            :key="boundary.id"
            class="expanded-earth-boundary"
            :d="boundary.path"
          />
        </g>

        <g class="expanded-terrain" aria-hidden="true">
          <path class="terrain mountain" d="M43 154 L59 124 L75 158 L91 111 L108 159 L124 134 L139 170" />
          <path class="terrain mountain" d="M72 177 L90 147 L108 178 L126 154 L143 186" />
          <path class="terrain river" d="M210 104 C194 128 219 151 205 174 C194 198 218 226 251 239" />
          <path class="terrain river" d="M300 154 C324 162 351 160 388 173" />
          <path class="terrain ice" d="M133 92 C171 76 228 78 264 96 M130 118 C171 104 217 109 258 125" />
          <path
            class="terrain forest"
            d="M294 128 C286 115 300 108 312 121 C323 109 339 121 328 136 M314 136 L314 170"
          />
          <path
            class="terrain forest"
            d="M328 143 C319 131 332 123 344 137 C357 126 371 139 360 154 M345 154 L345 177"
          />
          <path class="terrain volcano" d="M171 222 L198 174 L230 225 Z M187 204 C202 187 219 187 230 204" />
          <path class="terrain storm" d="M317 180 L296 211 L325 205 L310 236 L357 191 L328 205 L343 181" />
          <path
            class="terrain vortex"
            d="M127 262 C108 247 85 255 88 273 C92 292 129 296 153 276 C176 256 150 225 118 238 C96 247 99 264 118 273 C139 284 158 268 145 254"
          />
          <path class="terrain fissure" d="M176 111 C158 153 140 218 126 263" />
          <path class="terrain fissure" d="M205 174 C203 211 207 251 213 284" />
          <path class="terrain fissure" d="M185 220 C222 238 270 250 307 266" />
          <path class="terrain fissure" d="M303 166 C331 204 354 238 375 267" />
        </g>

        <g class="expanded-routes">
          <path
            v-for="route in expandedRoutes"
            :key="route.id"
            :class="['expanded-route', `expanded-route-${route.kind}`, { current: routeConnectsCurrent(route) }]"
            :d="route.path"
          />
        </g>

        <g class="expanded-labels">
          <g
            v-for="area in expandedMapAreas"
            :key="`${area.id}-expanded-label`"
            class="expanded-label"
            :class="{ current: area.id === currentAreaId, selected: area.id === selectedAreaId }"
            :transform="`translate(${area.labelX} ${area.labelY})`"
            role="button"
            tabindex="0"
            @click="selectArea(area.id)"
            @keydown.enter.prevent="selectArea(area.id)"
            @keydown.space.prevent="selectArea(area.id)"
          >
            <circle r="2" />
            <text x="4.6" y="1.5">{{ area.name }}</text>
          </g>
        </g>

        <g
          v-if="expandedCurrentArea"
          class="expanded-current-marker"
          :transform="`translate(${expandedCurrentArea.labelX} ${expandedCurrentArea.labelY})`"
        >
          <path class="expanded-current-pointer" d="M0 -4 V-8" />
          <rect class="expanded-current-tag" x="-13" y="-17" width="26" height="8" rx="2.2" />
          <text x="0" y="-11.7" text-anchor="middle">当前位置</text>
          <circle class="expanded-current-ring" r="8" />
          <circle class="expanded-current-core" r="2.2" />
        </g>
      </svg>
      </Transition>
    </div>

    <div class="map-view-switcher" role="group" aria-label="切换地图视图">
      <button type="button" class="map-view-arrow" title="上一张地图" aria-label="上一张地图" @click="shiftMapView(-1)">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <button
        type="button"
        class="map-view-current"
        :title="`切换地图，当前为${activeMapView.label}`"
        :aria-label="`切换地图，当前为${activeMapView.label}`"
        @click="shiftMapView(1)"
      >
        <i :class="activeMapView.icon"></i>
        <span>{{ activeMapView.label }}</span>
        <small>{{ activeViewIndex + 1 }}/{{ mapViewOrder.length }}</small>
      </button>
      <button type="button" class="map-view-arrow" title="下一张地图" aria-label="下一张地图" @click="shiftMapView(1)">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>

    <div class="map-detail">
      <div class="detail-main">
        <div class="detail-kicker">{{ selectedArea.realmLabel }} · 险度 {{ selectedArea.danger }}</div>
        <div class="detail-title">
          <span>{{ selectedArea.name }}</span>
          <span v-if="selectedArea.id === currentAreaId" class="detail-current">当前位置</span>
        </div>
        <div class="detail-summary">{{ selectedArea.summary }}</div>
      </div>
      <div class="detail-grid">
        <div class="detail-line">
          <span>法则</span>
          <strong>{{ selectedArea.law }}</strong>
        </div>
        <div class="detail-line">
          <span>连通</span>
          <strong>{{ selectedArea.connection }}</strong>
        </div>
        <div class="detail-line">
          <span>地标</span>
          <strong>{{ selectedArea.landmarks }}</strong>
        </div>
      </div>
    </div>

    <div class="route-strip" v-if="availableConnections.length > 0">
      <span class="route-label">当前可行</span>
      <span v-for="conn in availableConnections" :key="conn" class="route-chip">{{ conn }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getDangerColor } from '../schema';

// 地图按需从图床读取，避免把大幅位图内联进状态栏页面。
const MAP_ASSET_ROOT = 'https://pub-4d14ab94aa29488b977bc5be9f2a06ef.r2.dev/picgo';
const overviewMapBg = `${MAP_ASSET_ROOT}/world-map-painted-bg-v3.png：世界总览.png`;
const earthMapBg = `${MAP_ASSET_ROOT}/world-map-earth.png：地界地图.png`;
const underworldMapBg = `${MAP_ASSET_ROOT}/world-map-underworld.png：冥界地图.png`;

type AreaKind = 'land' | 'core' | 'sea' | 'border' | 'celestial' | 'abyss';
type RouteKind = 'mortal' | 'sea' | 'celestial' | 'abyss' | 'border';
type MapViewId = 'overview' | 'earth' | 'underworld';

interface MapLabel {
  text: string;
  x: number;
  y: number;
}

interface MapAreaLayout {
  path: string;
  labelX: number;
  labelY: number;
}

interface MapViewDefinition {
  id: MapViewId;
  label: string;
  icon: string;
  image: string;
  ariaLabel: string;
  areaIds: string[];
  layout: Record<string, MapAreaLayout>;
  layerLabels: MapLabel[];
  seaLabels: MapLabel[];
  showRealmLayers: boolean;
}

interface MapArea {
  id: string;
  name: string;
  realmLabel: string;
  kind: AreaKind;
  path: string;
  detailPath?: string;
  labelX: number;
  labelY: number;
  markerX: number;
  markerY: number;
  danger: number;
  fill: string;
  stroke: string;
  aliases: string[];
  summary: string;
  law: string;
  connection: string;
  landmarks: string;
}

interface RouteLine {
  id: string;
  from: string;
  to: string;
  kind: RouteKind;
  path: string;
}

const props = defineProps<{
  currentLocation: string;
  currentDomain: string;
  currentDanger: number;
  availableConnections: string[];
}>();

const mapAreas: MapArea[] = [
  {
    id: '四海',
    name: '四海',
    realmLabel: '地界环海',
    kind: 'sea',
    path: 'M10 49 C13 34 31 25 51 23 C78 18 112 28 129 45 C137 58 129 73 105 81 C75 91 37 82 17 70 C8 63 6 55 10 49Z',
    detailPath:
      'M17 52 C25 39 43 32 63 32 C90 32 114 42 122 55 M25 66 C46 74 78 78 104 70 M39 29 C34 41 34 55 42 73 M95 31 C105 43 107 57 100 73',
    labelX: 112,
    labelY: 62,
    markerX: 112,
    markerY: 62,
    danger: 45,
    fill: 'rgba(35, 122, 132, 0.22)',
    stroke: 'rgba(118, 221, 222, 0.58)',
    aliases: ['四海', '潮音海', '龙眠海', '蓬莱幻海', '北冥冰海', '外海', '无尽洋', '天泣洋'],
    summary: '五域之外的环海与外海总称，潮音、龙眠、蓬莱、北冥冰海各藏航路与秘境。',
    law: '海脉、蜃气、星陨与水族法度交错，外海越远越失序。',
    connection: '环接五域；西通潮音，东接龙眠，北入北冥冰海。',
    landmarks: '潮音海、龙眠海、蓬莱幻海、北冥冰海。',
  },
  {
    id: '北冥',
    name: '北冥',
    realmLabel: '地界北域',
    kind: 'land',
    path: 'M50 29 L66 24 C78 24 90 30 98 38 L88 47 L68 46 L52 42 L44 35 Z',
    detailPath:
      'M48 35 C57 31 70 31 84 36 M55 28 C58 34 57 39 53 42 M70 27 C69 35 73 41 83 44 M61 41 C63 43 66 43 69 41',
    labelX: 58,
    labelY: 35,
    markerX: 63,
    markerY: 36,
    danger: 30,
    fill: 'rgba(102, 154, 190, 0.42)',
    stroke: 'rgba(174, 222, 255, 0.78)',
    aliases: ['北冥', '北域', '玄武灵境', '北冥冰海'],
    summary: '北方水域，冰海、琉璃雪原、冰雪仙城与鲛人珊瑚宫并存。',
    law: '水冰法增强，心境空明，火法受抑。',
    connection: '南接神州；极北海眼被阵法封印，下通归墟。',
    landmarks: '极光雪原、珊瑚海市、玄武灵泉、北冥海眼。',
  },
  {
    id: '西庚',
    name: '西庚',
    realmLabel: '地界西域',
    kind: 'land',
    path: 'M26 47 L45 39 L57 43 L56 58 L43 66 L25 63 L18 56 L21 50 Z',
    detailPath: 'M25 52 C33 49 44 48 54 50 M35 42 L31 61 M47 42 L43 61 M25 57 L52 44',
    labelX: 33,
    labelY: 52,
    markerX: 36,
    markerY: 52,
    danger: 35,
    fill: 'rgba(181, 172, 143, 0.4)',
    stroke: 'rgba(225, 214, 185, 0.76)',
    aliases: ['西庚', '西漠', '白虎锐境'],
    summary: '西方金域，奇峰剑阁与灵金矿脉交错，白虎主杀伐与守护。',
    law: '金法与剑道增强，木法受抑，矿贸极盛。',
    connection: '东接神州，西临潮音海；极西承天渊星陨之径。',
    landmarks: '剑意长城、庚金灵脉、白虎天堑。',
  },
  {
    id: '神州',
    name: '神州',
    realmLabel: '地界中枢',
    kind: 'core',
    path: 'M57 43 L76 41 L90 50 L86 64 L70 72 L56 63 L52 51 Z',
    detailPath:
      'M55 52 C63 48 75 48 86 53 M61 43 C62 51 60 59 56 64 M76 43 C74 52 78 59 85 63 M63 59 C68 57 74 58 80 61',
    labelX: 64,
    labelY: 54,
    markerX: 67,
    markerY: 54,
    danger: 10,
    fill: 'rgba(211, 174, 87, 0.46)',
    stroke: 'rgba(255, 225, 136, 0.82)',
    aliases: ['神州', '中州', '中土神州', '中原'],
    summary: '天地中枢，五行调和，九曲天河贯穿，修仙文明最盛。',
    law: '五行圆融，道法不增不减，消息与法度最完备。',
    connection: '八方辐辏，可达五域四海；天河源头直通黄泉。',
    landmarks: '问道峰、九层藏书阁、九曲天河、酆都鬼城。',
  },
  {
    id: '东苍',
    name: '东苍',
    realmLabel: '地界东域',
    kind: 'land',
    path: 'M90 43 L111 40 L124 49 L121 61 L105 70 L87 64 L90 51 Z',
    detailPath:
      'M91 51 C100 47 111 48 121 53 M98 42 C100 51 98 60 91 65 M111 43 C108 53 113 62 120 65 M91 59 C99 56 108 58 115 63',
    labelX: 96,
    labelY: 48,
    markerX: 97,
    markerY: 48,
    danger: 20,
    fill: 'rgba(85, 166, 100, 0.46)',
    stroke: 'rgba(142, 224, 145, 0.82)',
    aliases: ['东苍', '东荒', '青帝仙乡'],
    summary: '东方木域，巨木托起树冠仙城，人族与木灵共居，甘霖福泽。',
    law: '木法与医道增强，寿元流逝缓，金法受抑。',
    connection: '西接神州，东临龙眠与蓬莱，建木根下通神木枯冢。',
    landmarks: '建木神树、百花秘境、青帝苑。',
  },
  {
    id: '南炎',
    name: '南炎',
    realmLabel: '地界南域',
    kind: 'land',
    path: 'M56 63 L70 72 L87 65 L100 75 L92 87 L70 91 L48 79 L45 69 Z',
    detailPath: 'M49 73 C61 69 75 70 89 78 M58 66 L53 80 M74 67 L77 86 M66 65 C65 70 68 74 74 78',
    labelX: 66,
    labelY: 76,
    markerX: 69,
    markerY: 74,
    danger: 30,
    fill: 'rgba(207, 92, 62, 0.46)',
    stroke: 'rgba(255, 150, 100, 0.82)',
    aliases: ['南炎', '南疆', '朱雀圣域'],
    summary: '南方火域，赤壤常夏，火山、琉璃城与地热灵泉繁盛。',
    law: '火法增强，炼丹炼器成率提升，水法受抑。',
    connection: '北接神州，火眼封印下通无尽炎渊，旁及雷暴海。',
    landmarks: '赤霞花海、汤谷灵泉、不灭火山口。',
  },
  {
    id: '苍茫古径',
    name: '苍茫古径',
    realmLabel: '边境商道',
    kind: 'border',
    path: 'M84 49 C92 46 100 48 108 53 L104 56 C96 53 90 53 83 56 Z',
    detailPath: 'M86 52 C92 50 98 51 105 54',
    labelX: 86,
    labelY: 56,
    markerX: 86,
    markerY: 56,
    danger: 15,
    fill: 'rgba(159, 203, 121, 0.38)',
    stroke: 'rgba(187, 232, 150, 0.74)',
    aliases: ['苍茫古径', '上古商道'],
    summary: '神州东境至东苍西陲的八百里商道，古木成穹，旧驿站与护道石像散落。',
    law: '木灵自西向东渐盛，是初赴东苍者的适应带。',
    connection: '西接神州官道，东抵建木外围。',
    landmarks: '老槐驿、石碑林、青藤关。',
  },
  {
    id: '雪线',
    name: '雪线',
    realmLabel: '极寒前哨',
    kind: 'border',
    path: 'M51 41 L66 42 L82 41 L78 46 L62 48 L50 45 Z',
    detailPath: 'M55 44 C62 43 70 43 78 44',
    labelX: 58,
    labelY: 41,
    markerX: 61,
    markerY: 40,
    danger: 35,
    fill: 'rgba(180, 222, 246, 0.38)',
    stroke: 'rgba(210, 239, 255, 0.76)',
    aliases: ['雪线', '极寒前哨'],
    summary: '神州北境至北冥冰原的五百里极寒前哨，“永远白雪”始不融。',
    law: '水灵逐里增强，非水灵运转滞涩。',
    connection: '南接北境官道，北达琉璃雪原。',
    landmarks: '融雪驿、冰年轮原野、六灯塔。',
  },
  {
    id: '赤金走廊',
    name: '赤金走廊',
    realmLabel: '边境商路',
    kind: 'border',
    path: 'M39 61 C49 58 58 61 65 68 L60 72 C51 68 43 67 36 65 Z',
    detailPath: 'M42 65 C49 63 56 64 62 68',
    labelX: 43,
    labelY: 66,
    markerX: 51,
    markerY: 66,
    danger: 40,
    fill: 'rgba(207, 143, 91, 0.4)',
    stroke: 'rgba(232, 176, 110, 0.76)',
    aliases: ['赤金走廊', '戈壁商路'],
    summary: '神州西南陲千里商路，西北通西庚，西南通南炎，黑路可至雷暴海。',
    law: '金火互斥成灵气真空，道法与阵法皆不稳。',
    connection: '连西庚、南炎与神州边陲。',
    landmarks: '三岔口绿洲、碎金峡谷、赤焰裂谷。',
  },
  {
    id: '龙眠海峡',
    name: '龙眠海峡',
    realmLabel: '海界锁钥',
    kind: 'sea',
    path: 'M120 49 C129 50 134 55 134 62 C130 68 122 66 119 60 C117 55 117 52 120 49Z',
    detailPath: 'M119 57 C123 55 129 56 133 60',
    labelX: 125,
    labelY: 55,
    markerX: 125,
    markerY: 55,
    danger: 50,
    fill: 'rgba(72, 175, 190, 0.32)',
    stroke: 'rgba(112, 222, 235, 0.74)',
    aliases: ['龙眠海峡', '水族锁钥', '眠龙渊'],
    summary: '东苍东岸与龙眠海之间的水族法定边界，沉船叹喟坟场在海底延伸。',
    law: '中线以东归水族，水压与暗流会排斥无牌者。',
    connection: '西接东苍红树林，东至龙眠海水晶宫外围。',
    landmarks: '红树林廊道、眠龙拱门、叹喟坟场。',
  },
  {
    id: '雷暴海',
    name: '雷暴海',
    realmLabel: '海界凶域',
    kind: 'sea',
    path: 'M89 67 C98 62 111 66 116 75 C110 82 96 81 88 73 Z',
    detailPath: 'M96 71 L102 75 L99 75 L108 81 M106 68 L110 72 L107 72 L113 77',
    labelX: 99,
    labelY: 76,
    markerX: 102,
    markerY: 75,
    danger: 85,
    fill: 'rgba(119, 91, 190, 0.36)',
    stroke: 'rgba(168, 132, 244, 0.78)',
    aliases: ['雷暴海', '天地熔炉'],
    summary: '南炎与东苍之间的狂暴海域，紫电如龙，也是死亡走私航线。',
    law: '木火激荡成天雷，雷暴干扰神识与阵法。',
    connection: '夹在南炎、东苍之间，暗通走私航路。',
    landmarks: '雷云海面、雷兽巢、渡劫暗礁。',
  },
  {
    id: '天渊',
    name: '天渊',
    realmLabel: '天界裂痕',
    kind: 'celestial',
    path: 'M18 18 C24 10 37 10 44 17 C39 22 27 25 19 22 C16 21 15 19 18 18Z',
    detailPath: 'M29 10 C27 14 32 16 27 22 M21 17 C28 16 34 14 40 15',
    labelX: 25,
    labelY: 17,
    markerX: 27,
    markerY: 17,
    danger: 95,
    fill: 'rgba(126, 202, 255, 0.2)',
    stroke: 'rgba(164, 220, 255, 0.62)',
    aliases: ['天层', '天渊', '九天罡风带'],
    summary: '九霄悬空裂痕，星陨与空间乱流自此坠世，是天界垂入地界的伤口。',
    law: '光阴错乱，空间不稳；星辰、罡风与虚空道纹极盛。',
    connection: '下坠西庚与潮音海，上接星陨废墟。',
    landmarks: '乱流带、星辰冢、龙凤古战场、渊核。',
  },
  {
    id: '星陨废墟',
    name: '星陨废墟',
    realmLabel: '下霄',
    kind: 'celestial',
    path: 'M49 13 C58 6 72 8 78 16 C73 24 59 25 49 19 C45 17 45 15 49 13Z',
    detailPath: 'M53 16 C60 14 68 14 75 17 M59 9 L56 22 M70 10 L67 22',
    labelX: 57,
    labelY: 17,
    markerX: 61,
    markerY: 16,
    danger: 90,
    fill: 'rgba(184, 215, 255, 0.19)',
    stroke: 'rgba(207, 228, 255, 0.6)',
    aliases: ['星陨废墟', '下霄', '陨仙坟场'],
    summary: '天界崩碎残骸堆成的废墟海，古仙执念与法则碎片仍在漂流。',
    law: '空间一步百里，古仙残念随机触发。',
    connection: '下经罡风带通天渊，朔日可达九天遗迹。',
    landmarks: '仙宫残骸带、飞舟坟场、陨落仙台。',
  },
  {
    id: '太古战场',
    name: '九天遗迹',
    realmLabel: '中霄',
    kind: 'celestial',
    path: 'M80 13 C89 7 103 10 108 18 C103 26 89 27 80 22 C75 19 75 15 80 13Z',
    detailPath: 'M82 21 C88 17 97 17 105 20 M92 10 C90 15 92 21 99 24',
    labelX: 88,
    labelY: 20,
    markerX: 91,
    markerY: 19,
    danger: 97,
    fill: 'rgba(194, 171, 255, 0.2)',
    stroke: 'rgba(221, 205, 255, 0.6)',
    aliases: ['太古战场', '九天遗迹', '中霄'],
    summary: '祖龙与神凤骸骨横陈的虚空战场，残杀意仍会诱人重演古战。',
    law: '龙威凤威撕裂神识，战意会同化来者。',
    connection: '下通星陨废墟，寂静中心黑孔通天道裂隙。',
    landmarks: '龙脊荒原、凤羽焦土、寂静中心。',
  },
  {
    id: '天道裂隙',
    name: '天道裂隙',
    realmLabel: '上霄',
    kind: 'celestial',
    path: 'M112 13 C119 8 129 10 133 18 C130 25 120 27 112 23 C108 20 108 16 112 13Z',
    detailPath: 'M118 11 L115 17 L120 16 L116 24 M127 14 L123 19 L128 20',
    labelX: 122,
    labelY: 16,
    markerX: 122,
    markerY: 16,
    danger: 100,
    fill: 'rgba(237, 202, 103, 0.22)',
    stroke: 'rgba(255, 229, 146, 0.64)',
    aliases: ['天道裂隙', '上霄', '法则残缺'],
    summary: '九天极巅的纯法则空间，金色裂纹浮于虚空，传闻无人完整归来。',
    law: '断裂天道法则外显，观之可悟道，也可被法则同化。',
    connection: '疑由太古战场寂静中心黑孔进入。',
    landmarks: '法则碎片带、大道裂纹带、天道核心。',
  },
  {
    id: '归墟',
    name: '归墟',
    realmLabel: '幽界极渊',
    kind: 'abyss',
    path: 'M55 79 C62 73 74 77 76 85 C72 94 58 95 52 88 C48 84 50 81 55 79Z',
    detailPath:
      'M63 84 C60 81 55 82 55 85 C55 89 62 91 67 88 C71 85 68 80 62 80 C58 80 56 83 58 85 C61 88 66 87 66 84 C66 82 63 82 62 83',
    labelX: 58,
    labelY: 86,
    markerX: 63,
    markerY: 85,
    danger: 99,
    fill: 'rgba(29, 34, 72, 0.44)',
    stroke: 'rgba(116, 151, 255, 0.64)',
    aliases: ['归墟', '万物终焉', '永夜海域', '北冥海眼', '幽界极渊'],
    summary: '北冥海眼之底的幽界极渊，漆黑巨漩吞噬万物，深处有水蓝仙光镇压死气。',
    law: '死气与沉疴归宿，剥夺生机化混沌。',
    connection: '由北冥极北海眼垂直下入。',
    landmarks: '外渊、中渊、内渊、许听雨镇压之渊核。',
  },
  {
    id: '碎金渊',
    name: '碎金渊',
    realmLabel: '幽界剑冢',
    kind: 'abyss',
    path: 'M27 80 C35 74 47 78 50 85 C46 94 32 95 26 89 C22 85 24 82 27 80Z',
    detailPath: 'M33 80 L30 91 M39 78 L37 93 M45 81 L41 90',
    labelX: 32,
    labelY: 87,
    markerX: 36,
    markerY: 86,
    danger: 90,
    fill: 'rgba(170, 135, 64, 0.32)',
    stroke: 'rgba(225, 196, 122, 0.58)',
    aliases: ['碎金渊', '万剑冢', '潮音海床裂隙'],
    summary: '潮音海极西海沟中的万剑坟场，天渊折剑与人间残剑在此同悲。',
    law: '剑意侵蚀血肉神识，剑修或悟道或碎心。',
    connection: '上通潮音海深裂，底至金气本源。',
    landmarks: '残剑滩、断刃崖、万剑渊、金气本源。',
  },
  {
    id: '黄泉古迹',
    name: '黄泉古迹',
    realmLabel: '幽界交界',
    kind: 'abyss',
    path: 'M68 88 C75 82 87 84 91 91 C87 100 74 101 67 95 C64 92 65 89 68 88Z',
    detailPath: 'M71 93 C75 90 82 90 88 93 M79 86 C78 90 78 95 80 98',
    labelX: 73,
    labelY: 94,
    markerX: 79,
    markerY: 93,
    danger: 90,
    fill: 'rgba(174, 104, 58, 0.32)',
    stroke: 'rgba(225, 164, 102, 0.58)',
    aliases: ['黄泉古迹', '黄泉', '生死交界'],
    summary: '神州天河下连的生死交界，九曲天河之源，晚棠梦境映世。',
    law: '阴阳交汇，死气沉重而含净世幽莲灵机。',
    connection: '由神州天河入幽冥门户。',
    landmarks: '黄泉路、奈何桥、望乡台、九口轮回井。',
  },
  {
    id: '无尽炎渊',
    name: '无尽炎渊',
    realmLabel: '幽界火狱',
    kind: 'abyss',
    path: 'M86 84 C94 78 107 81 111 89 C107 99 92 100 84 93 C80 89 82 86 86 84Z',
    detailPath: 'M93 95 C88 90 92 85 97 82 C96 88 104 90 101 96 M103 92 C101 88 105 86 108 83',
    labelX: 91,
    labelY: 91,
    markerX: 97,
    markerY: 91,
    danger: 95,
    fill: 'rgba(192, 58, 45, 0.34)',
    stroke: 'rgba(255, 121, 86, 0.62)',
    aliases: ['无尽炎渊', '炎渊', '地心火狱'],
    summary: '南炎地底万丈熔岩深渊，越深火品越高，极深处可焚毁概念。',
    law: '火阶层层攀升，心火与地火同焚。',
    connection: '由南炎火山地火之径下入。',
    landmarks: '赤焰、白焰、青焰、黑焰、虚无之火。',
  },
  {
    id: '神木枯冢',
    name: '神木枯冢',
    realmLabel: '幽界藤狱',
    kind: 'abyss',
    path: 'M107 78 C115 74 127 78 130 86 C126 96 112 97 105 90 C101 86 102 81 107 78Z',
    detailPath: 'M109 86 C115 83 122 84 128 89 M116 79 C113 85 115 91 121 95',
    labelX: 111,
    labelY: 87,
    markerX: 117,
    markerY: 86,
    danger: 95,
    fill: 'rgba(88, 136, 72, 0.31)',
    stroke: 'rgba(144, 210, 108, 0.58)',
    aliases: ['神木枯冢', '葬仙藤狱'],
    summary: '东苍建木根系之下的灰暗地窟，生机与死气扭曲纠缠。',
    law: '畸变生机反噬来者，木灵根极易被同化。',
    connection: '由东苍建木深根下入。',
    landmarks: '枯骨林、畸变藤狱、岁月灰烬、枯荣本源。',
  },
];

const earthOuterPath =
  'M22 155 C34 118 76 102 113 91 C145 67 196 67 246 77 C279 70 338 76 382 105 C405 121 412 157 394 185 C368 218 318 226 283 212 C248 236 193 242 154 223 C126 236 74 221 43 197 C20 180 14 167 22 155Z';

const earthRegionBoundaries = [
  { id: 'north-west', path: 'M113 91 C124 106 140 121 151 138' },
  { id: 'north-core-east', path: 'M151 138 C179 122 221 118 253 134' },
  { id: 'west-core-south', path: 'M151 138 C139 160 126 181 96 198' },
  { id: 'core-south', path: 'M151 166 C179 188 224 190 252 170' },
  { id: 'east-south', path: 'M252 170 C285 185 325 186 365 174' },
];

const overviewAreaLayout: Record<string, MapAreaLayout> = {
  天渊: {
    path: 'M2 21 C28 4 73 9 118 31 C103 48 61 62 17 58 C2 54 0 37 2 21Z',
    labelX: 39,
    labelY: 39,
  },
  星陨废墟: {
    path: 'M130 10 C159 0 219 2 253 23 C248 53 194 68 136 54 C112 48 107 21 130 10Z',
    labelX: 149,
    labelY: 41,
  },
  太古战场: {
    path: 'M248 13 C279 0 330 2 352 30 C343 63 291 74 252 56 C231 46 230 24 248 13Z',
    labelX: 263,
    labelY: 42,
  },
  天道裂隙: {
    path: 'M346 7 C373 0 412 5 420 34 C407 66 363 68 340 51 C325 39 329 15 346 7Z',
    labelX: 361,
    labelY: 47,
  },
  四海: {
    path: `M1 104 C63 70 134 55 201 58 C287 53 374 72 414 112 C420 148 407 208 343 228 C272 255 138 251 57 220 C0 196 0 139 1 104Z ${earthOuterPath}`,
    labelX: 395,
    labelY: 112,
  },
  北冥: {
    path: 'M110 82 C150 65 222 65 278 80 L270 112 C246 124 209 127 178 121 C147 116 123 104 110 82Z',
    labelX: 173,
    labelY: 107,
  },
  西庚: {
    path: 'M23 153 C31 123 67 104 113 91 L151 138 L127 181 L96 198 L53 194 C27 185 14 169 23 153Z',
    labelX: 60,
    labelY: 153,
  },
  神州: {
    path: 'M151 138 C178 119 222 119 253 134 L252 170 C224 190 185 190 151 166Z',
    labelX: 200,
    labelY: 157,
  },
  东苍: {
    path: 'M253 134 L278 80 C319 77 366 95 392 123 C405 144 400 175 378 193 C347 206 311 199 282 185 L252 170Z',
    labelX: 292,
    labelY: 155,
  },
  南炎: {
    path: 'M96 198 C119 181 135 176 151 166 C183 190 224 190 252 170 C269 181 286 199 283 213 C247 236 188 237 154 223 C135 220 112 209 96 198Z',
    labelX: 185,
    labelY: 220,
  },
  苍茫古径: {
    path: 'M246 132 C258 126 270 129 281 142 L274 165 C263 157 253 151 243 149Z',
    labelX: 253,
    labelY: 154,
  },
  雪线: {
    path: 'M124 111 C164 98 214 99 263 118 L250 130 C214 119 168 118 132 128Z',
    labelX: 149,
    labelY: 132,
  },
  赤金走廊: {
    path: 'M73 190 C96 177 122 174 151 166 L160 179 C130 188 111 202 89 210Z',
    labelX: 92,
    labelY: 200,
  },
  龙眠海峡: {
    path: 'M379 116 C402 121 421 142 416 164 C405 184 382 184 369 166 C356 145 360 124 379 116Z',
    labelX: 375,
    labelY: 155,
  },
  雷暴海: {
    path: 'M272 188 C298 180 340 184 365 206 C350 225 303 225 273 207Z',
    labelX: 304,
    labelY: 204,
  },
  归墟: {
    path: 'M94 238 C112 220 148 222 163 244 C155 270 123 282 99 267 C84 257 83 246 94 238Z',
    labelX: 126,
    labelY: 263,
  },
  碎金渊: {
    path: 'M8 232 C24 208 69 204 91 229 C84 267 45 292 12 278 C0 266 0 246 8 232Z',
    labelX: 45,
    labelY: 266,
  },
  黄泉古迹: {
    path: 'M180 250 C200 236 238 239 260 258 C250 285 210 294 181 278 C166 268 168 258 180 250Z',
    labelX: 213,
    labelY: 284,
  },
  无尽炎渊: {
    path: 'M258 235 C281 219 320 219 345 231 C352 244 350 261 342 276 C317 291 281 290 257 274 C242 263 243 247 258 235Z',
    labelX: 307,
    labelY: 266,
  },
  神木枯冢: {
    path: 'M347 226 C371 207 416 216 423 251 C417 287 371 300 345 277 C326 260 329 240 347 226Z',
    labelX: 375,
    labelY: 267,
  },
};

const earthAreaLayout: Record<string, MapAreaLayout> = {
  四海: {
    path: 'M0 0 H420 V300 H0 Z',
    labelX: 18,
    labelY: 286,
  },
  北冥: {
    path: 'M48 22 C91 4 150 6 203 8 C256 7 318 16 347 39 C328 58 301 73 274 83 C229 91 172 93 127 81 C92 72 61 54 48 22Z',
    labelX: 205,
    labelY: 52,
  },
  西庚: {
    path: 'M46 60 C76 55 104 61 127 78 C137 104 145 143 145 178 C136 201 118 219 91 232 C62 223 43 199 36 168 C35 126 37 88 46 60Z',
    labelX: 78,
    labelY: 151,
  },
  神州: {
    path: 'M127 78 C166 88 230 88 274 83 C279 112 277 150 272 190 C249 216 216 226 176 219 C154 207 143 192 145 178 C146 143 138 105 127 78Z',
    labelX: 204,
    labelY: 151,
  },
  东苍: {
    path: 'M274 83 C302 62 335 58 367 74 C390 100 395 140 387 178 C373 201 344 219 307 228 C289 220 278 207 272 190 C277 150 279 112 274 83Z',
    labelX: 327,
    labelY: 151,
  },
  南炎: {
    path: 'M91 232 C111 216 128 204 145 178 C159 203 176 219 202 226 C229 224 255 210 272 190 C282 209 292 220 307 228 C291 262 254 283 207 286 C158 282 119 267 91 232Z',
    labelX: 205,
    labelY: 251,
  },
  雪线: {
    path: 'M124 77 C163 87 220 88 278 77 L269 94 C221 104 169 103 132 94Z',
    labelX: 160,
    labelY: 94,
  },
  苍茫古径: {
    path: 'M267 116 C281 112 295 120 305 139 C302 158 291 174 276 184 L269 169 C276 151 276 134 267 116Z',
    labelX: 277,
    labelY: 154,
  },
  赤金走廊: {
    path: 'M92 203 C111 188 129 181 146 174 L160 193 C140 205 125 219 111 235 L93 226Z',
    labelX: 108,
    labelY: 214,
  },
  龙眠海峡: {
    path: 'M366 105 C395 111 410 133 407 161 C403 184 393 199 376 205 C368 190 365 171 367 151 C370 132 370 117 366 105Z',
    labelX: 378,
    labelY: 158,
  },
  雷暴海: {
    path: 'M279 211 C309 202 356 207 397 234 C398 260 378 282 342 291 C313 284 289 263 276 238Z',
    labelX: 326,
    labelY: 249,
  },
};

const underworldAreaLayout: Record<string, MapAreaLayout> = {
  归墟: {
    path: 'M145 7 C176 0 240 0 278 17 C300 39 291 76 267 93 C235 105 181 101 151 82 C131 62 127 27 145 7Z',
    labelX: 210,
    labelY: 55,
  },
  碎金渊: {
    path: 'M0 37 C27 24 80 27 112 49 C132 77 137 129 126 174 C111 203 79 220 43 211 C18 197 5 168 0 134Z',
    labelX: 58,
    labelY: 132,
  },
  黄泉古迹: {
    path: 'M132 94 C162 80 234 80 278 100 C294 126 291 171 269 198 C232 214 172 210 139 191 C122 166 119 122 132 94Z',
    labelX: 207,
    labelY: 151,
  },
  无尽炎渊: {
    path: 'M89 205 C128 190 184 193 211 209 C248 188 307 194 332 218 C350 244 345 280 329 300 H81 C66 274 67 229 89 205Z',
    labelX: 210,
    labelY: 259,
  },
  神木枯冢: {
    path: 'M291 45 C320 26 383 29 420 47 V216 C394 225 347 219 316 198 C292 170 281 87 291 45Z',
    labelX: 355,
    labelY: 137,
  },
};

const overviewRoutes: RouteLine[] = [
  { id: '神州-东苍', from: '神州', to: '东苍', kind: 'mortal', path: 'M210 157 C236 149 265 149 292 155' },
  { id: '神州-西庚', from: '神州', to: '西庚', kind: 'mortal', path: 'M190 157 C154 156 103 154 60 153' },
  { id: '神州-北冥', from: '神州', to: '北冥', kind: 'mortal', path: 'M199 146 C193 132 184 117 173 107' },
  { id: '神州-南炎', from: '神州', to: '南炎', kind: 'mortal', path: 'M199 170 C197 190 191 207 185 220' },
  { id: '西庚-天渊', from: '西庚', to: '天渊', kind: 'celestial', path: 'M60 153 C39 118 26 76 39 39' },
  { id: '天渊-星陨', from: '天渊', to: '星陨废墟', kind: 'celestial', path: 'M77 36 C101 25 126 28 149 41' },
  { id: '星陨-太古', from: '星陨废墟', to: '太古战场', kind: 'celestial', path: 'M188 41 C211 34 238 35 263 42' },
  { id: '太古-天道', from: '太古战场', to: '天道裂隙', kind: 'celestial', path: 'M301 42 C320 36 340 38 361 47' },
  { id: '东苍-龙眠', from: '东苍', to: '龙眠海峡', kind: 'sea', path: 'M306 150 C331 138 356 139 375 155' },
  { id: '东苍-雷暴', from: '东苍', to: '雷暴海', kind: 'sea', path: 'M306 167 C310 183 309 195 304 204' },
  { id: '南炎-雷暴', from: '南炎', to: '雷暴海', kind: 'sea', path: 'M198 220 C238 207 274 200 304 204' },
  { id: '北冥-归墟', from: '北冥', to: '归墟', kind: 'abyss', path: 'M173 111 C158 150 141 219 126 263' },
  { id: '四海-碎金', from: '四海', to: '碎金渊', kind: 'abyss', path: 'M29 209 C34 229 40 249 45 266' },
  { id: '神州-黄泉', from: '神州', to: '黄泉古迹', kind: 'abyss', path: 'M199 170 C199 214 205 253 213 284' },
  { id: '南炎-炎渊', from: '南炎', to: '无尽炎渊', kind: 'abyss', path: 'M185 220 C222 238 270 250 307 266' },
  { id: '东苍-枯冢', from: '东苍', to: '神木枯冢', kind: 'abyss', path: 'M303 166 C331 204 354 238 375 267' },
];

const earthRoutes: RouteLine[] = [
  { id: '神州-东苍', from: '神州', to: '东苍', kind: 'mortal', path: 'M218 151 C251 145 289 146 327 151' },
  { id: '神州-西庚', from: '神州', to: '西庚', kind: 'mortal', path: 'M190 151 C154 148 115 149 78 151' },
  { id: '神州-北冥', from: '神州', to: '北冥', kind: 'mortal', path: 'M204 137 C204 107 204 76 205 52' },
  { id: '神州-南炎', from: '神州', to: '南炎', kind: 'mortal', path: 'M204 166 C204 196 205 224 205 251' },
  { id: '东苍-龙眠', from: '东苍', to: '龙眠海峡', kind: 'sea', path: 'M341 151 C355 148 367 151 378 158' },
  { id: '东苍-雷暴', from: '东苍', to: '雷暴海', kind: 'sea', path: 'M337 174 C338 200 333 226 326 249' },
  { id: '南炎-雷暴', from: '南炎', to: '雷暴海', kind: 'sea', path: 'M224 251 C259 246 294 246 326 249' },
];

const mapViewOrder: MapViewId[] = ['overview', 'earth', 'underworld'];

const mapViews: Record<MapViewId, MapViewDefinition> = {
  overview: {
    id: 'overview',
    label: '三界总览',
    icon: 'fa-solid fa-map-location-dot',
    image: overviewMapBg,
    ariaLabel: '踏月寻仙三界总览图',
    areaIds: [
      '天渊',
      '星陨废墟',
      '太古战场',
      '天道裂隙',
      '四海',
      '北冥',
      '西庚',
      '神州',
      '东苍',
      '南炎',
      '碎金渊',
      '归墟',
      '黄泉古迹',
      '无尽炎渊',
      '神木枯冢',
    ],
    layout: overviewAreaLayout,
    layerLabels: [
      { text: '九霄', x: 17, y: 20 },
      { text: '地界', x: 18, y: 113 },
      { text: '幽界', x: 18, y: 286 },
    ],
    seaLabels: [
      { text: '北冥冰海', x: 211, y: 76 },
      { text: '潮音海', x: 29, y: 209 },
      { text: '龙眠海', x: 400, y: 181 },
      { text: '蓬莱幻海', x: 361, y: 218 },
    ],
    showRealmLayers: true,
  },
  earth: {
    id: 'earth',
    label: '地界舆图',
    icon: 'fa-solid fa-earth-asia',
    image: earthMapBg,
    ariaLabel: '踏月寻仙地界平面舆图',
    areaIds: ['四海', '北冥', '西庚', '神州', '东苍', '南炎', '雪线', '苍茫古径', '赤金走廊', '龙眠海峡', '雷暴海'],
    layout: earthAreaLayout,
    layerLabels: [{ text: '地界', x: 14, y: 22 }],
    seaLabels: [
      { text: '北冥冰海', x: 208, y: 14 },
      { text: '潮音海', x: 20, y: 151 },
      { text: '龙眠海', x: 402, y: 145 },
      { text: '蓬莱幻海', x: 378, y: 287 },
    ],
    showRealmLayers: false,
  },
  underworld: {
    id: 'underworld',
    label: '幽界渊图',
    icon: 'fa-solid fa-layer-group',
    image: underworldMapBg,
    ariaLabel: '踏月寻仙幽界五渊图',
    areaIds: ['碎金渊', '归墟', '黄泉古迹', '无尽炎渊', '神木枯冢'],
    layout: underworldAreaLayout,
    layerLabels: [{ text: '幽界', x: 14, y: 22 }],
    seaLabels: [],
    showRealmLayers: false,
  },
};

const activeViewId = ref<MapViewId>('overview');
const activeMapView = computed(() => mapViews[activeViewId.value]);
const activeViewIndex = computed(() => mapViewOrder.indexOf(activeViewId.value));

const expandedMapAreas = computed(() =>
  activeMapView.value.areaIds
    .map(id => mapAreas.find(area => area.id === id))
    .filter((area): area is MapArea => Boolean(area))
    .map(area => {
      const layout = activeMapView.value.layout[area.id];
      if (!layout) return area;
      return {
        ...area,
        path: layout.path,
        labelX: layout.labelX,
        labelY: layout.labelY,
        markerX: layout.labelX,
        markerY: layout.labelY,
      };
    }),
);

const expandedRoutes = computed<RouteLine[]>(() => {
  if (activeViewId.value === 'overview') return overviewRoutes;
  if (activeViewId.value === 'earth') return earthRoutes;
  return [];
});

const activeRegionBoundaries = computed(() => (activeViewId.value === 'overview' ? earthRegionBoundaries : []));

const selectedAreaId = ref('');

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const currentAreaId = computed(() => {
  const domain = normalizeText(props.currentDomain);
  const location = normalizeText(props.currentLocation);
  const source = `${domain} ${location}`;

  const exactDomainArea = mapAreas.find(area => area.id === domain || area.name === domain);
  if (exactDomainArea) return exactDomainArea.id;

  const directLocationArea = mapAreas.find(area => source.includes(area.id) || source.includes(area.name));
  if (directLocationArea) return directLocationArea.id;

  const aliasArea = mapAreas.find(area => area.aliases.some(alias => alias && source.includes(alias)));
  return aliasArea?.id ?? '';
});

const currentArea = computed(() => mapAreas.find(area => area.id === currentAreaId.value));

const viewForAreaId = (areaId: string): MapViewId => {
  const area = mapAreas.find(item => item.id === areaId);
  if (area?.kind === 'abyss') return 'underworld';
  if (area?.kind === 'celestial') return 'overview';
  if (area) return 'earth';
  return 'overview';
};

const defaultAreaByView: Record<MapViewId, string> = {
  overview: '神州',
  earth: '神州',
  underworld: '归墟',
};

watch(
  currentAreaId,
  value => {
    activeViewId.value = viewForAreaId(value);
    selectedAreaId.value = value || '神州';
  },
  { immediate: true },
);

watch(activeViewId, viewId => {
  const visibleAreaIds = mapViews[viewId].areaIds;
  selectedAreaId.value = visibleAreaIds.includes(currentAreaId.value)
    ? currentAreaId.value
    : defaultAreaByView[viewId];
});

const selectedArea = computed(
  () => mapAreas.find(area => area.id === selectedAreaId.value) ?? currentArea.value ?? mapAreas[3],
);
const expandedCurrentArea = computed(() => expandedMapAreas.value.find(area => area.id === currentAreaId.value));

const currentLocationLabel = computed(() => normalizeText(props.currentLocation) || '未知之地');
const currentDomainLabel = computed(() => normalizeText(props.currentDomain) || '未明地域');
const currentRealmLabel = computed(() => currentArea.value?.realmLabel ?? '行踪');
const dangerColor = computed(() => getDangerColor(props.currentDanger ?? 10));
const selectArea = (id: string) => {
  selectedAreaId.value = id;
};

const shiftMapView = (direction: number) => {
  const nextIndex = (activeViewIndex.value + direction + mapViewOrder.length) % mapViewOrder.length;
  activeViewId.value = mapViewOrder[nextIndex];
};

const areaPaintStyle = (area: MapArea): Record<string, string> => ({
  '--area-fill': area.fill,
  '--area-stroke': area.stroke,
});

const routeConnectsCurrent = (route: RouteLine): boolean => {
  const current = currentAreaId.value;
  if (!current) return false;
  return route.from === current || route.to === current;
};
</script>

<style lang="scss" scoped>
.world-map-panel {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-primary);
  overflow: hidden;
}

.map-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.map-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', 'STKaiti', 'KaiTi', serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;

  i {
    color: var(--accent-color);
  }
}

.map-subtitle {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 1px;
}

.map-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.danger-pill,
.current-pill,
.route-chip,
.route-label,
.detail-current {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  white-space: nowrap;
}

.danger-pill {
  padding: 4px 10px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.current-pill {
  max-width: 260px;
  padding: 4px 10px;
  overflow: hidden;
  color: var(--text-accent);
  font-size: 11px;
  text-overflow: ellipsis;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

/* 星图灵脉核心样式 */
.map-stage {
  position: relative;
  isolation: isolate;
  width: 100%;
  flex: 0 0 auto;
  height: clamp(500px, 48vw, 760px);
  overflow: hidden;
  background: var(--bg-primary);
  /* 极简的星空/阵法底纹 */
  background-image:
    radial-gradient(circle at 50% 50%, var(--bg-secondary) 0%, transparent 70%),
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size:
    100% 100%,
    20px 20px,
    20px 20px;
  box-shadow:
    inset 0 1px rgba(255, 225, 205, 0.05),
    inset 0 -1px rgba(255, 225, 205, 0.05);
}

.map-view-fade-enter-active,
.map-view-fade-leave-active {
  transition:
    opacity 0.2s ease,
    filter 0.2s ease;
}

.map-view-fade-enter-from,
.map-view-fade-leave-to {
  opacity: 0;
  filter: brightness(0.72);
}

.map-view-switcher {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 58px;
  padding: 9px 12px;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
}

.map-view-arrow,
.map-view-current {
  height: 36px;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 7px;
  background: var(--button-bg);
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
  cursor: pointer;

  &:hover {
    color: var(--text-primary);
    border-color: var(--border-active);
    background: var(--button-hover);
  }

  &:active {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
}

.map-view-arrow {
  display: inline-grid;
  place-items: center;
  width: 36px;
  padding: 0;
  font-size: 12px;
}

.map-view-current {
  display: inline-grid;
  grid-template-columns: 16px minmax(68px, auto) 28px;
  align-items: center;
  gap: 7px;
  min-width: 154px;
  padding: 0 11px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;

  i {
    color: var(--accent-color);
  }

  span {
    white-space: nowrap;
  }

  small {
    color: var(--text-secondary);
    font-size: 10px;
    font-weight: 500;
    text-align: right;
  }
}

.map-canvas {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 420 / 300;
}

/* 大陆板块轮廓 */
.continent-path {
  fill: var(--area-fill, var(--accent-color));
  fill-opacity: 0.03;
  stroke: var(--area-stroke, var(--accent-color));
  stroke-width: 0.25;
  stroke-dasharray: 2.2 2.4;
  opacity: 0.32;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  &.kind-sea {
    fill-opacity: 0.008;
    stroke-width: 0.15;
    stroke-dasharray: 3 3.2;
  }

  &.kind-core {
    fill-opacity: 0.06;
    stroke-width: 0.35;
    stroke-dasharray: 2.6 2.2;
  }

  &.kind-abyss {
    fill-opacity: 0.025;
    stroke-width: 0.2;
    stroke-dasharray: 1.6 2;
  }

  &:hover {
    fill-opacity: 0.1;
    stroke-width: 0.4;
    opacity: 0.8;
    filter: url(#hover-glow);
  }

  &.is-selected {
    fill-opacity: 0.13;
    stroke-width: 0.6;
    stroke-dasharray: 4 2;
    opacity: 1;
    filter: url(#active-glow);
  }

  &.is-current {
    fill-opacity: 0.18;
    stroke-width: 0.8;
    stroke-dasharray: 5 2;
    opacity: 1;
    filter: url(#active-glow);
  }

  &.is-current.is-selected {
    fill-opacity: 0.25;
    stroke-width: 1;
  }
}

/* 境界划分 */
.realm-dividers {
  pointer-events: none;

  .divider-line {
    stroke: var(--text-secondary);
    stroke-width: 0.2;
    stroke-dasharray: 2 4;
    opacity: 0.3;
  }

  .divider-text {
    fill: var(--text-secondary);
    font-size: 4.8px;
    font-weight: 700;
    letter-spacing: 2px;
    font-family: 'Noto Serif SC', serif;
    opacity: 0.4;
  }
}

/* 灵脉连线 */
.vein-base {
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 0.3;
  opacity: 0.08;
  stroke-linecap: round;
}

.vein-flow {
  fill: none;
  stroke: var(--accent-color);
  stroke-width: 0.4;
  stroke-linecap: round;
  stroke-dasharray: 2 4;
  opacity: 0.14;
  animation: vein-flow-anim 4s linear infinite;

  &.vein-active {
    stroke-width: 0.6;
    opacity: 0.62;
    stroke-dasharray: 3 3;
    animation: vein-flow-anim 2s linear infinite;
  }
}

@keyframes vein-flow-anim {
  to {
    stroke-dashoffset: -12;
  }
}

/* 阵眼节点 */
.node-group {
  cursor: pointer;
  outline: none;

  &:hover {
    .node-core {
      fill: var(--accent-color);
      transform: scale(1.2);
    }
    .node-ring {
      stroke: var(--accent-color);
      opacity: 1;
      transform: scale(1.4);
    }
    .node-label {
      fill: var(--accent-color);
    }
  }

  &.is-selected {
    .node-core {
      fill: var(--accent-color);
      transform: scale(1.2);
    }
    .node-ring {
      stroke: var(--accent-color);
      opacity: 1;
      transform: scale(1.4);
    }
    .node-label {
      fill: var(--text-primary);
      font-weight: 900;
    }
  }

  &.is-current {
    .node-core {
      fill: var(--bg-primary);
      stroke: var(--accent-color);
      stroke-width: 0.5;
      transform: scale(1.2);
    }
    .node-label {
      fill: var(--accent-color);
      font-weight: 900;
      font-size: 3.45px;
    }
  }

  &.is-current.is-selected {
    .node-core {
      fill: var(--accent-color);
      stroke: var(--bg-primary);
      stroke-width: 0.5;
      transform: scale(1.4);
    }
    .node-ring {
      stroke: var(--accent-color);
      opacity: 1;
      transform: scale(1.6);
    }
  }
}

.node-core {
  fill: var(--text-secondary);
  transition: all 0.3s ease;
}

.node-ring {
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 0.2;
  opacity: 0.5;
  transition: all 0.3s ease;
}

.selected-glow {
  fill: var(--accent-color);
  opacity: 0.2;
  animation: pulse-glow 2s ease-in-out infinite alternate;
}

@keyframes pulse-glow {
  from {
    transform: scale(0.8);
    opacity: 0.1;
  }
  to {
    transform: scale(1.2);
    opacity: 0.3;
  }
}

/* 当前位置涟漪动画 */
.current-ripples {
  pointer-events: none;
}

.ripple {
  fill: none;
  stroke: var(--accent-color);
  stroke-width: 0.4;
  opacity: 0;
  animation: ripple-anim 3s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;

  &.r2 {
    animation-delay: 1.5s;
  }
}

@keyframes ripple-anim {
  0% {
    transform: scale(0.3);
    opacity: 0.8;
    stroke-width: 0.6;
  }
  100% {
    transform: scale(2);
    opacity: 0;
    stroke-width: 0.1;
  }
}

/* 地名标签 */
.node-label {
  fill: var(--text-primary);
  font-size: 3.15px;
  font-weight: 700;
  letter-spacing: 0.2px;
  font-family: 'Noto Serif SC', 'STKaiti', serif;
  /* 使用 paint-order 描边，保证文字在复杂背景下清晰可读 */
  paint-order: stroke;
  stroke: var(--bg-primary);
  stroke-width: 0.45;
  stroke-linejoin: round;
  transition: all 0.3s ease;
  pointer-events: none;
}

.world-map-panel {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-primary);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.map-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.82fr);
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.detail-kicker {
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 1px;
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  color: var(--text-primary);
  font-family: 'Noto Serif SC', 'STKaiti', 'KaiTi', serif;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1px;
}

.detail-current {
  padding: 3px 8px;
  color: var(--text-accent);
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
}

.detail-summary {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-line {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  font-size: 12px;

  span {
    color: var(--accent-color);
    opacity: 0.9;
  }

  strong {
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }
}

.route-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 16px;
  background: var(--bg-secondary);
}

.route-label {
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 1px;
}

.route-chip {
  padding: 4px 10px;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 11px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--accent-color);
    color: var(--text-accent);
  }
}

.expanded-map-canvas {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 50% 47%, rgba(255, 198, 120, 0.08), transparent 48%),
    linear-gradient(180deg, rgba(45, 14, 18, 0.12), rgba(20, 6, 9, 0.24));
}

.expanded-map-bg {
  fill: url(#expandedWorldGlow);
}

.expanded-map-grid {
  fill: url(#expandedMapGrid);
  opacity: 0.55;
}

.painted-map-bg {
  opacity: 0.97;
  filter: saturate(0.92) contrast(1.03) brightness(0.9);
}

.map-canvas-overview .painted-map-bg {
  filter: saturate(0.94) contrast(1.02) brightness(0.94);
}

.map-canvas-earth .painted-map-bg {
  filter: saturate(0.96) contrast(1.02) brightness(0.96);
}

.map-canvas-underworld .painted-map-bg {
  filter: saturate(0.92) contrast(1.04) brightness(0.95);
}

.painted-map-tone {
  fill: url(#expandedMapTone);
  pointer-events: none;
  mix-blend-mode: color;
}

.painted-map-vignette {
  fill: url(#expandedMapVignette);
  pointer-events: none;
}

.expanded-layer {
  stroke-width: 0.35;
  stroke-dasharray: 5 4;
  opacity: 0.42;
}

.expanded-layer-sky {
  fill: rgba(114, 154, 202, 0.08);
  stroke: rgba(169, 213, 255, 0.22);
}

.expanded-layer-earth {
  fill: url(#expandedEarthMass);
  stroke: rgba(239, 198, 151, 0.34);
  stroke-width: 0.55;
  opacity: 0.78;
}

.expanded-layer-abyss {
  fill: url(#expandedAbyssFade);
  stroke: rgba(184, 129, 232, 0.22);
}

.expanded-layer-labels {
  pointer-events: none;

  text {
    fill: rgba(255, 224, 205, 0.52);
    font-family: 'Noto Serif SC', 'STKaiti', serif;
    font-size: 6.5px;
    font-weight: 900;
    letter-spacing: 2px;
    paint-order: stroke;
    stroke: rgba(30, 9, 12, 0.64);
    stroke-width: 0.7;
  }
}

.expanded-sea-labels {
  pointer-events: none;

  text {
    fill: rgba(169, 214, 221, 0.68);
    font-family: 'Noto Serif SC', 'STKaiti', 'KaiTi', serif;
    font-size: 4.4px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-anchor: middle;
    paint-order: stroke;
    stroke: rgba(17, 12, 16, 0.86);
    stroke-width: 0.72;
    stroke-linejoin: round;
  }
}

.expanded-route {
  fill: none;
  stroke-width: 0.42;
  stroke-linecap: round;
  stroke-dasharray: 2.2 3.4;
  opacity: 0.08;
  transition:
    opacity 0.22s ease,
    stroke-width 0.22s ease;

  &.current {
    stroke-width: 0.72;
    opacity: 0.68;
    stroke-dasharray: 4 2.4;
  }
}

.expanded-route-mortal {
  stroke: rgba(255, 218, 133, 0.58);
}

.expanded-route-sea {
  stroke: rgba(105, 219, 226, 0.58);
}

.expanded-route-celestial {
  stroke: rgba(174, 219, 255, 0.58);
}

.expanded-route-abyss {
  stroke: rgba(206, 129, 242, 0.58);
}

.expanded-area {
  cursor: pointer;
  outline: none;
}

.expanded-area-shape {
  fill: var(--area-fill, rgba(255, 214, 160, 0.16));
  stroke: var(--area-stroke, rgba(255, 223, 198, 0.54));
  stroke-width: 0.42;
  stroke-dasharray: 2.4 2.8;
  stroke-linejoin: round;
  fill-rule: evenodd;
  opacity: 0.98;
  transition:
    fill 0.2s ease,
    stroke 0.2s ease,
    stroke-width 0.2s ease,
    opacity 0.2s ease,
    filter 0.2s ease;
}

.expanded-kind-core .expanded-area-shape {
  fill: var(--area-fill, rgba(230, 190, 88, 0.34));
  stroke: var(--area-stroke, rgba(255, 224, 135, 0.72));
}

.expanded-kind-land .expanded-area-shape {
  fill: var(--area-fill, rgba(195, 160, 110, 0.28));
  stroke: var(--area-stroke, rgba(240, 206, 168, 0.62));
}

.expanded-kind-sea .expanded-area-shape {
  fill: var(--area-fill, rgba(64, 157, 172, 0.2));
  stroke: var(--area-stroke, rgba(118, 222, 230, 0.56));
}

.expanded-kind-border .expanded-area-shape {
  fill: var(--area-fill, rgba(230, 196, 126, 0.28));
  stroke: var(--area-stroke, rgba(250, 218, 158, 0.68));
  stroke-width: 0.62;
}

.expanded-kind-celestial .expanded-area-shape {
  fill: var(--area-fill, rgba(147, 181, 226, 0.18));
  stroke: var(--area-stroke, rgba(186, 224, 255, 0.58));
}

.expanded-kind-abyss .expanded-area-shape {
  fill: var(--area-fill, rgba(96, 67, 122, 0.22));
  stroke: var(--area-stroke, rgba(190, 153, 235, 0.56));
}

.expanded-area:hover .expanded-area-shape,
.expanded-area.selected .expanded-area-shape {
  fill: var(--area-fill, rgba(255, 210, 160, 0.28));
  stroke: rgba(247, 217, 178, 0.9);
  stroke-width: 0.68;
  filter: url(#expandedSoftGlow);
}

.expanded-area.current .expanded-area-shape {
  fill: var(--area-fill, rgba(255, 190, 190, 0.32));
  stroke: rgba(255, 180, 150, 0.96);
  stroke-width: 0.76;
  filter: url(#expandedSoftGlow);
}

.expanded-earth-boundaries {
  pointer-events: none;
}

.expanded-earth-boundary {
  fill: none;
  stroke: rgba(255, 229, 196, 0.28);
  stroke-width: 0.34;
  stroke-dasharray: 1.8 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.expanded-terrain {
  pointer-events: none;
  opacity: 0.58;
}

.terrain {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.terrain.mountain {
  stroke: rgba(235, 219, 190, 0.5);
  stroke-width: 0.8;
}

.terrain.river {
  stroke: rgba(130, 210, 220, 0.45);
  stroke-width: 0.6;
}

.terrain.ice {
  stroke: rgba(215, 241, 255, 0.45);
  stroke-width: 0.55;
}

.terrain.forest {
  stroke: rgba(159, 223, 142, 0.48);
  stroke-width: 0.75;
}

.terrain.volcano {
  stroke: rgba(255, 147, 98, 0.55);
  stroke-width: 0.75;
}

.terrain.storm {
  stroke: rgba(180, 145, 255, 0.58);
  stroke-width: 0.75;
}

.terrain.vortex {
  stroke: rgba(150, 181, 255, 0.62);
  stroke-width: 0.62;
}

.terrain.fissure {
  stroke: rgba(190, 111, 228, 0.46);
  stroke-width: 0.55;
  stroke-dasharray: 3 2;
}

.expanded-label {
  cursor: pointer;
  outline: none;

  circle {
    fill: rgba(235, 177, 165, 0.96);
    stroke: rgba(255, 237, 222, 0.76);
    stroke-width: 0.32;
    filter: drop-shadow(0 0 1.2px rgba(27, 7, 10, 0.92));
  }

  text {
    fill: rgba(255, 241, 232, 0.98);
    font-family: 'Noto Serif SC', 'STKaiti', 'KaiTi', serif;
    font-size: 5.2px;
    font-weight: 800;
    letter-spacing: 0;
    paint-order: stroke;
    stroke: rgba(30, 8, 11, 0.9);
    stroke-width: 0.96;
    stroke-linejoin: round;
    filter: drop-shadow(0 0.6px 0.45px rgba(0, 0, 0, 0.62));
  }

  &.selected text,
  &.current text {
    fill: rgba(255, 213, 205, 1);
    font-weight: 900;
  }

  &.current circle {
    fill: rgba(255, 202, 195, 1);
  }
}

.expanded-current-marker {
  pointer-events: none;
  filter: url(#expandedSoftGlow);

  text {
    fill: rgba(255, 232, 219, 0.98);
    font-size: 3.6px;
    font-weight: 800;
    letter-spacing: 0;
  }
}

.expanded-current-tag {
  fill: rgba(44, 13, 17, 0.88);
  stroke: rgba(255, 186, 157, 0.82);
  stroke-width: 0.42;
}

.expanded-current-pointer {
  fill: none;
  stroke: rgba(255, 190, 163, 0.9);
  stroke-width: 0.45;
  stroke-linecap: round;
}

.expanded-current-ring {
  fill: rgba(255, 176, 148, 0.08);
  stroke: rgba(255, 195, 169, 0.92);
  stroke-width: 0.62;
  stroke-dasharray: 1.6 1.2;
  animation: expanded-current-pulse 2.4s ease-in-out infinite;
}

.expanded-current-core {
  fill: rgba(255, 190, 163, 1);
  stroke: rgba(70, 14, 18, 0.7);
  stroke-width: 0.28;
}

.has-painted-map {
  .expanded-map-bg {
    opacity: 0.68;
  }

  .expanded-map-grid {
    opacity: 0.26;
    mix-blend-mode: soft-light;
  }

  .expanded-layer {
    opacity: 0.16;
  }

  .expanded-layer-earth {
    fill: rgba(12, 6, 6, 0.08);
    stroke: rgba(140, 225, 232, 0.48);
    stroke-width: 0.45;
    opacity: 0.54;
  }

  .expanded-layer-sky,
  .expanded-layer-abyss {
    fill: transparent;
  }

  .expanded-area-shape {
    fill-opacity: 0.035;
    stroke-opacity: 0.48;
    stroke-width: 0.42;
    mix-blend-mode: normal;
  }

  .expanded-kind-celestial .expanded-area-shape,
  .expanded-kind-abyss .expanded-area-shape {
    fill-opacity: 0.06;
    stroke-opacity: 0.58;
  }

  .expanded-kind-sea .expanded-area-shape {
    fill-opacity: 0.02;
    stroke-opacity: 0.38;
  }

  .expanded-area:hover .expanded-area-shape,
  .expanded-area.selected .expanded-area-shape {
    fill-opacity: 0.13;
    stroke-opacity: 0.94;
    stroke-width: 0.68;
  }

  .expanded-area.current .expanded-area-shape {
    fill-opacity: 0.12;
    stroke-opacity: 0.96;
    stroke-width: 0.76;
  }

  .expanded-earth-boundary {
    stroke: rgba(255, 232, 204, 0.38);
    stroke-width: 0.3;
    stroke-opacity: 0.54;
  }

  .expanded-route {
    opacity: 0.07;
  }

  .expanded-route-abyss {
    stroke: rgba(201, 150, 235, 0.72);
    opacity: 0.14;
    stroke-width: 0.54;
    stroke-dasharray: 3.4 3;
  }

  .expanded-route.current {
    opacity: 0.7;
    filter: drop-shadow(0 0 1.5px rgba(255, 205, 166, 0.38));
  }

  .expanded-terrain {
    display: none;
  }

  .expanded-label text {
    stroke: rgba(18, 5, 7, 0.94);
    stroke-width: 1;
  }
}

@keyframes expanded-current-pulse {
  0%,
  100% {
    opacity: 0.84;
    transform: scale(0.96);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@media screen and (max-width: 680px) {
  .map-heading,
  .map-detail {
    grid-template-columns: 1fr;
  }

  .map-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .map-status {
    justify-content: flex-start;
  }

  .map-stage {
    height: clamp(420px, 110vw, 620px);
  }

  .label-text {
    font-size: 3.5px;
  }

  .label-border .label-text,
  .label-sea .label-text,
  .label-celestial .label-text,
  .label-abyss .label-text {
    font-size: 3px;
  }

  .current-location-text {
    font-size: 3.35px;
  }
}

@media screen and (max-width: 420px) {
  .map-stage {
    height: 420px;
  }

  .map-detail {
    padding: 10px 12px 12px;
  }
}
</style>
