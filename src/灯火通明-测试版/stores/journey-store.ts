import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { klona } from 'klona';
import { useActionPreferences } from '../action-preferences';
import { CloudStorySchema, cloudJourneyId, createStorySnapshot, type CloudStory } from '../cloud-stories';
import { fingerprintJourneyHistory, JOURNEY_DRAFT_KEY, readJourneyDraft, type JourneyDraft } from '../journey-draft';
import {
  buildJourneyProposalPrompts,
  collectJourneyWorldbookBindings,
  journeyHistorySignature,
  loadJourneyWorldbooks,
  readJourneyHistory,
  type JourneyHistoryRow,
  type JourneyWorldbook,
} from '../journey-context';
import {
  buildJourneyAction,
  createJourney,
  JOURNEY_GENERATION_PREFIX,
  parseJourneyProposals,
  type JourneyProposal,
} from '../journey';
import { JourneysSchema, type Journey } from '../../灯火阑珊/schema/journeys';
import { Schema, type SchemaType } from '../schema';
import { useDataStore } from './data-store';
import { usePseudoLayerStore } from './pseudo-layer-store';

export const useJourneyStore = defineStore('bright-test-journeys', () => {
  const data = useDataStore();
  const pseudo = usePseudoLayerStore();
  const preferences = useActionPreferences();
  const empty = JourneysSchema.parse({});
  const archive = computed(() => data.rawData?.行旅 ?? empty);
  const currentId = computed(() => archive.value.当前追踪);
  const current = computed(() => archive.value.旅程[currentId.value]);
  const seeking = ref(false);
  const saving = ref(false);
  const error = ref('');
  const preference = ref('');
  const inspiration = ref('');
  const proposals = ref<JourneyProposal[]>([]);
  const panelOpen = ref(false);
  const historyRows = ref<JourneyHistoryRow[]>([]);
  const selectedMessageIds = ref<number[]>([]);
  const historyMode = ref<'all' | 'manual'>('all');
  const rangeStart = ref(0);
  const rangeEnd = ref(0);
  const historyLastMessageId = ref(-1);
  const worldbooks = ref<JourneyWorldbook[]>([]);
  const contextLoading = ref(false);
  const contextError = ref('');
  const worldReady = ref(false);
  const historyReady = ref(false);
  const proposalsInvalidated = ref(false);
  let generationId = '';
  let proposalChatId = '';
  let proposalMessageId = -1;
  let proposalLastMessageId = -1;
  let proposalHistorySignature = '';
  let contextChatId: string | undefined;
  let contextRevision = 0;
  let pendingContext: { origin: string; promise: Promise<boolean> } | undefined;
  let restoringDraft = false;
  let restoredHistoryFingerprint: string | undefined;
  let lastSavedDraft = '';
  let hasSavedDraft = false;
  const chatId = () => String(SillyTavern.getCurrentChatId() ?? '');
  const atLatest = computed(() => (pseudo.isDetachedMode ? pseudo.isNativeLatest : pseudo.isStoryHistoryLatest));
  const disabled = computed(() => !atLatest.value || pseudo.isGenerating || seeking.value || saving.value);
  const selectedHistory = computed(() => {
    const ids = new Set(selectedMessageIds.value);
    return historyRows.value.filter(row => ids.has(row.id));
  });
  const historySignature = computed(() => journeyHistorySignature(selectedHistory.value));
  const referencePrompts = computed(() =>
    data.rawData
      ? buildJourneyProposalPrompts(
          worldbooks.value,
          selectedHistory.value,
          data.rawData,
          preference.value,
          inspiration.value,
        )
      : [],
  );
  const referenceCharacters = computed(() =>
    referencePrompts.value.reduce((total, prompt) => total + prompt.content.length, 0),
  );
  const worldEntryCount = computed(() => worldbooks.value.reduce((total, book) => total + book.entries.length, 0));
  const contextReady = computed(() => historyReady.value && worldReady.value && !contextError.value);
  const proposalsStale = computed(
    () =>
      proposals.value.length > 0 &&
      (proposalsInvalidated.value ||
        proposalChatId !== chatId() ||
        proposalMessageId !== Number(data.viewedMessageId) ||
        proposalLastMessageId !== historyLastMessageId.value ||
        !historyReady.value ||
        proposalHistorySignature !== historySignature.value),
  );
  const fail = (cause: unknown) => {
    error.value = cause instanceof Error ? cause.message : String(cause);
  };

  const saveDraft = () => {
    const origin = chatId();
    if (restoringDraft || !atLatest.value || !origin || contextChatId !== origin) return;
    if (
      !hasSavedDraft &&
      !preference.value &&
      !inspiration.value &&
      !panelOpen.value &&
      !proposals.value.length &&
      historyMode.value === 'all'
    )
      return;
    const draft: JourneyDraft = {
      version: 1,
      chatId: origin,
      preference: preference.value,
      inspiration: inspiration.value,
      panelOpen: panelOpen.value,
      history: {
        mode: historyMode.value,
        selectedMessageIds: [...selectedMessageIds.value],
        rangeStart: Number.isInteger(rangeStart.value) && rangeStart.value >= 0 ? rangeStart.value : 0,
        rangeEnd: Number.isInteger(rangeEnd.value) && rangeEnd.value >= 0 ? rangeEnd.value : 0,
      },
      proposals: klona(proposals.value),
      source: proposals.value.length
        ? {
            messageId: proposalMessageId,
            lastMessageId: proposalLastMessageId,
            historyFingerprint: fingerprintJourneyHistory(proposalHistorySignature),
            invalidated: proposalsInvalidated.value,
          }
        : null,
    };
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedDraft) return;
    try {
      // Replace only this frontend key; keep the chat's other variables and MVU snapshots intact.
      updateVariablesWith(variables => ({ ...variables, [JOURNEY_DRAFT_KEY]: draft }), { type: 'chat' });
      lastSavedDraft = serialized;
      hasSavedDraft = true;
    } catch (cause) {
      console.warn('[寻途] 聊天草稿保存失败', cause);
      error.value = '寻途草稿暂未保存成功，请保留当前界面后重试。';
    }
  };

  const restoreDraft = (origin: string) => {
    let draft: JourneyDraft | undefined;
    try {
      draft = readJourneyDraft(getVariables({ type: 'chat' })[JOURNEY_DRAFT_KEY], origin);
    } catch (cause) {
      console.warn('[寻途] 聊天草稿读取失败', cause);
    }
    preference.value = draft?.preference ?? '';
    inspiration.value = draft?.inspiration ?? '';
    panelOpen.value = draft?.panelOpen ?? panelOpen.value;
    historyMode.value = draft?.history.mode ?? 'all';
    selectedMessageIds.value = draft?.history.selectedMessageIds ?? [];
    rangeStart.value = draft?.history.rangeStart ?? 0;
    rangeEnd.value = draft?.history.rangeEnd ?? 0;
    proposals.value = draft?.proposals ?? [];
    proposalsInvalidated.value = draft?.source?.invalidated ?? false;
    proposalChatId = draft?.source ? origin : '';
    proposalMessageId = draft?.source?.messageId ?? -1;
    proposalLastMessageId = draft?.source?.lastMessageId ?? -1;
    proposalHistorySignature = '';
    restoredHistoryFingerprint = draft?.source?.historyFingerprint;
    lastSavedDraft = draft ? JSON.stringify(draft) : '';
    hasSavedDraft = Boolean(draft);
  };

  const refreshHistory = () => {
    const previousRestore = restoringDraft;
    restoringDraft = true;
    try {
      const origin = chatId();
      if (contextChatId !== origin) {
        contextChatId = origin;
        contextRevision += 1;
        pendingContext = undefined;
        contextLoading.value = false;
        contextError.value = '';
        worldReady.value = false;
        worldbooks.value = [];
        restoreDraft(origin);
      }
      historyReady.value = false;
      const rows = readJourneyHistory(getChatMessages('0-{{lastMessageId}}', { include_swipes: false }));
      historyRows.value = rows;
      historyLastMessageId.value = getLastMessageId();
      if (historyMode.value === 'all') {
        selectedMessageIds.value = rows.filter(row => row.defaultSelected).map(row => row.id);
        rangeEnd.value = Math.max(0, historyLastMessageId.value);
      } else {
        const existing = new Set(rows.map(row => row.id));
        selectedMessageIds.value = selectedMessageIds.value.filter(id => existing.has(id));
      }
      historyReady.value = true;
      if (restoredHistoryFingerprint !== undefined) {
        if (restoredHistoryFingerprint !== fingerprintJourneyHistory(historySignature.value))
          proposalsInvalidated.value = true;
        proposalHistorySignature = historySignature.value;
        restoredHistoryFingerprint = undefined;
      }
      if (
        proposals.value.length &&
        (proposalChatId !== origin ||
          proposalLastMessageId !== historyLastMessageId.value ||
          proposalHistorySignature !== historySignature.value)
      )
        proposalsInvalidated.value = true;
    } finally {
      restoringDraft = previousRestore;
    }
    saveDraft();
  };
  const refreshContext = async (): Promise<boolean> => {
    try {
      refreshHistory();
    } catch (cause) {
      contextError.value = `剧情历史读取失败：${cause instanceof Error ? cause.message : String(cause)}`;
      return false;
    }
    const origin = chatId();
    if (pendingContext?.origin === origin) return pendingContext.promise;
    const revision = ++contextRevision;
    contextLoading.value = true;
    contextError.value = '';
    worldReady.value = false;
    const promise = (async () => {
      try {
        const bindings = collectJourneyWorldbookBindings(
          getGlobalWorldbookNames(),
          getCharWorldbookNames('current'),
          getChatWorldbookName('current'),
        );
        const loaded = await loadJourneyWorldbooks(
          bindings,
          name => getWorldbook(name),
          text => substitudeMacros(text),
        );
        if (revision !== contextRevision || chatId() !== origin) return false;
        worldbooks.value = loaded;
        worldReady.value = true;
        return true;
      } catch (cause) {
        if (revision === contextRevision && chatId() === origin) {
          contextError.value = cause instanceof Error ? cause.message : String(cause);
        }
        return false;
      } finally {
        if (revision === contextRevision) {
          contextLoading.value = false;
          pendingContext = undefined;
        }
      }
    })();
    pendingContext = { origin, promise };
    return promise;
  };
  const selectAllHistory = () => {
    if (seeking.value) return;
    historyMode.value = 'all';
    rangeStart.value = 0;
    try {
      refreshHistory();
    } catch (cause) {
      contextError.value = `剧情历史读取失败：${cause instanceof Error ? cause.message : String(cause)}`;
    }
  };
  const applyHistoryRange = () => {
    if (seeking.value) return;
    const start = rangeStart.value;
    const end = rangeEnd.value;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start ||
      end > historyLastMessageId.value
    ) {
      error.value = '请填写有效的起止楼层，结束楼层须在当前历史范围内。';
      return;
    }
    historyMode.value = 'manual';
    selectedMessageIds.value = historyRows.value
      .filter(row => row.id >= start && row.id <= end && row.defaultSelected)
      .map(row => row.id);
    if (proposals.value.length && proposalHistorySignature !== historySignature.value)
      proposalsInvalidated.value = true;
    error.value = '';
  };
  const toggleHistoryMessage = (id: number) => {
    if (seeking.value || !historyRows.value.some(row => row.id === id)) return;
    historyMode.value = 'manual';
    const ids = new Set(selectedMessageIds.value);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    selectedMessageIds.value = [...ids].sort((left, right) => left - right);
    if (proposals.value.length) proposalsInvalidated.value = true;
  };

  const write = async (change: (state: SchemaType) => void) => {
    if (disabled.value) return false;
    const target = Number(data.viewedMessageId);
    const origin = chatId();
    if (!Number.isInteger(target) || target < 0) return false;
    saving.value = true;
    error.value = '';
    try {
      await waitGlobalInitialized('Mvu');
      if (chatId() !== origin || Number(data.viewedMessageId) !== target || !atLatest.value || pseudo.isGenerating) {
        throw new Error('当前场景已变化，请返回最新正文后再试。');
      }
      const variables = klona(Mvu.getMvuData({ type: 'message', message_id: target }));
      const state = Schema.parse(variables.stat_data);
      change(state);
      const next = Schema.parse(state);
      await Mvu.replaceMvuData({ ...variables, stat_data: next }, { type: 'message', message_id: target });
      if (chatId() === origin && Number(data.viewedMessageId) === target) {
        data.viewMessage(target, { preserveGallery: true });
      }
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    } finally {
      saving.value = false;
    }
  };

  const seek = async () => {
    if (disabled.value || !data.rawData) return;
    const origin = chatId();
    const target = Number(data.viewedMessageId);
    const requestId = `${JOURNEY_GENERATION_PREFIX}${crypto.randomUUID()}`;
    generationId = requestId;
    seeking.value = true;
    error.value = '';
    panelOpen.value = true;
    try {
      if (!(await refreshContext())) throw new Error(contextError.value || '当前场景已变化，请重新寻途。');
      if (generationId !== requestId) return;
      if (chatId() !== origin || Number(data.viewedMessageId) !== target) {
        throw new Error('场景已经变化，请在最新正文重新寻途。');
      }
      if (!selectedHistory.value.length) throw new Error('请至少选中一条剧情或玩家输入，再开始寻途。');
      const selectedSignature = historySignature.value;
      const latestMessageId = historyLastMessageId.value;
      const snapshot = Schema.parse(klona(data.rawData));
      const response = await generateRaw({
        generation_id: requestId,
        should_stream: false,
        should_silence: true,
        max_chat_history: 0,
        overrides: { chat_history: { prompts: [], with_depth_entries: false } },
        // History is explicitly included below, so native history and depth entries stay off to avoid duplicates.
        ordered_prompts: buildJourneyProposalPrompts(
          worldbooks.value,
          selectedHistory.value,
          snapshot,
          preference.value,
          inspiration.value,
        ),
      });
      if (generationId !== requestId) return;
      refreshHistory();
      if (
        chatId() !== origin ||
        Number(data.viewedMessageId) !== target ||
        latestMessageId !== historyLastMessageId.value ||
        selectedSignature !== historySignature.value
      ) {
        throw new Error('场景已经变化，提案未写入；请在最新正文重新寻途。');
      }
      const parsed = parseJourneyProposals(response);
      proposalChatId = origin;
      proposalMessageId = target;
      proposalLastMessageId = latestMessageId;
      proposalHistorySignature = selectedSignature;
      proposalsInvalidated.value = false;
      proposals.value = parsed;
    } catch (cause) {
      if (generationId === requestId) fail(cause);
    } finally {
      if (generationId === requestId) {
        generationId = '';
        seeking.value = false;
      }
    }
  };
  const cancel = () => {
    const id = generationId;
    generationId = '';
    seeking.value = false;
    if (id) stopGenerationById(id);
  };
  const perform = (journey: Journey, guessId?: string) => {
    if (disabled.value) return false;
    return pseudo.performAction(
      `行旅 · ${journey.名称}`,
      buildJourneyAction(journey, guessId),
      preferences.submitMode.value === 'direct',
    );
  };
  const choose = async (proposal: JourneyProposal) => {
    try {
      refreshHistory();
    } catch (cause) {
      fail(cause);
      return false;
    }
    if (proposalsStale.value) {
      error.value = '提案来自先前场景，请重寻后再选。';
      return false;
    }
    const id = `行旅_${crypto.randomUUID().replaceAll('-', '')}`;
    const journey = createJourney(proposal);
    const saved = await write(state => {
      state.行旅.旅程[id] = journey;
      state.行旅.当前追踪 = id;
      state.$行旅蓝图[id] = proposal.plan;
    });
    if (saved) {
      proposals.value = [];
      panelOpen.value = false;
      perform(journey);
    }
    return saved;
  };
  const chooseStory = async (input: CloudStory) => {
    let selected: Journey | undefined;
    let created = false;
    const saved = await write(state => {
      const story = CloudStorySchema.parse(input);
      const id = cloudJourneyId(story.id);
      if (!state.行旅.旅程[id]) {
        state.行旅.旅程[id] = createJourney({
          name: story.name,
          lead: story.lead,
          goal: story.goal,
          step: story.step,
          plan: story.blueprint,
        });
        state.$行旅蓝图[id] = createStorySnapshot(story);
        created = true;
      }
      state.行旅.当前追踪 = id;
      selected = state.行旅.旅程[id];
    });
    if (saved) {
      panelOpen.value = false;
      if (created && selected) perform(selected);
    }
    return saved;
  };
  const track = (id: string) =>
    write(state => {
      if (!state.行旅.旅程[id]) throw new Error('这段行旅已经不存在。');
      state.行旅.当前追踪 = id;
    });
  const pause = () =>
    write(state => {
      const journey = state.行旅.旅程[state.行旅.当前追踪];
      if (journey && journey.状态 !== '已落幕') journey.状态 = '暂歇';
    });
  const resume = async () => {
    const id = currentId.value;
    const journey = current.value;
    if (!journey || journey.状态 === '已落幕') return false;
    const saved = await write(state => {
      const target = state.行旅.旅程[id];
      if (target.状态 === '暂歇') target.状态 = target.进展 ? '进行中' : '待启程';
    });
    if (saved && current.value && currentId.value === id) perform(current.value);
    return saved;
  };
  const untrack = () =>
    write(state => {
      state.行旅.当前追踪 = '';
    });
  const removeJourney = (id: string) =>
    write(state => {
      if (!state.行旅.旅程[id]) throw new Error('这段行旅已经不存在。');
      delete state.行旅.旅程[id];
      delete state.$行旅蓝图[id];
      if (state.行旅.当前追踪 === id) state.行旅.当前追踪 = '';
    });
  const addGuess = async (content: string, clues: string[]) => {
    const text = content.trim().slice(0, 600);
    if (!text || !current.value) return false;
    const id = currentId.value;
    return write(state => {
      const journey = state.行旅.旅程[id];
      journey.猜想[`想法_${crypto.randomUUID().replaceAll('-', '')}`] = {
        内容: text,
        关联线索: clues.filter(key => journey.线索[key]),
        状态: '待核实',
        依据: '',
      };
    });
  };
  const verifyGuess = (id: string) => (current.value ? perform(current.value, id) : false);
  try {
    refreshHistory();
  } catch (cause) {
    contextError.value = `剧情历史读取失败：${cause instanceof Error ? cause.message : String(cause)}`;
  }
  watch(
    [
      preference,
      inspiration,
      panelOpen,
      historyMode,
      rangeStart,
      rangeEnd,
      selectedMessageIds,
      proposals,
      proposalsInvalidated,
    ],
    saveDraft,
    { deep: true, flush: 'sync' },
  );
  const historyListeners = [
    tavern_events.MESSAGE_SENT,
    tavern_events.MESSAGE_RECEIVED,
    tavern_events.MESSAGE_EDITED,
    tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_DELETED,
    tavern_events.MESSAGE_SWIPED,
    tavern_events.CHAT_CHANGED,
  ].map(event =>
    eventOn(event, () => {
      try {
        if (event === tavern_events.CHAT_CHANGED) cancel();
        refreshHistory();
        if (event === tavern_events.CHAT_CHANGED && panelOpen.value) void refreshContext();
      } catch (cause) {
        contextError.value = `剧情历史读取失败：${cause instanceof Error ? cause.message : String(cause)}`;
      }
    }),
  );
  onScopeDispose(() => {
    cancel();
    contextRevision += 1;
    historyListeners.forEach(listener => listener.stop());
  });
  return {
    archive,
    currentId,
    current,
    seeking,
    saving,
    error,
    preference,
    inspiration,
    proposals,
    panelOpen,
    disabled,
    proposalsStale,
    historyRows,
    selectedMessageIds,
    selectedHistory,
    historyMode,
    rangeStart,
    rangeEnd,
    historyLastMessageId,
    worldbooks,
    worldEntryCount,
    referenceCharacters,
    contextLoading,
    contextError,
    contextReady,
    refreshContext,
    selectAllHistory,
    applyHistoryRange,
    toggleHistoryMessage,
    seek,
    cancel,
    choose,
    chooseStory,
    track,
    pause,
    resume,
    untrack,
    removeJourney,
    addGuess,
    verifyGuess,
  };
});
