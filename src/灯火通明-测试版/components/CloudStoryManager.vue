<template>
  <section class="story-manager" aria-label="故事管理" @keydown.esc.stop="$emit('close')">
    <header class="manager-heading">
      <div>
        <h3>故事管理</h3>
        <p>编辑文稿，预览后发布到共享故事库。</p>
      </div>
      <button type="button" @click="$emit('close')">关闭管理</button>
    </header>
    <p class="repository-note">
      故事仓库：<a :href="STORY_REPOSITORY_URL" target="_blank" rel="noopener noreferrer">
        {{ STORY_REPOSITORY.owner }}/{{ STORY_REPOSITORY.repo }}
      </a>
    </p>
    <div class="credentials">
      <label
        >发布凭证
        <input
          v-model="editor.token"
          type="password"
          autocomplete="off"
          :spellcheck="false"
          :disabled="editor.busy"
          placeholder="专用于故事仓库的 GitHub Token"
        />
      </label>
      <button type="button" :disabled="editor.busy || !editor.token.trim()" @click="editor.load">
        {{ editor.loaded ? '重新载入云端版本' : '载入云端版本' }}
      </button>
    </div>
    <p class="manager-note">
      凭证需具有此仓库的 Contents 读写权限，仅保留在本次管理窗口内存中，关闭即清除。公开仓库中的文稿可被下载。
      <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer"
        >创建专用凭证</a
      >
    </p>
    <p v-if="editor.busy" role="status">正在与故事库同步……</p>
    <p v-if="editor.error" class="manager-error" role="alert">{{ editor.error }}</p>
    <p v-if="editor.notice" class="manager-note" role="status">{{ editor.notice }}</p>
    <a v-if="editor.commitUrl" :href="editor.commitUrl" target="_blank" rel="noopener noreferrer">查看本次提交</a>

    <div v-if="editor.loaded" class="published-stories">
      <h4>已发布故事</h4>
      <p v-if="!editor.library.stories.length" class="manager-note">故事库尚为空，可以发布第一篇文稿。</p>
      <article v-for="story in editor.library.stories" :key="story.id">
        <div class="published-row">
          <span
            >{{ story.name }}<small>第 {{ story.revision }} 版</small></span
          >
          <div class="manager-actions">
            <button type="button" :disabled="editor.busy" @click="editor.edit(story)">载入文稿</button>
            <button
              type="button"
              :disabled="editor.busy"
              :aria-expanded="editor.removalId === story.id"
              @click="editor.removalId = editor.removalId === story.id ? '' : story.id"
            >
              下架
            </button>
          </div>
        </div>
        <div v-if="editor.removalId === story.id" class="withdraw-confirm">
          <p>下架「{{ story.name }}」后，玩家已保存的行旅继续保留。</p>
          <button type="button" :disabled="editor.busy" @click="editor.withdraw(story.id)">确认下架</button>
          <button type="button" :disabled="editor.busy" @click="editor.removalId = ''">取消</button>
        </div>
      </article>
    </div>

    <form @submit.prevent="editor.publish">
      <div class="manager-heading">
        <h4>{{ editor.draft.revision ? '编辑故事' : '新建故事' }}</h4>
        <button type="button" :disabled="editor.busy" @click="editor.create">另写一篇</button>
      </div>
      <fieldset :disabled="editor.busy">
        <div class="form-grid">
          <label>故事名称<input v-model="editor.draft.name" maxlength="24" required /></label>
          <label
            >题材<input v-model="editor.draft.genresText" placeholder="例如：恐怖、悬疑；多个题材用顿号分隔" required
          /></label>
          <label
            >篇幅<select v-model="editor.draft.length">
              <option v-for="length in STORY_LENGTHS" :key="length" :value="length">{{ length }}</option>
            </select></label
          >
        </div>
        <label>玩家可读的简介<textarea v-model="editor.draft.lead" rows="3" maxlength="220" required></textarea></label>
        <label>此行所求<textarea v-model="editor.draft.goal" rows="2" maxlength="160" required></textarea></label>
        <label>入手方式<textarea v-model="editor.draft.step" rows="2" maxlength="220" required></textarea></label>
        <label class="manuscript-import"
          >导入幕后文稿
          <input type="file" accept=".md,.txt,text/markdown,text/plain" @change="importFile" />
        </label>
        <label
          >幕后故事蓝图<textarea
            v-model="editor.draft.blueprint"
            rows="12"
            required
            placeholder="写清固定真相、人物动机、关键节点、可调查线索、结局条件，以及允许随玩家行动变化的部分。"
          ></textarea>
        </label>
        <p class="manager-note">幕后蓝图随选篇存入行旅，仅在作者管理中展示。已开始的行旅继续使用选篇时保存的版本。</p>
        <div class="manager-actions">
          <button type="button" :aria-expanded="editor.preview" @click="editor.preview = !editor.preview">
            玩家视角预览
          </button>
          <button type="submit" :disabled="!editor.loaded || !editor.token.trim()">发布故事</button>
        </div>
      </fieldset>
      <article v-if="editor.preview" class="story-preview" aria-label="玩家视角预览">
        <small>{{ editor.draft.genresText }} · {{ editor.draft.length }}</small>
        <h3>{{ editor.draft.name || '待填写名称' }}</h3>
        <p>{{ editor.draft.lead || '待填写简介' }}</p>
        <p>所求：{{ editor.draft.goal }}</p>
        <p>入手：{{ editor.draft.step }}</p>
      </article>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { STORY_LENGTHS, STORY_REPOSITORY, STORY_REPOSITORY_URL, type StoryLibrary } from '../cloud-stories';
import { useCloudStoryEditor } from '../cloud-story-editor';

const emit = defineEmits<{ close: []; published: [library: StoryLibrary] }>();
const editor = reactive(useCloudStoryEditor(library => emit('published', library)));
const importFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await editor.importManuscript(file);
};
</script>

<style scoped lang="scss">
.story-manager {
  margin-top: 16px;
  padding: 18px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--surface-inset);
  color: var(--text-primary);
  overflow-wrap: anywhere;
}
.manager-heading,
.published-row,
.manager-actions,
.credentials {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
h3,
h4,
p {
  margin: 0;
}
h3,
h4 {
  font-weight: 600;
}
.manager-heading p,
.repository-note,
.manager-note,
small {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.9;
}
.manager-note,
.repository-note,
[role='status'],
[role='alert'] {
  margin-top: 10px;
}
a {
  color: var(--gold);
}
button,
input,
textarea,
select {
  font: inherit;
  color: inherit;
}
button {
  padding: 10px 12px;
  border: 1px solid var(--line-subtle);
  border-radius: 5px;
  background: var(--button-bg);
  color: var(--gold);
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:hover:not(:disabled) {
  background: var(--button-hover);
}
.credentials {
  margin-top: 14px;
  align-items: flex-end;
}
.credentials label {
  flex: 1;
  min-width: 0;
}
label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
input,
textarea,
select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 4px;
  background: var(--surface);
}
textarea {
  resize: vertical;
  line-height: 1.8;
}
.manager-error {
  color: var(--semantic-danger);
  line-height: 1.8;
}
.published-stories,
form {
  margin-top: 20px;
  border-top: 1px solid var(--line-subtle);
  padding-top: 16px;
}
.published-stories article {
  padding-block: 10px;
  border-bottom: 1px solid var(--line-subtle);
}
small {
  margin-left: 8px;
}
.manager-actions {
  justify-content: flex-start;
}
.withdraw-confirm {
  margin-top: 10px;
  line-height: 1.9;
}
.withdraw-confirm button {
  margin: 8px 8px 0 0;
}
fieldset {
  display: grid;
  min-width: 0;
  gap: 14px;
  margin: 14px 0 0;
  padding: 0;
  border: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 110px;
  gap: 12px;
}
.story-preview {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--line-subtle);
  line-height: 1.9;
}
.story-preview small {
  margin: 0;
  color: var(--gold);
}
@media (max-width: 650px) {
  .story-manager {
    padding: 14px 10px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .credentials {
    display: grid;
    grid-template-columns: 1fr;
  }
}
@media (pointer: coarse) {
  input,
  textarea,
  select {
    font-size: 16px;
  }
}
</style>
