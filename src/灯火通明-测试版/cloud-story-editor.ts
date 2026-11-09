import { onScopeDispose, ref } from 'vue';
import {
  CloudStorySchema,
  emptyStoryLibrary,
  loadEditableStories,
  publishStoryLibrary,
  STORY_LIBRARY_LIMIT,
  type CloudStory,
  type StoryLibrary,
} from './cloud-stories';

export type StoryDraft = Omit<CloudStory, 'genres'> & { genresText: string };

export function newStoryDraft(): StoryDraft {
  return {
    id: 'story_' + crypto.randomUUID().replaceAll('-', ''),
    revision: 0,
    name: '',
    genresText: '',
    length: '短篇',
    lead: '',
    goal: '',
    step: '',
    blueprint: '',
  };
}

/** 每个管理窗口独享会话；关闭或卸载窗口时清除凭证并丢弃迟到结果。 */
export function useCloudStoryEditor(onPublished: (library: StoryLibrary) => void, fetcher: typeof fetch = fetch) {
  const token = ref('');
  const draft = ref<StoryDraft>(newStoryDraft());
  const library = ref(emptyStoryLibrary());
  const sha = ref<string | null>(null);
  const loaded = ref(false);
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  const commitUrl = ref('');
  const removalId = ref('');
  const preview = ref(false);
  let disposed = false;
  let controller: AbortController | undefined;

  const run = async <T>(operation: (signal: AbortSignal) => Promise<T>, receive: (result: T) => void) => {
    if (busy.value || disposed) return false;
    const current = new AbortController();
    controller = current;
    busy.value = true;
    error.value = '';
    notice.value = '';
    try {
      const result = await operation(current.signal);
      if (disposed || current.signal.aborted) return false;
      receive(result);
      return true;
    } catch (cause) {
      if (!disposed && !current.signal.aborted) {
        error.value = cause instanceof Error ? cause.message : '操作未完成，编辑内容已保留，请重试。';
      }
      return false;
    } finally {
      if (!disposed) busy.value = false;
      if (controller === current) controller = undefined;
    }
  };

  const load = () =>
    run(
      signal => loadEditableStories(token.value, signal, fetcher),
      result => {
        library.value = result.library;
        sha.value = result.sha;
        loaded.value = true;
        removalId.value = '';
        notice.value = '云端版本已载入。当前编辑内容继续保留，可在下方选择文稿进行核对。';
      },
    );

  const edit = (story: CloudStory) => {
    if (busy.value) return;
    const { genres, ...fields } = story;
    draft.value = { ...fields, genresText: genres.join('、') };
    removalId.value = '';
    preview.value = false;
    error.value = '';
    notice.value = '';
  };

  const create = () => {
    if (busy.value) return;
    draft.value = newStoryDraft();
    removalId.value = '';
    preview.value = false;
    error.value = '';
    notice.value = '';
  };

  const publish = async () => {
    if (!loaded.value) {
      error.value = '请先载入云端版本，再发布文稿。';
      return false;
    }
    const previous = library.value.stories.find(story => story.id === draft.value.id);
    const parsed = CloudStorySchema.safeParse({
      ...draft.value,
      genres: draft.value.genresText
        .split(/[、,，]/u)
        .map(text => text.trim())
        .filter(Boolean),
      revision: Math.max(previous?.revision ?? 0, draft.value.revision) + 1,
    });
    if (!parsed.success) {
      error.value = '请填写名称、题材、简介、目标、入手方式及幕后蓝图，并检查各栏字数。';
      return false;
    }
    const story = parsed.data;
    const next: StoryLibrary = {
      formatVersion: 1,
      stories: [...library.value.stories.filter(item => item.id !== story.id), story],
    };
    return run(
      signal => publishStoryLibrary(next, sha.value, token.value, signal, fetcher),
      result => {
        library.value = next;
        sha.value = result.sha;
        draft.value.revision = story.revision;
        commitUrl.value = result.commitUrl;
        notice.value = '故事已发布。玩家可刷新故事库查看，公开读取地址的缓存更新可能稍有延迟。';
        onPublished(next);
      },
    );
  };

  const withdraw = (id: string) => {
    if (!loaded.value || removalId.value !== id || !library.value.stories.some(story => story.id === id)) {
      return Promise.resolve(false);
    }
    const next: StoryLibrary = { formatVersion: 1, stories: library.value.stories.filter(story => story.id !== id) };
    return run(
      signal => publishStoryLibrary(next, sha.value, token.value, signal, fetcher),
      result => {
        library.value = next;
        sha.value = result.sha;
        commitUrl.value = result.commitUrl;
        removalId.value = '';
        notice.value = '故事已下架，玩家已经保存的行旅继续保留。';
        onPublished(next);
      },
    );
  };

  const importManuscript = async (file: File) => {
    if (busy.value || disposed) return;
    error.value = '';
    if (!/\.(?:md|txt)$/iu.test(file.name)) {
      error.value = '请选择 Markdown 或 TXT 文稿。';
      return;
    }
    if (file.size > STORY_LIBRARY_LIMIT) {
      error.value = '文稿超过 1 MB，请缩减后重新导入。当前编辑内容已保留。';
      return;
    }
    try {
      const text = (await file.text()).replace(/^\uFEFF/u, '').trim();
      if (disposed) return;
      if (!text) throw new Error('文稿内容为空，请检查文件。');
      draft.value.blueprint = text;
      notice.value = '幕后文稿已导入，请补全展示资料并预览后发布。';
    } catch (cause) {
      if (!disposed) error.value = cause instanceof Error ? cause.message : '文稿读取失败，请重新选择文件。';
    }
  };

  const close = () => {
    disposed = true;
    token.value = '';
    controller?.abort();
    controller = undefined;
    busy.value = false;
  };
  onScopeDispose(close);

  return {
    token,
    draft,
    library,
    loaded,
    busy,
    error,
    notice,
    commitUrl,
    removalId,
    preview,
    load,
    edit,
    create,
    publish,
    withdraw,
    importManuscript,
    close,
  };
}
