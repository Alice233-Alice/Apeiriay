# 添加角色立绘

在 `characters/角色名.ts` 中编辑 `FRONT_IMAGE_IDS`（正面）或 `BACK_IMAGE_IDS`（背面）。虞汐颜使用各魂体对应的数组。

## 同一个图片池混用两个存储桶

原有数字和文件名继续使用旧桶的 `picgo` 目录。新图片可以直接粘贴完整 URL，也可以用 `{ source: 'mingli', file: '文件名' }`
省略第二个桶的公共前缀，两种写法可以混用：

```ts
const FRONT_IMAGE_IDS = [
  1, // 旧桶：角色名 (1).png
  '历史文件名.png', // 旧桶：保留原文件名
  {
    source: 'mingli',
    file: '22-26-39-798861316946214_部位细化_00001_.png',
  },
  'https://pub-911389cc229e4bac956d6afd361514aa.r2.dev/mingli/22-17-26-418030827486536_部位细化_00001_.png',
] as const;
```

保留数组后的 `as const`，下方原有的 `buildCharacterImageUrls('角色名', FRONT_IMAGE_IDS)`
调用无需调整。示例中的图片请按实际角色及正反面归属添加。

`mingli` 已包含 `/mingli` 目录，`file` 只填写它后面的文件名或子目录路径。使用 URL 中实际的下划线
`_`，不要复制 Markdown 为下划线添加的反斜杠。

## 整组图片使用第二个桶

若某组图片全部来自第二个桶，可以用第三个参数指定默认来源：

```ts
front: buildCharacterImageUrls('角色名', FRONT_IMAGE_IDS, 'mingli'),
```

此时普通文件名和数字编号都使用 `mingli` 前缀；数字仍按 `角色名 (编号).png` 生成文件名。数组中单独指定的 `source`
优先，完整 URL 始终原样使用。

## 以后增加更多来源

在 `image-url.ts` 的 `CHARACTER_IMAGE_BASE_URLS` 中新增一个名称和公共 URL（包含图片目录），即可在 `source`
或第三个参数中使用该名称。直接粘贴其他存储桶的完整 HTTP(S) URL 则无需新增配置。
