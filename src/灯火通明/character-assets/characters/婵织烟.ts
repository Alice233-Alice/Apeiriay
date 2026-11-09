import type { CharacterAssetConfig, CharacterImagePool } from '../types';
import { buildCharacterImageUrls } from '../image-url';

// 来源：灯火阑珊-世界书/图片URL/婵织烟.yaml，保留原有正反面分组和顺序。
const FRONT_IMAGE_IDS = [
  67, 70, 69, 68, 66, 64, 63, 47, 45, 43, 41, 38, 37, 36, 32, 33, 34, 35, 28, 29, 50, 49, 22, 23, 12, 15, 13, 18, 19,
  26, 30, 31, 11, 10, 80, 79, 78, 77, 75, 76, 74, 73, 4, 7, 6, 72, 1, 9, 2, 3, 88, 87,
] as const;

const BACK_IMAGE_IDS = [
  39, 38, 71, 65, 61, 60, 62, 58, 59, 57, 56, 54, 53, 52, 51, 27, 20, 16, 14, 5, 90, 82, 83, 84, 85, 89, 86,
] as const;

export const assets = {
  normal: {
    front: 'random_front',
    back: 'random_back',
  },
} satisfies CharacterAssetConfig;

export const imagePool = {
  front: buildCharacterImageUrls('婵织烟', FRONT_IMAGE_IDS, 'mingli'),
  back: buildCharacterImageUrls('婵织烟', BACK_IMAGE_IDS, 'mingli'),
} satisfies CharacterImagePool;
