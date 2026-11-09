# 美化状态栏 - 动态角色图鉴功能

本功能允许你根据 AI 回复中的 `<visual_cards>` 标签，动态显示在场角色的图片卡片。用户可以点击卡片翻转，查看角色的内心独白。

## 目录

1. [快速开始](#快速开始)
2. [配置角色图片](#配置角色图片)
3. [设置世界书](#设置世界书)
4. [工作原理](#工作原理)
5. [常见问题](#常见问题)

---

## 快速开始

### 第一步：配置角色图片资源

编辑 `character-assets.ts` 文件，为每个角色配置图片 URL：

```typescript
export const CHARACTER_ASSETS: Record<string, Record<string, string>> = {
  // 角色名必须与世界书中的名称完全一致
  孟十七: {
    normal: 'https://your-image-host.com/mengshiqi_normal.jpg',
    shy: 'https://your-image-host.com/mengshiqi_shy.jpg',
    smile: 'https://your-image-host.com/mengshiqi_smile.jpg',
    angry: 'https://your-image-host.com/mengshiqi_angry.jpg',
    cry: 'https://your-image-host.com/mengshiqi_cry.jpg',
    surprise: 'https://your-image-host.com/mengshiqi_surprise.jpg',
  },
  
  // 添加更多角色...
  角色名2: {
    normal: 'https://...',
    happy: 'https://...',
  },
};
```

### 第二步：设置世界书

在酒馆的世界书中创建一个新条目，将 `世界书模板/visual-cards-system.yaml` 的内容复制进去。

**重要**：确保世界书中的角色名和可用的 img_code 与 `character-assets.ts` 保持一致。

### 第三步：构建并部署

```bash
pnpm build
```

将生成的 `dist/美化状态栏/index.html` 上传到你的 GitHub 仓库，通过 jsDelivr 引用。

---

## 配置角色图片

### 图片托管建议

推荐使用以下图片托管服务：
- [Catbox](https://catbox.moe/) - 免费、稳定
- [ImgBB](https://imgbb.com/) - 免费
- GitHub 仓库 + jsDelivr CDN

### 图片格式建议

- **尺寸**: 建议 400x600 像素（2:3 比例）
- **格式**: JPG 或 WebP（较小文件体积）
- **大小**: 每张图片控制在 500KB 以内

### 表情代号命名规范

建议使用统一的表情代号命名：

| 代号 | 含义 | 适用场景 |
|------|------|----------|
| `normal` | 日常/平静 | 默认状态 |
| `smile` | 微笑/开心 | 高兴时 |
| `shy` | 害羞/脸红 | 害羞时 |
| `angry` | 生气/愤怒 | 生气时 |
| `cry` | 哭泣/委屈 | 难过时 |
| `surprise` | 惊讶/震惊 | 惊讶时 |
| `think` | 思考/沉思 | 思考时 |
| `blush` | 脸红/心动 | 心动时 |

你可以根据需要自定义表情代号，只需保持前端配置和世界书一致即可。

---

## 设置世界书

### 推荐的世界书结构

```
世界书/
├── [System] Visual Cards Protocol    # 卡片输出规则（常驻激活）
├── [角色] 孟十七 - 基础信息          # 角色基础设定
├── [角色] 孟十七 - 图片资源          # 该角色的可用表情列表
└── ... 其他角色
```

### 角色图片资源条目示例

```yaml
# 条目名称: [角色] 孟十七 - 图片资源
# 触发关键词: 孟十七

---
角色名: 孟十七
可用表情:
  - normal: 日常的平静表情，眼神温和
  - shy: 脸颊微红，眼神躲闪，略显局促
  - smile: 嘴角上扬，眼睛弯成月牙，很开心的样子
  - angry: 嘟着嘴，眉头微皱，有些不满
  - cry: 眼眶泛红，泪珠欲落，楚楚可怜
  - surprise: 眼睛睁大，嘴巴微张，一脸惊讶
```

这样 AI 可以参考描述选择最合适的表情。

---

## 工作原理

### 数据流

```
AI 回复 → 包含 <visual_cards> 标签
    ↓
前端 store.ts 解析 JSON 数据
    ↓
通过 character-assets.ts 获取图片 URL
    ↓
渲染到图鉴面板
```

### 解析逻辑

前端会从当前消息楼层中提取 `<visual_cards>` 标签内的 JSON：

```typescript
// 匹配 <visual_cards>...</visual_cards>
const match = content.match(/<visual_cards>\s*([\s\S]*?)\s*<\/visual_cards>/);
const cards = JSON.parse(match[1]);
```

### 图片映射

根据角色名和表情代号查找对应的图片 URL：

```typescript
const image = CHARACTER_ASSETS[角色名][img_code];
```

---

## 常见问题

### Q: 图片不显示怎么办？

1. 检查 `character-assets.ts` 中的角色名是否与 AI 输出的 `name` 完全一致
2. 检查图片 URL 是否可访问
3. 检查 img_code 是否在该角色的配置中存在

### Q: 点击标签页没反应？

确保使用了最新构建的代码。之前版本使用 `useLocalStorage` 可能在 iframe 中失效，现已改为普通 `ref`。

### Q: 如何添加新角色？

1. 在 `character-assets.ts` 中添加角色配置
2. 在世界书中添加该角色的可用表情列表
3. 重新构建并部署

### Q: AI 尝试更新只读字段导致错误？

**错误提示**：`Path 'xxx' does not exist in stat_data, skipping set command`

**原因**：某些字段（如 `本尊.状态`、`本尊.境界描述`、`本尊.进度` 等）是自动计算的衍生字段，不存在于原始数据中，因此无法被直接更新。

**解决方案**：
1. 将 [`世界书模板/mvu-readonly-fields.yaml`](世界书模板/mvu-readonly-fields.yaml) 添加到世界书中
2. 设置为**常驻激活（蓝灯）**
3. AI 会学习到应该更新基础字段而非衍生字段

**只读字段列表**：
- `本尊.突破阈值` - 由等级决定
- `本尊.寿元上限` - 由等级决定
- `本尊.境界描述` - 由等级计算
- `本尊.寿元状态` - 由已活岁月和寿元上限计算
- `本尊.状态` - 由修为、突破阈值和尝试突破状态计算
- `本尊.进度` - 由修为和突破阈值计算

**正确做法**：
- ❌ `{{mvu 本尊.状态=突破中}}`
- ✅ `{{mvu 本尊.尝试突破=true}}`（状态会自动变为"突破中"）

### Q: AI 输出的 JSON 格式错误？

在世界书中添加更明确的格式要求，例如：

```
⚠️ 输出 visual_cards 时请严格遵循以下格式：
- 使用双引号而非单引号
- 每个字段后面需要逗号（最后一个字段除外）
- 角色名使用正确的中文名称
```

### Q: 如何调试？

打开浏览器开发者工具（F12），查看 Console 中的日志：
- `[图鉴] 解析到角色卡片` - 成功解析
- `[图鉴] 未找到角色 "xxx" 的图片配置` - 角色未配置
- `[图鉴] 解析 visual_cards 失败` - JSON 格式错误

---

## 文件结构

```
src/美化状态栏/
├── app.vue                 # 主界面组件
├── store.ts                # 状态管理（包含解析逻辑）
├── schema.ts               # 类型定义
├── character-assets.ts     # ⭐ 角色图片配置（需要编辑）
├── index.html              # 入口 HTML
├── index.ts                # 入口 TypeScript
├── 世界书模板/
│   └── visual-cards-system.yaml  # 世界书条目模板
└── README.md               # 本说明文档
```

---

## 更新日志

### v1.1.0
- 新增动态角色图鉴功能
- 支持从 AI 输出解析 `<visual_cards>` 标签
- 卡片背面显示角色心声文字（而非图片）
- 修复标签页切换在 iframe 中不生效的问题

### v1.0.0
- 初始版本
- 静态图鉴卡片功能