<h1 align="center"><a href="https://flowoss.com">Flow - Open Source Software (OSS)</a></h1>

<h2 align="center">Redefine ePub reader</h2>

<p align="center">Free. Open source. Browser-based.</p>

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

## Self-hosting

Before self-hosting, you should [setup the environment variables](#setup-the-environment-variables).

### Docker

You can use docker-compose:

```sh
docker compose up -d
```

Or build the image and run it manually:

```sh
docker build -t flow .
docker run -p 3000:3000 --env-file apps/reader/.env.local flow
```

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

If you need to connect to an external WebDAV server securely and bypass CORS restrictions (especially necessary when hosting the frontend on Cloudflare Pages), you can deploy the included Cloudflare Worker as a proxy.

1. Configure your WebDAV settings in `apps/webdav-proxy/wrangler.toml` (or use `.dev.vars` / Cloudflare Dashboard Secrets):
   ```toml
   [vars]
   WEBDAV_URL = "https://your-backend-webdav.com/"
   WEBDAV_DIR = "/books"
   ```
2. Deploy the worker:
   ```sh
   cd apps/webdav-proxy
   npm install
   npx wrangler deploy
   ```
3. Open the reader app in your browser, go to **Settings > WebDAV Sync**, and enter your deployed worker's URL (e.g., `https://webdav-proxy.<your-user>.workers.dev`), along with any required credentials for the proxy.

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
