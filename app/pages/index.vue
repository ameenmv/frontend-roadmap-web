<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { LEVELS, WEEKS, resolveWeek, weekHref } from '~/data/weeks'
import { T_END, T_START, createRoad, stationT, type Road } from '~/three/road'

const { done, track, load, toggle, setTrack } = useJourney()

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const scroller = ref<HTMLElement>()
const hero = ref<HTMLElement>()
const card = ref<HTMLElement>()
const finale = ref<HTMLElement>()

const mode = ref<'loading' | '3d' | 'flat'>('loading')
const index = ref(0)
const started = ref(false)
const ended = ref(false)

const weeks = computed(() => WEEKS.map((w) => resolveWeek(w, track.value)))
const week = computed(() => weeks.value[index.value]!)
const level = computed(() => LEVELS[week.value.level])
const percent = computed(() => Math.round((done.value.length / WEEKS.length) * 100))
const isDone = (n: number) => done.value.includes(n)

let road: Road | undefined
let lenis: Lenis | undefined
let ctx: gsap.Context | undefined
let tick: ((time: number) => void) | undefined

const scrollToWeek = (i: number) => {
  const el = scroller.value
  if (!el) return
  const max = el.offsetHeight - window.innerHeight
  const y = el.offsetTop + stationT(clampIdx(i), WEEKS.length) * max
  if (lenis) lenis.scrollTo(y, { duration: 1.4 })
  else window.scrollTo({ top: y, behavior: 'smooth' })
}
const clampIdx = (i: number) => Math.max(0, Math.min(WEEKS.length - 1, i))

const onKey = (e: KeyboardEvent) => {
  if (mode.value !== '3d' || e.metaKey || e.ctrlKey || e.altKey) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    scrollToWeek(started.value ? index.value + 1 : 0)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    scrollToWeek(index.value - 1)
  }
}

const webglOk = () => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

onMounted(async () => {
  load()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || !webglOk()) {
    mode.value = 'flat'
    return
  }
  mode.value = '3d'
  await nextTick()

  gsap.registerPlugin(ScrollTrigger, SplitText)

  const nav = navigator as Navigator & { deviceMemory?: number }
  const low = window.innerWidth < 768 || (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4

  road = createRoad(
    canvas.value!,
    WEEKS.map((w) => {
      const r = resolveWeek(w, track.value)
      return { n: w.n, color: LEVELS[w.level].color, label: r.short, project: w.project }
    }),
    { quality: low ? 'low' : 'high' },
  )

  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
  lenis.on('scroll', ScrollTrigger.update)
  tick = (time: number) => lenis!.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  ctx = gsap.context(() => {
    const split = SplitText.create('.hero-title', { type: 'chars', mask: 'chars' })
    gsap
      .timeline({ defaults: { ease: 'power4.out' } })
      .from(split.chars, { yPercent: 115, duration: 1.1, stagger: 0.028 }, 0.25)
      .from('.hero-fade', { autoAlpha: 0, y: 18, duration: 0.9, stagger: 0.12 }, 0.7)
      .from('.hud-in', { autoAlpha: 0, duration: 1 }, 1)

    gsap.to('.scroll-cue', { y: 10, repeat: -1, yoyo: true, duration: 0.9, ease: 'sine.inOut' })

    ScrollTrigger.create({
      trigger: scroller.value,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate(self) {
        const p = self.progress
        road?.setProgress(p)
        const i = Math.round(((p - T_START) / (T_END - T_START)) * (WEEKS.length - 1))
        index.value = clampIdx(i)
        started.value = p > 0.022
        ended.value = p > 0.978
        gsap.set(hero.value!, { autoAlpha: 1 - gsap.utils.clamp(0, 1, p / 0.03), scale: 1 + p * 6, yPercent: -p * 400 })
      },
    })
  }, root.value)

  window.addEventListener('keydown', onKey)
})

// Swap the card content with a short stagger each time the nearest week changes.
watch([index, track], () => {
  if (!card.value || mode.value !== '3d') return
  gsap.fromTo(card.value.querySelectorAll('.swap'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.05, ease: 'power3.out', overwrite: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (tick) gsap.ticker.remove(tick)
  ctx?.revert()
  lenis?.destroy()
  road?.dispose()
})
</script>

<template>
  <div ref="root" :style="{ '--level': level.color }">
    <!-- ================= 3D journey ================= -->
    <template v-if="mode !== 'flat'">
      <canvas ref="canvas" class="fixed inset-0 h-dvh w-full" aria-hidden="true" />
      <div class="scanline pointer-events-none fixed inset-0" aria-hidden="true" />

      <!-- top bar -->
      <header class="hud-in fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#top" class="font-mono text-xs tracking-[0.2em] uppercase" @click.prevent="scrollToWeek(0)">
          <span class="level-text">CIS</span> · Frontend <span class="hidden sm:inline">Roadmap</span> 26/27
        </a>

        <p class="hud-glass level-text hidden rounded-full px-4 py-1.5 font-mono text-[0.7rem] tracking-[0.18em] uppercase transition-colors md:block">
          {{ level.name }} · {{ level.range }}
        </p>

        <div class="flex items-center gap-2">
          <div class="hud-glass flex rounded-full p-0.5 font-mono text-[0.7rem] uppercase" role="group" aria-label="Level 3 track">
            <button
              v-for="t in (['react', 'vue'] as const)"
              :key="t"
              class="rounded-full px-3 py-1 transition-colors"
              :class="track === t ? 'bg-(--level) text-void' : 'text-mute hover:text-ink'"
              :aria-pressed="track === t"
              @click="setTrack(t)"
            >
              {{ t }}
            </button>
          </div>
          <p class="hud-glass rounded-full px-3 py-1.5 font-mono text-[0.7rem]" :title="`${done.length} of ${WEEKS.length} weeks done`">
            <span class="level-text">{{ percent }}%</span>
          </p>
        </div>
      </header>

      <!-- hero -->
      <section id="top" ref="hero" class="pointer-events-none fixed inset-0 z-20 grid place-items-center px-6 text-center">
        <div>
          <p class="hero-fade font-mono text-xs tracking-[0.35em] text-mute uppercase">CIS Team · 2026—2027</p>
          <h1 class="hero-title font-display mt-4 text-[clamp(3rem,11vw,10rem)] leading-[0.9] font-extrabold tracking-tight">
            Frontend<br /><span class="level-text">Roadmap</span>
          </h1>
          <p class="hero-fade mx-auto mt-6 max-w-md text-base text-mute sm:text-lg">
            31 weeks. From your first <code class="font-mono text-ink">&lt;div&gt;</code> to a live app.
          </p>
          <p class="hero-fade scroll-cue mt-10 font-mono text-xs tracking-[0.3em] uppercase">Scroll to start ↓</p>
        </div>
      </section>

      <!-- week card -->
      <aside
        ref="card"
        class="hud-glass fixed inset-x-3 bottom-3 z-30 rounded-2xl p-4 transition-[opacity,translate] duration-500 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[26rem] sm:p-5"
        :class="started && !ended ? 'opacity-100' : 'pointer-events-none translate-y-4 opacity-0'"
        aria-live="polite"
      >
        <p class="swap level-text font-mono text-[0.7rem] tracking-[0.2em] uppercase">
          Week {{ String(week.n).padStart(2, '0') }} <span class="text-mute">/ 30</span>
          <span v-if="week.project" class="ml-2 rounded bg-(--level) px-1.5 py-0.5 text-void">Milestone</span>
        </p>
        <h2 class="swap font-display mt-1.5 text-2xl leading-tight font-extrabold sm:text-[1.7rem]">{{ week.title }}</h2>
        <p class="swap mt-2 text-sm text-mute"><span class="text-ink">You ship:</span> {{ week.ship }}</p>
        <div class="swap mt-4 flex flex-wrap items-center gap-2">
          <a
            :href="weekHref(week.n, track)"
            target="_blank"
            rel="noopener"
            class="rounded-full bg-(--level) px-4 py-2 text-sm font-bold text-void transition-transform hover:scale-[1.03] active:scale-95"
          >
            Open week →
          </a>
          <button
            class="rounded-full border px-4 py-2 text-sm font-bold transition-colors"
            :class="isDone(week.n) ? 'border-(--level) text-(--level)' : 'border-white/15 text-mute hover:text-ink'"
            :aria-pressed="isDone(week.n)"
            @click="toggle(week.n)"
          >
            {{ isDone(week.n) ? '✓ Done' : 'Mark done' }}
          </button>
          <span class="ml-auto hidden font-mono text-[0.65rem] text-mute sm:inline">← → to travel</span>
        </div>
      </aside>

      <!-- week rail -->
      <nav class="hud-in fixed top-1/2 right-2 z-30 hidden -translate-y-1/2 flex-col gap-[3px] sm:right-4 md:flex" aria-label="Weeks">
        <button
          v-for="(w, i) in weeks"
          :key="w.n"
          class="group relative flex h-[14px] items-center justify-end"
          :aria-label="`Week ${w.n}: ${w.title}`"
          :aria-current="i === index && started ? 'step' : undefined"
          @click="scrollToWeek(i)"
        >
          <span
            class="pointer-events-none absolute right-8 rounded bg-void/80 px-2 py-0.5 font-mono text-[0.65rem] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {{ String(w.n).padStart(2, '0') }} · {{ w.title }}
          </span>
          <span
            class="block h-[3px] rounded-full transition-all duration-300"
            :class="[i === index && started ? 'w-7' : w.project ? 'w-4' : 'w-2.5', 'group-hover:w-7']"
            :style="{ background: LEVELS[w.level].color, opacity: i === index && started ? 1 : isDone(w.n) ? 0.9 : 0.35 }"
          />
        </button>
      </nav>

      <!-- finale -->
      <section
        ref="finale"
        class="fixed inset-0 z-20 grid place-items-center px-6 text-center transition-opacity duration-700"
        :class="ended ? 'opacity-100' : 'pointer-events-none opacity-0'"
      >
        <div>
          <p class="font-mono text-xs tracking-[0.35em] text-mute uppercase">End of the road</p>
          <h2 class="font-display mt-4 text-[clamp(2.5rem,8vw,7rem)] leading-[0.92] font-extrabold">
            Now go<br /><span class="level-text">build it.</span>
          </h2>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <button class="rounded-full bg-(--level) px-6 py-3 font-bold text-void transition-transform hover:scale-[1.03]" @click="scrollToWeek(0)">Start at Week 0</button>
            <a
              href="https://github.com/ameenmv/frontend-roadmap-2026-2027"
              target="_blank"
              rel="noopener"
              class="rounded-full border border-white/20 px-6 py-3 font-bold transition-colors hover:border-(--level)"
            >
              Read on GitHub
            </a>
          </div>
        </div>
      </section>

      <!-- scroll distance that drives the camera -->
      <div ref="scroller" :style="{ height: `${WEEKS.length * 78 + 160}vh` }" />
    </template>

    <!-- ================= flat fallback (reduced motion / no WebGL) ================= -->
    <main v-else class="mx-auto max-w-5xl px-5 py-16">
      <p class="font-mono text-xs tracking-[0.3em] text-mute uppercase">CIS Team · 2026—2027</p>
      <h1 class="font-display mt-3 text-5xl font-extrabold sm:text-7xl">Frontend <span class="text-beginner">Roadmap</span></h1>
      <p class="mt-4 max-w-xl text-mute">31 weeks. From your first <code class="font-mono text-ink">&lt;div&gt;</code> to a live app.</p>

      <section v-for="lv in Object.values(LEVELS)" :key="lv.id" class="mt-12" :style="{ '--level': lv.color }">
        <h2 class="level-text font-mono text-sm tracking-[0.2em] uppercase">{{ lv.name }} · {{ lv.range }}</h2>
        <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="w in weeks.filter((x) => x.level === lv.id)" :key="w.n">
            <a :href="weekHref(w.n, track)" target="_blank" rel="noopener" class="hud-glass block h-full rounded-xl p-4 transition-colors hover:border-(--level)">
              <span class="level-text font-mono text-xs">Week {{ String(w.n).padStart(2, '0') }}</span>
              <span class="font-display mt-1 block text-lg leading-snug font-extrabold">{{ w.title }}</span>
              <span class="mt-1 block text-sm text-mute">{{ w.ship }}</span>
            </a>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
