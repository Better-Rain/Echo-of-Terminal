# 黑箱档案局

纯前端网页解密游戏原型。当前目标是建立一个可以发布到 GitHub Pages 的制作环境，并提供“内部档案系统 + 安全聊天”的首版美术方向。

## 本地开发

```powershell
npm install
npm run dev
```

## 构建

```powershell
npm run build
```

构建产物会输出到 `dist/`，可以直接部署到 GitHub Pages 或其他静态站点服务。

## GitHub Pages 发布

本项目已包含 `.github/workflows/deploy-pages.yml`。推送到 GitHub 后：

1. 在仓库 Settings -> Pages 中选择 GitHub Actions 作为发布来源。
2. 推送 `main` 分支。
3. Actions 构建成功后，页面会发布到仓库对应的 GitHub Pages 地址。

`vite.config.ts` 使用 `base: './'`，因此项目页路径不需要提前写死仓库名。

## 当前原型范围

- 类内部档案系统界面。
- 档案列表、当前档案、碎片记录、提示区。
- 右侧安全聊天线索区。
- 示例剧情只用于验证美术和交互方向，后续可以替换为正式世界观、角色、谜题和资源。

## 当前代码结构

- `src/domain/types.ts`: 档案、聊天、玩家身份、角色、权限规则等共享类型。
- `src/domain/access.ts`: 访问权限判断逻辑，不依赖 UI。
- `src/data/access.ts`: 角色定义和默认权限能力。
- `src/data/player.ts`: 当前玩家身份、已发现线索和已解谜题。
- `src/data/cases.ts`: 示例档案数据。
- `src/data/chats.ts`: 示例聊天数据。
- `src/main.ts`: 当前三栏界面的渲染层，之后可以替换为桌面式窗口、地图节点或其他结构。

## 访问权限模型

档案、聊天、单条消息和单个档案片段都可以挂载 `AccessRule`。规则目前支持：

- `minClearance`: 最低权限等级，例如 `L2`、`L3`。
- `anyRoles`: 任一身份满足即可，例如档案管理员或局长。
- `allRoles`: 必须同时具备的身份。
- `permissions`: 需要的权限标记，例如读取限制字段。
- `discoveredFlags`: 已发现的剧情线索。
- `solvedPuzzles`: 已解开的谜题。

这个模型是为后续谜题预留的：玩家可以通过聊天、档案推理、密码输入或伪登录等方式获得临时身份、权限标记或线索 flag，从而解锁新的档案字段。
