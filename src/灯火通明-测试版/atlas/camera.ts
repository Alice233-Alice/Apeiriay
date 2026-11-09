import type { AtlasViewBox } from './types';
import { createAtlasArtwork } from './artwork';

export function fitAtlasCamera(box: AtlasViewBox, width: number, height: number) {
  const scale = Math.min(width / box.w, height / box.h);
  return { scale, x: (width - box.w * scale) / 2 - box.x * scale, y: (height - box.h * scale) / 2 - box.y * scale };
}

/** Pan and zoom cached vector artwork independently from the interactive SVG.
 * Terrain keeps a stable drawing size even after gestures; only the small overlay rebases. */
export function createAtlasCamera(
  svg: SVGSVGElement,
  viewport: HTMLElement,
  mapWidth: number,
  mapHeight: number,
  onZoom: (zoom: number) => void,
  onSettled: () => void,
  overview: AtlasViewBox = { x: 0, y: 0, w: mapWidth, h: mapHeight },
  symbols: Record<string, string> = {},
) {
  const doc = svg.ownerDocument;
  const win = doc.defaultView!;
  // Chrome otherwise requests a different hinted font for every fractional zoom
  // step, forcing SVG text layout even when only an ancestor transform changes.
  svg.style.textRendering = 'geometricPrecision';
  const layer = doc.createElement('div');
  layer.className = 'atlas-camera';
  svg.before(layer);
  layer.append(svg);
  const artwork = createAtlasArtwork(svg, mapWidth, mapHeight, () => !active && viewport.clientWidth > 0, symbols);
  layer.before(artwork.layer);
  const shield = doc.createElement('div');
  shield.className = 'atlas-gesture-shield';
  shield.setAttribute('aria-hidden', 'true');
  layer.after(shield);
  let box = { ...overview };
  let width = 1,
    height = 1,
    screenX = 0,
    screenY = 0,
    screenRatioX = 1,
    screenRatioY = 1;
  let rasterScale = 0,
    artworkScale = 0,
    frame = 0,
    timer = 0,
    active = false,
    held = false,
    disposed = false;
  let settledView = '';
  const readViewport = () => {
    // v-show preserves the atlas between tabs. Ignore its temporary zero size so
    // returning to it doesn't collapse the camera or invalidate label placement.
    if (!viewport.clientWidth || !viewport.clientHeight) return false;
    const bounds = viewport.getBoundingClientRect();
    width = Math.max(1, viewport.clientWidth);
    height = Math.max(1, viewport.clientHeight);
    screenX = bounds.left;
    screenY = bounds.top;
    screenRatioX = bounds.width / width || 1;
    screenRatioY = bounds.height / height || 1;
    return true;
  };
  const zoom = () => fitAtlasCamera(box, width, height).scale / fitAtlasCamera(overview, width, height).scale;
  const paint = () => {
    frame = 0;
    if (disposed) return;
    const view = fitAtlasCamera(box, width, height);
    layer.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale / rasterScale})`;
    artwork.layer.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale / artworkScale})`;
    onZoom(zoom());
  };
  const queuePaint = () => {
    if (!frame) frame = win.requestAnimationFrame(paint);
  };
  const commit = () => {
    timer = 0;
    if (disposed) return;
    if (held) {
      queuePaint();
      return;
    }
    active = false;
    shield.style.pointerEvents = 'none';
    shield.style.cursor = '';
    const scale = fitAtlasCamera(box, width, height).scale;
    if (Math.abs(scale - rasterScale) > 0.00001) {
      rasterScale = scale;
      layer.style.width = `${mapWidth * scale}px`;
      layer.style.height = `${mapHeight * scale}px`;
    }
    if (frame) win.cancelAnimationFrame(frame);
    paint();
    const signature = `${box.x},${box.y},${box.w},${box.h},${width},${height}`;
    if (signature !== settledView) {
      settledView = signature;
      onSettled();
    }
  };
  const deferCommit = (delay = 280) => {
    win.clearTimeout(timer);
    timer = win.setTimeout(commit, delay);
  };
  readViewport();
  // A bounded, stable texture budget avoids reallocating the whole terrain on each
  // wheel notch. Original SVG files remain intact; display textures are ephemeral.
  const dpr = win.devicePixelRatio || 1;
  artworkScale = Math.min(
    Math.min(width / mapWidth, height / mapHeight) * 6,
    5120 / (Math.max(mapWidth, mapHeight) * dpr),
    Math.sqrt(12_000_000 / (mapWidth * mapHeight)) / dpr,
  );
  artwork.layer.style.width = `${mapWidth * artworkScale}px`;
  artwork.layer.style.height = `${mapHeight * artworkScale}px`;
  rasterScale = fitAtlasCamera(box, width, height).scale;
  layer.style.width = `${mapWidth * rasterScale}px`;
  layer.style.height = `${mapHeight * rasterScale}px`;
  // A fixed SVG viewBox means no subtree-wide relayout during either panning or scaling.
  svg.setAttribute('viewBox', `0 0 ${mapWidth} ${mapHeight}`);
  const resize = new win.ResizeObserver(() => {
    if (disposed) return;
    if (!readViewport()) return;
    if (active) queuePaint();
    else commit();
  });
  resize.observe(viewport);
  return {
    ready: artwork.ready,
    get interacting() {
      return active;
    },
    get viewport() {
      return { width, height };
    },
    get scale() {
      return fitAtlasCamera(box, width, height).scale * screenRatioX;
    },
    zoom,
    prepare() {
      if (!active) readViewport();
    },
    screenToWorld(x: number, y: number) {
      const view = fitAtlasCamera(box, width, height);
      return {
        x: ((x - screenX) / screenRatioX - view.x) / view.scale,
        y: ((y - screenY) / screenRatioY - view.y) / view.scale,
      };
    },
    interact(hold = false) {
      if (!active) readViewport();
      active = true;
      held ||= hold;
      shield.style.pointerEvents = 'auto';
      if (hold) shield.style.cursor = 'grabbing';
      deferCommit();
    },
    release() {
      held = false;
      deferCommit(90);
    },
    setView(next: AtlasViewBox) {
      box = { ...next };
      if (active) {
        queuePaint();
        deferCommit();
      } else {
        if (frame) win.cancelAnimationFrame(frame);
        frame = win.requestAnimationFrame(() => {
          frame = 0;
          commit();
        });
      }
    },
    dispose() {
      disposed = true;
      artwork.dispose();
      resize.disconnect();
      win.cancelAnimationFrame(frame);
      win.clearTimeout(timer);
    },
  };
}
