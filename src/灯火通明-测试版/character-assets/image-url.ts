/** 图片来源的公共前缀；以后增加存储桶或目录时，在这里新增一项即可。 */
export const CHARACTER_IMAGE_BASE_URLS = {
  picgo: 'https://pub-4d14ab94aa29488b977bc5be9f2a06ef.r2.dev/picgo',
  mingli: 'https://pub-911389cc229e4bac956d6afd361514aa.r2.dev/mingli',
} as const;

export type CharacterImageSource = keyof typeof CHARACTER_IMAGE_BASE_URLS;

export type CharacterImageToken =
  number | string | { readonly source: CharacterImageSource; readonly file: number | string };

/**
 * 数字使用“角色名 (编号).png”；普通字符串作为文件名拼接，完整 HTTP(S) URL 直接使用。
 * 默认沿用 picgo，也可逐张指定来源或用第三个参数设置整组图片的默认来源。
 * 添加示例见同目录 README.md。
 */
export function buildCharacterImageUrls(
  characterName: string,
  tokens: readonly CharacterImageToken[],
  defaultSource: CharacterImageSource = 'picgo',
): string[] {
  return tokens.map(token => {
    const source = typeof token === 'object' ? token.source : defaultSource;
    const file = typeof token === 'object' ? token.file : token;

    // 已有完整地址时保留其域名、路径、编码和查询参数，不再添加公共前缀。
    if (typeof file === 'string' && /^(?:https?:)?\/\//i.test(file)) {
      return file;
    }

    const filename = typeof file === 'number' ? `${characterName} (${file}).png` : file;
    const baseUrl = CHARACTER_IMAGE_BASE_URLS[source].replace(/\/+$/, '');
    return `${baseUrl}/${filename.replace(/^\/+/, '')}`;
  });
}
