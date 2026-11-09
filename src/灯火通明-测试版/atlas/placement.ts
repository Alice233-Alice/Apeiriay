import geography from './generated/geography';
import type { AtlasAnchor } from './types';

type Point = [number, number];
type Terrain = 'town' | 'water' | 'mountain' | 'forest' | 'plain';
const seaAreas: Record<string, Point[]> = {
  潮音海: [
    [156, 318],
    [277, 339],
    [313, 713],
    [156, 747],
  ],
  龙眠海: [
    [1290, 289],
    [1444, 289],
    [1450, 598],
    [1340, 619],
    [1285, 550],
  ],
  蓬莱幻海: [
    [1160, 722],
    [1370, 696],
    [1416, 844],
    [1135, 874],
  ],
  北冥冰海: [
    [605, 70],
    [1000, 70],
    [967, 122],
    [638, 125],
  ],
  雷暴海: [
    [989, 684],
    [1095, 699],
    [1116, 782],
    [1000, 786],
    [968, 737],
  ],
  无尽洋: [
    [1390, 515],
    [1520, 515],
    [1520, 823],
    [1405, 836],
  ],
  天泣洋: [
    [87, 365],
    [168, 365],
    [168, 808],
    [87, 808],
  ],
  永夜海域: [
    [1005, 58],
    [1230, 58],
    [1230, 134],
    [1030, 134],
  ],
  四海: [
    [1370, 633],
    [1485, 623],
    [1485, 824],
    [1380, 824],
  ],
};
// Reference spots taken from the existing engraved relief. They are soft placement
// preferences, not new settlements, routes, or worldbook coordinates.
const terrainSpots: Record<string, Partial<Record<Terrain, Point[]>>> = {
  神州: {
    mountain: [
      [669, 423],
      [690, 380],
      [663, 581],
    ],
    water: [
      [790, 406],
      [772, 462],
      [780, 519],
      [841, 587],
    ],
    forest: [
      [913, 477],
      [895, 566],
    ],
    plain: [
      [710, 483],
      [860, 531],
    ],
  },
  西庚: {
    mountain: [
      [452, 437],
      [489, 386],
      [439, 528],
      [538, 585],
    ],
    water: [
      [527, 446],
      [597, 459],
    ],
    forest: [[572, 481]],
    plain: [[543, 514]],
  },
  东苍: {
    mountain: [
      [1122, 337],
      [1146, 477],
      [1101, 594],
    ],
    water: [
      [1053, 513],
      [1111, 548],
      [1035, 458],
    ],
    forest: [
      [1081, 369],
      [1161, 522],
      [1052, 598],
    ],
    plain: [[1100, 490]],
  },
  北冥: {
    mountain: [
      [692, 266],
      [787, 209],
      [923, 274],
    ],
    water: [
      [867, 247],
      [810, 306],
    ],
    forest: [[896, 309]],
    plain: [[740, 303]],
  },
  南炎: {
    mountain: [
      [685, 678],
      [781, 696],
      [863, 723],
    ],
    water: [[826, 663]],
    forest: [[609, 740]],
    plain: [
      [727, 766],
      [659, 741],
    ],
  },
};
const areaCache = new Map<string, Point[]>();

export function insideAtlasArea([x, y]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i],
      [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function atlasArea(anchor: AtlasAnchor): Point[] {
  if (geography[anchor.id]) return geography[anchor.id];
  if (seaAreas[anchor.id]) return seaAreas[anchor.id];
  let x = anchor.x,
    y = anchor.y,
    rx = 65,
    ry = 38;
  if (anchor.realm === 'underworld') {
    rx = (anchor.view?.w || 450) * 0.29;
    ry = (anchor.view?.h || 320) * 0.24;
    if (anchor.id === '倒悬天墟' && anchor.view) {
      x = anchor.view.x + anchor.view.w / 2;
      y = anchor.view.y + anchor.view.h / 2;
      rx = anchor.view.w * 0.4;
      ry = anchor.view.h * 0.18;
    }
  } else if (anchor.realm === 'sky' && anchor.view) {
    x = anchor.view.x + anchor.view.w / 2;
    y = anchor.view.y + anchor.view.h / 2;
    rx = anchor.view.w * 0.34;
    ry = anchor.view.h * 0.28;
  }
  return Array.from({ length: 40 }, (_, i) => [
    x + Math.cos((i / 20) * Math.PI) * rx,
    y + Math.sin((i / 20) * Math.PI) * ry,
  ]);
}

const hash = (text: string) => {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
};
const terrainOf = (text: string): Terrain | undefined =>
  /河|江|溪|湖|泉|瀑|渡口|码头|水岸|海岸|海滩/.test(text)
    ? 'water'
    : /峰|山|岭|崖|峡|谷|洞|矿|雪原|冰原|火口/.test(text)
      ? 'mountain'
      : /林|森|木海|竹|花海/.test(text)
        ? 'forest'
        : /城|镇|村|坊|街|巷|客栈|酒楼|商|集市|驿|救助所/.test(text)
          ? 'town'
          : /平原|田野|草原|荒野/.test(text)
            ? 'plain'
            : undefined;
const terrainLabels: Record<Terrain, string> = {
  town: '聚落',
  water: '水岸',
  mountain: '山地',
  forest: '林地',
  plain: '平野',
};

/** Only read explicit directions, never the 北 in 北冥 or a surname like 南宫. */
function directionOf(text: string): { x: number; y: number; label: string } | undefined {
  const match =
    /(东北|西北|东南|西南|东|西|南|北)(?:侧|部|面|边|境|郊|门|岸|麓|方|端|坡|角|隅)/.exec(text) ||
    /(城东|城西|城南|城北)/.exec(text);
  if (!match) return;
  const value = match[1];
  return {
    x: value.includes('东') ? 1 : value.includes('西') ? -1 : 0,
    y: value.includes('南') ? 1 : value.includes('北') ? -1 : 0,
    label: value.replace('城', '') + '侧',
  };
}

/** Stable local simulation, evaluated only on location updates, never during a gesture. */
export function estimateAtlasPoint(input: {
  label: string;
  clue: string;
  description: string;
  region: AtlasAnchor;
  nearby?: AtlasAnchor;
  capital?: AtlasAnchor;
}): { x: number; y: number; basis: string } {
  const { label, clue, description, region, nearby, capital } = input;
  const area = atlasArea(region);
  const xs = area.map(p => p[0]),
    ys = area.map(p => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const width = maxX - minX,
    height = maxY - minY;
  const seed = `${region.realm}/${region.id}/${label}`;
  const direction = directionOf(clue) || directionOf(description);
  const namedTerrain = terrainOf(clue),
    sceneTerrain = terrainOf(description);
  const terrain = namedTerrain === 'town' && sceneTerrain ? sceneTerrain : namedTerrain || sceneTerrain;
  const spots = terrain ? terrainSpots[region.id]?.[terrain] : undefined;
  let center: Point = [minX + width / 2, minY + height / 2];
  let spreadX = width * 0.37,
    spreadY = height * 0.37;
  const reference = nearby || (terrain === 'town' ? capital : undefined);
  const basis: string[] = [];
  if (reference) {
    center = [reference.x, reference.y];
    spreadX = Math.min(width * 0.13, nearby ? 28 : 58);
    spreadY = Math.min(height * 0.13, nearby ? 22 : 45);
    basis.push(`${reference.id}附近`);
  } else if (spots?.length && !direction) {
    center = spots[Math.floor(hash(seed + '/terrain') * spots.length)];
    spreadX = Math.min(width * 0.2, 42);
    spreadY = Math.min(height * 0.2, 36);
  }
  if (direction) {
    center = [
      center[0] + direction.x * (reference ? spreadX * 1.3 : width * 0.28),
      center[1] + direction.y * (reference ? spreadY * 1.3 : height * 0.28),
    ];
    spreadX *= 0.5;
    spreadY *= 0.5;
    basis.push(direction.label);
  }
  if (terrain && !reference) basis.push(terrainLabels[terrain]);
  const target: Point = [
    center[0] + (hash(seed + '/x') * 2 - 1) * spreadX,
    center[1] + (hash(seed + '/y') * 2 - 1) * spreadY,
  ];
  let candidates = areaCache.get(region.realm + region.id);
  if (!candidates) {
    candidates = [];
    for (let y = 1; y < 36; y++)
      for (let x = 1; x < 36; x++) {
        const point: Point = [minX + (width * x) / 36, minY + (height * y) / 36];
        if (insideAtlasArea(point, area)) candidates.push(point);
      }
    areaCache.set(region.realm + region.id, candidates);
  }
  // Never let the inferred point spill into a neighbouring land domain or the sea.
  const point = insideAtlasArea(target, area)
    ? target
    : candidates.reduce(
        (best, p) =>
          Math.hypot(p[0] - target[0], p[1] - target[1]) < Math.hypot(best[0] - target[0], best[1] - target[1])
            ? p
            : best,
        candidates[0] || center,
      );
  return {
    x: +point[0].toFixed(2),
    y: +point[1].toFixed(2),
    basis: `${region.id} · ${basis.join(' · ') || '域内分布'}推定，位置为示意`,
  };
}
