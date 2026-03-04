<h1 align="center"><a href="https://flowoss.com">Flow - Open Source Software (OSS)</a></h1>

<h2 align="center">Redefine ePub reader</h2>

<p align="center">Free. Open source. Browser-based.</p>

<p align="center">
  English | <a href="README-zh.md">简体中文</a>
</p>

<p align="center"><img src="apps/website/public/screenshots/01.webp"/>

</p>

## Features

- Grid layout
- Search in book
- Image preview
- Custom typography
- Highlight and Annotation
- Theme
- Share/Download book with link
- Data export
- Cloud storage

For planed features, see our [roadmap](https://pacexy.notion.site/283696d0071c43bfb03652e8e5f47936?v=b43f4dd7a3cb4ce785d6c32b698a8ff5).

## Development

### Prerequisites

- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io/installation)
- [Git](https://git-scm.com/downloads)

### Clone the repo

```bash
git clone https://github.com/pacexy/flow
```

### Install the dependencies

```bash
pnpm i
```

### Setup the environment variables

Copy and rename all `.env.local.example`s to `.env.local` and setup the environment variables.

### Run the apps

```bash
pnpm dev
```

## Deployment

### Cloudflare Pages

The `apps/reader` frontend has been adapted for static hosting, making it directly deployable to **Cloudflare Pages**.

1. Connect your GitHub/GitLab repository to Cloudflare Pages.
2. Under **Build settings**, configure the following:
   - **Framework preset**: `Next.js (Static HTML Export)`
   - **Build command**: `pnpm run build --filter @flow/reader`
   - **Build output directory**: `apps/reader/out`
   - **Root directory**: `/`
3. Click "Save and Deploy".

> **Note:** The reader app is now a pure static site. For WebDAV syncing, you do not need to configure any environment variables here during build. Instead, you enter your WebDAV credentials (or the URL of your WebDAV Proxy Worker) directly in the reader's settings page in your browser.

### WebDAV Proxy (Cloudflare Worker)

If you need to connect to an external WebDAV server securely and bypass CORS restrictions (especially necessary when hosting the frontend on static hosting services), we recommend using GitHub Integration to deploy the included Cloudflare Worker as a proxy.

#### Deployment via GitHub Auto Build:
1. Log in to your Cloudflare Dashboard, navigate to **Workers & Pages**, and click **Create application** -> **Worker**.
2. Connect your worker to your GitHub repository for automatic builds.
3. Under **Build settings**, configure the following carefully:
   - **Root directory**: `apps/webdav-proxy`
   - **Build command**: *(Leave blank)*
   - **Deploy command**: `npx wrangler deploy`
4. ⚠️ **Crucial Step - Configuring Environment Variables**: Scroll down to the **Variables and secrets** section below. **DO NOT** use Plain Text. Click to add and select **Secret** as the type for these variables:
   - Secret Name: `WEBDAV_URL`, Value: Your backend WebDAV server URL, e.g., `https://example.com/remote.php/webdav/`
   - Secret Name: `WEBDAV_DIR`, Value: The base directory for your books, e.g., `/books`
5. Click **Save and Deploy**.
6. Open the Flow reader app in your browser, go to **Settings > WebDAV Sync**, and enter your newly deployed worker's URL (e.g., `https://webdav-proxy.<your-user>.workers.dev`), along with any required credentials for the proxy.

## Contributing

There are many ways in which you can participate in this project, for example:

- [Submit bugs and feature requests](https://github.com/pacexy/flow/issues/new), and help us verify as they are checked in
- [Submit pull requests](https://github.com/pacexy/flow/pulls)

## Credits

- [Epub.js](https://github.com/futurepress/epub.js/)
- [React](https://github.com/facebook/react)
- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org)
- [Vercel](https://vercel.com)
- [Turborepo](https://turbo.build/repo)
