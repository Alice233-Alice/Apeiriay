<!-- eslint-disable vue/no-v-html -->
<template>
  <section class="timeline-reader" :class="{ 'with-portrait': showPortrait }">
    <div class="timeline-scroll-shell">
      <div
        ref="scrollRef"
        class="timeline-scroll"
        :data-following="isFollowing"
        tabindex="0"
        @scroll="handleScroll"
        @wheel.passive="handleWheel"
        @keydown="handleKeydown"
        @touchstart.passive="handleTouchStart"
        @touchmove.passive="handleTouchMove"
        @touchend.passive="handleTouchEnd"
        @touchcancel.passive="handleTouchEnd"
        @pointerdown.passive="handlePointerDown"
        @pointerup.passive="handlePointerUp"
        @pointercancel.passive="handlePointerUp"
      >
        <div v-if="pseudo.timelineLoading && pseudo.timelineHasOlder" class="timeline-loading">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          正在展开更早历程
        </div>

        <div v-if="pseudo.timelineError" class="timeline-error">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>{{ pseudo.timelineError }}</span>
          <button type="button" @click="requestInitialPage">重试</button>
        </div>

        <template v-for="entry in pseudo.timelineEntries" :key="entry.representativeMessageId">
          <article
            v-if="entry.stage.kind === 'story'"
            class="timeline-entry story-entry"
            :class="{
              latest: entry.representativeMessageId === pseudo.view.latestMessageId,
              rerolling: isRerollTargetEntry(entry),
            }"
            :data-timeline-id="entry.representativeMessageId"
          >
            <header class="entry-heading">
              <span class="entry-ordinal">第 {{ entry.historyIndex }} 回</span>
              <span v-if="entry.turns[0]?.tokenCount !== undefined" class="entry-token-count" title="本层回复 Token">
                {{ entry.turns[0].tokenCount }}t
              </span>
              <span
                v-if="entry.turns[0]?.responseDuration !== undefined"
                class="entry-response-time"
                title="AI 回复总耗时"
              >
                <i class="fa-regular fa-clock"></i>
                {{ formatDuration(entry.turns[0].responseDuration) }}
              </span>
              <span class="entry-rule"></span>
              <span v-if="isRerollTargetEntry(entry)" class="live-mark">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                {{ liveStatus }}
              </span>
              <span v-else-if="entry.representativeMessageId === pseudo.view.latestMessageId" class="latest-mark"
                >当前</span
              >
              <div class="entry-menu-wrap">
                <button
                  type="button"
                  class="entry-menu-trigger"
                  title="回合操作"
                  @click.stop="toggleMenu(entry.representativeMessageId)"
                >
                  <i class="fa-solid fa-ellipsis"></i>
                </button>
                <div v-if="openMenuId === entry.representativeMessageId" class="entry-menu" role="menu" @click.stop>
                  <button
                    type="button"
                    role="menuitem"
                    :disabled="!pseudo.canEditMessage"
                    @click="editTurn(entry.representativeMessageId, `第 ${entry.historyIndex} 回`)"
                  >
                    <i class="fa-solid fa-pen-to-square"></i> 编辑原文
                  </button>
                  <button
                    v-if="entry.representativeMessageId === latestStoryMessageId"
                    type="button"
                    role="menuitem"
                    :disabled="!pseudo.canRerollLatest"
                    @click="rerollLatest(entry.representativeMessageId)"
                  >
                    <i class="fa-solid fa-rotate-right"></i> 重新生成
                  </button>
                  <button
                    v-if="entry.representativeMessageId === latestStoryMessageId"
                    type="button"
                    role="menuitem"
                    class="danger"
                    :disabled="!pseudo.canDeleteLatest"
                    @click="askDelete(entry.representativeMessageId, '本回剧情')"
                  >
                    <i class="fa-solid fa-trash-can"></i> 删除本回
                  </button>
                </div>
              </div>
            </header>

            <template v-if="entry.turns[0]">
              <div v-if="entry.turns[0].userText" class="story-action">
                <span class="action-avatar"><i class="fa-solid fa-feather-pointed"></i></span>
                <div>
                  <div class="action-heading">
                    <small>你的行动</small>
                    <button
                      v-if="entry.turns[0].userMessageId !== undefined"
                      type="button"
                      class="input-edit-button"
                      title="修改这轮输入"
                      :disabled="!pseudo.canEditUserMessage || editingInputId !== null"
                      @click="startInputEdit(entry.turns[0].userMessageId)"
                    >
                      <i class="fa-solid fa-feather-pointed"></i>
                      <span>{{ editingInputId === entry.turns[0].userMessageId ? '改写中' : '改写' }}</span>
                    </button>
                  </div>
                  <InlineInputEditor
                    v-if="editingInputId === entry.turns[0].userMessageId && entry.turns[0].userMessageId !== undefined"
                    :content="entry.turns[0].userText"
                    :user-message-id="entry.turns[0].userMessageId"
                    :assistant-message-id="entry.turns[0].assistantMessageId"
                    variant="story"
                    @cancel="finishInputEdit"
                    @saved="finishInputEdit"
                  />
                  <template v-else>
                    <p :class="{ expanded: expandedPrompts.has(entry.representativeMessageId) }">
                      {{ cleanUserText(entry.turns[0].userText) }}
                    </p>
                    <button
                      v-if="entry.turns[0].userText.length > 110"
                      type="button"
                      @click="togglePrompt(entry.representativeMessageId)"
                    >
                      {{ expandedPrompts.has(entry.representativeMessageId) ? '收起' : '展开完整行动' }}
                    </button>
                  </template>
                </div>
              </div>

              <div
                v-if="storyReasoningText(entry) && !storyReasoningUsesOwnDisclosure(entry)"
                class="entry-context entry-context-before-prose"
              >
                <button
                  type="button"
                  class="reasoning-shell"
                  :class="{ active: isContextOpen(entry.representativeMessageId, 'reasoning') }"
                  :aria-expanded="isContextOpen(entry.representativeMessageId, 'reasoning')"
                  title="展开灵台观照"
                  @click="toggleContext(entry.representativeMessageId, 'reasoning')"
                >
                  <span class="reasoning-shell-glyph"><i class="fa-solid fa-fire-flame-curved"></i></span>
                  <span class="reasoning-shell-title">
                    <strong>灵台观照</strong>
                    <small>一念入定 · 照见推演脉络</small>
                  </span>
                  <span class="reasoning-shell-ornament" aria-hidden="true"><i></i><b>◇</b><i></i></span>
                  <span v-if="isRerollTargetEntry(entry) && liveReasoningStreaming" class="reasoning-shell-state">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    观照流转中<span v-if="pseudo.reasoningDuration">
                      · {{ formatDuration(pseudo.reasoningDuration) }}</span
                    >
                  </span>
                  <span v-else class="reasoning-shell-state">观照已成</span>
                  <i class="fa-solid fa-chevron-down reasoning-shell-chevron"></i>
                </button>
              </div>
              <section
                v-if="
                  (isContextOpen(entry.representativeMessageId, 'reasoning') ||
                    storyReasoningUsesOwnDisclosure(entry)) &&
                  storyReasoningText(entry)
                "
                class="context-detail reasoning-detail reasoning-detail-before-prose"
              >
                <ReasoningDisplay
                  :text="storyReasoningText(entry)"
                  :raw-message="storyReasoningRawMessage(entry)"
                  :message-id="entry.turns[0].assistantMessageId"
                  :open-preset-disclosure="!storyReasoningUsesOwnDisclosure(entry)"
                  :streaming="isRerollTargetEntry(entry) && liveReasoningStreaming"
                  :editable="Boolean(entry.turns[0].reasoningEditable) && !isRerollTargetEntry(entry)"
                />
              </section>

              <RenderedMessageHtml
                v-if="isRerollTargetEntry(entry) && liveStoryHtml"
                class="story-prose reroll-live-copy"
                :html="liveStoryHtml"
                :message-id="entry.turns[0].assistantMessageId"
              />
              <div
                v-else-if="isRerollTargetEntry(entry)"
                class="live-waiting reroll-waiting"
                :class="{ 'reasoning-active': Boolean(liveReasoningText) }"
              >
                <i class="fa-solid fa-feather-pointed"></i>
                {{ pseudo.generationWaitingText }}
              </div>
              <RenderedMessageHtml
                v-else
                class="story-prose"
                :html="formatStory(entry.turns[0].assistantText, entry.turns[0].assistantMessageId)"
                :message-id="entry.turns[0].assistantMessageId"
              />
              <BranchChoicePanel v-if="storyBranchChoices(entry).length" :choices="storyBranchChoices(entry)" />
              <GenerationRecoveryPanel
                v-if="
                  !isRerollTargetEntry(entry) &&
                  (entry.turns[0].generationNotice ||
                    !parseMessageContent(entry.turns[0].assistantText).narrative.trim())
                "
                :message-id="entry.turns[0].assistantMessageId"
                :raw-message="entry.turns[0].assistantText"
                :notice="entry.turns[0].generationNotice"
              />
              <InlineActionChoices
                v-if="entry.representativeMessageId === latestStoryMessageId && !isRerollTargetEntry(entry)"
                :raw-message="entry.turns[0].assistantText"
              />

              <div v-if="storyDiagnostics(storyReasoningRawMessage(entry))" class="entry-context">
                <button
                  type="button"
                  class="variable-shell"
                  :class="{
                    active: isContextOpen(entry.representativeMessageId, 'variable'),
                    invalid: storyDiagnostics(storyReasoningRawMessage(entry))?.parseError,
                  }"
                  :aria-expanded="isContextOpen(entry.representativeMessageId, 'variable')"
                  title="展开本回天道推演"
                  @click="toggleContext(entry.representativeMessageId, 'variable')"
                >
                  <span class="variable-shell-glyph"><i class="fa-solid fa-code-branch"></i></span>
                  <span class="variable-shell-title">
                    <strong>天道推演</strong>
                    <small>因果流转 · 变数落定</small>
                  </span>
                  <span
                    v-if="
                      !isContextOpen(entry.representativeMessageId, 'variable') &&
                      storyVariableSummaryPills(storyReasoningRawMessage(entry)).length
                    "
                    class="variable-shell-pills"
                  >
                    <em
                      v-for="pill in storyVariableSummaryPills(storyReasoningRawMessage(entry))"
                      :key="pill"
                      class="variable-pill"
                    >
                      {{ pill }}
                    </em>
                  </span>
                  <span class="variable-shell-count">
                    {{ variableStatusLabel(storyDiagnostics(storyReasoningRawMessage(entry))) }}
                  </span>
                  <i class="fa-solid fa-chevron-down variable-shell-chevron"></i>
                </button>
              </div>

              <section
                v-if="
                  isContextOpen(entry.representativeMessageId, 'variable') &&
                  storyDiagnostics(storyReasoningRawMessage(entry))
                "
                class="context-detail variable-detail"
              >
                <VariableDiagnosticsPanel :diagnostics="storyDiagnostics(storyReasoningRawMessage(entry))!" dense />
              </section>

              <section v-if="entry.dialogueThreads?.length" class="interlude-thread-list">
                <button
                  v-for="thread in entry.dialogueThreads"
                  :key="thread.sessionId"
                  type="button"
                  class="interlude-thread-trigger"
                  @click="pseudo.openDialogueThread(thread)"
                >
                  <span class="interlude-icon"><i class="fa-solid fa-comments"></i></span>
                  <span>
                    <small>{{ thread.channel === 'transmission' ? '远程传讯' : '当面交谈' }}</small>
                    <strong>与{{ thread.targetName }}交谈 · {{ thread.turnCount }}轮</strong>
                  </span>
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              </section>
            </template>
          </article>

          <article
            v-else
            class="timeline-entry dialogue-entry"
            :class="{ latest: entry.representativeMessageId === pseudo.view.latestMessageId }"
            :data-timeline-id="entry.representativeMessageId"
          >
            <header class="dialogue-block-heading">
              <img
                v-if="dialoguePortrait(entry.stage.targetName, entry.stage.canonicalName)"
                :src="dialoguePortrait(entry.stage.targetName, entry.stage.canonicalName)"
                :alt="entry.stage.targetName"
              />
              <span v-else class="dialogue-avatar"><i class="fa-solid fa-user"></i></span>
              <span>
                <small>{{ entry.stage.channel === 'transmission' ? '传讯往来' : '此刻相谈' }}</small>
                <strong>与{{ entry.stage.targetName }}</strong>
              </span>
              <em>{{ entry.turns.length }} 轮</em>
            </header>

            <div class="dialogue-turn-list">
              <template v-for="turn in entry.turns" :key="turn.assistantMessageId">
                <div v-if="turn.userText" class="timeline-dialogue-turn user">
                  <span>你</span>
                  <div class="dialogue-user-message">
                    <button
                      v-if="turn.userMessageId !== undefined"
                      type="button"
                      class="input-edit-button"
                      title="修改这轮输入"
                      :disabled="!pseudo.canEditUserMessage || editingInputId !== null"
                      @click="startInputEdit(turn.userMessageId)"
                    >
                      <i class="fa-solid fa-feather-pointed"></i>
                      <span>{{ editingInputId === turn.userMessageId ? '改写中' : '改写' }}</span>
                    </button>
                    <InlineInputEditor
                      v-if="editingInputId === turn.userMessageId && turn.userMessageId !== undefined"
                      :content="turn.userText"
                      :user-message-id="turn.userMessageId"
                      :assistant-message-id="turn.assistantMessageId"
                      variant="dialogue"
                      @cancel="finishInputEdit"
                      @saved="finishInputEdit"
                    />
                    <p v-else>{{ turn.userText }}</p>
                  </div>
                </div>
                <div
                  class="timeline-dialogue-turn character"
                  :class="{ live: isRerollTargetTurn(turn.assistantMessageId) }"
                >
                  <div class="dialogue-turn-heading">
                    <span>{{ entry.stage.targetName }}</span>
                    <small v-if="turn.tokenCount !== undefined" class="dialogue-token-count" title="本层回复 Token">
                      {{ turn.tokenCount }}t
                    </small>
                    <small
                      v-if="turn.responseDuration !== undefined"
                      class="dialogue-response-time"
                      title="AI 回复总耗时"
                    >
                      <i class="fa-regular fa-clock"></i>
                      {{ formatDuration(turn.responseDuration) }}
                    </small>
                    <em v-if="isRerollTargetTurn(turn.assistantMessageId)">
                      <i class="fa-solid fa-circle-notch fa-spin"></i>
                      {{ liveStatus }}
                    </em>
                    <button
                      v-if="
                        (isRerollTargetTurn(turn.assistantMessageId) ? liveReasoningText : turn.reasoning) &&
                        !messageUsesOwnDisclosure(
                          isRerollTargetTurn(turn.assistantMessageId) ? pseudo.streamText : turn.assistantText,
                          turn.assistantMessageId,
                        )
                      "
                      type="button"
                      class="reasoning-mini-trigger"
                      :class="{ active: expandedDialogueReasoning === turn.assistantMessageId }"
                      :aria-expanded="expandedDialogueReasoning === turn.assistantMessageId"
                      title="展开灵台观照"
                      @click="toggleDialogueReasoning(turn.assistantMessageId)"
                    >
                      <i class="fa-solid fa-fire-flame-curved"></i>
                      <span>观照</span>
                      <small v-if="turn.reasoningDuration">{{ formatDuration(turn.reasoningDuration) }}</small>
                    </button>
                    <div v-if="!isRerollTargetTurn(turn.assistantMessageId)" class="entry-menu-wrap">
                      <button
                        type="button"
                        class="entry-menu-trigger"
                        title="回应操作"
                        @click.stop="toggleMenu(turn.assistantMessageId)"
                      >
                        <i class="fa-solid fa-ellipsis"></i>
                      </button>
                      <div v-if="openMenuId === turn.assistantMessageId" class="entry-menu" role="menu" @click.stop>
                        <button
                          type="button"
                          role="menuitem"
                          :disabled="!pseudo.canEditMessage"
                          @click="editTurn(turn.assistantMessageId, `与${entry.stage.targetName}交谈`)"
                        >
                          <i class="fa-solid fa-pen-to-square"></i> 编辑回应
                        </button>
                        <button
                          v-if="turn.assistantMessageId === pseudo.view.latestMessageId"
                          type="button"
                          role="menuitem"
                          :disabled="!pseudo.canRerollLatest"
                          @click="rerollLatest(turn.assistantMessageId)"
                        >
                          <i class="fa-solid fa-rotate-right"></i> 重新回应
                        </button>
                        <button
                          v-if="turn.assistantMessageId === pseudo.view.latestMessageId"
                          type="button"
                          role="menuitem"
                          class="danger"
                          :disabled="!pseudo.canDeleteLatest"
                          @click="askDelete(turn.assistantMessageId, '最后一轮交谈')"
                        >
                          <i class="fa-solid fa-trash-can"></i> 删除本轮
                        </button>
                      </div>
                    </div>
                  </div>
                  <template v-if="isRerollTargetTurn(turn.assistantMessageId)">
                    <p v-if="pseudo.streamReaction" class="dialogue-reaction">{{ pseudo.streamReaction }}</p>
                    <RenderedMessageHtml
                      v-if="pseudo.streamText"
                      class="dialogue-copy"
                      :html="liveDialogueHtml"
                      :message-id="turn.assistantMessageId"
                    />
                    <div v-else class="waiting-dots"><i></i><i></i><i></i></div>
                    <section
                      v-if="liveReasoningText && liveReasoningUsesOwnDisclosure"
                      class="context-detail reasoning-detail"
                    >
                      <ReasoningDisplay
                        :text="liveReasoningText"
                        :raw-message="pseudo.streamText"
                        :message-id="turn.assistantMessageId"
                        :open-preset-disclosure="false"
                        :streaming="liveReasoningStreaming"
                      />
                    </section>
                    <section
                      v-else-if="expandedDialogueReasoning === turn.assistantMessageId && liveReasoningText"
                      class="context-detail reasoning-detail"
                    >
                      <ReasoningDisplay
                        :text="liveReasoningText"
                        :raw-message="pseudo.streamText"
                        :message-id="turn.assistantMessageId"
                        :streaming="liveReasoningStreaming"
                      />
                    </section>
                  </template>
                  <template v-else>
                    <p v-if="turn.reaction || dialogueVisible(turn.assistantText).reaction" class="dialogue-reaction">
                      {{ turn.reaction || dialogueVisible(turn.assistantText).reaction }}
                    </p>
                    <RenderedMessageHtml
                      class="dialogue-copy"
                      :html="formatDialogue(turn.assistantText, turn.assistantMessageId)"
                      :message-id="turn.assistantMessageId"
                    />
                    <section
                      v-if="turn.reasoning && messageUsesOwnDisclosure(turn.assistantText, turn.assistantMessageId)"
                      class="context-detail reasoning-detail"
                    >
                      <ReasoningDisplay
                        :text="turn.reasoning"
                        :raw-message="turn.assistantText"
                        :message-id="turn.assistantMessageId"
                        :open-preset-disclosure="false"
                        :editable="Boolean(turn.reasoningEditable)"
                      />
                    </section>
                    <section
                      v-else-if="expandedDialogueReasoning === turn.assistantMessageId"
                      class="context-detail reasoning-detail"
                    >
                      <ReasoningDisplay
                        :text="turn.reasoning"
                        :raw-message="turn.assistantText"
                        :message-id="turn.assistantMessageId"
                        :editable="Boolean(turn.reasoningEditable)"
                      />
                    </section>
                  </template>
                </div>
              </template>

              <template v-if="isLiveDialogueEntry(entry)">
                <div v-if="pendingUserText" class="timeline-dialogue-turn user pending">
                  <span>你</span>
                  <p>{{ pendingUserText }}</p>
                </div>
                <div class="timeline-dialogue-turn character live">
                  <div class="dialogue-turn-heading">
                    <span>{{ entry.stage.targetName }}</span>
                    <em><i class="fa-solid fa-circle-notch fa-spin"></i> {{ liveStatus }}</em>
                    <button
                      v-if="liveReasoningText && !liveReasoningUsesOwnDisclosure"
                      type="button"
                      class="reasoning-mini-trigger"
                      :class="{ active: expandedDialogueReasoning === LIVE_DIALOGUE_REASONING_ID }"
                      :aria-expanded="expandedDialogueReasoning === LIVE_DIALOGUE_REASONING_ID"
                      title="展开灵台观照"
                      @click="toggleDialogueReasoning(LIVE_DIALOGUE_REASONING_ID)"
                    >
                      <i class="fa-solid fa-fire-flame-curved"></i>
                      <span>观照</span>
                    </button>
                  </div>
                  <p v-if="pseudo.streamReaction" class="dialogue-reaction">{{ pseudo.streamReaction }}</p>
                  <RenderedMessageHtml
                    v-if="pseudo.streamText"
                    class="dialogue-copy"
                    :html="liveDialogueHtml"
                    :message-id="pseudo.view.latestMessageId"
                  />
                  <div v-else class="waiting-dots"><i></i><i></i><i></i></div>
                  <section
                    v-if="liveReasoningText && liveReasoningUsesOwnDisclosure"
                    class="context-detail reasoning-detail"
                  >
                    <ReasoningDisplay
                      :text="liveReasoningText"
                      :raw-message="pseudo.streamText"
                      :message-id="pseudo.view.latestMessageId"
                      :open-preset-disclosure="false"
                      :streaming="liveReasoningStreaming"
                    />
                  </section>
                  <section
                    v-else-if="expandedDialogueReasoning === LIVE_DIALOGUE_REASONING_ID && liveReasoningText"
                    class="context-detail reasoning-detail"
                  >
                    <ReasoningDisplay
                      :text="liveReasoningText"
                      :raw-message="pseudo.streamText"
                      :message-id="pseudo.view.latestMessageId"
                      :streaming="liveReasoningStreaming"
                    />
                  </section>
                </div>
              </template>
            </div>
          </article>
        </template>

        <article
          v-if="isLiveStory && !pseudo.isRerolling"
          class="timeline-entry story-entry live-story"
          data-timeline-live="story"
        >
          <header class="entry-heading">
            <span class="entry-ordinal">新回落笔</span>
            <span class="entry-rule"></span>
            <span class="live-mark"><i class="fa-solid fa-circle-notch fa-spin"></i> {{ liveStatus }}</span>
          </header>
          <div v-if="pendingUserText" class="story-action">
            <span class="action-avatar"><i class="fa-solid fa-feather-pointed"></i></span>
            <div>
              <small>你的行动</small>
              <p class="expanded">{{ pendingUserText }}</p>
            </div>
          </div>
          <div
            v-if="liveReasoningText && !liveReasoningUsesOwnDisclosure"
            class="entry-context entry-context-before-prose"
          >
            <button
              type="button"
              class="reasoning-shell"
              :class="{ active: isContextOpen(LIVE_STORY_REASONING_ID, 'reasoning') }"
              :aria-expanded="isContextOpen(LIVE_STORY_REASONING_ID, 'reasoning')"
              title="展开灵台观照"
              @click="toggleContext(LIVE_STORY_REASONING_ID, 'reasoning')"
            >
              <span class="reasoning-shell-glyph"><i class="fa-solid fa-fire-flame-curved"></i></span>
              <span class="reasoning-shell-title">
                <strong>灵台观照</strong>
                <small>一念入定 · 照见推演脉络</small>
              </span>
              <span class="reasoning-shell-ornament" aria-hidden="true"><i></i><b>◇</b><i></i></span>
              <span v-if="liveReasoningStreaming" class="reasoning-shell-state">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                观照流转中<span v-if="pseudo.reasoningDuration"> · {{ formatDuration(pseudo.reasoningDuration) }}</span>
              </span>
              <span v-else class="reasoning-shell-state">观照已成</span>
              <i class="fa-solid fa-chevron-down reasoning-shell-chevron"></i>
            </button>
          </div>
          <section
            v-if="
              liveReasoningText &&
              (isContextOpen(LIVE_STORY_REASONING_ID, 'reasoning') || liveReasoningUsesOwnDisclosure)
            "
            class="context-detail reasoning-detail reasoning-detail-before-prose"
          >
            <ReasoningDisplay
              :text="liveReasoningText"
              :raw-message="pseudo.streamText"
              :message-id="pseudo.view.latestMessageId"
              :open-preset-disclosure="!liveReasoningUsesOwnDisclosure"
              :streaming="liveReasoningStreaming"
            />
          </section>
          <RenderedMessageHtml
            v-if="liveStoryHtml"
            class="story-prose"
            :html="liveStoryHtml"
            :message-id="pseudo.view.latestMessageId"
          />
          <div v-else class="live-waiting">
            <i class="fa-solid fa-feather-pointed"></i>
            {{ pseudo.generationWaitingText }}
          </div>
          <BranchChoicePanel v-if="liveBranchChoices.length" :choices="liveBranchChoices" />
          <div v-if="liveVariableDiagnostics" class="entry-context">
            <button
              type="button"
              class="variable-shell"
              :class="{
                active: isContextOpen(LIVE_STORY_REASONING_ID, 'variable'),
                invalid: liveVariableDiagnostics.parseError,
              }"
              :aria-expanded="isContextOpen(LIVE_STORY_REASONING_ID, 'variable')"
              title="展开本回天道推演"
              @click="toggleContext(LIVE_STORY_REASONING_ID, 'variable')"
            >
              <span class="variable-shell-glyph"><i class="fa-solid fa-code-branch"></i></span>
              <span class="variable-shell-title">
                <strong>天道推演</strong>
                <small>因果流转 · 变数落定</small>
              </span>
              <span
                v-if="!isContextOpen(LIVE_STORY_REASONING_ID, 'variable') && liveVariableSummaryPills.length"
                class="variable-shell-pills"
              >
                <em v-for="pill in liveVariableSummaryPills" :key="pill" class="variable-pill">{{ pill }}</em>
              </span>
              <span class="variable-shell-count">{{ variableStatusLabel(liveVariableDiagnostics) }}</span>
              <i class="fa-solid fa-chevron-down variable-shell-chevron"></i>
            </button>
          </div>
          <section
            v-if="liveVariableDiagnostics && isContextOpen(LIVE_STORY_REASONING_ID, 'variable')"
            class="context-detail variable-detail"
          >
            <VariableDiagnosticsPanel :diagnostics="liveVariableDiagnostics" dense />
          </section>
        </article>

        <div v-if="!pseudo.timelineEntries.length && !pseudo.timelineLoading" class="timeline-empty">
          <i class="fa-solid fa-scroll"></i>
          <strong>长卷尚未展开</strong>
          <span>完成一次推演后，历程会在这里依次铺陈。</span>
        </div>

        <div v-if="pseudo.timelineLoading && pseudo.timelineHasNewer" class="timeline-loading">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          正在接续后来的历程
        </div>
      </div>

      <button v-if="showReturnLatest" type="button" class="return-latest" title="回到最新内容" @click="returnLatest">
        <i class="fa-solid fa-arrow-down"></i>
        <span>{{ pseudo.timelineHasNewer ? '回到最新' : '跟随最新' }}</span>
      </button>
    </div>

    <ScenePortraitRail v-if="showPortrait" class="timeline-portrait" />

    <div v-if="deleteTarget" class="timeline-dialog-backdrop" @click.self="deleteTarget = null">
      <section class="timeline-delete-dialog" role="alertdialog" aria-modal="true">
        <i class="fa-solid fa-trash-can"></i>
        <strong>删除{{ deleteTarget.label }}？</strong>
        <p>会同时删除关联的玩家发言，此操作无法恢复。</p>
        <div>
          <button type="button" :disabled="pseudo.isDeleting" @click="deleteTarget = null">取消</button>
          <button type="button" class="danger" :disabled="pseudo.isDeleting" @click="confirmDelete">
            {{ pseudo.isDeleting ? '正在删除' : '确认删除' }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getCharacterImageCandidates } from '../character-assets';
import { useStreamFollow } from '../composables/use-stream-follow';
import { restoreReadingPosition, type ReadingPosition } from '../reading-position';
import {
  extractVariableUpdateDiagnostics,
  formatMessageHtml,
  formatNarrativeHtml,
  hasInlineReasoningPresetDisclosure,
  parseMessageContent,
  selectReasoningText,
  stripStructuredBlocks,
  summarizeVariableDiagnostics,
} from '../message-content';
import type { PseudoLayerTimelineEntry } from '../pseudo-layer-protocol';
import { useDataStore, usePseudoLayerStore, useThemeStore } from '../store';
import BranchChoicePanel from './BranchChoicePanel.vue';
import GenerationRecoveryPanel from './GenerationRecoveryPanel.vue';
import InlineActionChoices from './InlineActionChoices.vue';
import InlineInputEditor from './InlineInputEditor.vue';
import ReasoningDisplay from './ReasoningDisplay.vue';
import RenderedMessageHtml from './RenderedMessageHtml.vue';
import ScenePortraitRail from './ScenePortraitRail.vue';
import VariableDiagnosticsPanel from './VariableDiagnosticsPanel.vue';

const props = defineProps<{
  anchorMessageId: number;
  initialPosition?: ReadingPosition | null;
  active: boolean;
  immersive?: boolean;
  mobileLayout?: boolean;
}>();
const emit = defineEmits<{
  (event: 'edit-message', messageId: number, label: string): void;
  (event: 'active-entry', messageId: number): void;
}>();
const pseudo = usePseudoLayerStore();
const data = useDataStore();
const appearance = useThemeStore();
const latestStoryMessageId = computed(
  () => pseudo.view.latestStoryMessageId ?? pseudo.view.histories.story.latestMessageId ?? pseudo.view.latestMessageId,
);
const showPortrait = computed(
  () => !props.immersive && !props.mobileLayout && appearance.preferences.showPortraitRail && data.hasGalleryCards,
);
const scrollRef = ref<HTMLElement>();
const {
  isFollowing,
  handleScroll: handleStreamScroll,
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
} = useStreamFollow(scrollRef);
const openMenuId = ref<number | null>(null);
const expandedContext = ref('');
const expandedPrompts = ref(new Set<number>());
const expandedDialogueReasoning = ref<number | null>(null);
const editingInputId = ref<number | null>(null);
const LIVE_STORY_REASONING_ID = -1;
const LIVE_DIALOGUE_REASONING_ID = -2;
const deleteTarget = ref<{ messageId: number; label: string } | null>(null);
let initialPositioned = false;
let pendingInitialPosition = props.initialPosition?.view === 'timeline' ? props.initialPosition : null;
let positionTarget = props.anchorMessageId;
type ViewportAnchor = {
  messageId: number | null;
  relativeTop: number;
  fallbackHeight: number;
  fallbackTop: number;
};
let prependAnchor: ViewportAnchor | null = null;
let savedViewport: { anchor: ViewportAnchor; following: boolean } | null = null;
let activeEntryFrame: number | null = null;
let settleAnchorFrame: number | null = null;
const initialSettleTimers: number[] = [];

type LiveViewportAnchor = {
  kind: 'story' | 'dialogue';
  blockIndex: number;
  text: string;
  relativeTop: number;
};

const isLiveDialogue = computed(() => pseudo.isGenerating && pseudo.generationInteractionMode === 'dialogue');
const isLiveStory = computed(() => pseudo.isGenerating && pseudo.generationInteractionMode !== 'dialogue');
const pendingUserText = computed(() => pseudo.generationUserMessage.trim() || pseudo.draftPrompt.trim());
const liveMessageContent = computed(() => parseMessageContent(pseudo.streamText));
const liveInlineReasoning = computed(() => liveMessageContent.value.reasoning);
const liveReasoningText = computed(() =>
  selectReasoningText(pseudo.liveReasoning, liveInlineReasoning.value?.text ?? ''),
);
const liveReasoningStreaming = computed(
  () =>
    pseudo.isGenerating &&
    (pseudo.liveReasoningState === 'thinking' || Boolean(liveInlineReasoning.value?.isComplete === false)),
);
const messageUsesOwnDisclosure = (rawMessage: string, messageId: number) =>
  appearance.preferences.reasoningAppearance !== 'theme' && hasInlineReasoningPresetDisclosure(rawMessage, messageId);
const liveReasoningUsesOwnDisclosure = computed(() =>
  messageUsesOwnDisclosure(pseudo.streamText, pseudo.view.latestMessageId),
);
const liveStoryHtml = computed(() =>
  formatNarrativeHtml(liveMessageContent.value.narrative, pseudo.view.latestMessageId),
);
const liveBranchChoices = computed(() => liveMessageContent.value.choices);
const liveVariableDiagnostics = computed(() => extractVariableUpdateDiagnostics(pseudo.streamText));
const liveVariableSummaryPills = computed(() => summarizeVariableDiagnostics(liveVariableDiagnostics.value, 3));
const liveDialogueHtml = computed(() => formatMessageHtml(pseudo.streamText, pseudo.view.latestMessageId));
const liveStatus = computed(() => pseudo.generationLabel);
const isRerollTargetTurn = (messageId: number) => pseudo.isRerolling && messageId === pseudo.rerollTargetMessageId;
const isRerollTargetEntry = (entry: PseudoLayerTimelineEntry) =>
  pseudo.isRerolling && entry.messageIds.includes(pseudo.rerollTargetMessageId);
const storyReasoningText = (entry: PseudoLayerTimelineEntry) =>
  isRerollTargetEntry(entry) ? liveReasoningText.value : (entry.turns[0]?.reasoning ?? '');
const storyReasoningRawMessage = (entry: PseudoLayerTimelineEntry) =>
  isRerollTargetEntry(entry) ? pseudo.streamText : (entry.turns[0]?.assistantText ?? '');
const storyBranchChoices = (entry: PseudoLayerTimelineEntry) =>
  parseMessageContent(storyReasoningRawMessage(entry)).choices;
const storyReasoningUsesOwnDisclosure = (entry: PseudoLayerTimelineEntry) => {
  const messageId = entry.turns[0]?.assistantMessageId ?? entry.representativeMessageId;
  return messageUsesOwnDisclosure(storyReasoningRawMessage(entry), messageId);
};
const liveDialogueAttached = computed(() => {
  const latest = pseudo.timelineEntries.at(-1);
  return (
    isLiveDialogue.value &&
    !pseudo.isRerolling &&
    latest?.stage.kind === 'dialogue' &&
    latest.stage.sessionId === pseudo.activeDialogue?.sessionId
  );
});
const showReturnLatest = computed(
  () => pseudo.timelineHasNewer || (!isFollowing.value && (pseudo.isGenerating || pseudo.timelineEntries.length > 0)),
);

const cleanUserText = (text: string) =>
  stripStructuredBlocks(text)
    .replace(/<[^>]+>/g, ' ')
    .trim();
const formatStory = (text: string, messageId: number) =>
  formatNarrativeHtml(parseMessageContent(text).narrative, messageId);
const dialogueVisible = (text: string) => parseMessageContent(text).dialogue;
const formatDialogue = (text: string, messageId: number) =>
  formatMessageHtml(parseMessageContent(text).dialogue.dialogue, messageId);
const storyDiagnostics = (text: string) => extractVariableUpdateDiagnostics(text);
const storyVariableSummaryPills = (text: string) => summarizeVariableDiagnostics(storyDiagnostics(text), 3);
const variableStatusLabel = (diagnostics: ReturnType<typeof extractVariableUpdateDiagnostics>) => {
  if (!diagnostics) return '';
  if (!diagnostics.isComplete) return '接收中';
  if (diagnostics.parseError) return '需检错';
  return `${diagnostics.operations.length} 项`;
};
const formatDuration = (duration: number) => `${Math.max(1, Math.round(duration / 1000))} 秒`;

const dialoguePortrait = (targetName: string, canonicalName: string) => {
  const currentCard = data.galleryCards.find(card => {
    const canonical = card.name === '虞汐' || card.name === '虞颜' ? '虞汐颜' : card.name;
    return canonical === canonicalName;
  });
  if (currentCard) {
    if (currentCard.frontName === targetName) return currentCard.front;
    if (currentCard.backName === targetName) return currentCard.back;
    return currentCard.front;
  }
  const custom = (data.红颜角色库 as Record<string, any>)[canonicalName]?.自定义立绘?.正面;
  return String(custom ?? '').trim() || String(getCharacterImageCandidates(targetName, 'front', targetName)[0] ?? '');
};

const isLiveDialogueEntry = (entry: PseudoLayerTimelineEntry) =>
  liveDialogueAttached.value &&
  entry.stage.kind === 'dialogue' &&
  entry.stage.sessionId === pseudo.activeDialogue?.sessionId &&
  entry === pseudo.timelineEntries.at(-1);

const toggleMenu = (messageId: number) => {
  openMenuId.value = openMenuId.value === messageId ? null : messageId;
};
const editTurn = (messageId: number, label: string) => {
  openMenuId.value = null;
  emit('edit-message', messageId, label);
};
const startInputEdit = (userMessageId: number) => {
  if (!pseudo.canEditUserMessage || editingInputId.value !== null) return;
  openMenuId.value = null;
  pseudo.clearEditError();
  editingInputId.value = userMessageId;
};
const finishInputEdit = () => {
  editingInputId.value = null;
};
const rerollLatest = (messageId: number) => {
  openMenuId.value = null;
  pseudo.reroll(messageId);
};
const askDelete = (messageId: number, label: string) => {
  openMenuId.value = null;
  deleteTarget.value = { messageId, label };
};
const confirmDelete = () => {
  if (!deleteTarget.value) return;
  pseudo.deleteCurrent(deleteTarget.value.messageId);
};
const togglePrompt = (messageId: number) => {
  const next = new Set(expandedPrompts.value);
  if (next.has(messageId)) next.delete(messageId);
  else next.add(messageId);
  expandedPrompts.value = next;
};
const contextKey = (messageId: number, panel: 'reasoning' | 'variable') => `${messageId}:${panel}`;
const isContextOpen = (messageId: number, panel: 'reasoning' | 'variable') =>
  expandedContext.value === contextKey(messageId, panel);
const toggleContext = (messageId: number, panel: 'reasoning' | 'variable') => {
  const key = contextKey(messageId, panel);
  expandedContext.value = expandedContext.value === key ? '' : key;
};
const toggleDialogueReasoning = (messageId: number) => {
  expandedDialogueReasoning.value = expandedDialogueReasoning.value === messageId ? null : messageId;
};

const requestInitialPage = () => {
  if (!props.active || !pseudo.controllerReady || pseudo.timelineLoading) return;
  initialPositioned = false;
  positionTarget = props.anchorMessageId;
  pseudo.resetTimeline(positionTarget);
};

const positionInitialAnchor = () => {
  if (!props.active || initialPositioned || pseudo.timelineLoading || pseudo.timelineEntries.length === 0) return;
  void nextTick(() => {
    const element = scrollRef.value;
    if (!props.active || !element || initialPositioned) return;
    const saved = pendingInitialPosition;
    pendingInitialPosition = null;
    if (saved) {
      if (saved.following) resumeFollowing(false);
      else {
        pauseFollowing();
        if (!restoreReadingPosition(element, saved)) element.scrollTop = saved.top;
      }
      initialPositioned = true;
      return;
    }
    const anchor =
      element.querySelector<HTMLElement>(`[data-timeline-id='${positionTarget}']`) ??
      element.querySelector<HTMLElement>('[data-timeline-id]:last-of-type');
    if (positionTarget < 0 || positionTarget === pseudo.view.latestMessageId || !anchor) {
      resumeFollowing(false);
      [80, 260].forEach(delay => {
        initialSettleTimers.push(
          window.setTimeout(() => {
            if (props.active && isFollowing.value) resumeFollowing(false);
          }, delay),
        );
      });
    } else {
      pauseFollowing();
      element.scrollTop = Math.max(0, anchor.offsetTop - element.clientHeight * 0.18);
    }
    initialPositioned = true;
  });
};

const captureViewportAnchor = (): ViewportAnchor | null => {
  const element = scrollRef.value;
  if (!element) return null;
  const scrollRect = element.getBoundingClientRect();
  const visibleEntry = [...element.querySelectorAll<HTMLElement>('[data-timeline-id]')].find(
    entry => entry.getBoundingClientRect().bottom > scrollRect.top,
  );
  const messageId = Number(visibleEntry?.dataset.timelineId);
  return {
    messageId: Number.isFinite(messageId) ? messageId : null,
    relativeTop: visibleEntry ? visibleEntry.getBoundingClientRect().top - scrollRect.top : 0,
    fallbackHeight: element.scrollHeight,
    fallbackTop: element.scrollTop,
  };
};

const restoreViewportAnchor = (anchor: ViewportAnchor) => {
  const element = scrollRef.value;
  if (!props.active || !element) return;
  const anchoredEntry =
    anchor.messageId === null ? null : element.querySelector<HTMLElement>(`[data-timeline-id='${anchor.messageId}']`);
  if (anchoredEntry) {
    const relativeTop = anchoredEntry.getBoundingClientRect().top - element.getBoundingClientRect().top;
    element.scrollTop += relativeTop - anchor.relativeTop;
    return;
  }
  element.scrollTop = anchor.fallbackTop + (element.scrollHeight - anchor.fallbackHeight);
};

const loadOlder = () => {
  if (!props.active || !scrollRef.value || pseudo.timelineLoading || !pseudo.timelineHasOlder) return;
  prependAnchor = captureViewportAnchor();
  pseudo.loadOlderTimeline();
};

const loadNewer = () => {
  if (pseudo.timelineLoading || !pseudo.timelineHasNewer) return;
  pseudo.loadNewerTimeline();
};

const normalizeAnchorText = (value: string | null | undefined) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const captureLiveViewportAnchor = (): LiveViewportAnchor | null => {
  const element = scrollRef.value;
  if (!element) return null;
  const storyScope = element.querySelector<HTMLElement>("[data-timeline-live='story'], .story-entry.rerolling");
  const dialogueScope = [...element.querySelectorAll<HTMLElement>('.timeline-dialogue-turn.character.live')].at(-1);
  const kind = storyScope ? 'story' : dialogueScope ? 'dialogue' : null;
  const copy =
    storyScope?.querySelector<HTMLElement>('.story-prose') ??
    dialogueScope?.querySelector<HTMLElement>('.dialogue-copy');
  if (!kind || !copy) return null;

  const blocks = [...copy.children].filter(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement && normalizeAnchorText(candidate.textContent).length > 0,
  );
  if (blocks.length === 0) return null;

  const scrollRect = element.getBoundingClientRect();
  const copyRect = copy.getBoundingClientRect();
  // 结束时可能正在阅读旧回合。屏幕外的 live 正文不能成为阅读锚点。
  if (copyRect.bottom <= scrollRect.top || copyRect.top >= scrollRect.bottom) return null;
  const readingLine = scrollRect.top + Math.min(element.clientHeight * 0.32, 220);
  const block =
    blocks.find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return rect.top <= readingLine && rect.bottom >= readingLine;
    }) ??
    blocks.find(candidate => candidate.getBoundingClientRect().bottom > scrollRect.top) ??
    blocks.at(-1)!;

  return {
    kind,
    blockIndex: blocks.indexOf(block),
    text: normalizeAnchorText(block.textContent).slice(0, 160),
    relativeTop: block.getBoundingClientRect().top - scrollRect.top,
  };
};

const restoreLiveViewportAnchor = (anchor: LiveViewportAnchor) => {
  const restore = () => {
    const element = scrollRef.value;
    if (!props.active || !element || isFollowing.value) return;
    const latestEntry = [...element.querySelectorAll<HTMLElement>('[data-timeline-id]')].at(-1);
    if (!latestEntry) return;
    const copies =
      anchor.kind === 'story'
        ? [...latestEntry.querySelectorAll<HTMLElement>('.story-prose')]
        : [...latestEntry.querySelectorAll<HTMLElement>('.dialogue-copy')];
    const copy = copies.at(-1);
    if (!copy) return;
    const blocks = [...copy.children].filter(
      (candidate): candidate is HTMLElement =>
        candidate instanceof HTMLElement && normalizeAnchorText(candidate.textContent).length > 0,
    );
    if (blocks.length === 0) return;
    const matched =
      blocks.find(candidate => {
        const text = normalizeAnchorText(candidate.textContent);
        return text.startsWith(anchor.text) || anchor.text.startsWith(text.slice(0, anchor.text.length));
      }) ?? blocks[anchor.blockIndex];
    if (!matched) return;
    const relativeTop = matched.getBoundingClientRect().top - element.getBoundingClientRect().top;
    element.scrollTop += relativeTop - anchor.relativeTop;
  };

  void nextTick(() => {
    restore();
    const view = scrollRef.value?.ownerDocument.defaultView;
    if (!view) return;
    settleAnchorFrame = view.requestAnimationFrame(() => {
      settleAnchorFrame = null;
      restore();
    });
  });
};

const updateActiveEntry = () => {
  activeEntryFrame = null;
  const element = scrollRef.value;
  if (!props.active || !element) return;
  const center = element.getBoundingClientRect().top + element.clientHeight / 2;
  const entries = [...element.querySelectorAll<HTMLElement>('[data-timeline-id]')];
  const closest = entries.reduce<{ id: number; distance: number } | null>((current, entry) => {
    const rect = entry.getBoundingClientRect();
    const distance = Math.abs((rect.top + rect.bottom) / 2 - center);
    const id = Number(entry.dataset.timelineId);
    if (!Number.isFinite(id) || (current && current.distance <= distance)) return current;
    return { id, distance };
  }, null);
  if (closest) emit('active-entry', closest.id);
};

const handleScroll = () => {
  if (!props.active || !initialPositioned) return;
  handleStreamScroll();
  const element = scrollRef.value;
  if (!element) return;
  if (element.scrollTop <= 120) loadOlder();
  if (element.scrollHeight - element.scrollTop - element.clientHeight <= 160) loadNewer();
  if (activeEntryFrame === null) activeEntryFrame = window.requestAnimationFrame(updateActiveEntry);
};

const returnLatest = () => {
  if (pseudo.timelineHasNewer) {
    pendingInitialPosition = null;
    positionTarget = pseudo.view.latestMessageId;
    initialPositioned = false;
    pseudo.resetTimeline(pseudo.view.latestMessageId);
    return;
  }
  resumeFollowing(!appearance.preferences.reduceMotion);
};

const handleDocumentPointer = (event: PointerEvent) => {
  if (!(event.target as HTMLElement | null)?.closest('.entry-menu-wrap')) openMenuId.value = null;
};
const handleDocumentKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    openMenuId.value = null;
    deleteTarget.value = null;
  }
};

watch(
  () => props.active,
  active => {
    if (!active) {
      // Capture before v-show hides the reader and its layout becomes zero-sized.
      // A scroll event may still be queued when the player immediately changes tabs.
      handleStreamScroll();
      const anchor = captureViewportAnchor();
      savedViewport = initialPositioned && anchor ? { anchor, following: isFollowing.value } : null;
      pauseFollowing();
      return;
    }
    void nextTick(() => {
      if (!props.active) return;
      if (!initialPositioned) {
        if (pseudo.timelineEntries.length > 0) positionInitialAnchor();
        else requestInitialPage();
        return;
      }
      const saved = savedViewport;
      savedViewport = null;
      if (saved?.following) resumeFollowing(false);
      else if (saved) restoreViewportAnchor(saved.anchor);
      updateActiveEntry();
    });
  },
  { flush: 'pre' },
);

watch(
  () => pseudo.controllerReady,
  ready => {
    if (ready && pseudo.timelineEntries.length === 0) requestInitialPage();
  },
  { immediate: true },
);
watch(
  () => pseudo.timelineLoading,
  (loading, previous) => {
    if (previous && !loading && prependAnchor) {
      const anchor = prependAnchor;
      prependAnchor = null;
      void nextTick(() => restoreViewportAnchor(anchor));
    }
    if (!loading) positionInitialAnchor();
  },
);
watch(
  () => pseudo.timelineEntries,
  () => {
    if (!props.active || !initialPositioned || isFollowing.value || prependAnchor) return;
    const anchor = captureViewportAnchor();
    if (anchor?.messageId === null || !anchor) return;
    // MVU 补写和超时后的历史重读只更新内容；保留正在阅读的楼层及楼内偏移。
    void nextTick(() => {
      if (!isFollowing.value && initialPositioned) restoreViewportAnchor(anchor);
    });
  },
  { flush: 'pre' },
);
watch(
  () => pseudo.timelineEntries.length,
  () => {
    positionInitialAnchor();
    if (props.active && initialPositioned && isFollowing.value) queueFollow();
  },
);
watch([() => pseudo.streamText, () => pseudo.streamReaction, () => pseudo.liveReasoning], () => {
  if (props.active) queueFollow();
});
watch(
  () => pseudo.isGenerating,
  (generating, wasGenerating) => {
    if (!wasGenerating && generating) {
      if (expandedContext.value === contextKey(LIVE_STORY_REASONING_ID, 'reasoning')) expandedContext.value = '';
      if (expandedDialogueReasoning.value === LIVE_DIALOGUE_REASONING_ID) expandedDialogueReasoning.value = null;
      if (
        props.active &&
        !pseudo.isRerolling &&
        isLiveStory.value &&
        (pseudo.generationState === 'preparing' || pseudo.generationState === 'generating')
      ) {
        resumeFollowing(false);
      }
    }
    if (!props.active || !wasGenerating || generating) return;
    if (isFollowing.value) {
      queueFollow();
      return;
    }
    const anchor = captureLiveViewportAnchor();
    if (anchor) restoreLiveViewportAnchor(anchor);
  },
  { flush: 'pre' },
);
watch(
  () => props.anchorMessageId,
  () => requestInitialPage(),
);
watch(
  () => pseudo.isDeleting,
  deleting => {
    if (!deleting) deleteTarget.value = null;
  },
);

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointer);
  document.addEventListener('keydown', handleDocumentKeydown);
  requestInitialPage();
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointer);
  document.removeEventListener('keydown', handleDocumentKeydown);
  if (activeEntryFrame !== null) window.cancelAnimationFrame(activeEntryFrame);
  if (settleAnchorFrame !== null) window.cancelAnimationFrame(settleAnchorFrame);
  initialSettleTimers.splice(0).forEach(timer => window.clearTimeout(timer));
});
</script>

<style lang="scss" scoped>
.timeline-reader {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-areas: 'copy';
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  color: var(--text-primary);
  background: var(--reading-surface);
  isolation: isolate;
}

.timeline-reader.with-portrait {
  grid-template-areas: 'copy portrait';
  grid-template-columns: minmax(0, 1fr) clamp(260px, 23vw, 360px);
}

.timeline-reader::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--reading-material);
  opacity: 0.82;
  pointer-events: none;
}

.timeline-scroll-shell {
  grid-area: copy;
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.timeline-scroll {
  position: relative;
  height: 100%;
  padding: clamp(18px, 3vw, 42px) clamp(14px, 5vw, 72px) 80px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--line-strong) transparent;
  scrollbar-width: thin;
}

.timeline-portrait {
  grid-area: portrait;
  z-index: 1;
}

.timeline-entry {
  width: min(100%, var(--reading-measure));
  margin: 0 auto clamp(28px, 5vw, 62px);
}

.story-entry {
  position: relative;
  padding: clamp(18px, 3.8vw, 38px);
  border: 1px solid color-mix(in srgb, var(--line-subtle) 86%, transparent);
  border-radius: 8px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 66%, transparent), transparent 22%),
    color-mix(in srgb, var(--reading-surface) 88%, transparent);
  box-shadow:
    inset 0 0 44px color-mix(in srgb, var(--stage-shadow) 12%, transparent),
    0 18px 44px color-mix(in srgb, var(--stage-shadow) 20%, transparent);
}

.story-entry.latest {
  border-color: color-mix(in srgb, var(--gold) 42%, var(--line-subtle));
}

.interlude-thread-list {
  margin-top: 18px;
  display: grid;
  gap: 7px;
}
.interlude-thread-trigger {
  width: 100%;
  min-height: 48px;
  padding: 7px 10px;
  display: grid;
  grid-template-columns: 31px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--jade) 25%, var(--line-subtle));
  border-radius: 6px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--jade) 5%, var(--surface-inset));
  text-align: left;
  cursor: pointer;
}
.interlude-thread-trigger:hover {
  color: var(--gold);
  border-color: var(--line-strong);
  background: var(--button-hover);
}
.interlude-thread-trigger > span:nth-child(2) {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.interlude-thread-trigger small {
  color: var(--text-secondary);
  font-size: 8px;
}
.interlude-thread-trigger strong {
  overflow: hidden;
  color: var(--text-accent);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.interlude-icon {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-subtle);
  border-radius: 50%;
  color: var(--jade);
  background: var(--surface-raised);
}

.entry-heading {
  margin-bottom: clamp(18px, 3vw, 30px);
  display: flex;
  align-items: center;
  gap: 10px;
}

.entry-ordinal {
  flex: none;
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.entry-token-count,
.dialogue-token-count,
.entry-response-time,
.dialogue-response-time {
  flex: none;
  color: var(--text-secondary);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 9px;
  font-weight: 500;
}

.entry-response-time,
.dialogue-response-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: inherit;
}

.entry-rule {
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, var(--line-strong), transparent);
}

.latest-mark,
.live-mark {
  flex: none;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--gold) 46%, var(--line-subtle));
  border-radius: 999px;
  color: var(--gold);
  font-size: 9px;
}

.live-mark {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--jade);
  border-color: color-mix(in srgb, var(--jade) 46%, var(--line-subtle));
}

.entry-menu-wrap {
  position: relative;
  flex: none;
}

.entry-menu-trigger {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}

.entry-menu-trigger:hover {
  border-color: var(--line-subtle);
  color: var(--gold);
  background: var(--button-hover);
}

.entry-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 5px);
  right: 0;
  width: 142px;
  padding: 5px;
  display: grid;
  gap: 2px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface-raised);
  box-shadow: 0 14px 36px var(--stage-shadow);
}

.entry-menu button {
  min-height: 34px;
  padding: 0 9px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.entry-menu button:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--button-hover);
}

.entry-menu button.danger {
  color: var(--semantic-danger);
}

.entry-menu button:disabled {
  opacity: 0.34;
  cursor: not-allowed;
}

.story-action {
  margin: 0 0 clamp(22px, 3vw, 34px);
  padding: 11px 14px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  border-left: 2px solid var(--jade);
  border-radius: 0 6px 6px 0;
  background: color-mix(in srgb, var(--jade) 7%, var(--surface-inset));
}

.action-avatar {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 12%, transparent);
}

.story-action small {
  display: block;
  margin-bottom: 3px;
  color: var(--jade);
  font-size: 9px;
}

.action-heading {
  min-height: 20px;
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.action-heading small {
  margin-bottom: 0;
}

.story-action p {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.story-action p.expanded {
  display: block;
  overflow: visible;
}

.story-action button {
  margin-top: 5px;
  padding: 0;
  border: 0;
  color: var(--gold-soft);
  background: transparent;
  font-size: 9px;
  cursor: pointer;
}

.input-edit-button {
  position: relative;
  min-height: 27px;
  padding: 3px 11px 3px 31px !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0 !important;
  border-radius: 2px 10px 2px 10px;
  color: color-mix(in srgb, var(--jade) 82%, var(--text-accent)) !important;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 11%, transparent), transparent 88%),
    color-mix(in srgb, var(--surface-inset) 30%, transparent) !important;
  box-shadow:
    inset 1px 0 color-mix(in srgb, var(--jade) 38%, transparent),
    inset 0 -1px color-mix(in srgb, var(--gold) 14%, transparent);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-size: 9px;
  letter-spacing: 0.14em;
  isolation: isolate;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.input-edit-button::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 8px;
  width: 13px;
  height: 13px;
  border: 1px solid color-mix(in srgb, var(--jade) 42%, transparent);
  background: color-mix(in srgb, var(--jade) 7%, transparent);
  box-shadow: inset 0 0 7px color-mix(in srgb, var(--jade) 12%, transparent);
  transform: translateY(-50%) rotate(45deg);
}

.input-edit-button::after {
  content: '';
  position: absolute;
  right: 7px;
  bottom: 3px;
  left: 29px;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--jade) 52%, transparent), transparent);
  opacity: 0.62;
}

.input-edit-button > i {
  position: absolute;
  left: 11px;
  color: var(--jade);
  font-size: 7px;
  transform: rotate(-14deg);
}

.story-action .input-edit-button {
  margin: 0 0 0 auto;
}

.input-edit-button:hover:not(:disabled) {
  color: var(--text-accent) !important;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 17%, transparent), transparent 92%),
    color-mix(in srgb, var(--surface-inset) 46%, transparent) !important;
  box-shadow:
    inset 1px 0 color-mix(in srgb, var(--jade) 58%, transparent),
    inset 0 -1px color-mix(in srgb, var(--gold) 25%, transparent),
    0 0 14px color-mix(in srgb, var(--jade) 9%, transparent);
  transform: translateY(-1px);
}

.input-edit-button:disabled {
  opacity: 0.34;
  cursor: not-allowed;
}

.story-prose {
  max-width: var(--reading-measure);
  margin: 0 auto;
  color: var(--text-primary);
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif;
  font-size: var(--reading-font-size);
  line-height: var(--reading-line-height);
  overflow-wrap: anywhere;
}

.story-prose :deep(p) {
  margin: 0 0 1.15em;
  text-indent: 2em;
}

.timeline-reader :deep(q) {
  quotes: none;
}

.timeline-reader :deep(q::before),
.timeline-reader :deep(q::after) {
  content: none;
}

.entry-context {
  margin-top: 24px;
  padding-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  border-top: 1px solid var(--line-subtle);
}

.entry-context-before-prose {
  margin-top: 0;
  margin-bottom: clamp(18px, 2.6vw, 28px);
  padding-top: 0;
  border-top: 0;
}

.reasoning-detail-before-prose {
  margin-bottom: clamp(20px, 2.8vw, 30px);
}

.entry-context button {
  min-height: 29px;
  padding: 0 9px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--surface-inset);
  font-size: 9px;
  cursor: pointer;
}

.entry-context button.active {
  color: var(--gold);
  border-color: var(--line-strong);
  background: var(--button-active);
}

.entry-context button.reasoning-shell {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-height: 48px;
  margin-inline: auto;
  padding: 5px 13px 5px 5px;
  gap: 11px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--jade) 42%, var(--line-subtle));
  border-radius: 8px;
  color: var(--text-accent);
  background:
    radial-gradient(circle at 4% 50%, color-mix(in srgb, var(--jade) 16%, transparent), transparent 20%),
    repeating-linear-gradient(90deg, transparent 0 52px, color-mix(in srgb, var(--jade) 3%, transparent) 53px 54px),
    linear-gradient(110deg, color-mix(in srgb, var(--surface-raised) 94%, transparent), var(--surface-inset));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 7%, transparent),
    inset 0 -14px 30px color-mix(in srgb, var(--stage-shadow) 10%, transparent),
    0 7px 22px color-mix(in srgb, var(--stage-shadow) 28%, transparent);
  isolation: isolate;
}

.entry-context button.reasoning-shell::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 3px;
  border: 1px solid color-mix(in srgb, var(--gold) 12%, transparent);
  border-radius: 5px;
  background: linear-gradient(
    105deg,
    transparent 18%,
    color-mix(in srgb, var(--gold) 8%, transparent),
    transparent 74%
  );
  opacity: 0.72;
  transition: opacity 0.2s ease;
}

.entry-context button.reasoning-shell::after {
  content: '✦';
  position: absolute;
  z-index: -1;
  right: 54px;
  bottom: -8px;
  color: color-mix(in srgb, var(--gold) 18%, transparent);
  font-size: 25px;
  line-height: 1;
  transform: rotate(22deg);
}

.entry-context button.reasoning-shell:hover::before,
.entry-context button.reasoning-shell.active::before {
  opacity: 1;
}

.entry-context button.reasoning-shell.active {
  border-color: color-mix(in srgb, var(--gold) 56%, var(--line-strong));
  color: var(--gold);
  background:
    radial-gradient(circle at 14% 0%, color-mix(in srgb, var(--gold) 20%, transparent), transparent 48%),
    linear-gradient(110deg, color-mix(in srgb, var(--button-active) 88%, transparent), var(--surface-inset));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 11%, transparent),
    0 0 20px color-mix(in srgb, var(--accent-glow) 32%, transparent);
}

.reasoning-shell-glyph {
  position: relative;
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 40%, transparent);
  border-radius: 50%;
  color: var(--jade);
  background: color-mix(in srgb, var(--surface-inset) 78%, transparent);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--jade) 5%, transparent),
    0 0 16px color-mix(in srgb, var(--jade) 13%, transparent);
}

.reasoning-shell-glyph::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px dashed color-mix(in srgb, var(--jade) 22%, transparent);
  border-radius: 50%;
}

.reasoning-shell.active .reasoning-shell-glyph {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 54%, transparent);
  box-shadow: 0 0 15px color-mix(in srgb, var(--accent-glow) 38%, transparent);
}

.reasoning-shell-title {
  min-width: 116px;
  display: grid;
  gap: 1px;
  text-align: left;
}

.reasoning-shell-title strong {
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', STSong, serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.14em;
}

.reasoning-shell-title small {
  color: color-mix(in srgb, var(--text-secondary) 82%, transparent);
  font-size: 8px;
  font-weight: 400;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.reasoning-shell-ornament {
  min-width: 40px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--gold) 50%, transparent);
}

.reasoning-shell-ornament i {
  height: 1px;
  flex: 1;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--jade) 34%, transparent),
    color-mix(in srgb, var(--gold) 42%, transparent)
  );
}

.reasoning-shell-ornament i:last-child {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--gold) 42%, transparent),
    color-mix(in srgb, var(--jade) 34%, transparent),
    transparent
  );
}

.reasoning-shell-ornament b {
  font-size: 9px;
  font-weight: 400;
}

.reasoning-shell > span:not(.reasoning-shell-glyph, .reasoning-shell-title, .reasoning-shell-ornament) {
  min-width: 70px;
  padding-left: 11px;
  border-left: 1px solid color-mix(in srgb, var(--gold) 26%, transparent);
  color: var(--gold-soft);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
  text-align: left;
  white-space: nowrap;
}

.reasoning-shell-state {
  display: inline-flex;
  align-items: center;
  color: var(--jade) !important;
  font-family: inherit !important;
  font-size: 9px !important;
  letter-spacing: 0.08em;
}

.reasoning-shell-chevron {
  color: var(--text-secondary);
  font-size: 8px;
  transition: transform 0.2s ease;
}

.reasoning-shell.active .reasoning-shell-chevron {
  color: var(--gold-soft);
  transform: rotate(180deg);
}

.entry-context button.variable-shell {
  position: relative;
  width: auto;
  max-width: 100%;
  min-width: 240px;
  min-height: 46px;
  padding: 5px 12px 5px 5px;
  gap: 9px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--jade) 34%, var(--line-subtle));
  border-radius: 9px 18px 18px 9px;
  color: var(--text-accent);
  background:
    radial-gradient(circle at 12% 50%, color-mix(in srgb, var(--jade) 16%, transparent), transparent 31%),
    linear-gradient(
      112deg,
      color-mix(in srgb, var(--surface-raised) 92%, transparent),
      color-mix(in srgb, var(--surface-inset) 96%, transparent)
    );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 6%, transparent),
    inset -18px 0 32px color-mix(in srgb, var(--stage-shadow) 12%, transparent),
    0 7px 20px color-mix(in srgb, var(--stage-shadow) 24%, transparent);
  isolation: isolate;
}

.variable-shell-pills {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-left: 4px;
}

.variable-pill {
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--jade) 34%, var(--line-subtle));
  border-radius: 999px;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 10%, var(--surface-inset));
  font-size: 10px;
  font-style: normal;
  font-weight: 550;
  white-space: nowrap;
}

.entry-context button.variable-shell::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 3px;
  border: 1px solid color-mix(in srgb, var(--gold) 11%, transparent);
  border-radius: 6px 15px 15px 6px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--jade) 7%, transparent), transparent 38%),
    repeating-linear-gradient(135deg, transparent 0 12px, color-mix(in srgb, var(--gold) 3%, transparent) 13px 14px);
  pointer-events: none;
}

.entry-context button.variable-shell::after {
  content: '◇';
  position: absolute;
  z-index: -1;
  right: 43px;
  color: color-mix(in srgb, var(--gold) 16%, transparent);
  font-size: 28px;
  line-height: 1;
  transform: rotate(45deg);
  pointer-events: none;
}

.variable-shell-glyph {
  position: relative;
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--jade) 44%, transparent);
  border-radius: 7px;
  color: var(--jade);
  background: color-mix(in srgb, var(--surface-inset) 76%, transparent);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--jade) 5%, transparent),
    0 0 14px color-mix(in srgb, var(--jade) 12%, transparent);
}

.variable-shell-glyph::before,
.variable-shell-glyph::after {
  content: '';
  position: absolute;
  width: 5px;
  height: 1px;
  top: 50%;
  background: color-mix(in srgb, var(--gold) 48%, transparent);
}

.variable-shell-glyph::before {
  right: calc(100% + 2px);
}

.variable-shell-glyph::after {
  left: calc(100% + 2px);
}

.variable-shell-title {
  min-width: 0;
  display: grid;
  gap: 1px;
  text-align: left;
}

.variable-shell-title strong {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.variable-shell-title small {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 8px;
  font-weight: 400;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variable-shell-count {
  min-width: 42px;
  margin-left: auto;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--gold) 24%, var(--line-subtle));
  border-radius: 999px;
  color: var(--gold-soft);
  background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.variable-shell-chevron {
  flex: none;
  color: var(--text-secondary);
  font-size: 8px;
  transition: transform 0.2s ease;
}

.entry-context button.variable-shell.active {
  border-color: color-mix(in srgb, var(--gold) 54%, var(--line-strong));
  color: var(--gold);
  background:
    radial-gradient(circle at 12% 50%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 34%),
    linear-gradient(112deg, color-mix(in srgb, var(--button-active) 88%, transparent), var(--surface-inset));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--gold) 12%, transparent),
    0 0 20px color-mix(in srgb, var(--accent-glow) 28%, transparent);
}

.variable-shell.active .variable-shell-glyph {
  color: var(--gold);
  border-color: color-mix(in srgb, var(--gold) 52%, transparent);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--gold) 6%, transparent),
    0 0 15px color-mix(in srgb, var(--accent-glow) 34%, transparent);
}

.variable-shell.active .variable-shell-chevron {
  color: var(--gold-soft);
  transform: rotate(180deg);
}

.entry-context button.invalid {
  color: var(--semantic-danger);
}

.entry-context button.variable-shell.invalid {
  border-color: color-mix(in srgb, var(--semantic-danger) 52%, var(--line-subtle));
}

.variable-shell.invalid .variable-shell-glyph,
.variable-shell.invalid .variable-shell-count {
  color: var(--semantic-danger);
  border-color: color-mix(in srgb, var(--semantic-danger) 42%, var(--line-subtle));
}

.context-detail {
  margin-top: 10px;
  padding: 13px 15px;
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-inset) 84%, transparent);
  font-size: 11px;
  line-height: 1.72;
}

/* Rich presets and the built-in theme own their card surface. Do not place the generic timeline
 * detail panel behind them, otherwise its padding becomes a visible dark
 * frame around the reasoning card. */
.context-detail.reasoning-detail:has(
    .reasoning-presentation:is([data-presentation='preset'], [data-presentation='theme'])
  ) {
  padding: 0;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
}

.variable-analysis {
  margin: 0 0 10px;
  color: var(--text-primary);
}

.variable-detail ol {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  list-style: none;
}

.variable-detail li {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.variable-detail li span {
  flex: none;
  color: var(--gold);
  text-transform: uppercase;
}

.variable-detail code {
  min-width: 0;
  overflow-wrap: anywhere;
}

.context-error {
  color: var(--semantic-danger);
}

.dialogue-entry {
  overflow: visible;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 76%, transparent);
  box-shadow: 0 18px 42px color-mix(in srgb, var(--stage-shadow) 18%, transparent);
}

.dialogue-entry.latest {
  border-color: color-mix(in srgb, var(--jade) 42%, var(--line-subtle));
}

.dialogue-block-heading {
  min-height: 54px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--line-subtle);
  background: color-mix(in srgb, var(--surface-inset) 72%, transparent);
}

.dialogue-block-heading img,
.dialogue-avatar {
  width: 36px;
  height: 36px;
  flex: none;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  object-fit: cover;
}

.dialogue-avatar {
  display: grid;
  place-items: center;
  color: var(--jade);
  background: color-mix(in srgb, var(--jade) 8%, var(--surface-inset));
}

.dialogue-block-heading > span:not(.dialogue-avatar) {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.dialogue-block-heading small {
  color: var(--text-secondary);
  font-size: 9px;
}

.dialogue-block-heading strong {
  color: var(--text-accent);
  font-family: 'Songti SC', 'STSong', serif;
}

.dialogue-block-heading em {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 9px;
  font-style: normal;
}

.dialogue-turn-list {
  padding: clamp(14px, 2.8vw, 28px);
  display: grid;
  gap: 13px;
}

.timeline-dialogue-turn {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.timeline-dialogue-turn.user {
  justify-content: flex-end;
}

.timeline-dialogue-turn.user > span {
  order: 2;
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 10%, var(--surface-inset));
  font-size: 9px;
}

.timeline-dialogue-turn.user > p,
.dialogue-user-message > p {
  max-width: min(78%, 660px);
  margin: 0;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--gold) 20%, var(--line-subtle));
  border-radius: 8px 2px 8px 8px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--gold) 7%, var(--surface-inset));
  line-height: 1.65;
  white-space: pre-wrap;
}

.dialogue-user-message {
  max-width: min(78%, 660px);
  display: grid;
  justify-items: end;
  gap: 4px;
}

.dialogue-user-message > p {
  width: 100%;
  max-width: none;
}

.timeline-dialogue-turn.character {
  max-width: min(86%, 760px);
  padding: 10px 12px;
  display: block;
  border: 1px solid color-mix(in srgb, var(--jade) 18%, var(--line-subtle));
  border-radius: 2px 8px 8px 8px;
  background: color-mix(in srgb, var(--jade) 5%, var(--surface-inset));
}

.dialogue-turn-heading {
  min-height: 24px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--jade);
  font-size: 10px;
}

.dialogue-turn-heading > button {
  padding: 3px 5px;
  border: 0;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
}

.dialogue-turn-heading > button.reasoning-mini-trigger {
  min-height: 24px;
  padding: 3px 7px;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--jade) 28%, var(--line-subtle));
  border-radius: 999px;
  color: var(--jade);
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--jade) 13%, transparent), transparent 48%),
    color-mix(in srgb, var(--surface-inset) 82%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 4%, transparent);
}

.dialogue-turn-heading > button.reasoning-mini-trigger:hover,
.dialogue-turn-heading > button.reasoning-mini-trigger.active {
  border-color: color-mix(in srgb, var(--gold) 46%, var(--line-strong));
  color: var(--gold);
  background: color-mix(in srgb, var(--button-active) 82%, var(--surface-inset));
  box-shadow: 0 0 13px color-mix(in srgb, var(--accent-glow) 24%, transparent);
}

.reasoning-mini-trigger > span {
  font-family: 'Songti SC', STSong, serif;
  letter-spacing: 0.08em;
}

.reasoning-mini-trigger > small {
  padding-left: 5px;
  border-left: 1px solid color-mix(in srgb, var(--gold) 22%, transparent);
  color: var(--gold-soft);
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}

.dialogue-turn-heading > .entry-menu-wrap {
  margin-left: auto;
}

.dialogue-turn-heading em {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 9px;
  font-style: normal;
}

.dialogue-reaction {
  margin: 3px 0 8px;
  color: var(--text-secondary);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 11px;
  font-style: italic;
}

.dialogue-copy {
  color: var(--text-primary);
  font-size: calc(var(--reading-font-size) * 0.9);
  line-height: 1.82;
}

.dialogue-copy :deep(p) {
  margin: 0 0 0.7em;
}

.waiting-dots {
  min-height: 26px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.waiting-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--jade);
  animation: timeline-dot 1.2s ease-in-out infinite;
}

.waiting-dots i:nth-child(2) {
  animation-delay: 0.14s;
}

.waiting-dots i:nth-child(3) {
  animation-delay: 0.28s;
}

.live-waiting,
.timeline-loading,
.timeline-empty,
.timeline-error {
  width: min(100%, var(--reading-measure));
  margin: 16px auto;
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  text-align: center;
}

.reroll-waiting {
  min-height: clamp(150px, 28vh, 260px);
}

.reroll-waiting.reasoning-active {
  min-height: 56px;
  margin-top: 0;
}

.timeline-empty {
  min-height: 260px;
  flex-direction: column;
}

.timeline-empty > i {
  color: var(--gold);
  font-size: 24px;
}

.timeline-empty strong {
  color: var(--text-accent);
}

.timeline-error {
  color: var(--semantic-danger);
}

.timeline-error button {
  padding: 5px 9px;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  color: var(--text-primary);
  background: var(--button-bg);
  cursor: pointer;
}

.return-latest {
  position: absolute;
  z-index: 8;
  right: clamp(14px, 3vw, 28px);
  bottom: 16px;
  min-height: 34px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  color: var(--gold);
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
  box-shadow: 0 10px 26px var(--stage-shadow);
  cursor: pointer;
}

.timeline-dialog-backdrop {
  position: fixed;
  z-index: 9300;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(1, 6, 10, 0.78);
}

.timeline-delete-dialog {
  width: min(92vw, 380px);
  padding: 22px;
  display: grid;
  gap: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  color: var(--text-primary);
  background: var(--surface-raised);
  box-shadow: 0 24px 64px var(--stage-shadow);
  text-align: center;
}

.timeline-delete-dialog > i {
  color: var(--semantic-danger);
  font-size: 22px;
}

.timeline-delete-dialog p {
  margin: 0;
  color: var(--text-secondary);
}

.timeline-delete-dialog > div {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.timeline-delete-dialog button {
  min-width: 88px;
  min-height: 34px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  color: var(--text-primary);
  background: var(--button-bg);
  cursor: pointer;
}

.timeline-delete-dialog button.danger {
  color: #fff;
  border-color: var(--semantic-danger);
  background: var(--semantic-danger);
}

@keyframes timeline-dot {
  0%,
  70%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  35% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@media screen and (max-width: 760px) {
  .timeline-scroll {
    padding: 12px 8px 66px;
  }

  .timeline-entry {
    margin-bottom: 22px;
  }

  .story-entry {
    padding: 16px 13px 20px;
    border-right: 0;
    border-left: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .entry-heading {
    margin-bottom: 16px;
  }

  .story-action {
    margin-bottom: 20px;
    padding: 9px 10px;
  }

  .entry-context button.reasoning-shell {
    min-height: 44px;
    padding: 4px 9px 4px 4px;
    gap: 8px;
    border-radius: 7px;
  }

  .entry-context button.variable-shell {
    width: min(100%, 238px);
    min-height: 43px;
    padding: 4px 8px 4px 4px;
    gap: 7px;
  }

  .variable-shell-glyph {
    width: 32px;
    height: 32px;
  }

  .variable-shell-title small {
    display: none;
  }

  .variable-shell-count {
    min-width: 38px;
    padding-inline: 6px;
  }

  .reasoning-shell-glyph {
    width: 32px;
    height: 32px;
  }

  .reasoning-shell-title {
    min-width: 90px;
  }

  .reasoning-shell-title strong {
    font-size: 11px;
  }

  .reasoning-shell-title small,
  .reasoning-shell-ornament {
    display: none;
  }

  .reasoning-shell > span:not(.reasoning-shell-glyph, .reasoning-shell-title, .reasoning-shell-ornament) {
    min-width: 58px;
    margin-left: auto;
    padding-left: 8px;
  }

  .story-prose {
    font-size: var(--reading-font-size);
    line-height: var(--reading-line-height);
  }

  .dialogue-entry {
    border-right: 0;
    border-left: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .dialogue-turn-list {
    padding: 12px 10px 16px;
  }

  .timeline-dialogue-turn.user > p,
  .dialogue-user-message {
    max-width: 84%;
  }

  .timeline-dialogue-turn.character {
    max-width: 92%;
  }

  .return-latest {
    right: 12px;
    bottom: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waiting-dots i {
    animation: none;
  }

  .variable-shell-chevron {
    transition: none;
  }
}
</style>
