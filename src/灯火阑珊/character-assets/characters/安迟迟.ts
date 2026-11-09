import type { CharacterAssetConfig, CharacterImagePool } from '../types';
import { buildCharacterImageUrls } from '../image-url';

// 按最新图片URL/安迟迟.yaml 的正反面分组和顺序维护，使用 mingli 来源。
const FRONT_IMAGE_IDS = [
  12, 11, 10, 5, 6, 7, 8, 4, 2, 1, 94, 92, 91, 90, 89, 87, 86, 83, 81, 82, 72, 71, 74, 70, 68, 63, 60, 62, 57, 55, 52,
  51, 50, 49, 47, 46, 45, 42, 36, 35, 34, 29, 28, 24, 25, 26, 17, 14, 21, 33,
] as const;

const BACK_IMAGE_IDS = [
  9, 3, 98, 97, 96, 95, 93, 88, 84, 85, 80, 79, 77, 78, 75, 73, 69, 67, 66, 65, 64, 59, 61, 58, 56, 54, 48, 43, 44, 41,
  40, 39, 38, 37, 32, 31, 30, 27, 23, 22, 20, 19, 15, 16, 18, 13,
] as const;

export const assets = {
  // 随机选择正面和背面图片
  normal: {
    front: 'random_front', // 特殊标记，表示从正面图片池中随机选择
    back: 'random_back', // 特殊标记，表示从背面图片池中随机选择
  },
} satisfies CharacterAssetConfig;

export const imagePool = {
  front: buildCharacterImageUrls('安迟迟', FRONT_IMAGE_IDS, 'mingli'),
  back: buildCharacterImageUrls('安迟迟', BACK_IMAGE_IDS, 'mingli'),
} satisfies CharacterImagePool;
