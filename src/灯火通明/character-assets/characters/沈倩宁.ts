import type { CharacterAssetConfig, CharacterImagePool } from '../types';
import { buildCharacterImageUrls } from '../image-url';

// 来源：灯火阑珊-世界书/图片URL/沈倩宁.yaml，保留原有正反面分组和顺序。
const FRONT_IMAGE_IDS = [
  7, 8, 9, 10, 12, 11, 15, 16, 17, 21, 22, 20, 23, 24, 25, 26, 28, 27, 31, 32, 34, 36, 35, 46, 45, 44, 43, 48, 49, 50,
  54, 52, 51, 55, 56, 57, 58, 60, 59, 64, 65, 68, 69, 74, 71, 75, 77, 78, 82, 84, 86, 88, 87, 1, 2, 5, 3, 4,
] as const;

const BACK_IMAGE_IDS = [
  14, 23, 13, 6, 85, 83, 81, 80, 79, 73, 72, 70, 67, 66, 63, 62, 61, 53, 41, 40, 42, 39, 38, 33, 30, 29, 19, 18, 47,
] as const;

export const assets = {
  normal: {
    front: 'random_front',
    back: 'random_back',
  },
} satisfies CharacterAssetConfig;

export const imagePool = {
  front: buildCharacterImageUrls('沈倩宁', FRONT_IMAGE_IDS, 'mingli'),
  back: buildCharacterImageUrls('沈倩宁', BACK_IMAGE_IDS, 'mingli'),
} satisfies CharacterImagePool;
