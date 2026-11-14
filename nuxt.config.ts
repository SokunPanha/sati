// Sati (សតិ) — personal focus & task PWA. Static SPA, all data in IndexedDB.
const FONT_URL
  = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=Kantumruy+Pro:wght@400;500;600;700&display=swap'

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,

  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],

  // No build-time font downloads (works offline); light theme only.
  ui: { fonts: false, colorMode: false },

  // Bundle every icon used in the source into the client so they work offline.
  icon: {
    provider: 'none',
    fallbackToApi: false,
    clientBundle: {
      scan: true,
      // Icons referenced by Nuxt UI internals (not found by the source scan).
      icons: [
        'lucide:x', 'lucide:check', 'lucide:chevron-down', 'lucide:chevron-up', 'lucide:chevron-left',
        'lucide:chevron-right', 'lucide:loader-circle', 'lucide:minus', 'lucide:plus', 'lucide:circle-check',
        'lucide:circle-alert', 'lucide:info', 'lucide:triangle-alert', 'lucide:circle-x'
      ],
      sizeLimitKb: 512
    }
  },

  spaLoadingTemplate: true,

  app: {
    head: {
      title: 'Sati · សតិ',
      htmlAttrs: { lang: 'km' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'ចិត្តស្ងប់ ផ្ដោតលើរឿងម្ដងមួយ · Calm mind. One thing at a time.' },
        { name: 'theme-color', content: '#0E1C1A' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
        { name: 'apple-mobile-web-app-title', content: 'Sati' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon-180.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: FONT_URL }
      ],
      // Catch the browser's install offer as early as possible (it fires once, often before the app's JS
      // has loaded), so the landing page's Install button can open the real install dialog.
      script: [{
        innerHTML: "window.__satiInstall=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__satiInstall=e;dispatchEvent(new Event('sati-install-ready'))});addEventListener('appinstalled',function(){window.__satiInstall=null})"
      }]
    }
  },

  i18n: {
    defaultLocale: 'km',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    locales: [
      { code: 'km', language: 'km-KH', name: 'ខ្មែរ', file: 'km.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
    ]
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/',
      name: 'Sati',
      short_name: 'Sati',
      description: 'ចិត្តស្ងប់ ផ្ដោតលើរឿងម្ដងមួយ · Calm mind. One thing at a time.',
      lang: 'km',
      dir: 'ltr',
      start_url: '/today',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#0E1C1A',
      background_color: '#0E1C1A',
      categories: ['productivity'],
      icons: [
        { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      shortcuts: [
        { name: 'ថ្ងៃនេះ · Today', url: '/today', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] },
        { name: 'ការរំលឹក · Reminders', url: '/reminders', icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }] }
      ]
    },
    // Custom service worker (app/service-worker/sw.ts): precache + offline shell + font caching
    // + the notificationclick handler.
    strategies: 'buildSW',
    filename: 'sw.js',
    buildSW: {
      swSrc: 'app/service-worker/sw.ts',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      globIgnores: ['**/200.html', '**/404.html', '**/_payload.json', '**/landing/**']
    },
    client: { installPrompt: true, periodicSyncForUpdates: 3600 },
    devOptions: { enabled: false }
  }
})
