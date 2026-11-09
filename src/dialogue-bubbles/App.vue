<template>
  <div class="BubbleMessage" :class="{ 'is-streaming': context.during_streaming }">
    <template v-for="segment in segments" :key="segment.key">
      <section
        v-if="segment.type === 'bubble'"
        class="BubbleMessage__row"
        :class="[segment.side === 'right' ? 'is-right' : 'is-left']"
      >
        <div class="BubbleMessage__avatar" :class="`is-${getAppearance(segment.key).tone}`">
          <img
            v-if="getAppearance(segment.key).avatarUrl"
            class="BubbleMessage__avatarImage"
            :src="getAppearance(segment.key).avatarUrl ?? undefined"
            :alt="segment.speakerName"
          />
          <span v-else class="BubbleMessage__avatarText">
            {{ getAppearance(segment.key).avatarText }}
          </span>
        </div>

        <div class="BubbleMessage__main">
          <div class="BubbleMessage__name">
            {{ segment.speakerName }}
          </div>
          <div
            class="BubbleMessage__bubble"
            :class="[
              segment.side === 'right' ? 'is-right' : 'is-left',
              `tone-${getAppearance(segment.key).tone}`,
            ]"
          >
            <div class="BubbleMessage__bubbleContent" v-html="segment.html" />
          </div>
        </div>
      </section>

      <section v-else class="BubbleMessage__narration">
        <div class="BubbleMessage__narrationContent" v-html="segment.html" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { injectStreamingMessageContext } from '@util/streaming';
import type { BubbleSegment } from './parser';
import { parseBubbleSegments } from './parser';

const context = injectStreamingMessageContext();

type DialogueChoiceFlags = {
  shixiaSelected: boolean;
  kuriharaSelected: boolean;
};

type BubbleAppearance = {
  tone: 'shixia' | 'kurihara' | 'purple';
  avatarUrl: string | null;
  avatarText: string;
};

const SHIXIA_SMILE_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%97%B6%E5%A4%8Fsmile.png';
const SHIXIA_SAD_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%97%B6%E5%A4%8Fsad.png';
const KURIHARA_SMILE_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%A0%97%E5%8E%9Fsmile.png';
const KURIHARA_SAD_AVATAR =
  'https://raw.githubusercontent.com/atr1official/atri_official/main/%E6%97%B6%E5%A4%8F%26%E6%A0%97%E5%8E%9F/%E6%A0%97%E5%8E%9Fsad.png';

function getUserName(): string {
  try {
    return String(SillyTavern.name1 || substitudeMacros('{{user}}') || 'User').trim() || 'User';
  } catch (_error) {
    return substitudeMacros('{{user}}').trim() || 'User';
  }
}

function getCurrentCharacterName(): string {
  try {
    return String(currentMessage.value?.name || SillyTavern.name2 || substitudeMacros('{{char}}') || '角色').trim() || '角色';
  } catch (_error) {
    return String(currentMessage.value?.name || substitudeMacros('{{char}}') || '角色').trim() || '角色';
  }
}

function normalizeBool(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
}

function findBooleanByKey(root: unknown, targetKey: string): boolean {
  const visited = new Set<unknown>();
  const stack: unknown[] = [root];
  let found = false;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach(item => stack.push(item));
      continue;
    }

    Object.entries(current).forEach(([key, value]) => {
      if (key === targetKey && normalizeBool(value)) {
        found = true;
        stack.length = 0;
        return;
      }
      stack.push(value);
    });
  }

  return found;
}

function getDialogueChoiceFlags(): DialogueChoiceFlags {
  const chatVariables = getVariables({ type: 'chat' });

  return {
    shixiaSelected: findBooleanByKey(chatVariables, '时夏'),
    kuriharaSelected: findBooleanByKey(chatVariables, '栗原'),
  };
}

function extractUrlFromBackgroundImage(value: string | null | undefined): string | null {
  if (!value || value === 'none') {
    return null;
  }
  const matched = value.match(/url\((['"]?)(.+?)\1\)/);
  return matched?.[2] ?? null;
}

function resolveUserAvatarUrl(): string | null {
  const $userMessages = $('#chat > .mes[is_user="true"]');
  const $lastUserMessage = $userMessages.last();
  const roots = [$lastUserMessage, $userMessages.first()].filter($root => $root.length > 0);

  const selectors = ['.avatar img', '.mesAvatar img', 'img.avatar', 'img'];

  for (const $root of roots) {
    for (const selector of selectors) {
      const imageElement = $root.find(selector).get(0) as HTMLImageElement | undefined;
      const source = imageElement?.src?.trim();
      if (source) {
        return source;
      }
    }

    const avatarElement = $root.find('.avatar, .mesAvatar').get(0) as HTMLElement | undefined;
    const backgroundImage = avatarElement ? getComputedStyle(avatarElement).backgroundImage : null;
    const url = extractUrlFromBackgroundImage(backgroundImage);
    if (url) {
      return url;
    }
  }

  return null;
}

function toAvatarText(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    return '?';
  }
  const glyphs = Array.from(normalized);
  return glyphs.slice(0, Math.min(glyphs.length, 3)).join('');
}

function createAppearance(
  segment: BubbleSegment,
  flags: DialogueChoiceFlags,
  userAvatarUrl: string | null,
): BubbleAppearance {
  switch (segment.speakerCategory) {
    case 'shixia':
      return {
        tone: 'shixia',
        avatarUrl: flags.kuriharaSelected ? SHIXIA_SAD_AVATAR : SHIXIA_SMILE_AVATAR,
        avatarText: '时夏',
      };
    case 'kurihara':
      return {
        tone: 'kurihara',
        avatarUrl: flags.shixiaSelected ? KURIHARA_SAD_AVATAR : KURIHARA_SMILE_AVATAR,
        avatarText: '栗原',
      };
    case 'user':
      return {
        tone: 'purple',
        avatarUrl: userAvatarUrl,
        avatarText: toAvatarText(segment.speakerName),
      };
    default:
      return {
        tone: 'purple',
        avatarUrl: null,
        avatarText: toAvatarText(segment.speakerName),
      };
  }
}

const currentMessage = computed(() => getChatMessages(context.message_id)[0]);
const userName = computed(() => getUserName());
const currentCharacterName = computed(() => getCurrentCharacterName());

const segments = computed(() =>
  parseBubbleSegments({
    messageId: context.message_id,
    message: context.message,
    role: currentMessage.value?.role ?? 'assistant',
    name: currentMessage.value?.name ?? '',
    currentCharName: currentCharacterName.value,
    userName: userName.value,
  }),
);

const bubbleAppearances = computed<Record<string, BubbleAppearance>>(() => {
  const flags = getDialogueChoiceFlags();
  const userAvatarUrl = resolveUserAvatarUrl();

  return segments.value.reduce<Record<string, BubbleAppearance>>((result, segment) => {
    if (segment.type === 'bubble') {
      result[segment.key] = createAppearance(segment, flags, userAvatarUrl);
    }
    return result;
  }, {});
});

function getAppearance(key: string): BubbleAppearance {
  return (
    bubbleAppearances.value[key] ?? {
      tone: 'purple',
      avatarUrl: null,
      avatarText: '?',
    }
  );
}
</script>

<style scoped lang="scss">
.BubbleMessage {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.2rem 0 0.45rem;
}

.BubbleMessage__row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  width: 100%;
  animation: bubble-enter 0.24s ease-out both;

  &.is-right {
    flex-direction: row-reverse;
  }
}

.BubbleMessage__avatar {
  width: 4.2rem;
  height: 4.2rem;
  flex: 0 0 4.2rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.96);
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.42), transparent 38%),
    linear-gradient(145deg, rgba(129, 116, 230, 0.95), rgba(92, 80, 194, 0.92));
  box-shadow:
    0 18px 38px rgba(12, 18, 32, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, 0.42);
  border: 2px solid rgba(255, 255, 255, 0.72);

  &.is-shixia {
    background:
      radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.42), transparent 38%),
      linear-gradient(145deg, rgba(147, 210, 255, 0.95), rgba(107, 177, 245, 0.92));
  }

  &.is-kurihara {
    background:
      radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.44), transparent 38%),
      linear-gradient(145deg, rgba(255, 228, 134, 0.95), rgba(244, 196, 82, 0.92));
  }
}

.BubbleMessage__avatarImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.BubbleMessage__avatarText {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0.45rem;
  text-align: center;
  line-height: 1.1;
  font-size: 0.96rem;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
}

.BubbleMessage__main {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  width: fit-content;
  max-width: min(52%, 42rem);
}

.BubbleMessage__row.is-right .BubbleMessage__main {
  align-items: flex-end;
}

.BubbleMessage__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: color-mix(in srgb, var(--SmartThemeBodyColor, #d7deea) 82%, white 18%);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.16);
  padding: 0 0.4rem;
}

.BubbleMessage__bubble {
  position: relative;
  border-radius: 1.7rem;
  padding: 1rem 1.22rem;
  color: #1d2736;
  box-shadow:
    0 18px 42px rgba(7, 12, 24, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.62);
  line-height: 1.78;
  overflow-wrap: anywhere;
  border: 1px solid rgba(255, 255, 255, 0.82);
  min-width: min(20rem, 48vw);

  &::after {
    content: '';
    position: absolute;
    bottom: 1.02rem;
    width: 1rem;
    height: 1rem;
    border-radius: 0.2rem;
    transform: rotate(45deg);
    border-right: 1px solid rgba(255, 255, 255, 0.72);
    border-bottom: 1px solid rgba(255, 255, 255, 0.72);
  }

  &.is-left::after {
    left: -0.42rem;
  }

  &.is-right::after {
    right: -0.42rem;
  }

  &.tone-shixia {
    background:
      linear-gradient(145deg, rgba(214, 237, 255, 0.96), rgba(181, 220, 255, 0.94)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0));

    &::after {
      background: rgba(188, 223, 255, 0.96);
    }
  }

  &.tone-kurihara {
    background:
      linear-gradient(145deg, rgba(255, 241, 178, 0.97), rgba(255, 222, 120, 0.94)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0));

    &::after {
      background: rgba(255, 228, 143, 0.96);
    }
  }

  &.tone-purple {
    background:
      linear-gradient(145deg, rgba(236, 223, 255, 0.97), rgba(215, 192, 255, 0.94)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0));

    &::after {
      background: rgba(222, 203, 255, 0.96);
    }
  }
}

.BubbleMessage.is-streaming .BubbleMessage__row:last-child .BubbleMessage__bubble {
  box-shadow:
    0 18px 42px rgba(7, 12, 24, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.62),
    0 0 0 1px rgba(255, 255, 255, 0.34);
}

.BubbleMessage__bubbleContent,
.BubbleMessage__narrationContent {
  font-size: 1.06rem;
}

.BubbleMessage__bubbleContent :deep(p),
.BubbleMessage__narrationContent :deep(p),
.BubbleMessage__bubbleContent :deep(blockquote),
.BubbleMessage__narrationContent :deep(blockquote),
.BubbleMessage__bubbleContent :deep(ul),
.BubbleMessage__narrationContent :deep(ul),
.BubbleMessage__bubbleContent :deep(ol),
.BubbleMessage__narrationContent :deep(ol),
.BubbleMessage__bubbleContent :deep(pre),
.BubbleMessage__narrationContent :deep(pre) {
  margin: 0;
}

.BubbleMessage__bubbleContent :deep(p + p),
.BubbleMessage__narrationContent :deep(p + p),
.BubbleMessage__bubbleContent :deep(blockquote + p),
.BubbleMessage__narrationContent :deep(blockquote + p),
.BubbleMessage__bubbleContent :deep(p + blockquote),
.BubbleMessage__narrationContent :deep(p + blockquote),
.BubbleMessage__bubbleContent :deep(ul + p),
.BubbleMessage__narrationContent :deep(ul + p),
.BubbleMessage__bubbleContent :deep(ol + p),
.BubbleMessage__narrationContent :deep(ol + p) {
  margin-top: 0.55rem;
}

.BubbleMessage__narration {
  width: 100%;
  animation: narration-enter 0.2s ease-out both;
}

.BubbleMessage__narrationContent {
  width: 100%;
  color: inherit;
  text-align: left;
  line-height: inherit;
  font-style: normal;
  text-shadow: none;
}

@keyframes bubble-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes narration-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .BubbleMessage__row {
    gap: 0.75rem;
  }

  .BubbleMessage__avatar {
    width: 3.35rem;
    height: 3.35rem;
    flex-basis: 3.35rem;
  }

  .BubbleMessage__main {
    max-width: min(82%, 100%);
  }

  .BubbleMessage__bubble {
    min-width: 0;
    padding: 0.92rem 1.05rem;
  }

  .BubbleMessage__narrationContent {
    width: 100%;
    font-size: 0.98rem;
  }
}
</style>
