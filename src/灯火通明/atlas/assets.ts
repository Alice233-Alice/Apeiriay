import manifest from '../../../assets/atlas/manifest.json';
import release from './generated/release';
import type { AtlasRealm } from './types';

type AtlasAsset = { markup: string; data: Record<string, unknown> };
const assetBase = `https://cdn.jsdelivr.net/gh/${manifest.repository}@${release}/assets/atlas/`;

async function fetchAtlas(realm: AtlasRealm, signal?: AbortSignal): Promise<Response> {
  const resource = manifest.realms[realm];
  const timeout = AbortSignal.timeout(20_000);
  const response = await fetch(assetBase + resource.file, {
    cache: 'force-cache',
    credentials: 'omit',
    integrity: resource.integrity,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`Atlas download failed (${response.status})`);
  return response;
}

export async function loadAtlas(realm: AtlasRealm, signal?: AbortSignal): Promise<AtlasAsset> {
  const response = await fetchAtlas(realm, signal);
  signal?.throwIfAborted();
  if (!response.body) throw new Error('Atlas response body is empty');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const asset = JSON.parse(await new Response(stream).text()) as AtlasAsset;
  signal?.throwIfAborted();
  if (typeof asset.markup !== 'string' || asset.data?.realm !== realm) throw new Error('Atlas resource is invalid');
  // The browser caches compressed files. Decoded SVG/data belong only to the active controller.
  return asset;
}

/** Warm the browser's HTTP cache after the interface is ready; do not decode or mount maps here. */
export function scheduleAtlasPrefetch(realm: AtlasRealm): () => void {
  const abort = new AbortController();
  let idle: number | undefined;
  const download = () => {
    void fetchAtlas(realm, abort.signal)
      .then(response => response.arrayBuffer())
      .catch(() => {});
  };
  const timer = window.setTimeout(() => {
    if (window.requestIdleCallback) idle = window.requestIdleCallback(download, { timeout: 2000 });
    else download();
  }, 800);
  return () => {
    window.clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    abort.abort();
  };
}
