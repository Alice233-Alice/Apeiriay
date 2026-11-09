import { z } from 'zod';

export const STORY_REPOSITORY = {
  owner: 'Alice233-Alice',
  repo: 'denghuo-stories',
  branch: 'main',
  path: 'library.json',
} as const;
export const STORY_LIBRARY_LIMIT = 1_000_000;
export const CLOUD_JOURNEY_PREFIX = '行旅_预设_';
export const STORY_LENGTHS = ['小插曲', '短篇', '长篇'] as const;

export const CloudStorySchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/),
  revision: z.number().int().positive(),
  name: z.string().trim().min(1).max(24),
  genres: z.array(z.string().trim().min(1).max(20)).min(1).max(8),
  length: z.enum(STORY_LENGTHS),
  lead: z.string().trim().min(1).max(220),
  goal: z.string().trim().min(1).max(160),
  step: z.string().trim().min(1).max(220),
  blueprint: z.string().trim().min(1),
});
export type CloudStory = z.output<typeof CloudStorySchema>;
export const StoryLibrarySchema = z
  .object({
    formatVersion: z.literal(1),
    stories: z.array(CloudStorySchema),
  })
  .refine(value => new Set(value.stories.map(story => story.id)).size === value.stories.length, {
    message: '故事 ID 重复',
  });
export type StoryLibrary = z.output<typeof StoryLibrarySchema>;
export interface EditableStoryLibrary {
  library: StoryLibrary;
  sha: string | null;
}

const repositoryPath = STORY_REPOSITORY.owner + '/' + STORY_REPOSITORY.repo;
export const STORY_REPOSITORY_URL = 'https://github.com/' + repositoryPath;
const apiUrl = 'https://api.github.com/repos/' + repositoryPath;
const fileUrl = apiUrl + '/contents/' + STORY_REPOSITORY.path;
export const STORY_LIBRARY_URL =
  'https://raw.githubusercontent.com/' + repositoryPath + '/' + STORY_REPOSITORY.branch + '/' + STORY_REPOSITORY.path;

export function emptyStoryLibrary(): StoryLibrary {
  return { formatVersion: 1, stories: [] };
}

function checkSize(text: string): void {
  if (new TextEncoder().encode(text).byteLength > STORY_LIBRARY_LIMIT) {
    throw new Error('故事库超过 1 MB，请缩减文稿后再发布。编辑内容已保留。');
  }
}

export function parseStoryLibrary(text: string): StoryLibrary {
  checkSize(text);
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/u, ''));
  } catch {
    throw new Error('故事库文件未形成有效的 JSON，请检查文稿格式。');
  }
  const result = StoryLibrarySchema.safeParse(value);
  if (!result.success) throw new Error('故事库资料不完整、格式版本不受支持或故事 ID 重复，请联系作者修正文稿。');
  return result.data;
}

export function serializeStoryLibrary(library: StoryLibrary): string {
  const result = StoryLibrarySchema.safeParse(library);
  if (!result.success) throw new Error('请检查故事名称、题材、篇幅、简介、目标、入手方式及幕后蓝图。');
  const text = JSON.stringify(result.data, null, 2) + '\n';
  checkSize(text);
  return text;
}

function headers(token: string): Record<string, string> {
  if (!token.trim()) throw new Error('请先填写故事仓库的发布凭证。');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token.trim(),
    'X-GitHub-Api-Version': '2026-03-10',
  };
}

async function request(
  url: string,
  options: RequestInit,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
): Promise<Response> {
  if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
  const signals = [AbortSignal.timeout(20_000)];
  if (signal) signals.push(signal);
  try {
    return await fetcher(url, { ...options, signal: AbortSignal.any(signals) });
  } catch {
    if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
    throw new Error('故事库连接失败或等待超时，请检查网络后重试。编辑内容已保留。');
  }
}

function checkResponse(response: Response): void {
  if (response.ok) return;
  if (response.status === 409 || response.status === 422) {
    throw new Error('云端版本已有变化或提交被拒绝。文稿已保留，请重新载入云端版本、核对后再发布。');
  }
  if (response.headers.get('x-ratelimit-remaining') === '0') {
    throw new Error('故事库读取次数暂时达到限额，请稍后重试。');
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('发布凭证无效、已过期或缺少仓库 Contents 写入权限，请检查授权。');
  }
  if (response.status === 404) throw new Error('故事仓库尚未建立或地址无法访问，请检查故事仓库配置。');
  throw new Error('故事库请求未成功，请稍后重试。编辑内容已保留。');
}

/** 玩家只读取公开文稿，凭证仅用于作者操作。 */
export async function loadPublicStories(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<StoryLibrary> {
  const response = await request(STORY_LIBRARY_URL, { cache: 'no-store', credentials: 'omit' }, signal, fetcher);
  if (response.status === 404) throw new Error('云端故事库尚未发布，请稍后刷新。');
  checkResponse(response);
  return parseStoryLibrary(await response.text());
}

export function encodeStoryFile(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

function decodeStoryFile(content: string): string {
  const binary = atob(content.replace(/\s/gu, ''));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

export async function loadEditableStories(
  token: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<EditableStoryLibrary> {
  const authHeaders = headers(token);
  const repo = await request(apiUrl, { headers: authHeaders, cache: 'no-store', credentials: 'omit' }, signal, fetcher);
  checkResponse(repo);
  const metadata = (await repo.json()) as { private?: boolean };
  if (metadata.private !== false) throw new Error('请使用公开故事仓库，让玩家能够免登录读取已发布文稿。');
  const response = await request(
    fileUrl + '?ref=' + STORY_REPOSITORY.branch,
    { headers: authHeaders, cache: 'no-store', credentials: 'omit' },
    signal,
    fetcher,
  );
  // 已验证仓库存在；空仓库首次发布时可以创建 library.json。
  if (response.status === 404) return { library: emptyStoryLibrary(), sha: null };
  checkResponse(response);
  const file = (await response.json()) as { sha?: string; encoding?: string; content?: string; size?: number };
  if (file.size !== undefined && file.size > STORY_LIBRARY_LIMIT) {
    throw new Error('故事库超过 1 MB，请缩减文稿后再发布。编辑内容已保留。');
  }
  if (!file.sha || file.encoding !== 'base64' || typeof file.content !== 'string') {
    throw new Error('故事库文件无法读取，请检查文件格式及 1 MB 大小限制。');
  }
  try {
    return { library: parseStoryLibrary(decodeStoryFile(file.content)), sha: file.sha };
  } catch (cause) {
    if (cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof DOMException)) throw cause;
    throw new Error('故事库文件编码无效，请使用 UTF-8 文稿。', { cause });
  }
}

export async function publishStoryLibrary(
  next: StoryLibrary,
  sha: string | null,
  token: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<{ sha: string; commitUrl: string }> {
  const content = encodeStoryFile(serializeStoryLibrary(next));
  const response = await request(
    fileUrl,
    {
      method: 'PUT',
      credentials: 'omit',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Publish cloud story library',
        content,
        branch: STORY_REPOSITORY.branch,
        ...(sha ? { sha } : {}),
      }),
    },
    signal,
    fetcher,
  );
  checkResponse(response);
  const result = (await response.json()) as { content?: { sha?: string }; commit?: { html_url?: string } };
  if (!result.content?.sha) throw new Error('提交结果尚未确认，文稿已保留，请重新载入云端版本核对。');
  const commitUrl = result.commit?.html_url;
  return {
    sha: result.content.sha,
    commitUrl: commitUrl?.startsWith(STORY_REPOSITORY_URL + '/commit/') ? commitUrl : STORY_REPOSITORY_URL,
  };
}

export function cloudJourneyId(storyId: string): string {
  return CLOUD_JOURNEY_PREFIX + storyId;
}

const SnapshotSchema = z.object({
  format: z.literal('dhl-authored-story-v1'),
  repository: z.string(),
  story: CloudStorySchema,
});

export function createStorySnapshot(story: CloudStory): string {
  return JSON.stringify({
    format: 'dhl-authored-story-v1',
    repository: STORY_REPOSITORY_URL,
    story: CloudStorySchema.parse(story),
  });
}

export function readStorySnapshot(plan: string | undefined): CloudStory | undefined {
  if (!plan?.startsWith('{"format":"dhl-authored-story-v1"')) return undefined;
  try {
    const result = SnapshotSchema.safeParse(JSON.parse(plan));
    return result.success ? result.data.story : undefined;
  } catch {
    return undefined;
  }
}
