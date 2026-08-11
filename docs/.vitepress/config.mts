import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'

export default defineConfig({
  title: '@klappay/node',
  description:
    'Official Node.js SDK for the Klap Core API — charges, webhooks, metrics, sandbox testing',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'force-dark',
  head: [['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }]],

  vite: {
    plugins: [llmstxt({ domain: 'https://node-sdk.klappay.com' })],
  },

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting started', link: '/getting-started' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@klappay/node' },
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
        ],
      },
      {
        text: 'Resources',
        items: [
          { text: 'Charges', link: '/charges' },
          { text: 'Webhooks', link: '/webhooks' },
          { text: 'Metrics', link: '/metrics' },
          { text: 'Distributions', link: '/distributions' },
          { text: 'Networks', link: '/networks' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Sandbox testing', link: '/sandbox-testing' },
          { text: 'Errors', link: '/errors' },
          { text: 'Tree-shaking', link: '/tree-shaking' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/klappay/klap-node' }],

    footer: {
      message: 'Docs live in ./docs — the source of truth for both the package and this site.',
      copyright: 'MIT — Klappay',
    },
  },
})
