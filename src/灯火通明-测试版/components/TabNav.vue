<template>
  <div class="tab-nav-shell">
    <button
      v-show="canScrollLeft"
      type="button"
      class="tab-scroll-control is-left"
      title="向左浏览功能"
      aria-label="向左浏览功能"
      @click="scrollTabs(-1)"
    >
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    <div ref="navRef" class="tab-nav" @scroll.passive="updateScrollState">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :data-tab-id="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="$emit('update:activeTab', tab.id)"
      >
        <i :class="tab.icon"></i>
        <span class="tab-label">{{ tab.label }}</span>
        <span
          v-if="tab.badge"
          class="tab-badge"
          :class="{ 'is-actions': tab.id === 'actions' }"
          :aria-label="`${tab.badge} 项待览`"
        >
          {{ tab.badge > 99 ? '99+' : tab.badge }}
        </span>
      </button>
    </div>
    <button
      v-show="canScrollRight"
      type="button"
      class="tab-scroll-control is-right"
      title="向右浏览更多功能"
      aria-label="向右浏览更多功能"
      @click="scrollTabs(1)"
    >
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
}

const props = defineProps<Props>();

defineEmits<{
  (e: 'update:activeTab', value: string): void;
}>();

const navRef = ref<HTMLElement>();
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
let resizeObserver: ResizeObserver | undefined;

const updateScrollState = () => {
  const nav = navRef.value;
  if (!nav) return;
  canScrollLeft.value = nav.scrollLeft > 2;
  canScrollRight.value = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2;
};

const scrollTabs = (direction: -1 | 1) => {
  const nav = navRef.value;
  if (!nav) return;
  nav.scrollBy({ left: direction * Math.max(132, nav.clientWidth * 0.62), behavior: 'smooth' });
};

const revealActiveTab = (behavior: ScrollBehavior = 'smooth') => {
  const nav = navRef.value;
  const activeButton = [...(nav?.querySelectorAll<HTMLElement>('.tab-btn') ?? [])].find(
    button => button.dataset.tabId === props.activeTab,
  );
  if (!nav || !activeButton) return;

  const navRect = nav.getBoundingClientRect();
  const buttonRect = activeButton.getBoundingClientRect();
  const buttonCenter = buttonRect.left - navRect.left + nav.scrollLeft + buttonRect.width / 2;
  const maxScrollLeft = Math.max(0, nav.scrollWidth - nav.clientWidth);
  const targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, buttonCenter - nav.clientWidth / 2));

  // Firefox 会把 scrollIntoView 传播到 iframe 外层，靠右页签会因此横向推动酒馆页面。
  nav.scrollTo({ left: targetScrollLeft, behavior });
  window.setTimeout(updateScrollState, behavior === 'smooth' ? 260 : 0);
};

watch(
  () => props.activeTab,
  () => nextTick(() => revealActiveTab()),
);

onMounted(() => {
  nextTick(() => {
    revealActiveTab('auto');
    if (navRef.value) {
      resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(navRef.value);
    }
  });
});

onUnmounted(() => resizeObserver?.disconnect());
</script>

<style lang="scss" scoped>
.tab-nav-shell {
  position: relative;
  flex-shrink: 0;
  min-width: 0;
}

.tab-badge {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  padding: 0 4px;
  border: 1px solid color-mix(in srgb, var(--gold) 42%, transparent);
  border-radius: 999px;
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 10%, var(--tab-bg));
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 9px;
  font-weight: 650;
  line-height: 1;

  &.is-actions {
    border-color: color-mix(in srgb, var(--jade) 52%, transparent);
    color: var(--jade);
    background: color-mix(in srgb, var(--jade) 14%, var(--tab-bg));
  }
}

.tab-nav {
  position: relative;
  display: flex;
  padding: 4px 8px 3px;
  gap: 2px;
  background: var(--tab-bg);
  border-top: 1px solid var(--line-subtle);
  border-bottom: 1px solid var(--border-color);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--gold) 8%, transparent);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  touch-action: pan-x pinch-zoom;

  &::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    position: relative;
    flex: 1;
    min-width: 58px;
    min-height: 38px;
    padding: 6px 8px 7px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: nowrap;

    &:hover {
      background: var(--button-bg);
      color: var(--text-accent);
    }

    &.active {
      background: var(--tab-active);
      border-color: transparent;
      color: var(--gold);

      &::after {
        content: '';
        position: absolute;
        right: 22%;
        bottom: 0;
        left: 22%;
        height: 2px;
        background: linear-gradient(90deg, transparent, var(--gold) 18% 82%, transparent);
        box-shadow: 0 0 10px var(--accent-glow);
      }
    }
  }
}

.tab-scroll-control {
  position: absolute;
  z-index: 4;
  top: 50%;
  width: 28px;
  height: 32px;
  display: none;
  place-items: center;
  padding: 0;
  transform: translateY(-50%);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  color: var(--gold);
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
  box-shadow: 0 0 16px var(--stage-shadow);
  cursor: pointer;

  &.is-left {
    left: 4px;
  }
  &.is-right {
    right: 4px;
  }
}

// 手机端适配
@media screen and (max-width: 480px) {
  .tab-scroll-control {
    display: grid;
  }

  .tab-nav {
    padding: 3px 36px;
    gap: 2px;
    justify-content: flex-start;
    scroll-snap-type: x proximity;

    .tab-btn {
      flex: 0 0 auto;
      min-width: auto;
      min-width: 54px;
      padding: 5px 8px;
      font-size: 11px;
      gap: 3px;
      scroll-snap-align: center;

      i {
        font-size: 12px;
      }
    }
  }
}

// 超小屏幕适配
@media screen and (max-width: 360px) {
  .tab-nav {
    padding: 5px 34px;
    gap: 1px;

    .tab-btn {
      padding: 5px 8px;
      font-size: 10px;

      .tab-label {
        display: none;
      }

      i {
        font-size: 14px;
      }
    }
  }
}
</style>
