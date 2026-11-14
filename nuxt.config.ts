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
        'three/addons/postprocessing/EffectComposer.js',
        'three/addons/postprocessing/OutputPass.js',
        'three/addons/postprocessing/RenderPass.js',
        'three/addons/postprocessing/UnrealBloomPass.js',
      ],
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Frontend Roadmap · CIS Team 2026-2027',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '31 weeks from your first <div> to a live app. A week-by-week frontend roadmap by CIS Team.' },
        { name: 'theme-color', content: '#05060a' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Manrope:wght@400;500;700&family=Syne:wght@600;800&display=swap' },
      ],
    },
  },
})
