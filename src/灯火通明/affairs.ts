import { buildQuestAction, type OpportunityAction, type TaskSnapshot } from './action-feed';
import type { SchemaType } from './schema';

export type AffairsSnapshot = Pick<SchemaType, '任务列表' | '世界图志' | '_近期任务结果'>;
export type AffairsChange = { kind: 'task' | 'event' | 'result'; id: string; title: string; detail: string };
export type AffairsDestination = { kind: 'task' | 'event' | 'person' | 'place' | 'item'; id: string; nonce: number };
export type AffairsFocus = { section: 'actions' | 'tasks' | 'events' | 'results'; id?: string; nonce: number };

/** 旧存档缺少关联字段时，仅从原文辨认已收录的完整名称，不写回变量。 */
export function inferTaskReferences(
  task: { 名称?: string; 目标?: string; 进度?: string; 下一步?: string; 关联人物?: string[]; 关联地点?: string[]; 关联物品?: string[] },
  known: { people: string[]; places: string[]; items: string[] },
) {
  const text = [task.名称, task.目标, task.进度, task.下一步].filter(Boolean).join('｜');
  const mentioned = (names: string[]) => [...new Set(names)].filter(name => name.length > 1 && text.includes(name));
  return { people: task.关联人物 ?? mentioned(known.people), places: task.关联地点 ?? mentioned(known.places), items: task.关联物品 ?? mentioned(known.items) };
}

export function chooseTrackedTask(tasks: Record<string, TaskSnapshot>, preferred: string): string {
  const entries = Object.entries(tasks).filter(([, task]) => !task.状态 || task.状态 === '进行中');
  return (
    entries.find(([id]) => id === preferred)?.[0] ??
    entries.find(([, task]) => task.类型 === '主线')?.[0] ??
    entries[0]?.[0] ??
    ''
  );
}

export function prioritizeAffairsActions(
  actions: OpportunityAction[],
  tasks: Record<string, TaskSnapshot>,
  trackedId: string,
): OpportunityAction[] {
  const candidates = actions.map(action => {
    if (!action.关联任务ID || tasks[action.关联任务ID]) return action;
    const { 关联任务ID: _missing, ...plain } = action;
    return plain;
  });
  if (trackedId && tasks[trackedId] && candidates.length === 0) {
    candidates.unshift(buildQuestAction(trackedId, tasks[trackedId]));
  }
  const seen = new Set<string>();
  const score = (action: OpportunityAction) =>
    action.关联任务ID === trackedId && trackedId
      ? 100
      : action.关联事件ID
        ? 60
        : action.叙事类型 === '平淡延续'
          ? 40
          : 20;
  const unique = candidates
    .filter(action => {
      const key = action.行动.replace(/\s+/gu, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => score(b) - score(a));
  const selected = unique.slice(0, 3);
  const calm = unique.find(action => action.叙事类型 === '平淡延续');
  if (calm && selected.length === 3 && !selected.includes(calm)) selected[2] = calm;
  return selected;
}

/** 按当前浏览楼层比较两份事实快照，首次加载没有基线时保持安静。 */
export function describeAffairsChanges(before: AffairsSnapshot | null, after: AffairsSnapshot): AffairsChange[] {
  if (!before) return [];
  const changes: AffairsChange[] = [];
  for (const [id, task] of Object.entries(after.任务列表)) {
    const old = before.任务列表[id];
    if (!old || old.进度 !== task.进度 || old.下一步 !== task.下一步) {
      changes.push({
        kind: 'task',
        id,
        title: `${old ? '任务进展' : '新目标'} · ${task.名称}`,
        detail: task.进度 || task.下一步 || task.目标,
      });
    }
  }
  for (const [id, result] of Object.entries(after._近期任务结果)) {
    if (JSON.stringify(before._近期任务结果?.[id]) === JSON.stringify(result)) continue;
    changes.push({ kind: 'result', id, title: `${result.状态} · ${result.名称}`, detail: result.结果 });
  }
  for (const [id, event] of Object.entries(after.世界图志)) {
    const old = before.世界图志[id];
    if (
      old &&
      ['状态', '阶段', '事件', '最近变化', '下一步', '可见影响', '参与情况'].every(
        key => JSON.stringify(old[key as keyof typeof old]) === JSON.stringify(event[key as keyof typeof event]),
      )
    )
      continue;
    changes.push({
      kind: 'event',
      id,
      title: `${old ? '世闻有变' : '新世闻'} · ${id}`,
      detail: event.最近变化 || event.事件,
    });
  }
  return changes;
}

export function readingViewForMode(mode: 'paged' | 'scroll') {
  return mode === 'scroll' ? ('timeline' as const) : ('story' as const);
}

export function focusStageElement(element: HTMLElement | null | undefined) {
  if (!element) return;
  const container = element.closest<HTMLElement>('.stage-viewport');
  if (container)
    container.scrollTo({
      top: container.scrollTop + element.getBoundingClientRect().top - container.getBoundingClientRect().top - 16,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  element.focus({ preventScroll: true });
}
