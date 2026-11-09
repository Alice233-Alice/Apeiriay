export type ThemeId = 'lantern' | 'duskInk' | 'shanhai' | 'starAltar';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  mode: 'dark' | 'light';
  glyph: string;
  preview: {
    background: string;
    surface: string;
    accent: string;
  };
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    border: string;
    borderActive: string;
    textPrimary: string;
    textSecondary: string;
    textAccent: string;
    dialogueText: string;
    accent: string;
    accentGlow: string;
    buttonBg: string;
    buttonHover: string;
    buttonActive: string;
    progressBg: string;
    headerBg: string;
    tabBg: string;
    tabActive: string;
    footerBg: string;
    canvas: string;
    surface: string;
    surfaceRaised: string;
    surfaceInset: string;
    readingSurface: string;
    lineSubtle: string;
    lineStrong: string;
    gold: string;
    goldSoft: string;
    jade: string;
    jadeSoft: string;
    crimson: string;
    danger: string;
    success: string;
    warning: string;
    info: string;
    relation: string;
    shadow: string;
    focusRing: string;
  };
  materials: {
    stage: string;
    ambient: string;
    frame: string;
    reading: string;
    portrait: string;
    grain: string;
  };
}

const lanternTheme: Theme = {
  id: 'lantern',
  name: '灯火阑珊',
  description: '雨巷入夜，疏灯照水，回首处仍有一窗微明',
  mode: 'dark',
  glyph: 'fa-solid fa-lightbulb',
  preview: {
    background: 'linear-gradient(145deg, #071723, #102b35 52%, #3b281f)',
    surface: 'rgba(12, 31, 40, 0.86)',
    accent: '#e6bd76',
  },
  colors: {
    bgPrimary: 'linear-gradient(180deg, rgba(7, 23, 32, 0.98), rgba(4, 15, 22, 0.992))',
    bgSecondary: 'rgba(16, 37, 45, 0.94)',
    border: 'rgba(213, 180, 121, 0.28)',
    borderActive: 'rgba(242, 194, 111, 0.72)',
    textPrimary: '#f3eee5',
    textSecondary: '#b7b8b3',
    textAccent: '#e0d3c1',
    dialogueText: '#7fd2c1',
    accent: '#e3b96f',
    accentGlow: 'rgba(227, 185, 111, 0.25)',
    buttonBg: 'rgba(186, 129, 69, 0.1)',
    buttonHover: 'rgba(215, 161, 87, 0.18)',
    buttonActive: 'linear-gradient(180deg, rgba(117, 70, 42, 0.62), rgba(50, 40, 36, 0.76))',
    progressBg: 'rgba(4, 14, 19, 0.76)',
    headerBg: 'linear-gradient(90deg, rgba(4, 18, 27, 0.985), rgba(16, 35, 43, 0.965), rgba(37, 27, 25, 0.985))',
    tabBg: 'rgba(4, 17, 25, 0.975)',
    tabActive: 'linear-gradient(180deg, rgba(126, 78, 42, 0.4), rgba(14, 27, 32, 0.16))',
    footerBg: 'rgba(3, 14, 21, 0.98)',
    canvas: '#030d14',
    surface: 'rgba(8, 26, 34, 0.94)',
    surfaceRaised: 'rgba(20, 39, 43, 0.98)',
    surfaceInset: 'rgba(2, 12, 18, 0.88)',
    readingSurface: 'linear-gradient(180deg, rgba(5, 25, 35, 0.8), rgba(3, 18, 27, 0.9))',
    lineSubtle: 'rgba(220, 191, 141, 0.14)',
    lineStrong: 'rgba(225, 184, 111, 0.42)',
    gold: '#e6bd76',
    goldSoft: '#c8a66f',
    jade: '#68c5b2',
    jadeSoft: '#8ebbb1',
    crimson: '#aa5960',
    danger: '#df7468',
    success: '#72c6a5',
    warning: '#dda85e',
    info: '#77aeca',
    relation: '#d8899d',
    shadow: 'rgba(0, 4, 8, 0.58)',
    focusRing: 'rgba(231, 187, 109, 0.3)',
  },
  materials: {
    stage: `
      radial-gradient(circle at 91% 18%, rgba(255, 177, 73, 0.2), transparent 11%),
      radial-gradient(circle at 8% 76%, rgba(244, 157, 58, 0.13), transparent 13%),
      linear-gradient(90deg, rgba(1, 11, 18, 0.99), rgba(7, 29, 39, 0.97) 48%, rgba(38, 25, 23, 0.98)),
      linear-gradient(180deg, #061721, #020a10)`,
    ambient: `
      radial-gradient(circle at 91% 18%, rgba(255, 194, 104, 0.64) 0 2px, rgba(255, 164, 65, 0.2) 3px 8px, transparent 20px),
      radial-gradient(circle at 84% 43%, rgba(255, 184, 82, 0.48) 0 1px, rgba(255, 157, 55, 0.14) 3px 7px, transparent 15px),
      radial-gradient(circle at 9% 73%, rgba(255, 187, 88, 0.48) 0 2px, rgba(255, 156, 54, 0.12) 3px 9px, transparent 19px),
      linear-gradient(91deg, transparent 0 82%, rgba(235, 165, 82, 0.04) 82.2% 82.5%, transparent 82.8%),
      repeating-linear-gradient(90deg, transparent 0 48px, rgba(234, 192, 121, 0.025) 49px 50px)`,
    frame: `
      linear-gradient(90deg, rgba(229, 191, 125, 0.46), transparent 10%, transparent 90%, rgba(229, 191, 125, 0.46)),
      repeating-linear-gradient(90deg, transparent 0 46px, rgba(232, 197, 143, 0.05) 47px 48px),
      repeating-linear-gradient(0deg, transparent 0 46px, rgba(232, 197, 143, 0.035) 47px 48px)`,
    reading: `
      radial-gradient(circle at 93% 14%, rgba(255, 178, 72, 0.18), transparent 9%),
      radial-gradient(circle at 88% 42%, rgba(255, 157, 52, 0.09), transparent 8%),
      linear-gradient(180deg, transparent 54%, rgba(20, 73, 82, 0.13) 72%, rgba(4, 17, 25, 0.22)),
      repeating-linear-gradient(90deg, transparent 0 70px, rgba(221, 184, 119, 0.025) 71px 72px)`,
    portrait:
      'radial-gradient(circle at 70% 16%, rgba(238, 170, 79, 0.14), transparent 28%), linear-gradient(180deg, rgba(221, 165, 83, 0.06), transparent 36%, rgba(1, 10, 15, 0.42))',
    grain: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,0.008) 4px)',
  },
};

const duskInkTheme: Theme = {
  id: 'duskInk',
  name: '暮灯丹青',
  description: '青绿山色沉入暮霭，绢本深处浮起零星灯影',
  mode: 'dark',
  glyph: 'fa-solid fa-mountain-sun',
  preview: {
    background: 'linear-gradient(145deg, #17333a, #40534f 56%, #b79a68)',
    surface: 'rgba(218, 209, 182, 0.84)',
    accent: '#d8b36c',
  },
  colors: {
    bgPrimary: 'linear-gradient(180deg, rgba(28, 51, 55, 0.97), rgba(18, 37, 42, 0.985))',
    bgSecondary: 'rgba(57, 72, 68, 0.9)',
    border: 'rgba(204, 181, 126, 0.24)',
    borderActive: 'rgba(224, 181, 96, 0.62)',
    textPrimary: '#f0e9d8',
    textSecondary: '#bac0b5',
    textAccent: '#ded4bd',
    dialogueText: '#83c5b5',
    accent: '#d7ae63',
    accentGlow: 'rgba(215, 174, 99, 0.24)',
    buttonBg: 'rgba(189, 151, 84, 0.11)',
    buttonHover: 'rgba(201, 165, 101, 0.2)',
    buttonActive: 'linear-gradient(180deg, rgba(118, 91, 50, 0.55), rgba(35, 60, 59, 0.72))',
    progressBg: 'rgba(11, 28, 31, 0.72)',
    headerBg: 'linear-gradient(90deg, rgba(28, 47, 49, 0.97), rgba(60, 67, 58, 0.96), rgba(38, 46, 43, 0.97))',
    tabBg: 'rgba(22, 39, 42, 0.95)',
    tabActive: 'linear-gradient(180deg, rgba(166, 119, 56, 0.34), rgba(31, 54, 54, 0.2))',
    footerBg: 'rgba(17, 34, 37, 0.96)',
    canvas: '#142e34',
    surface: 'rgba(29, 48, 49, 0.96)',
    surfaceRaised: 'rgba(57, 68, 59, 0.98)',
    surfaceInset: 'rgba(14, 32, 35, 0.82)',
    readingSurface: 'linear-gradient(180deg, rgba(37, 57, 57, 0.84), rgba(23, 42, 45, 0.92))',
    lineSubtle: 'rgba(220, 204, 163, 0.15)',
    lineStrong: 'rgba(218, 177, 96, 0.44)',
    gold: '#deb66b',
    goldSoft: '#c3a779',
    jade: '#73b7a7',
    jadeSoft: '#9abdb1',
    crimson: '#a65e5c',
    danger: '#d4776a',
    success: '#75b998',
    warning: '#d0a25b',
    info: '#7eaab5',
    relation: '#ca8692',
    shadow: 'rgba(3, 12, 13, 0.5)',
    focusRing: 'rgba(222, 182, 107, 0.3)',
  },
  materials: {
    stage: `
      radial-gradient(ellipse at 22% 12%, rgba(143, 176, 150, 0.12), transparent 34%),
      radial-gradient(ellipse at 82% 86%, rgba(228, 170, 81, 0.1), transparent 22%),
      linear-gradient(145deg, #18343a, #263f40 58%, #3d4138)`,
    ambient: `
      linear-gradient(165deg, transparent 18%, rgba(188, 206, 180, 0.045) 24%, transparent 31%),
      radial-gradient(circle at 83% 21%, rgba(246, 186, 92, 0.18) 0 2px, transparent 4px),
      radial-gradient(circle at 13% 80%, rgba(242, 176, 78, 0.11) 0 3px, transparent 5px)`,
    frame: `
      linear-gradient(90deg, rgba(223, 189, 116, 0.3), transparent 16%, transparent 84%, rgba(223, 189, 116, 0.3)),
      repeating-linear-gradient(135deg, transparent 0 30px, rgba(225, 213, 177, 0.018) 31px 32px)`,
    reading: `
      radial-gradient(ellipse at 20% 105%, rgba(111, 145, 123, 0.12), transparent 40%),
      radial-gradient(ellipse at 82% -8%, rgba(203, 178, 121, 0.08), transparent 36%)`,
    portrait: 'linear-gradient(180deg, rgba(151, 176, 146, 0.08), transparent 46%, rgba(14, 31, 33, 0.26))',
    grain: 'repeating-linear-gradient(90deg, transparent 0 6px, rgba(238,232,207,0.01) 7px)',
  },
};

const shanhaiTheme: Theme = {
  id: 'shanhai',
  name: '山海丹青',
  description: '绢素铺陈，矿青石绿与朱砂小印共写山海长卷',
  mode: 'light',
  glyph: 'fa-solid fa-scroll',
  preview: {
    background: 'linear-gradient(145deg, #aaa28e, #d8cfb9 55%, #315a58)',
    surface: 'rgba(218, 208, 185, 0.96)',
    accent: '#284f50',
  },
  colors: {
    bgPrimary: 'linear-gradient(180deg, rgba(186, 178, 155, 0.99), rgba(153, 157, 143, 0.995))',
    bgSecondary: 'rgba(181, 180, 162, 0.96)',
    border: 'rgba(30, 68, 68, 0.38)',
    borderActive: 'rgba(29, 77, 76, 0.82)',
    textPrimary: '#263837',
    textSecondary: '#5f6862',
    textAccent: '#344e4b',
    dialogueText: '#174f4c',
    accent: '#295f5d',
    accentGlow: 'rgba(35, 89, 87, 0.24)',
    buttonBg: 'rgba(35, 78, 76, 0.11)',
    buttonHover: 'rgba(36, 86, 82, 0.2)',
    buttonActive: 'linear-gradient(180deg, rgba(39, 91, 87, 0.24), rgba(169, 166, 150, 0.54))',
    progressBg: 'rgba(47, 65, 61, 0.18)',
    headerBg: 'linear-gradient(90deg, rgba(177, 173, 153, 0.94), rgba(216, 205, 179, 0.92), rgba(165, 173, 158, 0.94))',
    tabBg: 'rgba(191, 189, 168, 0.92)',
    tabActive: 'linear-gradient(180deg, rgba(43, 91, 86, 0.2), rgba(219, 210, 187, 0.54))',
    footerBg: 'rgba(177, 179, 163, 0.94)',
    canvas: '#929887',
    surface: 'rgba(202, 195, 174, 0.9)',
    surfaceRaised: 'rgba(216, 205, 181, 0.94)',
    surfaceInset: 'rgba(173, 172, 158, 0.72)',
    readingSurface: 'linear-gradient(180deg, rgba(216, 206, 181, 0.88), rgba(194, 190, 170, 0.91))',
    lineSubtle: 'rgba(31, 70, 68, 0.2)',
    lineStrong: 'rgba(28, 67, 66, 0.62)',
    gold: '#80632d',
    goldSoft: '#8e7748',
    jade: '#285f5d',
    jadeSoft: '#4e7973',
    crimson: '#9a4138',
    danger: '#b24d43',
    success: '#3d8060',
    warning: '#9a6f2f',
    info: '#3e7184',
    relation: '#a34f67',
    shadow: 'rgba(27, 37, 34, 0.34)',
    focusRing: 'rgba(32, 86, 82, 0.3)',
  },
  materials: {
    stage: `
      radial-gradient(ellipse at 8% 102%, rgba(37, 78, 72, 0.28) 0 10%, transparent 28%),
      radial-gradient(ellipse at 96% 4%, rgba(39, 80, 75, 0.2) 0 8%, transparent 23%),
      linear-gradient(145deg, #aaa591, #d5ccb5 48%, #b7b49f)`,
    ambient: `
      radial-gradient(ellipse at -2% 103%, rgba(31, 66, 64, 0.36) 0 8%, transparent 9%),
      radial-gradient(ellipse at 11% 105%, rgba(45, 78, 69, 0.28) 0 7%, transparent 8%),
      radial-gradient(ellipse at 93% -4%, rgba(43, 75, 70, 0.25) 0 7%, transparent 8%),
      linear-gradient(155deg, transparent 0 74%, rgba(43, 80, 73, 0.1) 74.5% 75%, transparent 75.5%),
      repeating-linear-gradient(0deg, transparent 0 3px, rgba(62, 56, 43, 0.018) 4px)`,
    frame: `
      linear-gradient(90deg, rgba(28, 67, 66, 0.58), transparent 9%, transparent 91%, rgba(28, 67, 66, 0.58)),
      repeating-linear-gradient(90deg, transparent 0 48px, rgba(37, 73, 68, 0.08) 49px 50px),
      repeating-linear-gradient(0deg, transparent 0 48px, rgba(37, 73, 68, 0.055) 49px 50px)`,
    reading: `
      radial-gradient(ellipse at 3% 103%, rgba(36, 79, 73, 0.22) 0 8%, transparent 18%),
      radial-gradient(ellipse at 18% 106%, rgba(52, 91, 76, 0.14) 0 7%, transparent 18%),
      radial-gradient(ellipse at 98% -2%, rgba(42, 83, 77, 0.13) 0 8%, transparent 18%),
      linear-gradient(90deg, rgba(45, 86, 80, 0.035), transparent 12%, transparent 88%, rgba(45, 86, 80, 0.04))`,
    portrait: 'linear-gradient(180deg, rgba(39, 82, 77, 0.08), transparent 48%, rgba(55, 64, 57, 0.18))',
    grain:
      'repeating-linear-gradient(87deg, transparent 0 2px, rgba(69,58,40,0.018) 3px), repeating-linear-gradient(3deg, transparent 0 5px, rgba(55,70,62,0.012) 6px)',
  },
};

const starAltarTheme: Theme = {
  id: 'starAltar',
  name: '星坛玄境',
  description: '曜石为坛，铜轨测天，青玉微光沿星图缓缓游移',
  mode: 'dark',
  glyph: 'fa-solid fa-dharmachakra',
  preview: {
    background: 'radial-gradient(circle at 70% 25%, #123b48, #06131d 55%, #02080e)',
    surface: 'rgba(4, 20, 29, 0.9)',
    accent: '#4fd2c3',
  },
  colors: {
    bgPrimary: 'linear-gradient(180deg, rgba(4, 19, 28, 0.98), rgba(3, 12, 20, 0.995))',
    bgSecondary: 'rgba(12, 34, 43, 0.92)',
    border: 'rgba(184, 151, 83, 0.24)',
    borderActive: 'rgba(94, 207, 190, 0.62)',
    textPrimary: '#e9f0ec',
    textSecondary: '#91aaa8',
    textAccent: '#bed2cc',
    dialogueText: '#63d9c8',
    accent: '#52cbbb',
    accentGlow: 'rgba(75, 204, 186, 0.24)',
    buttonBg: 'rgba(50, 150, 143, 0.1)',
    buttonHover: 'rgba(62, 183, 170, 0.18)',
    buttonActive: 'linear-gradient(180deg, rgba(24, 105, 105, 0.52), rgba(7, 34, 45, 0.72))',
    progressBg: 'rgba(2, 10, 17, 0.8)',
    headerBg: 'linear-gradient(90deg, rgba(4, 17, 26, 0.98), rgba(9, 31, 40, 0.97), rgba(5, 16, 26, 0.98))',
    tabBg: 'rgba(3, 16, 24, 0.97)',
    tabActive: 'linear-gradient(180deg, rgba(24, 120, 118, 0.34), rgba(4, 21, 30, 0.16))',
    footerBg: 'rgba(2, 13, 20, 0.98)',
    canvas: '#020d15',
    surface: 'rgba(6, 22, 31, 0.97)',
    surfaceRaised: 'rgba(10, 35, 43, 0.98)',
    surfaceInset: 'rgba(1, 10, 17, 0.88)',
    readingSurface: 'linear-gradient(180deg, rgba(7, 27, 37, 0.88), rgba(3, 17, 26, 0.94))',
    lineSubtle: 'rgba(121, 190, 180, 0.14)',
    lineStrong: 'rgba(188, 153, 83, 0.44)',
    gold: '#d2ae65',
    goldSoft: '#aa925f',
    jade: '#55d0bf',
    jadeSoft: '#7bb8b1',
    crimson: '#a34b5b',
    danger: '#dd6a68',
    success: '#56cda3',
    warning: '#d3a455',
    info: '#59aaca',
    relation: '#c86f9c',
    shadow: 'rgba(0, 3, 8, 0.66)',
    focusRing: 'rgba(80, 205, 187, 0.28)',
  },
  materials: {
    stage: `
      radial-gradient(circle at 78% 14%, rgba(51, 167, 165, 0.13), transparent 20%),
      radial-gradient(circle at 18% 86%, rgba(194, 154, 73, 0.08), transparent 22%),
      linear-gradient(145deg, #020c14, #061e2a 52%, #020811)`,
    ambient: `
      radial-gradient(circle at 15% 22%, rgba(169, 224, 216, 0.54) 0 1px, transparent 2px),
      radial-gradient(circle at 77% 74%, rgba(169, 224, 216, 0.44) 0 1px, transparent 2px),
      radial-gradient(circle at 92% 26%, rgba(211, 175, 99, 0.42) 0 1px, transparent 2px),
      radial-gradient(circle at 38% 8%, rgba(147, 205, 199, 0.36) 0 1px, transparent 2px)`,
    frame: `
      linear-gradient(90deg, rgba(205, 168, 91, 0.32), transparent 16%, transparent 84%, rgba(205, 168, 91, 0.32)),
      repeating-linear-gradient(90deg, transparent 0 74px, rgba(84, 207, 190, 0.035) 75px 76px)`,
    reading: `
      radial-gradient(circle at 86% 16%, transparent 0 80px, rgba(75, 201, 187, 0.05) 81px 82px, transparent 83px),
      linear-gradient(90deg, rgba(72, 195, 182, 0.025), transparent 12%, transparent 88%, rgba(72, 195, 182, 0.025))`,
    portrait:
      'radial-gradient(circle at 50% 28%, rgba(75, 204, 190, 0.12), transparent 34%), linear-gradient(180deg, transparent, rgba(1, 10, 17, 0.3))',
    grain: 'repeating-linear-gradient(135deg, transparent 0 18px, rgba(121,205,194,0.012) 19px)',
  },
};

export const themes: Theme[] = [lanternTheme, duskInkTheme, shanhaiTheme, starAltarTheme];

export function isThemeId(value: unknown): value is ThemeId {
  return themes.some(theme => theme.id === value);
}

export function getThemeById(id: string): Theme {
  return themes.find(theme => theme.id === id) ?? lanternTheme;
}

export function getDefaultTheme(): Theme {
  return lanternTheme;
}
