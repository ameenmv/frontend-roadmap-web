# Frontend Roadmap · Web

The interactive 3D version of the [CIS Team Frontend Roadmap 2026-2027](https://github.com/ameenmv/frontend-roadmap-2026-2027).

Scroll to fly along the road: 31 weeks, each one a gate.

## Stack

Nuxt 4 · Vue 3 · Bun · Tailwind CSS v4 · GSAP (ScrollTrigger, SplitText) · Lenis · Three.js

## Run

```bash
bun install
bun run dev
```

## Notes

- Progress and the React / Vue choice are saved in the browser (localStorage).
- Low-end devices and phones get a lighter scene (no bloom, fewer particles).
- With `prefers-reduced-motion` or no WebGL, the site shows a flat list of weeks instead.
