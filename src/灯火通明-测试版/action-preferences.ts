import { ref } from 'vue';

export type ActionSubmitMode = 'confirm' | 'direct';

const SUBMIT_MODE_STORAGE_KEY = 'dhl-action-submit-mode-v1';
const INLINE_ACTIONS_STORAGE_KEY = 'dhl-inline-actions-v1';

const readStorage = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const submitMode = ref<ActionSubmitMode>(readStorage(SUBMIT_MODE_STORAGE_KEY) === 'direct' ? 'direct' : 'confirm');
const inlineActionsEnabled = ref(readStorage(INLINE_ACTIONS_STORAGE_KEY) !== 'false');

const writeStorage = (key: string, value: string, label: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[行动提示] 无法保存${label}`, error);
  }
};

const setSubmitMode = (mode: ActionSubmitMode) => {
  submitMode.value = mode;
  writeStorage(SUBMIT_MODE_STORAGE_KEY, mode, '行动提交模式');
};

const setInlineActionsEnabled = (enabled: boolean) => {
  inlineActionsEnabled.value = enabled;
  writeStorage(INLINE_ACTIONS_STORAGE_KEY, String(enabled), '正文选项显示偏好');
};

const toggleInlineActions = () => setInlineActionsEnabled(!inlineActionsEnabled.value);

export const useActionPreferences = () => ({
  submitMode,
  inlineActionsEnabled,
  setSubmitMode,
  setInlineActionsEnabled,
  toggleInlineActions,
});
