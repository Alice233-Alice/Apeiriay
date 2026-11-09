import { createAtlasEncoder } from './encoder';

/** Separate immutable vector artwork from the small, interactive SVG overlay.
 * Self-contained SVG images preserve the original paths and local definitions.
 * Their fixed drawing sizes let the compositor reuse them throughout pan and zoom. */
export function createAtlasArtwork(
  svg: SVGSVGElement,
  width: number,
  height: number,
  canRefine: () => boolean = () => true,
  symbols: Record<string, string> = {},
) {
  const doc = svg.ownerDocument;
  const win = doc.defaultView!;
  const ns = 'http://www.w3.org/2000/svg';
  const layer = doc.createElement('div');
  layer.className = 'atlas-artwork';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  const definitions = [...svg.querySelector('defs')!.children];
  const styles = [...svg.querySelectorAll('style')].map(node => node.outerHTML).join('');
  const urls: string[] = [];
  const encoder = createAtlasEncoder();
  let disposed = false;
  let cancelIdle: (() => void) | undefined;
  // Refinement never holds up opening the map, nor competes with a drag/hidden tab.
  // Resolve pending work on disposal as well, so old realms retain no closures.
  const idle = () =>
    new Promise<boolean>(resolve => {
      let timer = 0;
      let handle = 0;
      const finish = (run: boolean) => {
        win.clearTimeout(timer);
        if (handle) win.cancelIdleCallback(handle);
        cancelIdle = undefined;
        resolve(run);
      };
      const check = () => {
        handle = 0;
        if (disposed) finish(false);
        else if (!canRefine() || doc.hidden) timer = win.setTimeout(schedule, 200);
        else finish(true);
      };
      const schedule = () => {
        if (win.requestIdleCallback) handle = win.requestIdleCallback(check, { timeout: 1000 });
        else timer = win.setTimeout(check, 50);
      };
      cancelIdle = () => finish(false);
      // Always leave a frame for the interactive preview before starting a job.
      timer = win.setTimeout(schedule, 100);
    });
  // Cache the browser's rendered SVG once, rather than asking it to tessellate
  // thousands of vector strokes again for every transform. These are temporary
  // in-memory display textures; exported artwork remains the original pure SVG.
  const cacheDrawing = async (img: HTMLImageElement, pixelWidth: number, pixelHeight: number) => {
    const sourceUrl = img.src;
    // Draw SVG with the window's fonts, then transfer pixels to the worker for
    // encoding. Neither the heavy SVG nor font availability changes in a worker.
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : doc.createElement('canvas');
    canvas.width = Math.ceil(pixelWidth);
    canvas.height = Math.ceil(pixelHeight);
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return;
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null;
    if ('convertToBlob' in canvas) {
      try {
        blob = await encoder.encode(canvas);
      } catch {
        if (disposed) return;
        // A host CSP or older browser may disallow workers. The source SVG is
        // still available if transferring the bitmap emptied the drawing buffer.
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await canvas.convertToBlob({ type: 'image/png' });
      }
    } else {
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    }
    canvas.width = canvas.height = 1;
    if (!blob || disposed) return;
    const url = win.URL.createObjectURL(blob);
    urls.push(url);
    img.src = url;
    await img.decode();
    win.URL.revokeObjectURL(sourceUrl);
  };

  // Include dependencies recursively: clip paths, gradients, masks and nested <use>.
  const dependencies = (markup: string) => {
    const selected = new Set<Element>();
    let pending = markup;
    while (pending) {
      const ids = new Set([
        ...[...pending.matchAll(/url\(#([^)]*)\)/g)].map(match => match[1]),
        ...[...pending.matchAll(/(?:href|xlink:href)="#([^"]+)"/g)].map(match => match[1]),
      ]);
      pending = '';
      for (const node of definitions) {
        if (selected.has(node) || !ids.has(node.id)) continue;
        selected.add(node);
        pending += node.outerHTML;
      }
    }
    return definitions.filter(node => selected.has(node));
  };
  const vectorSource = (markup: string, viewBox = `0 0 ${width} ${height}`) => {
    const defs = dependencies(markup)
      .map(node => node.outerHTML)
      .join('');
    return `<svg xmlns="${ns}" viewBox="${viewBox}" text-rendering="geometricPrecision"><defs>${defs}</defs>${styles}${markup}</svg>`;
  };
  const vectorUrl = (markup: string, viewBox = `0 0 ${width} ${height}`) => {
    const url = win.URL.createObjectURL(new Blob([vectorSource(markup, viewBox)], { type: 'image/svg+xml' }));
    urls.push(url);
    return url;
  };
  const dynamicIds = new Set([
    'region-outlines',
    'routes',
    'array-lines',
    'labels',
    'capitals',
    'sects',
    'portals',
    'array-nodes',
    'sites',
    'sky-sites',
    'sky-frame',
  ]);
  // The rift is itself clickable artwork, unlike the small label buttons. Keep its
  // outline as the hit target while caching all of its engraved paths underneath.
  const rift = svg.querySelector<SVGGElement>('#tianyuan-rift');
  const riftLayer = rift?.parentElement;
  const riftOutline = rift?.querySelector(':scope > path')?.cloneNode(true) as SVGPathElement | undefined;
  if (riftOutline) {
    riftOutline.setAttribute('fill', 'transparent');
    riftOutline.setAttribute('stroke', 'none');
    riftOutline.style.pointerEvents = 'all';
  }
  const staticNodes = [...svg.children].filter(
    node =>
      !['defs', 'style', 'title', 'desc'].includes(node.tagName) &&
      !dynamicIds.has(node.id) &&
      !node.matches('.cartography-annotation,.annotation,.traveler-pin') &&
      !node.matches('[data-region],[data-site],[data-portal],[data-array],[data-city],[data-sect]') &&
      (!node.querySelector('[data-region],[data-site],[data-portal],[data-array],[data-city],[data-sect]') ||
        (node === riftLayer && !!riftOutline)),
  );
  const groups: { key: string; nodes: Element[] }[] = [];
  for (const node of staticNodes) {
    const key = node.getAttribute('data-stratum') || '';
    if (groups.at(-1)?.key === key) groups.at(-1)!.nodes.push(node);
    else groups.push({ key, nodes: [node] });
  }
  const boundsOf = (nodes: Element[]) => {
    let left = width,
      top = height,
      right = 0,
      bottom = 0;
    for (const node of nodes) {
      const graphic = node as SVGGraphicsElement;
      const bounds = graphic.getBBox();
      const matrix = graphic.transform.baseVal.consolidate()?.matrix;
      for (const [x, y] of [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x, bounds.y + bounds.height],
        [bounds.x + bounds.width, bounds.y + bounds.height],
      ]) {
        const point = new DOMPoint(x, y);
        const p = matrix ? point.matrixTransform(matrix) : point;
        left = Math.min(left, p.x);
        top = Math.min(top, p.y);
        right = Math.max(right, p.x);
        bottom = Math.max(bottom, p.y);
      }
    }
    left = Math.max(0, left - 12);
    top = Math.max(0, top - 12);
    right = Math.min(width, right + 12);
    bottom = Math.min(height, bottom + 12);
    return { x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top) };
  };
  // City symbols are also immutable vector drawings (roughly 2,000 paths each).
  // Keep their original IDs so both map <use> and the city detail illustration work.
  const capitals = definitions
    .filter(node => node.id.startsWith('capital-'))
    .map(node => {
      const image = doc.createElementNS(ns, 'image');
      image.setAttribute('x', '-128');
      image.setAttribute('y', '-140');
      image.setAttribute('width', '256');
      image.setAttribute('height', '220');
      const url = vectorUrl(symbols[node.id] ?? node.innerHTML, '-128 -140 256 220');
      image.setAttribute('href', url);
      const preload = doc.createElement('img');
      preload.src = url;
      return { node, image, preload };
    });
  // One shared sheet for all miniature compounds, rather than hundreds of live
  // roof strokes per site or a separate texture/encode job for every faction.
  const sects = definitions.filter(node => node.hasAttribute('data-sect-art'));
  const columns = Math.ceil(Math.sqrt(sects.length));
  const rows = Math.ceil(sects.length / columns);
  const sectSheet = sects.length ? doc.createElement('img') : undefined;
  if (sectSheet) {
    sectSheet.src = vectorUrl(
      sects
        .map(
          (node, i) =>
            `<g transform="translate(${(i % columns) * 160 + 80} ${Math.floor(i / columns) * 160 + 96})">${symbols[node.id] ?? node.innerHTML}</g>`,
        )
        .join(''),
      `0 0 ${columns * 160} ${rows * 160}`,
    );
  }
  // City/sect definitions account for most of the live SVG tree. Detach them
  // before measuring terrain so the first layout doesn't traverse every roof.
  // Keep the originals until the preview succeeds, for the vector fallback.
  const originalSymbols = [...capitals.map(item => item.node), ...sects].map(node => {
    const children = doc.createDocumentFragment();
    children.append(...node.childNodes);
    return { node, children };
  });
  const planeBounds = groups.map(group => boundsOf(group.nodes));
  const sources: HTMLImageElement[] = [];
  const planes = groups.map((group, index) => {
    const bounds = planeBounds[index];
    const plane = doc.createElement('canvas');
    plane.className = 'atlas-artwork-plane';
    if (group.key) plane.dataset.stratum = group.key;
    plane.style.left = `${(bounds.x / width) * 100}%`;
    plane.style.top = `${(bounds.y / height) * 100}%`;
    plane.style.width = `${(bounds.w / width) * 100}%`;
    plane.style.height = `${(bounds.h / height) * 100}%`;
    const source = doc.createElement('img');
    source.decoding = 'async';
    source.src = vectorUrl(
      group.nodes.map(node => node.outerHTML).join(''),
      `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`,
    );
    sources.push(source);
    layer.append(plane);
    return plane;
  });
  const syncStrata = () => {
    const key = svg.dataset.skyLevel;
    planes.forEach(plane => {
      plane.style.opacity =
        key && key !== 'all' && plane.dataset.stratum && plane.dataset.stratum !== key ? '.12' : '1';
    });
  };
  const observer = new win.MutationObserver(syncStrata);
  observer.observe(svg, { attributes: true, attributeFilter: ['data-sky-level'] });
  const totalArea = planeBounds.reduce((area, bounds) => area + bounds.w * bounds.h, 0);
  const pixelScale = Math.min(5120 / Math.max(width, height), Math.sqrt(16_000_000 / totalArea));
  const previewScale = Math.min(pixelScale, 2048 / Math.max(width, height), Math.sqrt(2_000_000 / totalArea));
  const drawPlane = (index: number, scale: number) => {
    const previous = planes[index];
    const plane = previous.cloneNode(false) as HTMLCanvasElement;
    const context = plane.getContext('2d');
    if (!context) throw new Error('Atlas canvas unavailable');
    const bounds = planeBounds[index];
    plane.width = Math.ceil(bounds.w * scale);
    plane.height = Math.ceil(bounds.h * scale);
    try {
      context.drawImage(sources[index], 0, 0, plane.width, plane.height);
    } catch (error) {
      plane.width = plane.height = 1;
      throw error;
    }
    // Swap only after drawing succeeds; a failed refinement must not erase the
    // already usable preview by resizing its canvas to an empty buffer.
    previous.replaceWith(plane);
    previous.width = previous.height = 1;
    planes[index] = plane;
  };
  const sectImages: SVGImageElement[] = [];
  const refine = async () => {
    try {
      // Draw directly into the display canvas: no full-map PNG encode/decode round
      // trip, and no repeated SVG tessellation on every wheel notch afterwards.
      for (let index = 0; index < planes.length; index++) {
        if (!(await idle())) return;
        drawPlane(index, pixelScale);
      }
      sources.forEach(source => {
        win.URL.revokeObjectURL(source.src);
        source.removeAttribute('src');
      });
      for (const capital of capitals) {
        if (!(await idle())) return;
        await capital.preload.decode();
        if (disposed) return;
        await cacheDrawing(capital.preload, 1024, 880);
        if (disposed) return;
        capital.image.setAttribute('href', capital.preload.src);
      }
      if (sectSheet) {
        if (!(await idle())) return;
        await sectSheet.decode();
        if (disposed) return;
        await cacheDrawing(sectSheet, columns * 384, rows * 384);
        if (disposed) return;
        sectImages.forEach(image => image.setAttribute('href', sectSheet.src));
      }
      svg.dataset.artwork = 'cached';
    } catch {
      // The usable preview (and vector city symbols) remains on screen if optional
      // high-resolution caching is unsupported or a realm has been disposed.
    } finally {
      encoder.dispose();
    }
  };
  const ready = Promise.all(sources.map(img => img.decode()))
    .then(() => {
      if (disposed) return;
      planes.forEach((_, index) => drawPlane(index, previewScale));
      layer.style.background = svg.style.background;
      svg.style.background = 'transparent';
      staticNodes.forEach(node => {
        if (node === riftLayer && rift && riftOutline) {
          rift.replaceChildren(riftOutline);
          node.replaceChildren(rift);
        } else node.remove();
      });
      capitals.forEach(({ node, image }) => node.replaceChildren(image));
      sects.forEach((node, i) => {
        const crop = doc.createElementNS(ns, 'svg');
        crop.setAttribute('x', '-80');
        crop.setAttribute('y', '-96');
        crop.setAttribute('width', '160');
        crop.setAttribute('height', '160');
        crop.setAttribute('viewBox', `${(i % columns) * 160} ${Math.floor(i / columns) * 160} 160 160`);
        crop.setAttribute('overflow', 'hidden');
        const image = doc.createElementNS(ns, 'image');
        image.setAttribute('width', String(columns * 160));
        image.setAttribute('height', String(rows * 160));
        image.setAttribute('href', sectSheet!.src);
        sectImages.push(image);
        crop.append(image);
        node.replaceChildren(crop);
      });
      const live =
        [...svg.children]
          .filter(node => node.tagName !== 'defs')
          .map(node => node.outerHTML)
          .join('') + capitals.map(({ node }) => `<use href="#${node.id}"/>`).join('');
      const used = new Set(dependencies(live));
      definitions.forEach(node => {
        if (!used.has(node)) node.remove();
      });
      syncStrata();
      layer.hidden = false;
      svg.dataset.artwork = 'preview';
      // Do not retain the detached original terrain after the cache takes over.
      staticNodes.length = 0;
      definitions.length = 0;
      groups.length = 0;
      originalSymbols.length = 0;
      void refine();
    })
    .catch(() => {
      // Retain the original SVG intact if the browser cannot decode local SVG images.
      if (!disposed) {
        originalSymbols.forEach(({ node, children }) => {
          if (symbols[node.id]) node.innerHTML = symbols[node.id];
          else node.replaceChildren(children);
        });
        svg.dataset.artwork = 'inline';
      }
      encoder.dispose();
    });
  return {
    layer,
    ready,
    dispose() {
      disposed = true;
      cancelIdle?.();
      encoder.dispose();
      observer.disconnect();
      urls.forEach(url => win.URL.revokeObjectURL(url));
      planes.forEach(plane => (plane.width = plane.height = 1));
      sources.forEach(source => source.removeAttribute('src'));
    },
  };
}
