import {
  compareWorldEventTimeDescending,
  WorldEventSchema,
  type NormalizedWorldEvent,
  type WorldEventImpact,
  type WorldEventParticipation,
  type WorldEventStage,
  type WorldEventStatus,
} from './schema';

export type WorldEventView = NormalizedWorldEvent & {
  id: string;
  名称: string;
  isActive: boolean;
};

const statusRank: Record<WorldEventStatus, number> = {
  活跃: 0,
  已错过: 1,
  已平息: 2,
};

const stageRank: Record<WorldEventStage, number> = {
  可介入: 0,
  发展: 1,
  征兆: 2,
  余波: 3,
  落幕: 4,
};

export const getWorldEventEntries = (source: unknown): WorldEventView[] => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];

  return Object.entries(source as Record<string, unknown>)
    .flatMap(([id, rawEvent], sourceIndex) => {
      const result = WorldEventSchema.safeParse(rawEvent);
      if (!result.success || !String(id).trim() || !result.data.事件) return [];

      return [
        {
          event: {
            ...result.data,
            id: String(id).trim(),
            名称: String(id).trim(),
            isActive: result.data.状态 === '活跃',
          },
          sourceIndex,
        },
      ];
    })
    .sort((left, right) => {
      const statusDifference = statusRank[left.event.状态] - statusRank[right.event.状态];
      if (statusDifference !== 0) return statusDifference;

      const stageDifference = stageRank[left.event.阶段] - stageRank[right.event.阶段];
      if (stageDifference !== 0) return stageDifference;

      const timeDifference = compareWorldEventTimeDescending(left.event.更新时间, right.event.更新时间);
      if (timeDifference !== 0) return timeDifference;

      // 旧会话可能被旧版 MVU 裁掉更新时间；同档事件按后插入者优先，确保最新结果可见。
      return right.sourceIndex - left.sourceIndex;
    })
    .map(entry => entry.event);
};

export const getActiveWorldEvents = (source: unknown) => getWorldEventEntries(source).filter(event => event.isActive);

export const getForegroundWorldEvent = (source: unknown): WorldEventView | null =>
  getActiveWorldEvents(source)[0] ?? null;

export const selectWorldEventsForDisplay = (events: readonly WorldEventView[], limit = 3): WorldEventView[] => {
  const activeEvents = events.filter(event => event.isActive);
  return (activeEvents.length > 0 ? activeEvents : events).slice(0, Math.max(0, limit));
};

export const eventStageIconMap: Record<WorldEventStage, string> = {
  征兆: 'fa-solid fa-eye',
  发展: 'fa-solid fa-water',
  可介入: 'fa-solid fa-location-crosshairs',
  余波: 'fa-solid fa-wind',
  落幕: 'fa-solid fa-scroll',
};

export const eventImpactLabelMap: Record<WorldEventImpact, string> = {
  微澜: '微澜',
  轻变: '轻变',
  显著: '可感',
};

export const eventParticipationLabelMap: Record<WorldEventParticipation, string> = {
  未介入: '尚未介入',
  旁观: '有所留意',
  介入: '已经介入',
  主导: '正在主导',
};
