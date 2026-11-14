import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        'gsap', 'gsap/ScrollTrigger', 'gsap/SplitText', 'lenis', 'three',
        'three/addons/loaders/FontLoader.js',
        'three/addons/geometries/TextGeometry.js',
      ],
    },
  },
  app: {
    pageTransition: { name: 'wipe', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Frontend Roadmap · CIS Team 2026-2027',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '31 weeks from your first <div> to a live app. A week-by-week frontend roadmap by CIS Team.' },
        { name: 'theme-color', content: '#ff5a1f' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;700;800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap' },
      ],
    },
  },
})
