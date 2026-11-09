import type { AtlasRealm } from './types';

/** The embedded atlas uses the side margins for reference material, freeing its
 * drawing area from floating legends. The standalone SVG preview is unchanged. */
export function prepareAtlasLayout(root: ShadowRoot, data: { realm: AtlasRealm }) {
  const doc = root.ownerDocument;
  root.querySelector('.atlas-shell')!.classList.add('embedded-atlas');
  const sidebar = doc.createElement('aside');
  sidebar.className = 'atlas-sidebar';
  sidebar.setAttribute('aria-label', '山海地志');
  const guide = doc.createElement('div');
  guide.className = 'atlas-overview';
  const copy = {
    surface: [
      '地界 · 五域四海',
      '九野山海',
      '放大展开宗门驻地与山门细部，点选查阅势力地志。山门小于主城，图符随地图等比缩放；未定坐标为示意。',
    ],
    underworld: [
      '幽界 · 九泉五渊',
      '循脉入幽',
      '五渊极底通往镜面异界。放大查阅幽界势力；行舟与提灯人标示活动，不代表固定驻地。',
    ],
    sky: ['天界 · 上中下霄', '九霄悬天', '沿天渊仰观三霄。点选层级与遗迹，查阅登霄通路。'],
  }[data.realm];
  guide.innerHTML = `<span class="eyebrow">山海地志</span><h2>${copy[1]}</h2><small>${copy[0]}</small><p>${copy[2]}</p><div class="overview-rule"></div>`;
  guide.append(root.querySelector('#network-key')!);
  if (data.realm === 'underworld') {
    const passage = doc.createElement('div');
    passage.className = 'passage-key';
    passage.innerHTML =
      '<span>地表门户</span><i>↓</i><strong>幽界五渊</strong><i>↓ 极底逆泉</i><span>倒悬天墟 · 镜面阴界</span>';
    guide.append(passage);
  }
  sidebar.append(guide, root.querySelector('#detail')!);
  root.querySelector('.stage')!.append(sidebar);
  const reset = root.querySelector<HTMLButtonElement>('#reset')!;
  reset.textContent = '总览';
  reset.title = '回到山海总览（Home）';
  const toolbar = root.querySelector<HTMLElement>('.toolbar')!;
  const controls = root.querySelector<HTMLElement>('.layer-controls')!;
  controls.id = 'atlas-layer-controls';
  const menu = doc.createElement('button');
  menu.type = 'button';
  menu.className = 'layer-menu-button';
  menu.textContent = '图层';
  menu.setAttribute('aria-controls', controls.id);
  const toggle = (open: boolean) => {
    toolbar.classList.toggle('layer-menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
  };
  toggle(false);
  menu.addEventListener('click', () => toggle(menu.getAttribute('aria-expanded') !== 'true'));
  controls.addEventListener('click', () => toggle(false));
  toolbar.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      toggle(false);
      menu.focus();
    }
  });
  toolbar.append(menu);
}

/** Update only on settled camera/viewport changes, never during a gesture. */
export function createAtlasReadability(svg: SVGSVGElement) {
  const win = svg.ownerDocument.defaultView!;
  const labels = [...svg.querySelectorAll<SVGTextElement>('.capital-name,.portal text,.region-name,.minor-label')]
    .filter(node => !node.matches('.portal-caption,.region-name[data-base-size]'))
    .map(node => ({
      node,
      base: parseFloat(win.getComputedStyle(node).fontSize),
      minimum: node.matches('.region-name')
        ? node.closest('.sea')
          ? 18
          : 23
        : node.matches('.capital-name')
          ? 12
          : 10,
    }));
  return () => {
    if (!svg.getBoundingClientRect().width) return;
    const viewport = svg.closest<HTMLElement>('.map-viewport')!;
    const compact = viewport.clientWidth < 600 && (svg.getScreenCTM()?.a || 1) < 0.6;
    svg.classList.toggle('compact-overview', compact);
    // Measure all transforms before changing text sizes to avoid layout thrashing.
    const sizes = labels.map(({ node, base, minimum }) => {
      const m = node.getScreenCTM();
      const scale = m ? Math.hypot(m.a, m.b) : 1;
      const readable = compact && node.matches('.region-name') ? (node.closest('.sea') ? 15 : 20) : minimum;
      return `${Math.max(base, readable / Math.max(scale, 0.05)).toFixed(2)}px`;
    });
    labels.forEach(({ node }, i) => {
      if (node.style.fontSize !== sizes[i]) node.style.fontSize = sizes[i];
    });
  };
}
