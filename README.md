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
