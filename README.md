# Frontend Roadmap · Web

The interactive 3D version of the [CIS Team Frontend Roadmap 2026-2027](https://github.com/ameenmv/frontend-roadmap-2026-2027).

Scroll to drive the road: 31 weeks, each one a road sign. Every week has its own page.

## Stack

Nuxt 4 · Vue 3 · Bun · Tailwind CSS v4 · GSAP (ScrollTrigger, SplitText) · Lenis · Three.js

## Run

```bash
bun install
bun run dev
```

## Notes

- Progress and the React / Vue choice are saved in the browser (localStorage).
- Low-end devices and phones get a lighter scene.
- Week pages are generated from the roadmap markdown: `bun run content` (expects the roadmap repo next to this one).
- The 3D numerals use the Helvetiker typeface that ships with three.js examples.
- With `prefers-reduced-motion` or no WebGL, the site shows a flat list of weeks instead.
