const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})
const nextTranslate = require('next-translate')
/**
 * @type {import('rehype-pretty-code').Options}
 **/
const opts = {
  theme: {
    dark: 'github-dark',
    light: 'github-light',
  },
  onVisitLine(node) {
    if (node.children.length === 0) {
      node.children = [{ type: 'text', value: ' ' }]
    }
  },
  onVisitHighlightedLine(node) {
    node.properties.className.push('highlighted')
  },
  onVisitHighlightedWord(node) {
    node.properties.className = ['word', 'highlighted']
  },
}

const config = {
  transpilePackages: ['@flow/internal'],
  pageExtensions: ['ts', 'tsx', 'mdx'],
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.mdx?$/, // load both .md and .mdx files
      use: [
        options.defaultLoaders.babel,
        {
          loader: '@mdx-js/loader',
          options: {
            remarkPlugins: [],
            rehypePlugins: [[require('rehype-pretty-code').default, opts]],
            // If you use `MDXProvider`, uncomment the following line.
            providerImportSource: '@mdx-js/react',
          },
        },
        './plugins/mdx',
      ],
    })

    return config
  },
}

module.exports = nextTranslate(withBundleAnalyzer(config))
