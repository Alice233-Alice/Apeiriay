/** Single expression image configuration. */
export interface ExpressionImages {
  /** Front image URL. */
  front: string;
  /** Back image URL. Falls back to front when omitted. */
  back?: string;
}

export type CharacterAssetConfig = Record<string, ExpressionImages | string>;
export type CharacterAssets = Record<string, CharacterAssetConfig>;

export interface CharacterImagePool {
  front: string[];
  back: string[];
}

export interface DualSoulImagePool {
  虞汐_front: string[];
  虞汐_back: string[];
  虞颜_front: string[];
  虞颜_back: string[];
}

export type CharacterImagePoolConfig = CharacterImagePool | DualSoulImagePool;
export type CharacterImagePools = Record<string, CharacterImagePoolConfig>;
