export type AtlasRealm = 'surface' | 'underworld' | 'sky';
export type AtlasKind = 'region' | 'city' | 'site' | 'array' | 'portal' | 'sect';
export interface AtlasViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AtlasAnchor {
  id: string;
  domain?: string;
  realm: AtlasRealm;
  kind: AtlasKind;
  x: number;
  y: number;
  key?: string;
  view?: AtlasViewBox;
}
export interface AtlasLocation {
  realm: AtlasRealm;
  domain: string;
  label: string;
  precise: boolean;
  estimated: boolean;
  /** Explain the schematic placement without claiming surveyed coordinates. */
  basis: string;
  referenceId?: string;
  anchor?: AtlasAnchor;
}
export interface AtlasTarget {
  realm: AtlasRealm;
  id?: string;
}
export interface AtlasController {
  ready: Promise<void>;
  select: (id: string, focus?: boolean) => boolean;
  locate: (location: AtlasLocation, focus?: boolean) => void;
  dispose: () => void;
}
export interface AtlasOptions {
  navigate: (target: AtlasTarget) => void;
}
