import { getDefaultTheme, getThemeById, isThemeId, themes, type Theme, type ThemeId } from '../themes';

export type ReadingMeasure = 'narrow' | 'standard' | 'wide';
export type ReadingMode = 'paged' | 'scroll';
export type ReadingViewportMode = 'mobile' | 'desktop';
export type ReasoningAppearanceMode = 'auto' | 'preset' | 'theme';
export type DialogueColorOverrides = Partial<Record<ThemeId, string>>;

export interface ReadingPreferences {
  fontSize: number;
  lineHeight: number;
  measure: ReadingMeasure;
  measureWidth: number;
  dialogueColors: DialogueColorOverrides;
  reasoningAppearance: ReasoningAppearanceMode;
  showPortraitRail: boolean;
  reduceMotion: boolean;
}

const PREFERENCES_STORAGE_KEY = 'dhl-reading-preferences-v1';
const THEME_STORAGE_KEY = 'dhl-theme-id-v2';
const READING_MODE_STORAGE_KEYS: Record<ReadingViewportMode, string> = {
  desktop: 'denghuolanshan:pseudo-layer:reading-mode:desktop',
  mobile: 'denghuolanshan:pseudo-layer:reading-mode:mobile',
};
const LEGACY_THEME_KEYS = ['ui_theme_id', 'dhl-theme-id-v1'];
const DEFAULT_PREFERENCES: ReadingPreferences = {
  fontSize: 16,
  lineHeight: 1.95,
  measure: 'standard',
  measureWidth: 76,
  dialogueColors: {},
  reasoningAppearance: 'auto',
  showPortraitRail: true,
  reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
};
const DEFAULT_READING_MODES: Record<ReadingViewportMode, ReadingMode> = {
  desktop: 'paged',
  mobile: 'scroll',
};
const LEGACY_MEASURE_WIDTH: Record<ReadingMeasure, number> = {
  narrow: 58,
  standard: 76,
  wide: 100,
};
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const sanitizeDialogueColors = (value: unknown): DialogueColorOverrides => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [ThemeId, string] => isThemeId(entry[0]) && HEX_COLOR_PATTERN.test(String(entry[1])),
    ),
  );
};

const readStoredReadingMode = (viewport: ReadingViewportMode): ReadingMode => {
  try {
    const stored = localStorage.getItem(READING_MODE_STORAGE_KEYS[viewport]);
    if (stored === 'paged' || stored === 'scroll') return stored;
  } catch (error) {
    console.warn('[灯火阑珊·阅读] 阅读模式读取失败，使用设备默认值', error);
  }
  return DEFAULT_READING_MODES[viewport];
};

const clampPreferences = (value: Partial<ReadingPreferences>): ReadingPreferences => {
  const measure = ['narrow', 'standard', 'wide'].includes(String(value.measure))
    ? (value.measure as ReadingMeasure)
    : DEFAULT_PREFERENCES.measure;
  const storedMeasureWidth = Number(value.measureWidth);
  return {
    fontSize: _.clamp(Number(value.fontSize) || DEFAULT_PREFERENCES.fontSize, 14, 20),
    lineHeight: _.clamp(Number(value.lineHeight) || DEFAULT_PREFERENCES.lineHeight, 1.7, 2.2),
    measure,
    measureWidth: _.clamp(
      Number.isFinite(storedMeasureWidth) && storedMeasureWidth > 0
        ? storedMeasureWidth
        : LEGACY_MEASURE_WIDTH[measure],
      50,
      100,
    ),
    dialogueColors: sanitizeDialogueColors(value.dialogueColors),
    reasoningAppearance: ['auto', 'preset', 'theme'].includes(String(value.reasoningAppearance))
      ? (value.reasoningAppearance as ReasoningAppearanceMode)
      : DEFAULT_PREFERENCES.reasoningAppearance,
    showPortraitRail:
      typeof value.showPortraitRail === 'boolean' ? value.showPortraitRail : DEFAULT_PREFERENCES.showPortraitRail,
    reduceMotion: typeof value.reduceMotion === 'boolean' ? value.reduceMotion : DEFAULT_PREFERENCES.reduceMotion,
  };
};

const readStoredTheme = (): ThemeId => {
  try {
    const current = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(current)) return current;

    for (const key of LEGACY_THEME_KEYS) {
      const legacy = localStorage.getItem(key);
      if (isThemeId(legacy)) return legacy;
      if (legacy === 'red') return getDefaultTheme().id;
    }
  } catch (error) {
    console.warn('[灯火阑珊·外观] 主题设置读取失败，使用默认主题', error);
  }
  return getDefaultTheme().id;
};

export const useThemeStore = defineStore('appearance', () => {
  const currentThemeId = ref<ThemeId>(readStoredTheme());
  const currentTheme = computed<Theme>(() => getThemeById(currentThemeId.value));
  const availableThemes = themes;
  const preferences = ref<ReadingPreferences>({ ...DEFAULT_PREFERENCES });
  const readingModes = ref<Record<ReadingViewportMode, ReadingMode>>({
    desktop: readStoredReadingMode('desktop'),
    mobile: readStoredReadingMode('mobile'),
  });

  try {
    const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (saved) preferences.value = clampPreferences(JSON.parse(saved) as Partial<ReadingPreferences>);
  } catch (error) {
    console.warn('[灯火阑珊·外观] 阅读设置读取失败，使用默认值', error);
  }

  const savePreferences = () => {
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences.value));
    } catch (error) {
      console.warn('[灯火阑珊·外观] 阅读设置保存失败', error);
    }
  };

  const selectTheme = (themeId: string) => {
    currentThemeId.value = isThemeId(themeId) ? themeId : getDefaultTheme().id;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentThemeId.value);
    } catch (error) {
      console.warn('[灯火阑珊·外观] 主题设置保存失败', error);
    }
  };

  const updatePreferences = (next: Partial<ReadingPreferences>) => {
    preferences.value = clampPreferences({ ...preferences.value, ...next });
    savePreferences();
  };

  const currentDialogueColor = computed(
    () => preferences.value.dialogueColors[currentThemeId.value] ?? currentTheme.value.colors.dialogueText,
  );
  const hasCustomDialogueColor = computed(() => currentThemeId.value in preferences.value.dialogueColors);

  const setDialogueColor = (color: string) => {
    if (!HEX_COLOR_PATTERN.test(color)) return;
    updatePreferences({
      dialogueColors: {
        ...preferences.value.dialogueColors,
        [currentThemeId.value]: color.toLowerCase(),
      },
    });
  };

  const resetDialogueColor = () => {
    const dialogueColors = { ...preferences.value.dialogueColors };
    delete dialogueColors[currentThemeId.value];
    updatePreferences({ dialogueColors });
  };

  const resetPreferences = () => {
    preferences.value = { ...DEFAULT_PREFERENCES, dialogueColors: {} };
    savePreferences();
  };

  const setReadingMode = (viewport: ReadingViewportMode, mode: ReadingMode) => {
    readingModes.value = { ...readingModes.value, [viewport]: mode };
    try {
      localStorage.setItem(READING_MODE_STORAGE_KEYS[viewport], mode);
    } catch (error) {
      console.warn('[灯火阑珊·阅读] 阅读模式保存失败', error);
    }
  };

  const resetReadingMode = (viewport: ReadingViewportMode) => {
    setReadingMode(viewport, DEFAULT_READING_MODES[viewport]);
  };

  return {
    currentThemeId,
    currentTheme,
    currentDialogueColor,
    hasCustomDialogueColor,
    availableThemes,
    preferences,
    readingModes,
    selectTheme,
    updatePreferences,
    setDialogueColor,
    resetDialogueColor,
    resetPreferences,
    setReadingMode,
    resetReadingMode,
  };
});
