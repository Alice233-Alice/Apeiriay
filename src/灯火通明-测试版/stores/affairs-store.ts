import { computed, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { containsInitVar, extractJsonPatch, resolveActionFeed, type OpportunityAction } from '../action-feed';
import {
  chooseTrackedTask,
  describeAffairsChanges,
  prioritizeAffairsActions,
  type AffairsDestination,
  type AffairsSnapshot,
} from '../affairs';
import { useActionPreferences } from '../action-preferences';
import { Schema } from '../schema';
import { useDataStore } from './data-store';
import { usePseudoLayerStore } from './pseudo-layer-store';
import { useJourneyStore } from './journey-store';

const HISTORY_PAGE_SIZE = 32;

export const useAffairsStore = defineStore('bright-test-affairs', () => {
  const data = useDataStore();
  const pseudo = usePseudoLayerStore();
  const preferences = useActionPreferences();
  const journeys = useJourneyStore();
  const storageKey = `dhl-affairs:tracked:${SillyTavern.getCurrentChatId()}`;
  const readPreference = () => {
    try {
      return localStorage.getItem(storageKey) ?? '';
    } catch {
      return '';
    }
  };
  const preferredTaskId = ref(readPreference());
  const trackedTaskId = computed(() => chooseTrackedTask(data.任务列表, preferredTaskId.value));
  const trackedTask = computed(() => data.任务列表[trackedTaskId.value]);
  const navigation = shallowRef<AffairsDestination | null>(null);
  const content = ref('');
  const before = shallowRef<AffairsSnapshot | null>(null);
  let sourceId = -1;
  let lastContent = '';
  let nonce = 0;

  watch(
    [() => data.viewedMessageId, () => data.rawData],
    () => {
      const id = Number(data.viewedMessageId);
      if (!Number.isInteger(id) || id < 0) return;
      try {
        const raw = String(getChatMessages(id)[0]?.message ?? '');
        content.value = raw;
        if (sourceId === id && lastContent === raw) return;
        sourceId = id;
        lastContent = raw;
        before.value = null;
        if (id === 0) return;
        for (let end = id - 1; end >= 0; end -= HISTORY_PAGE_SIZE) {
          const previous = getChatMessages(`${Math.max(0, end - HISTORY_PAGE_SIZE + 1)}-${end}`)
            .filter(message => message.role === 'assistant')
            .reverse();
          for (const message of previous) {
            const variables = Mvu.getMvuData({ type: 'message', message_id: message.message_id });
            if (!variables?.stat_data) continue;
            const result = Schema.safeParse(variables.stat_data);
            if (result.success) {
              before.value = result.data;
              return;
            }
          }
        }
      } catch (error) {
        console.warn('[行事] 读取回合脉络失败', error);
      }
    },
    { immediate: true },
  );

  const actionState = computed(() =>
    resolveActionFeed({
      operations: extractJsonPatch(content.value),
      storedActions: data.可参与机遇,
      tasks: data.任务列表,
      situation: data.当前处境,
      worldEvents: data.世界图志,
      companionNames: Object.keys(data.红颜),
      useStoredActionsWithoutPatch: containsInitVar(content.value),
    }),
  );
  const actions = computed(() =>
    prioritizeAffairsActions(actionState.value.actions, data.任务列表, trackedTaskId.value),
  );
  const changes = computed(() => (data.rawData ? describeAffairsChanges(before.value, data.rawData) : []));
  const interactionDisabled = computed(
    () =>
      pseudo.isGenerating ||
      journeys.seeking ||
      journeys.saving ||
      (pseudo.isDetachedMode ? !pseudo.isNativeLatest : !pseudo.isStoryHistoryLatest),
  );
  const track = (id: string) => {
    if (interactionDisabled.value || !data.任务列表[id]) return;
    preferredTaskId.value = id;
  };
  watch(
    trackedTaskId,
    id => {
      if (!id || interactionDisabled.value) return;
      try {
        localStorage.setItem(storageKey, id);
      } catch {
        /* 界面偏好无法保存时仍可使用。 */
      }
    },
    { immediate: true },
  );
  const navigate = (kind: AffairsDestination['kind'], id: string) => {
    navigation.value = { kind, id, nonce: ++nonce };
  };
  const perform = (title: string, prompt: string) => {
    if (interactionDisabled.value) return false;
    return pseudo.performAction(title, prompt, preferences.submitMode.value === 'direct');
  };
  const selectAction = (action: OpportunityAction) => perform(action.标题 || '起念', action.行动);
  return {
    trackedTaskId,
    trackedTask,
    track,
    actionState,
    actions,
    changes,
    navigation,
    navigate,
    perform,
    selectAction,
    interactionDisabled,
  };
});
