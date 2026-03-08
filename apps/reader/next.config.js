const path = require('path')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const { withSentryConfig } = require('@sentry/nextjs')
const runtimeCaching = require('next-pwa/cache')
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 365 Days
        },
      },
    },
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 365 Days
        },
      },
    },
    ...runtimeCaching,
  ],
})
const IS_DEV = process.env.NODE_ENV === 'development'
const IS_DOCKER = process.env.DOCKER

const sentryWebpackPluginOptions = {
  silent: true,
}

const config = {
  transpilePackages: [
    '@flow/internal',
    '@flow/epubjs',
    '@material/material-color-utilities',
  ],
  pageExtensions: ['ts', 'tsx'],
  webpack(config) {
    return config
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'export',
  ...(IS_DOCKER && {
    output: 'standalone',
    experimental: {
      outputFileTracingRoot: path.join(__dirname, '../../'),
    },
  }),
}

const base = withPWA(withBundleAnalyzer(config))

const dev = base
const docker = base
const prod = withSentryConfig(
  base,
  sentryWebpackPluginOptions,
)

module.exports = IS_DEV ? dev : IS_DOCKER ? docker : prod
