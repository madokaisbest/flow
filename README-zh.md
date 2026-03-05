<h1 align="center"><a href="https://flowoss.com">Flow - 免费开源软件 (OSS)</a></h1>

<h2 align="center">重新定义 ePub 阅读器</h2>

<p align="center">免费。开源。基于浏览器。</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

<p align="center"><img src="apps/website/public/screenshots/01.webp"/></p>

## 特性

- 网格布局
- 书内搜索
- 图片预览
- 自定义排版
- 高亮与批注
- 主题切换
- 通过链接分享/下载书籍
- 数据导出
- 云端存储同步
- **云端预览模式**: 无需下载全量 ePub 文件即可展示完整书架。随点随下，结合毫秒级生成的纯 SVG 极简封面。

有关计划中的功能，请参阅我们的[路线图](https://pacexy.notion.site/283696d0071c43bfb03652e8e5f47936?v=b43f4dd7a3cb4ce785d6c32b698a8ff5)。

## 开发

### 环境要求

- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io/installation)
- [Git](https://git-scm.com/downloads)

### 本地开发

克隆仓库：
```bash
git clone https://github.com/pacexy/flow
```

安装依赖：
```bash
pnpm i
```

配置环境变量：
复制所有 `.env.local.example` 文件重命名为 `.env.local`，并配置所需的环境变量。

运行项目：
```bash
pnpm dev
```

## 云端部署

### Cloudflare Pages

`apps/reader` 前端已经过改造，完全支持静态托管，您可以直接将其部署至 **Cloudflare Pages**。

1. 在 Cloudflare Pages 中连接您的 GitHub/GitLab 仓库。
2. 在 **构建设置 (Build settings)** 中进行如下配置：
   - **框架预设 (Framework preset)**: `Next.js (Static HTML Export)`
   - **构建命令 (Build command)**: `pnpm run build --filter @flow/reader`
   - **构建输出目录 (Build output directory)**: `apps/reader/out`
   - **根目录 (Root directory)**: `/`
3. 点击“保存并部署”。

> **注意：** 阅读器目前是一个纯静态页面。对于 WebDAV 数据同步，您在构建阶段**不需要**配置任何相关的环境变量。而是要在部署成功后，在浏览器中打开阅读器的设置页面，直接在页面上填写您的 WebDAV 配置或代理 Worker URL。

### WebDAV Proxy 代理 (Cloudflare Worker)

如果您需要安全地直连到外部 WebDAV 服务器，并希望绕过浏览器的跨域 (CORS) 限制（特别是当前端由静态云服务托管时），建议通过 GitHub 集成自动部署对应的 Cloudflare Worker 代理进行流量无缝转发。

#### 借助 GitHub 自动构建的部署步骤：
1. 登录 Cloudflare 控制台，进入 **Workers & Pages** 面板，点击 **创建应用程序** -> **Worker**。
2. 将您的 Worker 代码库连接至 GitHub 仓库分支进行自动构建。
3. 在 **构建配置** 中进行如下设置：
   - **根目录 (Root directory)**: `apps/webdav-proxy`
   - **构建命令 (Build command)**: *(留空)*
   - **部署命令 (Deploy command)**: `npx wrangler deploy`
4. ⚠️ **最关键的一步配置环境变量**：在同一页面下方的 **“变量和机密 (Variables and secrets)”** 区域，**不要**选择纯文本类型。请点击添加并选择类型为 **机密 (Secret)** 添加以下两项配置：
   - 机密名称: `WEBDAV_URL`，值: 填入您后端云盘的实际地址，例如 `https://ena.teracloud.jp/dav/`
   - 机密名称: `WEBDAV_DIR`，值: 可选填入您储存书籍的初始路径，例如 `/books`
5. 点击保存并执行首次部署 **(Save and Deploy)**。
6. 最后，在浏览器中打开 Flow 阅读器前端页面，前往 **Settings (设置) > WebDAV Sync**。
   填入您刚刚部署完成的 Worker 域名（例如 `https://webdav-proxy.xxxx.workers.dev`）以及原始云盘帐号密码即可。

## 参与贡献

有很多方式可以参与此项目，例如：

- [提交 bug 或特性请求](https://github.com/pacexy/flow/issues/new)，并在修复提交后协助测试验证
- [提交 Pull Requests 代码](https://github.com/pacexy/flow/pulls)

## 致谢鸣谢

- [Epub.js](https://github.com/futurepress/epub.js/)
- [React](https://github.com/facebook/react)
- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org)
- [Vercel](https://vercel.com)
- [Turborepo](https://turbo.build/repo)
