import { parseAtlasLink } from './location';
import { createAtlasReadability } from './layout';
import type { AtlasController, AtlasLocation, AtlasOptions, AtlasViewBox } from './types';

interface Context {
  ready: Promise<void>;
  root: ShadowRoot;
  svg: SVGSVGElement;
  data: { realm: string } & Record<
    'regions' | 'sites' | 'capitals' | 'arrays' | 'portals' | 'sects',
    { id: string; x: number; y: number; key?: string; view?: AtlasViewBox }[]
  >;
  showDetail: (node: Element) => void;
  closeDetail: () => void;
  focusView: (view: AtlasViewBox) => void;
  setSkyLevel: (key: string) => void;
  scheduleLabels: () => void;
  cleanup: () => void;
}

export function bindAtlasIntegration(ctx: Context, options: AtlasOptions): AtlasController {
  const { root, svg } = ctx;
  const updateReadability = createAtlasReadability(svg);
  const abort = new AbortController();
  const nodes = [
    ...svg.querySelectorAll<SVGElement>('[data-region],[data-city],[data-site],[data-array],[data-portal],[data-sect]'),
  ];
  const findNode = (id: string) =>
    nodes.find(node => ['region', 'city', 'site', 'array', 'portal', 'sect'].some(key => node.dataset[key] === id));
  function select(id: string, focus = false) {
    const node = findNode(id);
    if (!node) return false;
    ctx.showDetail(node);
    if (focus) {
      const place = ['regions', 'sites', 'capitals', 'arrays', 'portals', 'sects']
        .flatMap(key => ctx.data[key as 'regions'] || [])
        .find(item => item.id === id);
      if (place?.view) ctx.focusView(place.view);
      else if (place) {
        const width = node.hasAttribute('data-city') ? 320 : 560;
        ctx.focusView({ x: place.x - width / 2, y: place.y - width / 3, w: width, h: width * 0.625 });
      }
    }
    return true;
  }
  root.addEventListener(
    'click',
    event => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a');
      if (!link) return;
      event.preventDefault();
      const target = parseAtlasLink(link.getAttribute('href') || '');
      if (target) options.navigate(target);
    },
    { signal: abort.signal },
  );

  // Geographic point stays fixed in world space; marker and caption stay readable.
  const ns = 'http://www.w3.org/2000/svg';
  const pin = root.ownerDocument.createElementNS(ns, 'g');
  pin.classList.add('traveler-pin');
  pin.setAttribute('role', 'img');
  pin.innerHTML =
    '<title></title><g class="pin-symbol"><circle class="pin-estimate" r="18"/><path class="pin-stem" fill="none" stroke="#c6e2b5" stroke-width="1"/><g class="pin-dot"><circle r="8" fill="#123b34" stroke="#bdd6a1" stroke-width="1.5"/><circle r="2.5" fill="#e4edc8"/></g><text text-anchor="middle"></text></g>';
  svg.append(pin);
  let location: AtlasLocation | undefined;
  let frame = 0;
  const setPinAttribute = (node: Element, name: string, value: string) => {
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  };
  const paintPin = () => {
    frame = 0;
    if (!root.host.clientWidth || !root.host.clientHeight) return;
    updateReadability();
    const anchor = location?.anchor;
    const visible = !!anchor && location?.realm === ctx.data.realm;
    pin.style.display = visible ? '' : 'none';
    if (!visible || !anchor) return;
    const scale = svg.getScreenCTM()?.a || 1;
    setPinAttribute(pin, 'transform', `translate(${anchor.x} ${anchor.y})`);
    setPinAttribute(pin.querySelector('.pin-symbol')!, 'transform', `scale(${1 / scale})`);
    const caption = pin.querySelector('text')!;
    // For real or estimated places the visible dot itself sits on the coordinate.
    // Only a broad region uses a leader to keep its title unobscured.
    const regionOnly = !location?.precise && !location?.estimated;
    setPinAttribute(pin.querySelector('.pin-dot')!, 'transform', regionOnly ? 'translate(0 -31)' : 'translate(0 0)');
    setPinAttribute(pin.querySelector('.pin-stem')!, 'd', regionOnly ? 'M0 0V-24' : 'M0-9V-20');
    setPinAttribute(caption, 'y', regionOnly ? '-47' : '-27');
    const name =
      location!.label
        .split(/[·•/／：:—]+/)
        .filter(Boolean)
        .at(-1) || location!.label;
    const shortName = name.length > 14 ? name.slice(0, 13) + '…' : name;
    const title = location?.estimated
      ? `${shortName} · 约位`
      : location?.precise
        ? `${shortName} · 此刻所在`
        : `${location!.domain} · 所在地域`;
    if (caption.textContent !== title) caption.textContent = title;
    const description = `${location!.label}：${location!.basis}`;
    if (pin.querySelector('title')!.textContent !== description) pin.querySelector('title')!.textContent = description;
    setPinAttribute(pin, 'aria-label', description);
    setPinAttribute(
      pin,
      'data-accuracy',
      location?.estimated ? 'estimated' : location?.precise ? 'landmark' : 'region',
    );
    pin.classList.toggle('is-estimated', !!location?.estimated);
    const level = svg.dataset.skyLevel;
    pin.style.opacity = anchor.key && level && level !== 'all' && level !== anchor.key ? '.15' : '1';
  };
  const schedulePin = () => {
    if (!frame) frame = requestAnimationFrame(paintPin);
  };
  const mutation = new MutationObserver(schedulePin);
  mutation.observe(svg, { attributes: true, attributeFilter: ['data-sky-level'] });
  svg.addEventListener('atlas-view-settled', schedulePin, { signal: abort.signal });
  const resize = new ResizeObserver(schedulePin);
  resize.observe(root.host);

  return {
    ready: ctx.ready,
    select,
    locate(next, focus = false) {
      location = next;
      if (focus && next.anchor && next.realm === ctx.data.realm) {
        ctx.setSkyLevel(next.anchor.key || 'all');
        if (!select(next.referenceId || next.anchor.id)) ctx.closeDetail();
        if (next.anchor.view) ctx.focusView(next.anchor.view);
        else ctx.focusView({ x: next.anchor.x - 290, y: next.anchor.y - 190, w: 580, h: 380 });
      }
      paintPin();
    },
    dispose() {
      abort.abort();
      mutation.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      ctx.cleanup();
      root.replaceChildren();
    },
  };
}
