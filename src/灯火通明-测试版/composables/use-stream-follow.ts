import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue';

const BOTTOM_THRESHOLD = 72;
const TOUCH_SCROLL_SETTLE_MS = 220;

export const useStreamFollow = (scrollRef: Ref<HTMLElement | undefined>) => {
  const isFollowing = ref(true);
  const isUserInteracting = ref(false);
  let touchY: number | null = null;
  let interactionReleaseTimer: number | undefined;
  let followQueued = false;
  let lastScrollTop = 0;
  let lastScrollHeight = 0;
  let lastClientHeight = 0;
  let movingTowardBottom = false;
  let draggingScrollbar = false;
  let disposed = false;

  const isNearBottom = () => {
    const element = scrollRef.value;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD;
  };

  const releaseInteraction = () => {
    interactionReleaseTimer = undefined;
    isUserInteracting.value = false;
    if (movingTowardBottom) isFollowing.value = isNearBottom();
    movingTowardBottom = false;
    draggingScrollbar = false;
  };

  const scheduleInteractionRelease = () => {
    if (interactionReleaseTimer !== undefined) window.clearTimeout(interactionReleaseTimer);
    interactionReleaseTimer = window.setTimeout(releaseInteraction, TOUCH_SCROLL_SETTLE_MS);
  };

  const handleScroll = () => {
    if (isUserInteracting.value && touchY === null) scheduleInteractionRelease();
    const scrollTop = scrollRef.value?.scrollTop ?? 0;
    const scrollHeight = scrollRef.value?.scrollHeight ?? 0;
    const clientHeight = scrollRef.value?.clientHeight ?? 0;
    const layoutChanged = scrollHeight !== lastScrollHeight || clientHeight !== lastClientHeight;
    lastScrollHeight = scrollHeight;
    lastClientHeight = clientHeight;
    const delta = scrollTop - lastScrollTop;
    lastScrollTop = scrollTop;
    if (draggingScrollbar && !layoutChanged && Math.abs(delta) > 1) movingTowardBottom = delta > 0;
    // Streaming and collapsing the composer resize the viewport. Browser scroll
    // anchoring/clamping during that resize is not a request to stop following.
    if (layoutChanged && isFollowing.value && !isUserInteracting.value) {
      queueFollow();
      return;
    }
    const nearBottom = isNearBottom();
    if (!nearBottom || delta < -1) isFollowing.value = false;
    // 后处理重绘、滚动锚定和位置恢复也会产生向下的 scroll 事件。
    // 暂停后只接受玩家主动向下阅读，不能靠这些程序性位移重新开启跟随。
    else if (delta > 1 && isUserInteracting.value && movingTowardBottom) isFollowing.value = true;
  };

  const handleWheel = (event: WheelEvent) => {
    if (!event.deltaY) return;
    isUserInteracting.value = true;
    movingTowardBottom = event.deltaY > 0;
    if (event.deltaY < 0) isFollowing.value = false;
    scheduleInteractionRelease();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if ((event.target as HTMLElement | null)?.closest('input, textarea, select, button, a, [contenteditable]')) return;
    const upward = ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey);
    const downward = ['ArrowDown', 'PageDown', 'End'].includes(event.key) || (event.key === ' ' && !event.shiftKey);
    if (!upward && !downward) return;
    isUserInteracting.value = true;
    movingTowardBottom = downward;
    if (upward) isFollowing.value = false;
    scheduleInteractionRelease();
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (interactionReleaseTimer !== undefined) {
      window.clearTimeout(interactionReleaseTimer);
      interactionReleaseTimer = undefined;
    }
    isUserInteracting.value = true;
    movingTowardBottom = false;
    touchY = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: TouchEvent) => {
    const nextY = event.touches[0]?.clientY ?? null;
    if (touchY !== null && nextY !== null) movingTowardBottom = nextY < touchY;
    if (touchY !== null && nextY !== null && nextY > touchY) isFollowing.value = false;
    touchY = nextY;
  };

  const handleTouchEnd = () => {
    touchY = null;
    scheduleInteractionRelease();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen' || event.button === 0) {
      if (interactionReleaseTimer !== undefined) {
        window.clearTimeout(interactionReleaseTimer);
        interactionReleaseTimer = undefined;
      }
      isUserInteracting.value = true;
      movingTowardBottom = false;
      // 原生滚动条拖动没有 wheel/touchmove；只在指针按住期间识别其方向。
      draggingScrollbar = event.pointerType === 'mouse' && event.target === scrollRef.value;
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen' && event.button !== 0) return;
    touchY = null;
    scheduleInteractionRelease();
  };

  const queueFollow = () => {
    if (disposed || followQueued || !isFollowing.value || isUserInteracting.value) return;
    followQueued = true;
    void nextTick(() => {
      followQueued = false;
      if (disposed || !isFollowing.value || isUserInteracting.value) return;
      const element = scrollRef.value;
      if (element) {
        element.scrollTop = element.scrollHeight;
        lastScrollTop = element.scrollTop;
      }
    });
  };

  const resumeFollowing = (smooth = true) => {
    if (interactionReleaseTimer !== undefined) {
      window.clearTimeout(interactionReleaseTimer);
      interactionReleaseTimer = undefined;
    }
    isUserInteracting.value = false;
    touchY = null;
    movingTowardBottom = false;
    draggingScrollbar = false;
    isFollowing.value = true;
    void nextTick(() => {
      if (disposed || !isFollowing.value || isUserInteracting.value) return;
      const element = scrollRef.value;
      if (!element) return;
      if (!smooth) {
        element.scrollTop = element.scrollHeight;
        lastScrollTop = element.scrollTop;
        return;
      }

      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
      const view = element.ownerDocument.defaultView;
      view?.requestAnimationFrame(() => {
        view.requestAnimationFrame(() => {
          // Firefox and embedded blob iframes can drop the smooth-scroll request.
          if (!disposed && isFollowing.value && !isUserInteracting.value && !isNearBottom()) {
            element.scrollTop = element.scrollHeight;
          }
        });
      });
    });
  };

  const pauseFollowing = () => {
    isFollowing.value = false;
  };

  onBeforeUnmount(() => {
    disposed = true;
    if (interactionReleaseTimer !== undefined) window.clearTimeout(interactionReleaseTimer);
  });

  return {
    isFollowing,
    isUserInteracting,
    handleScroll,
    handleWheel,
    handleKeydown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handlePointerDown,
    handlePointerUp,
    queueFollow,
    resumeFollowing,
    pauseFollowing,
  };
};
