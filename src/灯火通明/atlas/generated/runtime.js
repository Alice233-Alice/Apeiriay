// Generated from preview-shell.html by export-frontend.mjs. Edit the preview controller at its source.
/* eslint-disable */
import { bindAtlasIntegration } from '../integration';
import { createAtlasCamera } from '../camera';
import { prepareAtlasLayout } from '../layout';
export function mountAtlas(root, atlasData, options) {
  prepareAtlasLayout(root, atlasData);
  const owner = root.ownerDocument;
  const frames = new Set(), observers = [], events = new AbortController();
  const requestAnimationFrame = callback => {
    const id = globalThis.requestAnimationFrame(time => { frames.delete(id); callback(time); });
    frames.add(id); return id;
  };
  const ResizeObserver = class extends globalThis.ResizeObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  const document = {
    body: root.querySelector('.atlas-shell'), documentElement: root.host,
    querySelector: selector => root.querySelector(selector),
    querySelectorAll: selector => root.querySelectorAll(selector),
    getElementById: id => root.getElementById(id),
    createElement: tag => owner.createElement(tag),
    addEventListener: (type, listener) => root.addEventListener(type, listener, { signal: events.signal }),
    get fullscreenElement() { return owner.fullscreenElement; },
    exitFullscreen: () => owner.exitFullscreen(),
  };

    /* ATLAS_CAMERA */
    
    const isUnderworld=atlasData.realm==='underworld';
    const isSky=atlasData.realm==='sky',isLayered=isUnderworld||isSky;
    const hasSects=!!atlasData.sects?.length,maxZoom=hasSects?12:6;
    document.querySelector('#toggle-sects').hidden=!hasSects;
    document.body.classList.toggle('underworld',isUnderworld);
    document.body.classList.toggle('sky',isSky);
    document.querySelector(`[data-realm="${atlasData.realm||'surface'}"]`).setAttribute('aria-current','page');
    const svg = document.querySelector('#atlas');
    if(hasSects)svg.dataset.sectLevel='0';
    const detail = document.querySelector('#detail');
    const intro = document.querySelector('#intro');
    const networkKey = document.querySelector('#network-key');
    const interactionSelector='[data-region],[data-portal],[data-city],[data-array],[data-site],[data-sect]';
    let selectedCity=null;
    let selectedPlace=null;
    if(isLayered){
      document.querySelector('.chapter').textContent=atlasData.chapter;
      document.querySelector('#toggle-arrays').hidden=true;
      document.querySelector('#capital-study-link').hidden=true;
      document.querySelector('[data-layer="routes"]').textContent='渊途';
      document.querySelector('#svg-download').href='underworld-atlas.svg';
      document.querySelector('#svg-download').download='幽界五渊舆图.svg';
      document.querySelector('.detail-foot span').textContent='九泉地志 · 幽界卷';
      document.querySelector('#focus-capital').textContent='放大此处';
      networkKey.hidden=true;intro.hidden=false;
      intro.querySelector('strong').textContent='循脉入九泉，照影见五渊。';
      intro.querySelector('span').textContent='点选渊域与遗迹 · 放大查看深层地志';
    }
    if(isSky){
      document.querySelector('#sky-navigation').hidden=false;
      document.querySelector('[data-layer="routes"]').textContent='登霄通路';
      document.querySelector('#svg-download').href='sky-atlas.svg';
      document.querySelector('#svg-download').download='九霄悬天长卷.svg';
      document.querySelector('.detail-foot span').textContent='九霄地志 · 天界卷';
      document.querySelector('.interaction-hint').textContent='滚轮缩放 · 拖动巡览 · 分层近观';
    }
    const mapWidth=svg.viewBox.baseVal.width,mapHeight=svg.viewBox.baseVal.height,mapRatio=mapWidth/mapHeight;
    const overview=atlasData.overview||{x:0,y:0,w:mapWidth,h:mapHeight};
    let box = {...overview};
    let drag = null;
    let lastDragged = false;
    const pointers = new Map();
    let pinch = null;
    let selectedTrigger = null;
    const regionOutlines=new Map([...svg.querySelectorAll('[data-region-outline]')].map(node=>[node.dataset.regionOutline,node]));
    let previewRegion=null;
    function previewOutline(node){
      const next=node?.closest?.('.region[data-region]')?.dataset.region;
      if(next===previewRegion)return;
      regionOutlines.get(previewRegion)?.classList.remove('is-preview');
      previewRegion=next;
      regionOutlines.get(next)?.classList.add('is-preview');
    }
    svg.addEventListener('pointerover',e=>{if(!e.buttons&&!camera.interacting&&e.pointerType!=='touch')previewOutline(e.target);});
    svg.addEventListener('pointerout',e=>previewOutline(e.relatedTarget));
    svg.addEventListener('focusin',e=>{if(e.target.matches(':focus-visible'))previewOutline(e.target);});
    svg.addEventListener('focusout',()=>previewOutline(null));
    const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
    const viewport=document.querySelector('.map-viewport');
    const zoomValue=document.querySelector('#zoom-value'),zoomIn=document.querySelector('#zoom-in'),zoomOut=document.querySelector('#zoom-out');
    const camera=createAtlasCamera(svg,viewport,mapWidth,mapHeight,value=>{
      const label=Math.round(value*100)+'%';if(zoomValue.textContent!==label)zoomValue.textContent=label;
      zoomIn.disabled=value>=maxZoom-.01;zoomOut.disabled=value<=1.001;
    },()=>{
      svg.classList.toggle('detailed',currentZoom()>=1.7);
      svg.dataset.cameraView=JSON.stringify(box);
      svg.dispatchEvent(new CustomEvent('atlas-view-settled'));
      scheduleLabels();
    },overview,atlasData.symbols);
    const svgPoint=(x,y)=>{camera.prepare();return camera.screenToWorld(x,y);};
    function currentZoom(){return camera.zoom();}
    function render() {
      const xs=[-box.w*.08,mapWidth-box.w*.92],ys=[-box.h*.08,mapHeight-box.h*.92];
      box.x=clamp(box.x,Math.min(...xs),Math.max(...xs));box.y=clamp(box.y,Math.min(...ys),Math.max(...ys));
      camera.setView(box);
    }
    function zoom(factor,point={x:box.x+box.w/2,y:box.y+box.h/2}) {
      camera.interact();
      const next=clamp(currentZoom()*factor,1,maxZoom),ratio=currentZoom()/next;
      box=next<=1.001?{...overview}:{x:point.x-(point.x-box.x)*ratio,y:point.y-(point.y-box.y)*ratio,w:box.w*ratio,h:box.h*ratio};render();
    }
    let labelFrame=0;
    const siteLabelCache=[...svg.querySelectorAll('.site-label')].map(el=>({el,caption:el.querySelector('text'),node:el.closest('[data-site]')}));
    const regionNameCache=[...svg.querySelectorAll('.region-name')];
    const portalCaptionCache=[...svg.querySelectorAll('.portal-caption')].map(el=>({el,node:el.closest('.portal'),marker:el.closest('.portal').querySelector('circle'),leader:el.closest('.portal').querySelector('.portal-leader')}));
    const obstacleCache=[...svg.querySelectorAll('.region .label-hit,.region-name,.portal-caption,.mirror-caption')];
    function scheduleLabels(){if((isLayered||hasSects)&&!camera.interacting&&!labelFrame)labelFrame=requestAnimationFrame(()=>{labelFrame=0;if(!camera.interacting){if(isLayered)layoutLabels();layoutSects();}});}
    const sectLabels=[...svg.querySelectorAll('[data-sect]')].map(node=>({node,label:node.querySelector('.sect-label'),caption:node.querySelector('text'),leader:node.querySelector('.sect-leader')}));
    const sectObstacles=[...svg.querySelectorAll('.region-name,.region-sub,.capital-name,.node-label,.minor-label,.portal text,.site-label text')];
    function layoutSects(){
      if(!hasSects||!viewport.clientWidth||!viewport.clientHeight)return;
      const scale=svg.getScreenCTM()?.a||1,level=currentZoom()<1.6||scale<.65?0:scale<1.5?1:2;
      svg.dataset.sectLevel=String(level);
      const hidden=!level||svg.classList.contains('hide-sects'),bounds=viewport.getBoundingClientRect();
      const showNames=!hidden&&!svg.classList.contains('hide-place-labels');
      // Batch writes and measurements. Trying each candidate in the DOM caused
      // one synchronous SVG layout per candidate after every wheel notch.
      sectLabels.forEach(({node,label,caption})=>{
        node.setAttribute('tabindex',hidden?'-1':'0');node.setAttribute('aria-hidden',String(hidden));
        label.classList.toggle('label-visible',showNames);
        if(!showNames)return;
        caption.style.fontSize=(node.classList.contains('selected')?14:12)/scale+'px';caption.style.letterSpacing=.6/scale+'px';caption.style.strokeWidth=2.6/scale+'px';
        caption.setAttribute('x','0');caption.setAttribute('y','0');caption.setAttribute('text-anchor','start');
      });
      if(hidden||svg.classList.contains('hide-place-labels'))return;
      const occupied=[...sectObstacles,...svg.querySelectorAll('.traveler-pin text')].filter(el=>getComputedStyle(el).display!=='none'&&!el.closest('.is-muted')).map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
      const ordered=sectLabels.map(item=>({...item,origin:new DOMPoint(0,0).matrixTransform(item.node.getScreenCTM()),size:item.caption.getBBox(),priority:Number(item.node.matches('.selected,:hover,:focus-visible'))})).sort((a,b)=>b.priority-a.priority);
      const placements=[];
      for(const item of ordered){
        const {origin,size}=item;
        if(origin.x<bounds.left||origin.x>bounds.right||origin.y<bounds.top||origin.y>bounds.bottom)continue;
        for(const [side,dy]of[[1,20],[-1,20],[1,-22],[-1,-22]]){
          const x=side*11,y=dy;
          const left=origin.x+(x+size.x-(side===-1?size.width:0))*scale,top=origin.y+(y+size.y)*scale;
          const r={left,top,right:left+size.width*scale,bottom:top+size.height*scale};
          if(r.left<bounds.left+6||r.right>bounds.right-6||r.top<bounds.top+6||r.bottom>bounds.bottom-55)continue;
          if(occupied.some(b=>r.left<b.right+4&&r.right>b.left-4&&r.top<b.bottom+4&&r.bottom>b.top-4))continue;
          placements.push({...item,x,y,side});occupied.push(r);break;
        }
      }
      const placed=new Set(placements.map(item=>item.label));
      sectLabels.forEach(({label})=>label.classList.toggle('label-visible',placed.has(label)));
      placements.forEach(({caption,leader,x,y,side})=>{caption.setAttribute('x',x);caption.setAttribute('y',y);caption.setAttribute('text-anchor',side===1?'start':'end');leader.setAttribute('d',`M0 ${y>0?8:-8}V${y-3}H${x-side*3}`);});
    }
    function layoutLabels(){
      if(!viewport.clientWidth||!viewport.clientHeight)return;
      const screenScale=svg.getScreenCTM().a;
      const fontSize=Math.max(10,10/screenScale).toFixed(2)+'px';
      const bounds=viewport.getBoundingClientRect();
      // Apply font changes together, measure together, then update visibility once.
      siteLabelCache.forEach(({caption})=>{if(caption.style.fontSize!==fontSize)caption.style.fontSize=fontSize;});
      if(isSky){
        svg.classList.toggle('compact-sky',screenScale<.5);
        regionNameCache.forEach(el=>{const size=Math.max(Number(el.dataset.baseSize||35),(el.dataset.baseSize==='56'?21:16)/screenScale).toFixed(2)+'px';if(el.style.fontSize!==size)el.style.fontSize=size;});
        portalCaptionCache.forEach(({el})=>{
          const value=screenScale<.65?el.dataset.shortLabel:el.dataset.fullLabel;
          if(el.textContent!==value)el.textContent=value;
          const size=Math.max(11,9/screenScale).toFixed(2)+'px';if(el.style.fontSize!==size)el.style.fontSize=size;
          const baseY=Number(el.dataset.baseY||el.getAttribute('y'));el.setAttribute('y',baseY);
          el.setAttribute('text-anchor','middle');
        });
        const measured=portalCaptionCache.map(item=>({...item,rect:item.el.getBoundingClientRect(),markerRect:item.marker.getBoundingClientRect()}));
        measured.forEach(({el,node,leader,rect:r,markerRect:marker})=>{
          if(r.left<bounds.left+8)el.setAttribute('text-anchor','start');
          else if(r.right>bounds.right-8)el.setAttribute('text-anchor','end');
          if(!node.closest('.is-muted')&&marker.right>bounds.left&&marker.left<bounds.right&&marker.top>bounds.top&&marker.bottom<bounds.bottom&&r.bottom>bounds.bottom-60){el.setAttribute('y',Number(el.getAttribute('y'))-(r.bottom-bounds.bottom+60)/screenScale);}
          if(leader)leader.setAttribute('d',`M${leader.dataset.startX} ${leader.dataset.startY}L${el.getAttribute('x')} ${Number(el.getAttribute('y'))-18}`);
        });
      }
      if(svg.classList.contains('hide-place-labels'))return;
      const overlaps=(a,b,p=5)=>a.left<b.right+p&&a.right>b.left-p&&a.top<b.bottom+p&&a.bottom>b.top-p;
      const obstacles=obstacleCache.filter(el=>getComputedStyle(el).display!=='none'&&!el.closest('.is-muted')).map(el=>el.getBoundingClientRect());
      const zoom=currentZoom();
      const candidates=siteLabelCache.map(item=>({...item,priority:item.node.classList.contains('selected')?1000:item.node.matches(':hover,:focus-visible')?900:Number(item.node.dataset.priority||0)})).filter(v=>!v.node.closest('.is-muted')&&(zoom>=1.7||v.priority>=900||isSky&&svg.dataset.skyLevel&&svg.dataset.skyLevel!=='all')).sort((a,b)=>b.priority-a.priority).map(item=>({...item,rect:item.caption.getBoundingClientRect()}));
      const visible=new Set();
      for(const c of candidates){const r=c.rect;if(r.left<bounds.left+6||r.right>bounds.right-6||r.top<bounds.top+8||r.bottom>bounds.bottom-55)continue;if(obstacles.some(b=>overlaps(r,b)))continue;visible.add(c.el);obstacles.push(r);}
      siteLabelCache.forEach(({el})=>el.classList.toggle('label-visible',visible.has(el)));
    }
    function focusView(view){const viewport=document.querySelector('.map-viewport').getBoundingClientRect(),ratio=isSky?viewport.width/viewport.height:mapRatio;const width=Math.max(view.w,view.h*ratio);box={x:view.x+view.w/2-width/2,y:view.y+view.h/2-width/ratio/2,w:width,h:width/ratio};render();}
    if(isLayered||hasSects){const siteHover=e=>{if(e.target.closest('[data-site],[data-sect]'))scheduleLabels();};svg.addEventListener('pointerover',siteHover);svg.addEventListener('pointerout',siteHover);svg.addEventListener('focusin',scheduleLabels);svg.addEventListener('focusout',scheduleLabels);}
    function setSkyLevel(key){
      if(!isSky)return;
      svg.dataset.skyLevel=key;
      svg.querySelectorAll('[data-stratum]').forEach(el=>{const muted=key!=='all'&&el.dataset.stratum!==key;el.classList.toggle('is-muted',muted);el.querySelectorAll('[tabindex]').forEach(node=>node.setAttribute('tabindex',muted?'-1':'0'));});
      document.querySelectorAll('[data-sky-level]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.skyLevel===key)));
      scheduleLabels();
    }
    document.querySelectorAll('[data-sky-level]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.skyLevel;
      if(key==='all'){closeDetail();setSkyLevel('all');box={x:0,y:0,w:mapWidth,h:mapHeight};render();return;}
      const r=atlasData.regions.find(r=>r.key===key),node=svg.querySelector(`[data-region="${r.id}"]`);
      showDetail(node);focusView(r.view);
    }));
    function focusArray(id) {
      svg.classList.toggle('has-array-focus',!!id);
      svg.querySelectorAll('.related').forEach(el=>el.classList.remove('related'));
      if(!id)return;
      const adjacent=new Set([id]);
      svg.querySelectorAll('.array-edge').forEach(edge=>{if(edge.dataset.from===id||edge.dataset.to===id){edge.classList.add('related');adjacent.add(edge.dataset.from);adjacent.add(edge.dataset.to);}});
      svg.querySelectorAll('[data-array]').forEach(el=>el.classList.toggle('related',adjacent.has(el.dataset.array)));
    }
    function showDetail(node) {
      const isPortal=node.hasAttribute('data-portal'),isCity=node.hasAttribute('data-city'),isArray=node.hasAttribute('data-array'),isSite=node.hasAttribute('data-site'),isSect=node.hasAttribute('data-sect');
      const data=isSect?atlasData.sects?.find(r=>r.id===node.dataset.sect):isSite?atlasData.sites?.find(r=>r.id===node.dataset.site):isCity?atlasData.capitals.find(r=>r.id===node.dataset.city):isArray?atlasData.arrays.find(r=>r.id===node.dataset.array):isPortal?atlasData.portals.find(r=>r.id===node.dataset.portal):atlasData.regions.find(r=>r.id===node.dataset.region);
      if(!data)return;
      if(isSect){svg.classList.remove('hide-sects');document.querySelector('#toggle-sects').setAttribute('aria-pressed','true');}
      selectedCity=isCity?data:null;
      selectedPlace=data;
      selectedTrigger=node;
      svg.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
      node.classList.add('selected');
      regionOutlines.forEach((outline,id)=>outline.classList.toggle('is-selected',node.dataset.region===id));
      focusArray(isArray?data.id:isCity?data.hubId:null);
      const tier=isArray?atlasData.arrayTiers[data.tier]:null;
      document.querySelector('#detail-eyebrow').textContent=isSky?'九霄地志 / '+(data.domain||'天界'):isCity?'五域城郭 / '+data.domain:isArray?'九野通衢 / '+tier.name:isPortal?'山海地志 / 天地渊途':isSite?'九泉地志 / '+data.domain:isUnderworld?'九泉地志 / 幽界':'山海地志 / 地界';
      document.querySelector('#detail-name').textContent=data.id;
      document.querySelector('#detail-sub').textContent=isArray?tier.name+' · '+data.domain:isPortal?'入口 · '+data.from:data.sub;
      document.querySelector('#detail-desc').textContent=data.desc;
      const art=document.querySelector('#detail-art');art.hidden=!(isCity||isArray);art.classList.toggle('array-art',isArray);
      document.querySelector('#focus-capital').textContent=isSect?'近观驻地':isCity?'放大城郭':'放大此处';
      if(isSect){
        document.querySelector('#detail-eyebrow').textContent='宗门势力 / '+data.domain;
        document.querySelector('#detail-sub').textContent=data.sub+' · '+data.habitat;
        art.hidden=false;art.style.color='#e0c996';
        document.querySelector('#detail-art-use').setAttribute('href',data.form==='court'?'#capital-imperial':'#'+data.key);
        document.querySelector('#detail-art-svg').setAttribute('viewBox',data.form==='court'?'-128 -140 256 220':'-80 -96 160 160');
      }
      if(isCity||isArray){document.querySelector('#detail-art-use').setAttribute('href',isCity?'#capital-'+data.key:'#array-'+data.tier);document.querySelector('#detail-art-svg').setAttribute('viewBox',isCity?'-112 -117 224 174':'-27 -22 54 44');art.style.color=isArray?tier.color:'#e0c996';}
      document.querySelector('#detail-actions').hidden=!(isCity||data.view);
      document.querySelector('#show-capital-array').hidden=!isCity;
      const travel=document.querySelector('#travel-link');travel.hidden=true;
      if(isPortal&&(isUnderworld||['归墟','碎金渊','神木枯冢','黄泉古迹','无尽炎渊'].includes(data.id))){
        travel.hidden=false;travel.href=(isUnderworld?'index.html#':'underworld.html#')+encodeURIComponent(isUnderworld?data.target:data.id);travel.textContent=isUnderworld?'返回地界 · 查看此入口':'进入幽界 · 查看'+data.id;
      }
      if(data.href){travel.hidden=false;travel.href=data.href;travel.textContent=data.travelLabel;}
      if(!isLayered&&isPortal&&data.id==='天渊'){travel.hidden=false;travel.href='sky.html#天渊';travel.textContent='进入天界 · 查看天渊';}
      const facts=data.facts||(isCity?[['形制',data.features],['阵枢','域间星枢 · 上品灵石与虚空晶石驱动'],['通行','跨域瞬至，受大宗门与仙朝严控。'],['绘制','建筑形制为视觉设计，主城与阵枢名称依世界书。']]:isArray?[['时标',tier.time],['耗用',tier.cost],['通行',tier.rule],['扰动',tier.risk],['布点',data.placement||'具体阵址为视觉示意，连线不限定唯一的直连关系。']]:isPortal?[['渊途',data.from],['释义','跨界入口与下潜方向示意，非安全通行承诺。']]:[['法则',data.law],['地标',data.landmarks],['连通',data.connections]]);
      document.querySelector('#detail-facts').replaceChildren(...facts.flatMap(([key,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;return[dt,dd];}));
      document.querySelector('#detail-danger').textContent=isArray?tier.name:isCity?'主城 · 域间星枢':isPortal?'跨界通路':'地域险度 '+data.danger;
      if(isSect)document.querySelector('#detail-danger').textContent=data.status==='roaming'?'活动示意':'驻地示意';
      detail.hidden=false;intro.hidden=true;networkKey.hidden=true;detail.scrollTop=0;
      if(isSky)setSkyLevel(data.key||'all');
      scheduleLabels();
    }
    function closeDetail(restoreFocus=false){detail.hidden=true;intro.hidden=!isLayered&&!svg.classList.contains('hide-arrays');networkKey.hidden=isLayered||svg.classList.contains('hide-arrays');focusArray(null);svg.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));regionOutlines.forEach(outline=>outline.classList.remove('is-selected'));previewOutline(null);if(restoreFocus)selectedTrigger?.focus();}
    svg.addEventListener('click',e=>{if(lastDragged){lastDragged=false;return;}const node=e.target.closest(interactionSelector);if(node)showDetail(node);});
    svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const node=e.target.closest(interactionSelector);if(node){e.preventDefault();showDetail(node);}}});
    viewport.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-100,100)*.002),svgPoint(e.clientX,e.clientY));},{passive:false});
    viewport.addEventListener('dblclick',e=>{if(!e.target.closest(interactionSelector)&&!e.target.closest('button,a'))zoom(1.5,svgPoint(e.clientX,e.clientY));});
    // The cached artwork and gesture shield are siblings of the SVG. Protect the
    // complete canvas from native selection/dragging, leaving the detail pane selectable.
    viewport.addEventListener('selectstart',e=>e.preventDefault());
    viewport.addEventListener('dragstart',e=>e.preventDefault());
    viewport.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button,a,.network-key'))return;
      e.preventDefault();
      const selection=svg.getRootNode().getSelection?.()||svg.ownerDocument.getSelection();
      if(selection&&[selection.anchorNode,selection.focusNode].some(node=>node&&viewport.contains(node)))selection.removeAllRanges();
      if(e.pointerType==='mouse')e.target.closest(interactionSelector)?.focus({preventScroll:true});
      camera.prepare();lastDragged=false;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(b.x-a.x,b.y-a.y)};camera.interact(true);drag=null;return;}
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,box:{...box},scale:camera.scale,moved:false};
    });
    viewport.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(b.x-a.x,b.y-a.y);if(pinch.distance>0)zoom(distance/pinch.distance,svgPoint((a.x+b.x)/2,(a.y+b.y)/2));pinch.distance=distance;lastDragged=true;return;}
      if(!drag||drag.id!==e.pointerId)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
      if(!drag.moved){previewOutline(null);viewport.setPointerCapture(e.pointerId);camera.interact(true);}drag.moved=true;lastDragged=true;
      box.x=drag.box.x-dx/drag.scale;box.y=drag.box.y-dy/drag.scale;render();
    });
    function endPointer(e){const wasPinching=!!pinch;pointers.delete(e.pointerId);if(drag?.id===e.pointerId)drag=null;if(pointers.size<2)pinch=null;if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);if(!pointers.size)camera.release();else if(wasPinching&&pointers.size===1){const [id,point]=[...pointers.entries()][0];drag={id,x:point.x,y:point.y,box:{...box},scale:camera.scale,moved:true};viewport.setPointerCapture(id);}}
    viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
    viewport.addEventListener('pointerleave',e=>{if(!viewport.hasPointerCapture(e.pointerId))endPointer(e);});
    document.querySelector('#zoom-in').addEventListener('click',()=>zoom(1.3));
    document.querySelector('#zoom-out').addEventListener('click',()=>zoom(1/1.3));
    document.querySelector('#reset').addEventListener('click',()=>{if(isSky){closeDetail();setSkyLevel('all');}box={...overview};render();});
    document.querySelector('#close-detail').addEventListener('click',()=>closeDetail(true));
    document.querySelector('#toggle-sects').addEventListener('click',e=>{const button=e.currentTarget,visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));svg.classList.toggle('hide-sects',!visible);if(!visible&&selectedTrigger?.hasAttribute('data-sect'))closeDetail();scheduleLabels();});
    document.querySelectorAll('[data-layer]').forEach(button=>button.addEventListener('click',()=>{const visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));document.getElementById(button.dataset.layer).classList.toggle('hidden-layer',!visible);if(button.dataset.layer==='labels')svg.classList.toggle('hide-place-labels',!visible);scheduleLabels();}));
    document.querySelector('#toggle-arrays').addEventListener('click',e=>{const b=e.currentTarget,visible=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(visible));svg.classList.toggle('hide-arrays',!visible);if(!visible&&selectedTrigger?.hasAttribute('data-array'))closeDetail();networkKey.hidden=!visible||!detail.hidden;intro.hidden=visible||!detail.hidden;});
    document.querySelectorAll('[data-network-tier]').forEach(button=>button.addEventListener('click',()=>{const visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));svg.classList.toggle('hide-'+button.dataset.networkTier,!visible);}));
    document.querySelector('#focus-capital').addEventListener('click',()=>{if(selectedCity){box={x:selectedCity.x-150,y:selectedCity.y-118,w:320,h:200};render();}else if(selectedPlace?.view){focusView(selectedPlace.view);}});
    document.querySelector('#show-capital-array').addEventListener('click',()=>{if(selectedCity){const node=[...svg.querySelectorAll('[data-array]')].find(el=>el.dataset.array===selectedCity.hubId);if(node){svg.classList.remove('hide-arrays','hide-star');document.querySelector('#toggle-arrays').setAttribute('aria-pressed','true');document.querySelector('[data-network-tier="star"]').setAttribute('aria-pressed','true');showDetail(node);}}});
    document.querySelector('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#fullscreen').title='当前浏览器未允许全屏';}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail(true);if(e.key==='Home'){e.preventDefault();document.querySelector('#reset').click();}if(e.key==='+'||e.key==='=')zoom(1.3);if(e.key==='-')zoom(1/1.3);});
    render();

    
  
  return bindAtlasIntegration({ root, svg, ready: camera.ready, data: atlasData, showDetail, closeDetail, focusView, setSkyLevel, scheduleLabels,
    cleanup: () => { camera.dispose(); events.abort(); observers.forEach(o => o.disconnect()); frames.forEach(id => globalThis.cancelAnimationFrame(id)); }
  }, options);
}
