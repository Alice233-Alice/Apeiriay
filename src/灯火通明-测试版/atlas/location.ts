import { MAP_ANCHOR_ALIASES, SPECIFIC_MAP_DOMAINS } from '../../灯火阑珊/map-system';
import catalogData from './generated/catalog';
import { atlasArea, estimateAtlasPoint } from './placement';
import type { AtlasAnchor, AtlasLocation, AtlasRealm, AtlasTarget } from './types';

const catalog = catalogData as AtlasAnchor[];
const regions = catalog.filter(item => item.kind === 'region');
// These named sea/border areas are inscriptions in the surface drawing, not separate plates.
const inscriptions: AtlasAnchor[] = Object.entries({
  苍茫古径: [923, 490],
  赤金走廊: [559, 663],
  雪线: [658, 354],
  龙眠海峡: [1242, 588],
  无尽洋: [1468, 592],
  天泣洋: [112, 640],
  永夜海域: [1042, 79],
  四海: [1350, 660],
}).map(([id, [x, y]]) => ({ id, x, y, realm: 'surface', kind: 'region' }));
const domainAnchors = [...regions, ...inscriptions];
const landmarks: AtlasAnchor[] = [
  { id: '问道峰', domain: '神州', x: 653, y: 441 },
  { id: '九曲天河', domain: '神州', x: 775, y: 371 },
  { id: '白虎天堑', domain: '西庚', x: 461, y: 411 },
  { id: '建木神树', domain: '东苍', x: 1148, y: 351 },
  { id: '赤霞花海', domain: '南炎', x: 607, y: 737 },
  { id: '汤谷灵泉', domain: '南炎', x: 832, y: 662 },
].map(item => ({ ...item, realm: 'surface', kind: 'site' }));
const knownPlaces = [...catalog.filter(item => item.kind !== 'portal' && item.kind !== 'region'), ...landmarks].sort(
  (a, b) => b.id.length - a.id.length,
);
const aliases: Record<string, string> = { ...MAP_ANCHOR_ALIASES, 下霄: '天渊' };
const domainNames = [...SPECIFIC_MAP_DOMAINS, ...Object.keys(aliases)].sort((a, b) => b.length - a.length);
const canonical = (name: string) => aliases[name] || name;
const domainIn = (text: string) =>
  domainNames.find(name => name === text) || domainNames.find(name => text.includes(name));
const partsOf = (text: string) =>
  text
    .normalize('NFKC')
    .split(/[·•/／：:—\s]+/)
    .filter(Boolean);
const placeKey = (text: string) => partsOf(text).join('/');
const layerRealm = (text: string): AtlasRealm | undefined =>
  /天层|天界|九霄|[上中下]霄/.test(text)
    ? 'sky'
    : /幽界|冥界|下层|地底|阴界/.test(text)
      ? 'underworld'
      : /地层|地界/.test(text)
        ? 'surface'
        : undefined;

/** Read-only map simulation: exact landmarks first, otherwise a stable, bounded estimate. */
export function resolveAtlasLocation(input: {
  currentLocation: string;
  currentDomain?: string;
  currentLayer?: string;
  locationDescription?: string;
}): AtlasLocation {
  const label = input.currentLocation?.trim() || '行踪未明';
  const domainText = input.currentDomain?.trim() || '';
  const layer = input.currentLayer?.trim() || '';
  const description = input.locationDescription?.trim() || '';
  let domain = canonical(domainIn(domainText) || domainIn(label) || domainIn(layer) || '');
  const explicitRealm = domainAnchors.find(item => item.id === domain)?.realm || layerRealm(domainText + layer);
  const compatible = (item: AtlasAnchor) =>
    (!domain || item.domain === domain) && (!explicitRealm || item.realm === explicitRealm);
  const parts = partsOf(label);
  const specificParts = parts.filter(
    part => canonical(part) !== domain && !/^(?:地界|天界|幽界|天层|地层|下层)$/.test(part),
  );
  const exact = knownPlaces.find(item => compatible(item) && placeKey(specificParts.join('/')) === placeKey(item.id));
  const named = exact || knownPlaces.find(item => compatible(item) && placeKey(label).includes(placeKey(item.id)));
  domain ||= named?.domain || '';
  const anchor = domainAnchors.find(item => item.id === domain);
  const realm: AtlasRealm = anchor?.realm || named?.realm || explicitRealm || 'surface';
  if (exact)
    return {
      realm,
      domain,
      label,
      anchor: { ...exact, key: anchor?.key || exact.key },
      precise: exact.kind !== 'sect',
      estimated: exact.kind === 'sect',
      referenceId: exact.id,
      basis:
        exact.kind === 'sect' ? '对应宗门的驻地或活动示意；设定未载精确坐标' : '对应图上已有地标；舆图本身为形势示意',
    };
  if (!anchor)
    return { realm, domain, label, precise: false, estimated: false, basis: '尚无可识别的所属地域，暂不落点' };
  if (
    !specificParts.length ||
    canonical(label) === domain ||
    /^(?:行踪未明|未知|未明|某地|待定|待初始化)$/.test(label)
  ) {
    const area = atlasArea(anchor);
    // Sky captions and the mirror-inset caption sit outside the geography.
    const center =
      realm === 'sky' || domain === '倒悬天墟'
        ? {
            x: area.reduce((sum, p) => sum + p[0], 0) / area.length,
            y: area.reduce((sum, p) => sum + p[1], 0) / area.length,
          }
        : { x: anchor.x, y: anchor.y };
    return {
      realm,
      domain,
      label,
      anchor: { ...anchor, ...center },
      precise: false,
      estimated: false,
      referenceId: domain,
      basis: '目前仅能确认所属地域，尚无具体地点',
    };
  }
  // A mention in scene prose is useful only when it explicitly describes proximity.
  // Distant destinations and the list of available routes do not establish location.
  const proximity = description.match(/(?:位于|坐落于?|地处|毗邻|紧邻|靠近|身处)[^。！？；\n]{0,45}/g)?.join(' ') || '';
  const nearby = named || knownPlaces.find(item => compatible(item) && proximity.includes(item.id));
  const stripReferences = (text: string) =>
    [...domainNames, ...(nearby ? [nearby.id] : [])]
      .sort((a, b) => b.length - a.length)
      .reduce((value, name) => value.replaceAll(name, ' '), text);
  const stableLabel = specificParts.join('/');
  const point = estimateAtlasPoint({
    label: stableLabel,
    clue: stripReferences(label),
    description: stripReferences(description),
    region: anchor,
    nearby,
    capital: knownPlaces.find(item => item.kind === 'city' && item.domain === domain),
  });
  return {
    realm,
    domain,
    label,
    precise: false,
    estimated: true,
    referenceId: nearby?.id || domain,
    basis: point.basis,
    anchor: { id: label, domain, realm, kind: 'site', key: anchor.key, x: point.x, y: point.y },
  };
}

/** Translate preview links to local viewer state; never navigate the Tavern page. */
export function parseAtlasLink(href: string): AtlasTarget | null {
  const match = /^(index|underworld|sky)\.html(?:#(.*))?$/.exec(href);
  if (!match) return null;
  let id: string | undefined;
  try {
    id = match[2] ? decodeURIComponent(match[2]) : undefined;
  } catch {
    return null;
  }
  return {
    realm: ({ index: 'surface', underworld: 'underworld', sky: 'sky' } as const)[
      match[1] as 'index' | 'underworld' | 'sky'
    ],
    id,
  };
}

export const realmLabels: Record<AtlasRealm, string> = { surface: '地界', underworld: '幽界', sky: '天界' };
