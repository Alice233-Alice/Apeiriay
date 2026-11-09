<template>
  <Transition name="interlude-drawer">
    <div
      v-if="pseudo.dialogueDrawerOpen"
      ref="layerRef"
      class="dialogue-drawer-layer"
      :class="{ resizing: isResizing }"
      role="presentation"
      @click.self="close"
    >
      <aside
        ref="drawerRef"
        class="dialogue-drawer"
        :style="drawerStyle"
        role="dialog"
        aria-modal="true"
        aria-label="幕间对话"
      >
        <div
          ref="resizeHandleRef"
          class="drawer-edge"
          role="separator"
          aria-label="调整幕间对话宽度"
          aria-orientation="vertical"
          title="左右拖动调整宽度，双击恢复默认"
          tabindex="0"
          @pointerdown="startResize"
          @dblclick="resetDrawerWidth"
          @keydown="handleResizeKeydown"
        >
          <i></i><i></i><i></i>
        </div>
        <button
          type="button"
          class="drawer-close"
          aria-label="关闭幕间对话"
          title="关闭并返回正文"
          :disabled="pseudo.isGenerating"
          @click="close"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
        <DialogueStage />
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { usePseudoLayerStore } from '../store';
import DialogueStage from './DialogueStage.vue';

const DRAWER_WIDTH_STORAGE_KEY = '灯火通明:dialogue-drawer-width';
const MIN_DRAWER_WIDTH = 560;
const STORY_REMAINDER_WIDTH = 140;

const pseudo = usePseudoLayerStore();
const layerRef = ref<HTMLElement>();
const drawerRef = ref<HTMLElement>();
const resizeHandleRef = ref<HTMLElement>();
const drawerWidth = ref<number | null>(null);
const isResizing = ref(false);
let resizeStartX = 0;
let resizeStartWidth = 0;
let activePointerId: number | null = null;

const drawerStyle = computed<Record<string, string>>(() => {
  const style: Record<string, string> = {};
  if (drawerWidth.value !== null) {
    style['--dialogue-drawer-width'] = `${Math.round(drawerWidth.value)}px`;
  }
  return style;
});

const isMobileDrawer = () => window.matchMedia('(max-width: 760px)').matches;
const widthBounds = () => {
  const layerWidth = layerRef.value?.getBoundingClientRect().width ?? window.innerWidth;
  const max = Math.max(MIN_DRAWER_WIDTH, layerWidth - STORY_REMAINDER_WIDTH);
  return { min: Math.min(MIN_DRAWER_WIDTH, max), max };
};
const clampDrawerWidth = (width: number) => {
  const { min, max } = widthBounds();
  return Math.min(max, Math.max(min, width));
};
const saveDrawerWidth = () => {
  if (drawerWidth.value === null) return;
  localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(Math.round(drawerWidth.value)));
};
const setDrawerWidth = (width: number, persist = true) => {
  drawerWidth.value = clampDrawerWidth(width);
  if (persist) saveDrawerWidth();
};
const resetDrawerWidth = () => {
  drawerWidth.value = null;
  localStorage.removeItem(DRAWER_WIDTH_STORAGE_KEY);
};

const handleResizeMove = (event: PointerEvent) => {
  if (!isResizing.value || event.pointerId !== activePointerId) return;
  setDrawerWidth(resizeStartWidth + resizeStartX - event.clientX, false);
};
const finishResize = (event?: PointerEvent) => {
  if (!isResizing.value || (event && event.pointerId !== activePointerId)) return;
  if (activePointerId !== null && resizeHandleRef.value?.hasPointerCapture(activePointerId)) {
    resizeHandleRef.value.releasePointerCapture(activePointerId);
  }
  isResizing.value = false;
  activePointerId = null;
  window.removeEventListener('pointermove', handleResizeMove);
  window.removeEventListener('pointerup', finishResize);
  window.removeEventListener('pointercancel', finishResize);
  saveDrawerWidth();
};
const startResize = (event: PointerEvent) => {
  if (isMobileDrawer() || event.button !== 0) return;
  event.preventDefault();
  resizeStartX = event.clientX;
  resizeStartWidth = drawerRef.value?.getBoundingClientRect().width ?? drawerWidth.value ?? MIN_DRAWER_WIDTH;
  activePointerId = event.pointerId;
  isResizing.value = true;
  resizeHandleRef.value?.setPointerCapture(event.pointerId);
  window.addEventListener('pointermove', handleResizeMove);
  window.addEventListener('pointerup', finishResize);
  window.addEventListener('pointercancel', finishResize);
};
const handleResizeKeydown = (event: KeyboardEvent) => {
  if (isMobileDrawer() || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
  event.preventDefault();
  const step = event.shiftKey ? 64 : 24;
  const currentWidth = drawerRef.value?.getBoundingClientRect().width ?? drawerWidth.value ?? MIN_DRAWER_WIDTH;
  setDrawerWidth(currentWidth + (event.key === 'ArrowLeft' ? step : -step));
};

const close = () => pseudo.closeDialogueDrawer();
const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && pseudo.dialogueDrawerOpen) close();
};

onMounted(() => {
  const storedWidth = Number(localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY));
  if (Number.isFinite(storedWidth) && storedWidth > 0) drawerWidth.value = storedWidth;
  window.addEventListener('keydown', closeOnEscape);
});
onBeforeUnmount(() => {
  finishResize();
  window.removeEventListener('keydown', closeOnEscape);
});

watch(
  () => pseudo.dialogueDrawerOpen,
  async open => {
    if (!open || drawerWidth.value === null) return;
    await nextTick();
    setDrawerWidth(drawerWidth.value, false);
  },
);
</script>

<style lang="scss" scoped>
.dialogue-drawer-layer {
  position: absolute;
  z-index: 40;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--stage-shadow) 30%, transparent),
      color-mix(in srgb, var(--stage-shadow) 62%, transparent) 72%
    ),
    color-mix(in srgb, var(--stage-shadow) 16%, transparent);
  backdrop-filter: blur(1.5px) saturate(0.84);
}

.dialogue-drawer {
  position: relative;
  width: var(--dialogue-drawer-width, clamp(640px, 46vw, 860px));
  min-width: 560px;
  max-width: calc(100% - 140px);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-left: 3px double color-mix(in srgb, var(--gold) 48%, var(--line-strong));
  color: var(--text-primary);
  background: var(--reading-surface), var(--stage-canvas);
  box-shadow:
    -34px 0 90px color-mix(in srgb, var(--stage-shadow) 92%, transparent),
    inset 1px 0 0 color-mix(in srgb, var(--gold) 12%, transparent);
}
.dialogue-drawer::before,
.dialogue-drawer::after {
  content: '';
  position: absolute;
  z-index: 7;
  left: 18px;
  right: 18px;
  height: 1px;
  pointer-events: none;
}
.dialogue-drawer::before {
  top: 7px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--gold-soft) 18%,
    var(--jade) 50%,
    var(--gold-soft) 82%,
    transparent
  );
  opacity: 0.52;
}
.dialogue-drawer::after {
  bottom: 7px;
  background: linear-gradient(90deg, transparent, var(--gold-soft), transparent);
  opacity: 0.28;
}
.drawer-edge {
  position: absolute;
  z-index: 11;
  top: 0;
  bottom: 0;
  left: 0;
  width: 18px;
  display: grid;
  place-content: center;
  gap: 9px;
  outline: none;
  cursor: ew-resize;
  touch-action: none;
}
.drawer-edge::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5px;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--jade) 26%, transparent), transparent);
  opacity: 0;
  transition:
    width 0.16s ease,
    opacity 0.16s ease;
}
.drawer-edge:hover::before,
.drawer-edge:focus-visible::before,
.resizing .drawer-edge::before {
  width: 9px;
  opacity: 1;
}
.drawer-edge i {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  border: 1px solid var(--gold-soft);
  background: var(--surface-inset);
  transform: rotate(45deg);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-glow) 34%, transparent);
}
.drawer-edge i:nth-child(2) {
  width: 10px;
  height: 10px;
  border-color: var(--jade);
}
.drawer-edge:focus-visible i {
  box-shadow:
    0 0 0 2px var(--focus-ring),
    0 0 16px color-mix(in srgb, var(--accent-glow) 46%, transparent);
}
.dialogue-drawer-layer.resizing,
.dialogue-drawer-layer.resizing :deep(*) {
  cursor: ew-resize !important;
  user-select: none !important;
}

.drawer-close {
  position: absolute;
  z-index: 12;
  top: 15px;
  right: 16px;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--gold) 22%, var(--line-subtle));
  border-radius: 7px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 74%, transparent);
  box-shadow: inset 0 0 12px color-mix(in srgb, var(--gold) 5%, transparent);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
}
.drawer-close:hover:not(:disabled) {
  color: var(--gold);
  border-color: var(--line-strong);
  background: var(--button-hover);
  transform: rotate(4deg);
}
.drawer-close:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.interlude-drawer-enter-active,
.interlude-drawer-leave-active {
  transition: background 0.2s ease;
}
.interlude-drawer-enter-active .dialogue-drawer,
.interlude-drawer-leave-active .dialogue-drawer {
  transition:
    transform 0.22s ease,
    opacity 0.18s ease;
}
.interlude-drawer-enter-from,
.interlude-drawer-leave-to {
  background: transparent;
}
.interlude-drawer-enter-from .dialogue-drawer,
.interlude-drawer-leave-to .dialogue-drawer {
  opacity: 0;
  transform: translateX(100%);
}

@media screen and (max-width: 760px) {
  .dialogue-drawer-layer {
    position: fixed;
    align-items: flex-end;
    background: color-mix(in srgb, var(--stage-shadow) 56%, transparent);
    backdrop-filter: blur(2px);
  }
  .dialogue-drawer {
    width: 100%;
    min-width: 0;
    max-width: none;
    height: min(86%, 720px);
    padding-top: 13px;
    border-top: 1px solid color-mix(in srgb, var(--gold) 42%, var(--line-strong));
    border-left: 0;
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -18px 50px color-mix(in srgb, var(--stage-shadow) 78%, transparent);
  }
  .dialogue-drawer::before {
    top: 7px;
    left: 50%;
    width: 38px;
    height: 2px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--gold-soft) 54%, var(--line-strong));
    opacity: 0.66;
    transform: translateX(-50%);
  }
  .dialogue-drawer::after {
    display: none;
  }
  .drawer-edge {
    display: none;
  }
  .drawer-close {
    top: 22px;
    right: 10px;
    width: 32px;
    height: 32px;
  }
  .interlude-drawer-enter-from .dialogue-drawer,
  .interlude-drawer-leave-to .dialogue-drawer {
    transform: translateY(100%);
  }
}
</style>
