<template>
  <div ref="root" class="panel affairs-panel">
    <div class="location-brief">
      <div class="brief-header">
        <div class="brief-label">当前落点</div>
        <div class="brief-title">{{ data.本尊.行踪.当前区域 }}</div>
        <div class="brief-domain">{{ displayLayer }}</div>
      </div>
      <div class="brief-desc">
        <i class="fa-solid fa-quote-left"></i>{{ data.本尊.行踪.环境描述 || '周遭情势尚未明晰。'
        }}<i class="fa-solid fa-quote-right"></i>
      </div>
      <div class="brief-routes">
        <div class="routes-title"><i class="fa-solid fa-compass"></i>灵脉通路</div>
        <div class="connections-list">
          <button
            v-for="connection in connections"
            :key="connection"
            type="button"
            @click="affairs.navigate('place', connection)"
          >
            <i class="fa-solid fa-location-dot"></i>{{ connection }}
          </button>
          <span v-if="!connections.length" class="empty-hint">尚未探明通道</span>
        </div>
      </div>
    </div>
    <div data-affairs-section="actions" tabindex="-1"><AffairsActions /></div>
    <section data-affairs-section="tasks" tabindex="-1" class="ledger-section">
      <h2>
        <i class="fa-solid fa-scroll"></i>任务 <span>{{ tasks.length }}</span>
      </h2>
      <article
        v-for="[id, task] in tasks"
        :key="id"
        class="ledger-card task-card"
        :class="{ tracked: id === affairs.trackedTaskId }"
        :data-affairs-id="id"
        tabindex="-1"
      >
        <header>
          <h3>{{ task.名称 }}</h3>
          <span class="type-label">{{ task.类型 }}</span
          ><button
            type="button"
            class="track-button"
            :disabled="affairs.interactionDisabled"
            :aria-pressed="id === affairs.trackedTaskId"
            @click="affairs.track(id)"
          >
            <i :class="id === affairs.trackedTaskId ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'"></i
            >{{ id === affairs.trackedTaskId ? '正在追踪' : '追踪' }}
          </button>
        </header>
        <p class="task-goal">{{ task.目标 }}</p>
        <p v-if="task.进度" class="task-progress"><span>进展</span>{{ task.进度 }}</p>
        <p class="task-next"><span>下一步</span>{{ task.下一步 || '结合眼前线索，确认尚待处理的事项。' }}</p>
        <footer>
          <AffairsLinks v-bind="taskReferences[id]" />
          <button
            v-if="task.关联事件ID && data.世界图志[task.关联事件ID]"
            type="button"
            @click="affairs.navigate('event', task.关联事件ID)"
          >
            关联世闻 · {{ task.关联事件ID }}</button
          ><button type="button" class="intent-button" :disabled="affairs.interactionDisabled" @click="advanceTask(id)">
            <i class="fa-solid fa-feather-pointed"></i>{{ task.下一步 ? '由此起念' : '梳理线索' }}
          </button>
        </footer>
      </article>
      <p v-if="!tasks.length" class="empty-hint">行囊暂轻，眼前尚无未了之事。可从下方世闻寻一条线索。</p>
    </section>
    <section data-affairs-section="events" tabindex="-1" class="ledger-section">
      <h2>
        <i class="fa-solid fa-compass"></i>天下世闻 <span>{{ data.活跃世界事件.length }} 则流转中</span>
      </h2>
      <article
        v-for="event in events"
        :key="event.id"
        class="ledger-card event-card"
        :class="{ settled: !event.isActive }"
        :data-affairs-id="event.id"
        tabindex="-1"
      >
        <header>
          <h3>{{ event.名称 }}</h3>
          <span class="type-label">{{ event.阶段 }}</span
          ><span class="event-status">{{ eventParticipationLabelMap[event.参与情况] }}</span>
        </header>
        <p v-if="event.来源" class="event-origin">闻自 · {{ event.来源 }}</p>
        <p>{{ event.事件 }}</p>
        <p v-if="event.最近变化" class="event-change"><span>近况</span>{{ event.最近变化 }}</p>
        <p v-if="event.下一步 && event.isActive" class="task-next"><span>切入</span>{{ event.下一步 }}</p>
        <div v-if="event.可见影响.length" class="effects">
          <span v-for="effect in event.可见影响" :key="effect">{{ effect }}</span>
        </div>
        <AffairsLinks :people="event.关联人物" :places="event.地点 ? [event.地点] : []" />
        <footer>
          <button
            v-for="[taskId, task] in relatedTasks(event.id)"
            :key="taskId"
            type="button"
            @click="affairs.navigate('task', taskId)"
          >
            关联任务 · {{ task.名称 }}</button
          ><button
            v-if="event.isActive"
            type="button"
            class="intent-button"
            :disabled="affairs.interactionDisabled"
            @click="inquireEvent(event)"
          >
            <i class="fa-solid fa-feather-pointed"></i>{{ event.阶段 === '可介入' ? '着手介入' : '循闻追查' }}
          </button>
        </footer>
      </article>
      <div v-if="!events.length" class="calm-state">
        <p>四野暂静，尚无确切近闻。沿着眼前的人与事，也许能听见新的消息。</p>
        <button type="button" class="intent-button" :disabled="affairs.interactionDisabled" @click="askForNews">
          打听近闻
        </button>
      </div>
    </section>
    <section data-affairs-section="results" tabindex="-1" class="ledger-section">
      <h2>
        <i class="fa-solid fa-check"></i>近期结果 <span>{{ results.length }} / 5</span>
      </h2>
      <article
        v-for="[id, result] in results"
        :key="id"
        class="ledger-card result-card"
        :data-affairs-id="id"
        tabindex="-1"
      >
        <header>
          <h3>{{ result.名称 }}</h3>
          <span class="type-label">{{ result.状态 }}</span>
        </header>
        <p>{{ result.结果 }}</p>
        <small>{{ result.时地 }}</small
        ><button
          v-if="result.关联事件ID && data.世界图志[result.关联事件ID]"
          type="button"
          class="result-link"
          @click="affairs.navigate('event', result.关联事件ID)"
        >
          关联世闻 · {{ result.关联事件ID }}
        </button>
      </article>
      <p v-if="!results.length" class="empty-hint">往后办成的事与留下的结果，会在这里记下。</p>
    </section>
    <details v-if="Object.keys(data.声望系统).length" class="reputation-section">
      <summary>声望与往来</summary>
      <div v-for="(rep, faction) in data.声望系统" :key="faction" class="reputation-row">
        <strong>{{ faction }}</strong
        ><span>{{ rep.关系 }} · {{ rep.值 }}</span>
      </div>
    </details>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { buildQuestAction } from '../action-feed';
import { focusStageElement, inferTaskReferences, type AffairsFocus } from '../affairs';
import { inferLayerFromTrack, normalizeRegionName } from '../region-utils';
import { useDataStore } from '../store';
import { useAffairsStore } from '../stores/affairs-store';
import { eventParticipationLabelMap, selectWorldEventsForDisplay, type WorldEventView } from '../world-events';
import AffairsActions from './AffairsActions.vue';
import AffairsLinks from './AffairsLinks.vue';
const props = defineProps<{ focus?: AffairsFocus | null }>();
const root = ref<HTMLElement>();
const data = useDataStore();
const affairs = useAffairsStore();
const knownReferences = computed(() => ({
  people: [...Object.keys(data.红颜), ...Object.keys(data.NPC图鉴)],
  places: [...Object.keys(data.地点库), ...Object.keys(data.世界地图), data.本尊.行踪.当前区域],
  items: [data.本尊.法宝, data.本尊.背包, data.本尊.杂物袋].flatMap(record =>
    Object.entries(record ?? {}).flatMap(([id, item]) => [id, item.名称]),
  ),
}));
const displayLayer = computed(() =>
  inferLayerFromTrack(
    data.本尊.行踪.当前区域,
    data.本尊.行踪.所属层级,
    data.本尊.行踪.环境描述,
    data.地点库,
    data.世界地图,
  ),
);
const connections = computed(() =>
  data.本尊.行踪.可用通道?.length
    ? data.本尊.行踪.可用通道
    : (data.世界地图[normalizeRegionName(data.本尊.行踪.当前区域)]?.connections ?? []),
);
const tasks = computed(() =>
  Object.entries(data.任务列表).sort(
    ([a], [b]) => Number(b === affairs.trackedTaskId) - Number(a === affairs.trackedTaskId),
  ),
);
const results = computed(() => Object.entries(data.rawData?._近期任务结果 ?? {}).reverse());
const taskReferences = computed(() =>
  Object.fromEntries(tasks.value.map(([id, task]) => [id, inferTaskReferences(task, knownReferences.value)])),
);
const events = computed(() => {
  const visible = selectWorldEventsForDisplay(data.世界事件);
  const focused = data.世界事件.find(event => event.id === props.focus?.id);
  return focused && !visible.some(event => event.id === focused.id) ? [...visible, focused] : visible;
});
const relatedTasks = (eventId: string) => tasks.value.filter(([, task]) => task.关联事件ID === eventId);
const advanceTask = (id: string) =>
  affairs.selectAction(affairs.actions.find(item => item.关联任务ID === id) ?? buildQuestAction(id, data.任务列表[id]));
const inquireEvent = (event: WorldEventView) => {
  const proposal = affairs.actions.find(action => action.关联事件ID === event.id);
  if (proposal) {
    affairs.selectAction(proposal);
    return;
  }
  affairs.perform(
    `追查·${event.名称}`,
    event.下一步
      ? `围绕「${event.名称}」，尝试从已知线索入手：${event.下一步}`
      : `留心打探关于「${event.名称}」${event.地点 ? `（${event.地点}）` : ''}的近期动向，核实已知消息，再决定如何介入。`,
  );
};
const askForNews = () =>
  affairs.perform(
    '打听近闻',
    `在${data.本尊.行踪.当前区域}留心可见动静，在合适的交谈机会询问附近近期值得留意的消息，分辨传闻与已知事实。`,
  );
watch(
  () => props.focus,
  async target => {
    if (!target) return;
    await nextTick();
    const section = root.value?.querySelector<HTMLElement>(`[data-affairs-section="${target.section}"]`);
    const element = target.id
      ? Array.from(section?.querySelectorAll<HTMLElement>('[data-affairs-id]') ?? []).find(
          el => el.dataset.affairsId === target.id,
        )
      : section;
    focusStageElement(element ?? section);
  },
  { immediate: true, flush: 'post' },
);
</script>
<style scoped lang="scss">
.affairs-panel {
  padding: 20px;
  color: var(--text-primary);
}
.location-brief {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 24px 0;
  padding: 20px 0;
  border-top: 1px solid var(--line-subtle);
  border-bottom: 1px solid var(--line-subtle);
}
.brief-header {
  text-align: center;
}
.brief-label {
  font-size: 12px;
  color: var(--text-secondary);
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.brief-title {
  font-size: 26px;
  font-weight: bold;
  color: var(--text-accent);
  margin-bottom: 6px;
  font-family: 'Songti SC', STSong, serif;
}
.brief-domain {
  font-size: 14px;
  color: var(--gold);
}
.brief-desc {
  text-align: center;
  padding: 16px 24px;
  line-height: 1.8;
  color: var(--text-secondary);
  font-size: 14px;
  background: var(--surface-inset);
  border: 1px solid var(--line-subtle);
  border-radius: 6px;
}
.brief-desc i {
  color: var(--gold);
  opacity: 0.4;
  font-size: 12px;
  margin: 0 12px;
  vertical-align: super;
}
.brief-routes {
  margin-top: 8px;
}
.routes-title,
.connections-list {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.routes-title {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
.routes-title i {
  color: var(--gold);
}
.connections-list {
  flex-wrap: wrap;
}
.connections-list button {
  padding: 6px 16px;
  background: var(--bg-primary);
  border: 1px solid var(--line-subtle);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}
.connections-list i {
  margin-right: 8px;
  color: var(--gold);
  font-size: 11px;
}
.ledger-section {
  margin-bottom: 20px;
}
h2 {
  font-size: 18px;
  margin: 0 0 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-subtle);
  display: flex;
  gap: 10px;
  align-items: center;
  font-family: 'Songti SC', STSong, serif;
}
h2 i {
  color: var(--gold);
  font-size: 16px;
}
h2 > span {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
  margin-left: auto;
}
.ledger-card {
  padding: 9px 2px 10px;
  margin-bottom: 5px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line-subtle);
  border-radius: 0;
  overflow-wrap: anywhere;
}
.ledger-card.tracked h3 {
  color: var(--gold);
}
.ledger-card:focus {
  outline: 1px solid var(--gold);
  outline-offset: 3px;
}
.ledger-card header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  flex: 1;
}
.type-label {
  font-size: 11px;
  color: var(--gold);
  padding: 2px 6px;
  white-space: nowrap;
}
.ledger-card p {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
}
.task-progress > span,
.task-next > span,
.event-change > span {
  color: var(--gold);
  margin-right: 12px;
  font-size: 12px;
}
.ledger-card .task-next {
  color: var(--text-primary);
}
.track-button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  padding: 4px 0 4px 8px;
  color: var(--text-secondary);
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}
.track-button[aria-pressed='true'] {
  color: var(--gold);
}
footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
}
footer :deep(.affairs-links) {
  margin-top: 0;
}
footer > button,
.result-link {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--gold);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.intent-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--gold) 30%, transparent);
  border-radius: 0;
  padding: 4px 0;
  background: transparent;
  color: var(--gold);
  font-size: 12px;
  cursor: pointer;
}
footer > .intent-button {
  margin-left: auto;
}
.event-card h3 {
  color: var(--jade);
}
.event-card.settled h3 {
  color: var(--text-secondary);
}
.event-status,
.event-origin,
small {
  font-size: 12px;
  color: var(--text-secondary);
}
.effects {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.effects span {
  font-size: 11px;
  color: var(--jade);
}
.result-card h3 {
  color: var(--text-primary);
}
.result-card .result-link {
  display: block;
  margin-top: 10px;
}
.empty-hint,
.calm-state {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text-secondary);
  padding: 12px 0;
}
.reputation-section {
  color: var(--text-secondary);
  font-size: 13px;
  padding-top: 16px;
  border-top: 1px solid var(--line-subtle);
}
summary {
  cursor: pointer;
}
.reputation-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 600px) {
  .affairs-panel {
    padding: 12px;
  }
  .location-brief {
    margin-top: 16px;
  }
  .brief-desc {
    padding: 14px;
  }
  .ledger-card {
    padding: 9px 0;
  }
  .ledger-card header {
    gap: 8px;
  }
  .track-button {
    padding-left: 0;
  }
}
</style>
