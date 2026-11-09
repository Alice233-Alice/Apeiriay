import { z } from 'zod';

const EntrySchema = z.object({
  内容: z.string().prefault(''),
  依据: z.string().prefault(''),
  时地: z.string().prefault(''),
});

export const JourneySchema = z.object({
  名称: z.string().prefault('未名行旅'),
  缘起: z.string().prefault(''),
  所求: z.string().prefault(''),
  篇章: z.string().prefault('缘起'),
  进展: z.string().prefault(''),
  下一步: z.string().prefault(''),
  状态: z.enum(['待启程', '进行中', '暂歇', '已落幕']).prefault('待启程'),
  关联任务: z.array(z.string()).prefault([]),
  关联世闻: z.array(z.string()).prefault([]),
  线索: z.record(z.string().describe('线索名'), EntrySchema).prefault({}),
  纪事: z.record(z.string().describe('纪事名'), EntrySchema).prefault({}),
  猜想: z
    .record(
      z.string().describe('想法ID'),
      z.object({
        内容: z.string().prefault(''),
        关联线索: z.array(z.string()).prefault([]),
        状态: z.enum(['待核实', '有证据支持', '已印证', '已排除']).prefault('待核实'),
        依据: z.string().prefault(''),
      }),
    )
    .prefault({}),
});

export const JourneysSchema = z
  .object({
    当前追踪: z.string().prefault(''),
    旅程: z.record(z.string().describe('旅程ID'), JourneySchema).prefault({}),
  })
  .prefault({});

export const JourneyPlansSchema = z.record(z.string().describe('旅程ID'), z.string()).prefault({});
export type Journey = z.output<typeof JourneySchema>;
export type Journeys = z.output<typeof JourneysSchema>;
