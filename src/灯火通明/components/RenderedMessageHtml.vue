<!-- eslint-disable vue/no-v-html -->
<!-- Preset regex styles target `.mes_text`; keep that scope inside the pseudo layer. -->
<template>
  <div ref="host" class="rendered-message-html mes_text" v-bind="$attrs" v-html="html"></div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  html: string;
  messageId: number;
}>();

const host = ref<HTMLElement | null>(null);
const cleanupCallbacks: Array<() => void> = [];
let generatedFrameIndex = 0;

const FRONTEND_DOCUMENT_PATTERN = /^\s*(?:<!doctype\s+html(?=[\s>])|<html(?=[\s>])|<body(?=[\s>]))/i;
const TAVERN_THEME_VARIABLES = [
  '--SmartThemeBodyColor',
  '--SmartThemeEmColor',
  '--SmartThemeQuoteColor',
  '--SmartThemeBlurTintColor',
  '--SmartThemeBorderColor',
  '--SmartThemeShadowColor',
] as const;
const normalizeFrontendSource = (value: string) => value.replace(/\r\n?/g, '\n').trim();

const clearFrameObservers = () => {
  cleanupCallbacks.splice(0).forEach(cleanup => cleanup());
};

const getTavernDocument = (): Document | null => {
  try {
    return window.parent?.document ?? null;
  } catch {
    return null;
  }
};

const collectNativeFrontendFrames = () => {
  const tavernDocument = getTavernDocument();
  if (!tavernDocument || props.messageId < 0) return [];

  const escapedMessageId = CSS.escape(String(props.messageId));
  return [...tavernDocument.querySelectorAll<HTMLElement>(`#chat > .mes[mesid="${escapedMessageId}"] .TH-render`)]
    .map(render => {
      const code = render.querySelector('pre > code');
      const frame = render.querySelector<HTMLIFrameElement>('iframe');
      return code && frame
        ? {
            source: normalizeFrontendSource(code.textContent ?? ''),
            frame,
          }
        : null;
    })
    .filter((item): item is { source: string; frame: HTMLIFrameElement } => item !== null);
};

const findReadingSurfaceColor = () => {
  let element: HTMLElement | null = host.value;
  while (element) {
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== 'transparent' && !/^rgba\([^)]*,\s*0\s*\)$/i.test(color)) return color;
    element = element.parentElement;
  }
  return '#071820';
};

const applyFramePresentation = (frameDocument: Document, nativeFrame?: HTMLIFrameElement) => {
  const tavernDocument = getTavernDocument();
  const sources = [
    tavernDocument?.documentElement,
    tavernDocument?.body,
    document.documentElement,
    document.body,
    host.value,
    nativeFrame,
  ].filter((source): source is HTMLElement => Boolean(source));
  const target = frameDocument.documentElement.style;

  sources.forEach(source => {
    const view = source.ownerDocument.defaultView;
    if (!view) return;
    const computed = view.getComputedStyle(source);
    const names = new Set<string>(TAVERN_THEME_VARIABLES);
    for (let index = 0; index < computed.length; index += 1) {
      const name = computed[index];
      if (name.startsWith('--')) names.add(name);
    }
    names.forEach(name => {
      const value = computed.getPropertyValue(name).trim();
      if (value) target.setProperty(name, value);
    });
  });

  target.backgroundColor = findReadingSurfaceColor();
  target.colorScheme = 'dark';
  if (frameDocument.body) frameDocument.body.style.background = 'transparent';
};

const observeFrameHeight = (frame: HTMLIFrameElement, nativeFrame?: HTMLIFrameElement) => {
  let observer: ResizeObserver | null = null;

  const syncHeight = () => {
    try {
      const frameDocument = frame.contentDocument;
      if (!frameDocument) return;
      const height = Math.max(
        frameDocument.documentElement?.scrollHeight ?? 0,
        frameDocument.body?.scrollHeight ?? 0,
        frameDocument.documentElement?.getBoundingClientRect().height ?? 0,
        frameDocument.body?.getBoundingClientRect().height ?? 0,
      );
      if (height > 0) frame.style.height = `${Math.ceil(height)}px`;
    } catch {
      // Cross-origin frontends keep the native/fallback height.
    }
  };

  const handleLoad = () => {
    observer?.disconnect();
    observer = null;
    try {
      const frameDocument = frame.contentDocument;
      if (!frameDocument) return;
      applyFramePresentation(frameDocument, nativeFrame);
      syncHeight();
      observer = new ResizeObserver(syncHeight);
      observer.observe(frameDocument.documentElement);
      if (frameDocument.body) observer.observe(frameDocument.body);
    } catch {
      // Cross-origin frontends cannot be observed from the pseudo layer.
    }
  };

  frame.addEventListener('load', handleLoad);
  cleanupCallbacks.push(() => {
    frame.removeEventListener('load', handleLoad);
    observer?.disconnect();
  });

  if (frame.contentDocument?.readyState === 'complete') handleLoad();
};

const appendRuntimeSupport = (frameDocument: Document) => {
  const base = frameDocument.createElement('base');
  base.href = getTavernDocument()?.baseURI ?? document.baseURI;
  frameDocument.head.prepend(base);

  const resetStyle = frameDocument.createElement('style');
  resetStyle.textContent =
    '*,*::before,*::after{box-sizing:border-box}html,body{margin:0!important;padding:0;max-width:100%!important;overflow:hidden!important}';
  frameDocument.head.append(resetStyle);

  const bridge = frameDocument.createElement('script');
  bridge.textContent = `(() => {
    try {
      const scopes = [window.parent, window.parent?.parent].filter(Boolean);
      const source = scopes.find(scope => scope.TavernHelper) || scopes[0];
      const shared = ['TavernHelper', 'SillyTavern', 'Mvu', 'toastr', 'eventOn', 'eventOnce', 'eventEmit',
        'getVariables', 'replaceVariables', 'updateVariables', 'getChatMessages', 'setChatMessages',
        'createChatMessages', 'generate', 'generateRaw', 'triggerSlash', 'getCurrentMessageId',
        'getLastMessageId', 'formatAsDisplayedMessage', 'retrieveDisplayedMessage'];
      for (const name of shared) {
        const value = source?.[name] ?? source?.TavernHelper?.[name];
        if (value !== undefined && window[name] === undefined) window[name] = value;
      }
      const roots = scopes.flatMap(scope => [scope.document?.documentElement, scope.document?.body]).filter(Boolean);
      for (const root of roots) {
        const computed = root.ownerDocument.defaultView.getComputedStyle(root);
        for (let index = 0; index < computed.length; index += 1) {
          const name = computed[index];
          if (name.startsWith('--')) document.documentElement.style.setProperty(name, computed.getPropertyValue(name));
        }
      }
    } catch (error) {
      console.warn('[灯火阑珊·伪同层] 预设前端运行环境桥接失败', error);
    }
  })();`;
  frameDocument.head.prepend(bridge);

  const hasJquery = [...frameDocument.scripts].some(script => /jquery/i.test(script.src));
  if (!hasJquery) {
    const jquery = frameDocument.createElement('script');
    jquery.src = 'https://testingcf.jsdelivr.net/npm/jquery';
    bridge.after(jquery);
  }
};

const createFallbackFrameDocument = (source: string) => {
  const frameDocument = new DOMParser().parseFromString(source, 'text/html');
  appendRuntimeSupport(frameDocument);
  return `<!DOCTYPE html>\n${frameDocument.documentElement.outerHTML}`;
};

const createFrontendFrame = (source: string, nativeFrame?: HTMLIFrameElement) => {
  const frame = document.createElement('iframe');
  generatedFrameIndex += 1;
  frame.id = `TH-message--${Math.max(0, props.messageId)}--${1000 + generatedFrameIndex}`;
  frame.name = frame.id;
  frame.className = 'dhl-pseudo-preset-frame';
  frame.title = '预设前端';
  frame.loading = 'eager';
  frame.setAttribute('frameborder', '0');
  frame.style.height = nativeFrame?.style.height || '1px';
  observeFrameHeight(frame, nativeFrame);

  if (nativeFrame?.src) frame.src = nativeFrame.src;
  else frame.srcdoc = createFallbackFrameDocument(source);
  return frame;
};

const mountPresetFrontends = () => {
  clearFrameObservers();
  const root = host.value;
  if (!root) return;

  const nativeCandidates = collectNativeFrontendFrames();
  const consumedCandidates = new Set<number>();
  const codeBlocks = [...root.querySelectorAll<HTMLElement>('pre > code')];

  codeBlocks.forEach(code => {
    const source = normalizeFrontendSource(code.textContent ?? '');
    if (!FRONTEND_DOCUMENT_PATTERN.test(source)) return;

    const candidateIndex = nativeCandidates.findIndex(
      (candidate, index) => !consumedCandidates.has(index) && candidate.source === source,
    );
    const nativeFrame = candidateIndex >= 0 ? nativeCandidates[candidateIndex].frame : undefined;
    if (candidateIndex >= 0) consumedCandidates.add(candidateIndex);

    const frame = createFrontendFrame(source, nativeFrame);
    const wrapper = document.createElement('div');
    wrapper.className = 'dhl-pseudo-preset-frontend';
    wrapper.append(frame);
    (code.closest('pre') ?? code).replaceWith(wrapper);
  });
};

watch(
  () => [props.html, props.messageId] as const,
  () => void nextTick(mountPresetFrontends),
  { immediate: true, flush: 'post' },
);

onBeforeUnmount(clearFrameObservers);
</script>

<style scoped>
.rendered-message-html {
  min-width: 0;
  max-width: 100%;
}

.rendered-message-html :deep(.dhl-pseudo-preset-frontend) {
  width: 100%;
  max-width: 100%;
  margin: 0.5rem 0;
  overflow: hidden;
}

.rendered-message-html :deep(.dhl-pseudo-preset-frame) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-height: 1px;
  border: 0;
  background: transparent;
}
</style>
